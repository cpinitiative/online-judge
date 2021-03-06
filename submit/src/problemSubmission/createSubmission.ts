import { dbClient } from "../clients";
import { ProblemSubmissionRequestData } from "../types";
import {
  UpdateItemCommand,
  UpdateItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import execute from "../helpers/execute";
import fetchProblemTestCases from "./fetchProblemTestCases";
import compile from "../helpers/compile";
import { compress } from "../helpers/utils";
import problemIDToFileIOName from "./problemIDToFileIOName";

const statusToVerdictMapping: { [key: string]: string } = {
  correct: "AC",
  wrong_answer: "WA",
  runtime_error: "RTE",
  memory_limit_exceeded: "MLE",
  time_limit_exceeded: "TLE",
  compile_error: "CE",
  internal_error: "IE",
};

export default async function createSubmission(
  submissionID: string,
  requestData: ProblemSubmissionRequestData
) {
  try {
    const problemTimeout = 2000; // todo actually properly determine this?

    let [testCases, compiledExecutable] = await Promise.all([
      fetchProblemTestCases(requestData.problemID),
      compile({
        ...requestData,
        compilerOptions: "", // todo. some flags to keep in mind: http://usaco.org/index.php?page=instructions
      }),
    ]);

    if (compiledExecutable.status === "compile_error") {
      await dbClient.send(
        new UpdateItemCommand({
          TableName: "online-judge",
          Key: {
            submissionID: {
              S: submissionID,
            },
          },
          UpdateExpression: `SET #status = :status, verdict = :verdict, message = :message`,
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":status": {
              S: "done",
            },
            ":verdict": {
              S: "CE",
            },
            ":message": {
              B: await compress(compiledExecutable.message),
            },
          },
        })
      );
      return;
    } else if (compiledExecutable.status === "internal_error") {
      await dbClient.send(
        new UpdateItemCommand({
          TableName: "online-judge",
          Key: {
            submissionID: {
              S: submissionID,
            },
          },
          UpdateExpression: `SET #status = :status, verdict = :verdict, message = :message`,
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":status": {
              S: "done",
            },
            ":verdict": {
              S: "IE",
            },
            ":message": {
              B: await compress(compiledExecutable.message),
            },
            ":debugData": {
              B: await compress(
                JSON.stringify(compiledExecutable.debugData ?? null)
              ),
            },
          },
        })
      );
      return;
    }

    await dbClient.send(
      new UpdateItemCommand({
        TableName: "online-judge",
        Key: {
          submissionID: {
            S: submissionID,
          },
        },
        UpdateExpression: `SET #status = :status, testCases = :testCases`,
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": {
            S: "executing",
          },
          ":testCases": {
            M: testCases
              .map((_, i) => i)
              .reduce(
                (acc, cur) => ({
                  ...acc,
                  ["" + cur]: {
                    NULL: true,
                  },
                }),
                {}
              ),
          },
        },
      })
    );

    const fileIOName =
      (problemIDToFileIOName as any)[requestData.problemID] ?? undefined;
    const verdicts = await Promise.all(
      testCases.map(async (testCase, index) => {
        let executeOutput;
        try {
          executeOutput = await execute(
            compiledExecutable.output,
            testCase.input,
            requestData,
            problemTimeout,
            fileIOName
          );
        } catch (e) {
          if (e instanceof Error && e.message.indexOf("EAI_AGAIN") !== -1) {
            // I encounter this DNS error when connected to NordVPN and trying to send
            // many lambda requests at once. As a workaround, when I encounter this error,
            // I just delay it by a certain amount of time.
            console.warn(
              "Encountered EAI_AGAIN error. Usually this happens when connected to VPN. Throttling requests..."
            );
            await new Promise((resolve) => setTimeout(resolve, index * 500));
            executeOutput = await execute(
              compiledExecutable.output,
              testCase.input,
              requestData,
              problemTimeout,
              fileIOName
            );
          } else {
            throw e;
          }
        }
        if (executeOutput.status === "success") {
          // check if AC or WA
          let isCorrect;
          if (fileIOName && executeOutput.fileOutput) {
            isCorrect = validateOutput(
              executeOutput.fileOutput ?? "",
              testCase.expectedOutput
            );
          } else {
            isCorrect = validateOutput(
              executeOutput.stdout ?? "",
              testCase.expectedOutput
            );
          }
          executeOutput.status = isCorrect ? "correct" : "wrong_answer";
        }

        const verdict =
          executeOutput.status in statusToVerdictMapping
            ? statusToVerdictMapping[executeOutput.status]
            : "IE";
        const updateParams: UpdateItemCommandInput = {
          TableName: "online-judge",
          Key: {
            submissionID: {
              S: submissionID,
            },
          },
          UpdateExpression: `SET testCases.#index = :data`,
          ExpressionAttributeNames: {
            "#index": "" + index,
          },
          ExpressionAttributeValues: {
            ":data": {
              M: {
                verdict: {
                  S: verdict,
                },
                time: {
                  S: executeOutput.time ?? "",
                },
                memory: {
                  S: executeOutput.memory ?? "",
                },
                input: {
                  B: await compress(truncate(testCase.input)),
                },
                expectedOutput: {
                  B: await compress(truncate(testCase.expectedOutput)),
                },
                stdout: {
                  B: await compress(truncate(executeOutput.stdout ?? "")),
                },
                stderr: {
                  B: await compress(truncate(executeOutput.stderr ?? "")),
                },
              },
            },
          },
        };

        const dbCommand = new UpdateItemCommand(updateParams);
        await dbClient.send(dbCommand);

        return verdict;
      })
    );

    let finalVerdict = "AC";
    for (let verdict of verdicts) {
      if (verdict !== "AC") {
        finalVerdict = verdict;
        break;
      }
    }

    await dbClient.send(
      new UpdateItemCommand({
        TableName: "online-judge",
        Key: {
          submissionID: {
            S: submissionID,
          },
        },
        UpdateExpression: `SET verdict = :verdict, #status = :status`,
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":verdict": {
            S: finalVerdict,
          },
          ":status": {
            S: "done",
          },
        },
      })
    );
  } catch (e) {
    console.error(e);

    await dbClient.send(
      new UpdateItemCommand({
        TableName: "online-judge",
        Key: {
          submissionID: {
            S: submissionID,
          },
        },
        UpdateExpression: `SET verdict = :verdict, #status = :status, message = :message, debugData = :debugData`,
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":verdict": {
            S: "IE",
          },
          ":status": {
            S: "done",
          },
          ":message": {
            B: await compress("An unknown internal error occurred."),
          },
          ":debugData": {
            B: await compress((e as Error).message ?? e),
          },
        },
      })
    );
  }
}

// truncates given string to 4kb. used for input/expected output/etc for problem submission test case result
// actually, for now, it just returns nothing if > 4kb, becuase for such large test cases
// people probably wouldn't benefit from it anyway.
function truncate(data: string) {
  if (data.length > 1024 * 4) return "[Truncated]";
  return data;
}

function validateOutput(given: string, expected: string) {
  // todo trim every line?
  return given.trim() === expected.trim();
}
