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
import { ProblemSubmissionRequestData } from "./types";
import fetch from "node-fetch";

// todo: make idempotent?
export const lambdaHandler = (
  event: APIGatewayProxyEvent,
  context: APIGatewayEventRequestContext | null, // null for testing
  callback: APIGatewayProxyCallback
) => {
  if (context) {
    // Return response immediately without waiting for lambda function to exit
    // We have to check if it's null because it is null when testing
    // @ts-ignore this property should exist...
    context.callbackWaitsForEmptyEventLoop = false;
  }
  const rawRequestData = JSON.parse(event.body || "{}");

  // todo validate with zod?

  switch (event.httpMethod + " " + event.resource) {
    case "POST /submissions":
      const requestData: ProblemSubmissionRequestData = rawRequestData;

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

          if (requestData.wait || requestData.firebase) {
            let response = undefined;

            try {
              response = await getSubmission(submissionID);
            } catch (e: any) {
              if (requestData.wait) {
                callback(e);
              }
            }

            if (response !== undefined && requestData.wait) {
              callback(
                null,
                buildResponse(response, {
                  statusCode: 200,
                })
              );
            }

            if (response && requestData.firebase) {
              const url = `https://firestore.googleapis.com/v1/projects/${requestData.firebase.collectionPath}`;
              const resp = await fetch(url, {
                method: "POST",
                body: JSON.stringify({
                  fields: {
                    type: {
                      stringValue: "Online Judge",
                    },
                    verdict: {
                      stringValue: response.verdict,
                    },
                    submissionID: {
                      stringValue: response.submissionID,
                    },
                    problemID: {
                      stringValue: response.problemID,
                    },
                    language: {
                      stringValue: response.language,
                    },
                    score: {
                      doubleValue:
                        response.testCases?.length > 0
                          ? response.testCases.filter((x) => x.verdict === "AC")
                              .length / response.testCases.length
                          : 0, // probably a compiler error
                    },
                  },
                }),
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${requestData.firebase.idToken}`,
                },
              });
              if (resp.status !== 200) {
                console.warn("Failed to update firebase");
                console.warn(resp);
              }
            }
          }
        } catch (e: any) {
          callback(e);
        }
      })();

      break;

    case "POST /execute":
      // todo validate more stuff?
      if (!rawRequestData.language) {
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
        compile(rawRequestData)
          .then((compiled) => {
            if (
              compiled.status === "internal_error" ||
              compiled.status === "compile_error"
            ) {
              return compiled;
            }
            return execute(
              compiled.output,
              rawRequestData.input,
              rawRequestData
            );
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
