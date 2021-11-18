import { dbClient, s3Client } from "../clients";
import { ProblemSubmissionRequestData } from "../types";
import {
  PutItemCommand,
  UpdateItemCommand,
  UpdateItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import { ListObjectsCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import execute from "../helpers/execute";
import fetchProblemTestCases from "./fetchProblemTestCases";
import compile from "../helpers/compile";
const crypto = require("crypto");

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
  const problemTimeout = 2000; // todo actually properly determine this?

  let [testCases, compiledExecutable] = await Promise.all([
    fetchProblemTestCases(requestData.problemID),
    compile({
      ...requestData,
      compilerOptions: "", // todo. some flags to keep in mind: http://usaco.org/index.php?page=instructions
    }),
  ]);

  if (compiledExecutable.status === "compile_error") {
    // todo handle compilation failure
    return;
  } else if (compiledExecutable.status === "internal_error") {
    // todo handle internal error
    return;
  }

  const verdicts = await Promise.all(
    testCases.map(async (testCase, index) => {
      const executeOutput = await execute(
        compiledExecutable.output,
        testCase.input,
        requestData,
        problemTimeout
      );
      if (executeOutput.status === "success") {
        // check if AC or WA
        let isCorrect = validateOutput(
          executeOutput.stdout ?? "",
          testCase.expectedOutput
        );
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
        UpdateExpression: `SET testCases[${index}] = :data`,
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
                S: truncate(testCase.input),
              },
              expectedOutput: {
                S: truncate(testCase.expectedOutput),
              },
              stdout: {
                S: truncate(executeOutput.stdout ?? ""),
              },
              stderr: {
                S: truncate(executeOutput.stderr ?? ""),
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

  const updateParams: UpdateItemCommandInput = {
    TableName: "online-judge",
    Key: {
      submissionID: {
        S: submissionID,
      },
    },
    UpdateExpression: `SET verdict = :verdict`,
    ExpressionAttributeValues: {
      ":verdict": {
        S: finalVerdict,
      },
    },
  };

  const dbCommand = new UpdateItemCommand(updateParams);
  await dbClient.send(dbCommand);
}

// truncates given string to 4kb. used for input/expected output/etc for problem submission test case result
function truncate(data: string) {
  return data.substring(0, Math.min(data.length, 1024 * 4));
}

function validateOutput(given: string, expected: string) {
  // todo trim every line?
  return given.trim() === expected.trim();
}
