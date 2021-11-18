import { v4 as uuidv4 } from "uuid";
import type {
  APIGatewayProxyEvent,
  APIGatewayEventRequestContext,
  APIGatewayProxyCallback,
} from "aws-lambda";
import execute from "./helpers/execute";
import getSubmission from "./problemSubmission/getSubmission";
import createSubmission from "./problemSubmission/createSubmission";
import { buildResponse, compress, decompress } from "./helpers/utils";
import compile from "./helpers/compile";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { dbClient } from "./clients";
import {
  ExecutionVerdict,
  ProblemSubmissionRequestData,
  ProblemSubmissionResult,
  ProblemSubmissionTestCaseResult,
} from "./types";

// todo: make idempotent?
export const lambdaHandler = (
  event: APIGatewayProxyEvent,
  context: APIGatewayEventRequestContext | null, // null for testing
  callback: APIGatewayProxyCallback
) => {
  const requestData = JSON.parse(event.body || "{}");

  // todo validate with zod?

  switch (event.httpMethod + " " + event.resource) {
    case "POST /submissions":
      // todo validate structure of body?
      const submissionID = uuidv4();

      compress(requestData.sourceCode)
        .then((compressedSourceCode) => {
          const dbCommand = new PutItemCommand({
            TableName: "online-judge",
            Item: {
              submissionID: {
                S: submissionID,
              },
              status: {
                S: "compiling",
              },
              testCases: {
                L: [],
              },
              problemID: {
                S: requestData.problemID,
              },
              language: {
                S: requestData.language,
              },
              filename: {
                S: requestData.filename,
              },
              sourceCode: {
                B: compressedSourceCode,
              },
            },
          });
          return dbClient.send(dbCommand);
        })
        .then(() => {
          const promise = createSubmission(submissionID, requestData);

          callback(
            null,
            buildResponse({
              submissionID,
            })
          );

          return promise;
        })
        .catch((e) => {
          callback(e);
        });

      break;

    case "POST /execute":
      // todo validate more stuff?
      if (!requestData.language) {
        callback(
          null,
          buildResponse(
            {
              message: "Unknown language.",
            },
            { statusCode: 400 }
          )
        );
      } else {
        compile(requestData)
          .then((compiled) => {
            if (
              compiled.status === "internal_error" ||
              compiled.status === "compile_error"
            ) {
              return compiled;
            }
            return execute(compiled.output, requestData.input, requestData);
          })
          .then((result) => {
            if (result.status === "internal_error") {
              callback(null, buildResponse(result, { statusCode: 500 }));
            } else {
              callback(null, buildResponse(result));
            }
          })
          .catch((error) => callback(error));
      }
      break;

    // future improvement: support ?fields=[listOfFields] to reduce network size?
    // especially since sending input / output / expected output / stderr for every test case is big
    case "GET /submissions/{submissionID}":
      getSubmission(event.pathParameters!.submissionID!)
        .then((response) => {
          const data: ProblemSubmissionResult = {
            submissionID: response!.submissionID.S!,
            status: response!.status.S! as "compiling" | "executing" | "done",
            problemID: response!.problemID.S!,
            language: response!.language.S!,
            filename: response!.filename.S!,
            sourceCode: decompress(response!.sourceCode.B!),
            testCases:
              response!.testCases.L!.map<ProblemSubmissionTestCaseResult>(
                (tc) => ({
                  verdict: tc.M!.verdict.S! as ExecutionVerdict,
                  time: tc.M!.time.S!,
                  memory: tc.M!.memory.S!,
                  input: decompress(tc.M!.input.B!),
                  expectedOutput: decompress(tc.M!.expectedOutput.B!),
                  stdout: decompress(tc.M!.stdout.B!),
                  stderr: decompress(tc.M!.stderr.B!),
                })
              ),
          };

          if (response!.message) {
            data.message = decompress(response!.message.B!);
          }
          if (response!.verdict) {
            data.verdict = response!.verdict.S as ExecutionVerdict;
          }
          if (response!.debugData) {
            data.debugData = decompress(response!.debugData!.B!);
          }

          return data;
        })
        .then((response) => {
          callback(
            null,
            buildResponse(response, {
              statusCode: 200,
            })
          );
        })
        .catch((e) => callback(e));
      break;

    default:
      callback(
        null,
        buildResponse(
          {
            message:
              "Invalid request " + event.httpMethod + " " + event.resource,
          },
          {
            statusCode: 400,
          }
        )
      );
  }
};
