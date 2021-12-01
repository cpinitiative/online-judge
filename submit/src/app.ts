import { v4 as uuidv4 } from "uuid";
import type {
  APIGatewayProxyEvent,
  APIGatewayEventRequestContext,
  APIGatewayProxyCallback,
} from "aws-lambda";
import execute from "./helpers/execute";
import getSubmission from "./problemSubmission/getSubmission";
import createSubmission from "./problemSubmission/createSubmission";
import { buildResponse, compress } from "./helpers/utils";
import compile from "./helpers/compile";
import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { dbClient } from "./clients";
import { z } from "zod";

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
      (async () => {
        try {
          let submissionID = uuidv4();

          if (requestData.submissionID) {
            submissionID = requestData.submissionID;
            if (!z.string().uuid().safeParse(submissionID).success) {
              callback(
                null,
                buildResponse(
                  {
                    message: "Invalid submissionID format. Needs to be uuid.",
                  },
                  { statusCode: 400 }
                )
              );
              return;
            }

            const dbGetParams = {
              TableName: "online-judge",
              Key: {
                submissionID: {
                  S: submissionID,
                },
              },
            };
            const getCommand = new GetItemCommand(dbGetParams);
            const response = (await dbClient.send(getCommand)).Item;
            if (response) {
              // Submission already exists
              callback(
                null,
                buildResponse(
                  {
                    message:
                      "A submission with the given submissionID already exists.",
                  },
                  { statusCode: 409 }
                )
              );
              return;
            }
          }

          const compressedSourceCode = await compress(requestData.sourceCode);
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
                M: {},
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
          await dbClient.send(dbCommand);

          const submissionPromise = createSubmission(submissionID, requestData);

          if (!requestData.wait) {
            callback(
              null,
              buildResponse({
                submissionID,
              })
            );
          }

          await submissionPromise;

          if (requestData.wait) {
            await getSubmission(submissionID)
              .then((response) => {
                callback(
                  null,
                  buildResponse(response, {
                    statusCode: 200,
                  })
                );
              })
              .catch((e) => callback(e));
          }
        } catch (e: any) {
          callback(e);
        }
      })();

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
