import { v4 as uuidv4 } from "uuid";
import type {
  APIGatewayProxyEvent,
  APIGatewayEventRequestContext,
  APIGatewayProxyCallback,
} from "aws-lambda";
import execute from "./helpers/execute";
import getSubmission from "./helpers/getSubmission";
import createSubmission from "./helpers/createSubmission";
import { buildResponse } from "./helpers/utils";

// Note: for problem submission, some flags to keep in mind: http://usaco.org/index.php?page=instructions

export const lambdaHandler = (
  event: APIGatewayProxyEvent,
  context: APIGatewayEventRequestContext | null, // null for testing
  callback: APIGatewayProxyCallback
) => {
  const requestData = JSON.parse(event.body || "{}");

  switch (event.httpMethod + " " + event.resource) {
    case "POST /submissions":
      // todo validate structure of body?
      const submissionID = uuidv4();
      createSubmission(submissionID, requestData);

      callback(
        null,
        buildResponse({
          submissionID,
        })
      );

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
        execute(requestData, requestData.input)
          .then((resp) => callback(null, resp))
          .catch((error) => callback(error));
      }
      break;

    case "GET /submissions/{submissionID}":
      // todo verify submissionID not null?
      getSubmission(event.pathParameters!.submissionID!)
        .then((response) => {
          callback(
            null,
            buildResponse(response, {
              statusCode: 500,
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
