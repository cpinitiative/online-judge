import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { check } from "prettier";
import * as app from "../app";
import getSubmission from "../problemSubmission/getSubmission";
import {
  ProblemSubmissionRequestData,
  ProblemSubmissionResult,
} from "../types";

export const appHandlerPromise = (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return new Promise((resolve, reject) => {
    app.lambdaHandler(event, null, (error, result) => {
      if (error) reject(error);
      else resolve(result!);
    });
  });
};

export const generateCodeExecutionRequest = (
  data: object
): APIGatewayProxyEvent => {
  return {
    ...baseAPIGatewayRequest,
    resource: "/execute",
    body: JSON.stringify(data),
  } as any; // there's some sketchy typescript bug that I think is irrelevant...
};

export const generateProblemSubmissionRequest = (
  data: ProblemSubmissionRequestData
): APIGatewayProxyEvent => {
  return {
    ...baseAPIGatewayRequest,
    resource: "/submissions",
    body: JSON.stringify(data),
  } as any; // there's some sketchy typescript bug that I think is irrelevant...
};

export const generateGetProblemSubmissionRequest = (
  submissionID: string
): APIGatewayProxyEvent => {
  return {
    ...baseAPIGatewayRequest,
    httpMethod: "GET",
    resource: "/submissions/{submissionID}",
    pathParameters: {
      submissionID,
    },
  } as any; // there's some sketchy typescript bug that I think is irrelevant...
};

export const waitForSubmissionFinish = (
  submissionID: string
): Promise<ProblemSubmissionResult> => {
  return new Promise((resolve, reject) => {
    const check = (tries: number) => {
      // shouldn't take more than 10 seconds
      if (tries > 10) {
        reject(
          new Error(
            "Submission " + submissionID + " didn't finish after 10 seconds"
          )
        );
        return;
      }
      setTimeout(() => {
        getSubmission(submissionID)
          .then((val) => {
            if (val.status === "done") resolve(val);
            else check(tries + 1);
          })
          .catch(reject);
      }, 1000);
    };
    check(0);
  });
};

export const jestCheckSubmission = (submission: ProblemSubmissionResult) => {
  const { submissionID, testCases, ...submissionToCheck } = submission;
  expect(submissionToCheck).toMatchSnapshot();
  testCases.forEach(({ time, memory, ...tc }) => expect(tc).toMatchSnapshot());
};

const baseAPIGatewayRequest = {
  body: "{}",
  resource: "/path/to/resource",
  path: "/path/to/resource",
  httpMethod: "POST",
  isBase64Encoded: true,
  queryStringParameters: {
    foo: "bar",
  },
  multiValueQueryStringParameters: {
    foo: ["bar"],
  },
  pathParameters: {
    proxy: "/path/to/resource",
  },
  stageVariables: {
    baz: "qux",
  },
  headers: {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, sdch",
    "Accept-Language": "en-US,en;q=0.8",
    "Cache-Control": "max-age=0",
    "CloudFront-Forwarded-Proto": "https",
    "CloudFront-Is-Desktop-Viewer": "true",
    "CloudFront-Is-Mobile-Viewer": "false",
    "CloudFront-Is-SmartTV-Viewer": "false",
    "CloudFront-Is-Tablet-Viewer": "false",
    "CloudFront-Viewer-Country": "US",
    Host: "1234567890.execute-api.us-east-1.amazonaws.com",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Custom User Agent String",
    Via: "1.1 08f323deadbeefa7af34d5feb414ce27.cloudfront.net (CloudFront)",
    "X-Amz-Cf-Id": "cDehVQoZnx43VYQb9j2-nvCh-9z396Uhbp027Y2JvkCPNLmGJHqlaA==",
    "X-Forwarded-For": "127.0.0.1, 127.0.0.2",
    "X-Forwarded-Port": "443",
    "X-Forwarded-Proto": "https",
  },
  multiValueHeaders: {
    Accept: [
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    ],
    "Accept-Encoding": ["gzip, deflate, sdch"],
    "Accept-Language": ["en-US,en;q=0.8"],
    "Cache-Control": ["max-age=0"],
    "CloudFront-Forwarded-Proto": ["https"],
    "CloudFront-Is-Desktop-Viewer": ["true"],
    "CloudFront-Is-Mobile-Viewer": ["false"],
    "CloudFront-Is-SmartTV-Viewer": ["false"],
    "CloudFront-Is-Tablet-Viewer": ["false"],
    "CloudFront-Viewer-Country": ["US"],
    Host: ["0123456789.execute-api.us-east-1.amazonaws.com"],
    "Upgrade-Insecure-Requests": ["1"],
    "User-Agent": ["Custom User Agent String"],
    Via: ["1.1 08f323deadbeefa7af34d5feb414ce27.cloudfront.net (CloudFront)"],
    "X-Amz-Cf-Id": ["cDehVQoZnx43VYQb9j2-nvCh-9z396Uhbp027Y2JvkCPNLmGJHqlaA=="],
    "X-Forwarded-For": ["127.0.0.1, 127.0.0.2"],
    "X-Forwarded-Port": ["443"],
    "X-Forwarded-Proto": ["https"],
  },
  requestContext: {
    accountId: "123456789012",
    resourceId: "123456",
    stage: "prod",
    requestId: "c6af9ac6-7b61-11e6-9a41-93e8deadbeef",
    requestTime: "09/Apr/2015:12:34:56 +0000",
    requestTimeEpoch: 1428582896000,
    identity: {
      cognitoIdentityPoolId: null,
      accountId: null,
      cognitoIdentityId: null,
      caller: null,
      accessKey: null,
      sourceIp: "127.0.0.1",
      cognitoAuthenticationType: null,
      cognitoAuthenticationProvider: null,
      userArn: null,
      userAgent: "Custom User Agent String",
      user: null,
    },
    path: "/prod/path/to/resource",
    resourcePath: "/{proxy+}",
    httpMethod: "POST",
    apiId: "1234567890",
    protocol: "HTTP/1.1",
  },
};
