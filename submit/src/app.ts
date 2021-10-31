import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { buildResponse, extractTimingInfo } from "./utils";

const client = new LambdaClient({
  region: "us-west-1",
});

const dynamoDBClient = new DynamoDBClient({
  region: "us-west-1",
});

// Temporarily copy pasted from the execute lambda...
interface ExecuteResult {
  status: "success";
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  exitSignal: string | null;
  processError: string | null;
}

// Note: for problem submission, some flags to keep in mind: http://usaco.org/index.php?page=instructions

// WIP
interface CodeExecutionRequestData {
  language: "cpp" | "java" | "py";
}

const updateCodeExecutionStatistics = async (
  requestData: CodeExecutionRequestData
) => {
  // we don't want to update execution statistics when running test code (like Jest)
  if (process.env.NODE_ENV === "test") return;

  let language: string = requestData.language;
  if (language !== "cpp" && language !== "java" && language !== "py") {
    // this shouldn't happen, but just in case someone sends
    // a malicious language and we fail to catch it earlier
    language = "unknown";
  }

  const updateDB = async () => {
    await dynamoDBClient.send(
      new UpdateItemCommand({
        Key: {
          id: {
            S: "codeExecutions",
          },
        },
        TableName: "online-judge-statistics",
        // Note: make sure a map called `byDate` already exists inside the table...
        UpdateExpression: `ADD totalCount :inc, #languageCount :inc, byDate.#dateCount :inc`,
        ExpressionAttributeNames: {
          "#languageCount": `${language}Count`,
          "#dateCount": new Date().toISOString().split("T")[0], // Ex: 2021-10-31
        },
        ExpressionAttributeValues: {
          ":inc": {
            N: "1",
          },
        },
      })
    );
  };

  try {
    await updateDB();
  } catch (e) {
    if (
      e instanceof Error &&
      e?.message ===
        "The document path provided in the update expression is invalid for update"
    ) {
      // For us to do ADD byDate.#dateCount, the byDate map must exist
      // If it doesn't exist and fails with the above error, create the byDate map and rerun the update
      await dynamoDBClient.send(
        new UpdateItemCommand({
          Key: {
            id: {
              S: "codeExecutions",
            },
          },
          TableName: "online-judge-statistics",
          // Note: make sure a map called `byDate` already exists inside the table...
          UpdateExpression: `SET byDate = :value`,
          ConditionExpression: "attribute_not_exists(byDate)",
          ExpressionAttributeValues: {
            ":value": {
              M: {},
            },
          },
        })
      );
      await updateDB();
    }
  }
};

export const lambdaHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestData = JSON.parse(event.body || "{}");

  // todo validate structure of body?
  if (!requestData.language) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Unknown language.",
      }),
    };
  }

  // deliberately async -- don't hold up the rest of the function execution while waiting for dynamodb
  updateCodeExecutionStatistics(requestData);

  const compileCommand = new InvokeCommand({
    FunctionName: "online-judge-ExecuteFunction",
    Payload: Buffer.from(
      JSON.stringify({
        type: "compile",
        language: requestData.language,
        compilerOptions: requestData.compilerOptions,
        filename: requestData.filename,
        sourceCode: requestData.sourceCode,
      }),
      "utf-8"
    ),
  });
  const compileResponse = await client.send(compileCommand);
  const compileData = JSON.parse(
    Buffer.from(compileResponse.Payload!).toString()
  );

  if (compileData.status === "compile_error") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: Buffer.from(compileResponse.Payload!).toString(),
    };
  } else if (compileData.status === "internal_error") {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        status: "internal_error",
        message: "Compilation failed with an internal error",
        debugData: compileData,
      }),
    };
  } else if (compileData.status !== "success") {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        status: "internal_error",
        message: "Compilation failed with an unknown error",
        debugData: compileData,
      }),
    };
  }

  const executeCommand = new InvokeCommand({
    FunctionName: "online-judge-ExecuteFunction",
    Payload: Buffer.from(
      JSON.stringify({
        type: "execute",
        payload: compileData.output,
        input: requestData.input,
        timeout: 5000,
      })
    ),
  });
  const executeResponse = await client.send(executeCommand);
  const executeData: ExecuteResult = JSON.parse(
    Buffer.from(executeResponse.Payload!).toString()
  );

  if (executeData.status !== "success") {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        status: "internal_error",
        message: "Execution failed for an unknown reason",
        debugData: executeData,
      }),
    };
  }

  const { stdout, exitCode, exitSignal, processError } = executeData;

  const {
    restOfString: stderr,
    time,
    memory,
  } = extractTimingInfo(executeData.stderr);

  // 124 is the exit code returned by linux `timeout` command
  if (exitCode === 124) {
    return buildResponse({
      status: "time_limit_exceeded",
      stdout,
      stderr,
      time,
      memory,
      exitCode,
    });
  }

  // Honestly I don't think this check is necessary.
  // Sometimes processError would have EPIPE if the program didn't finish reading in all the stdin.
  // if (exitSignal !== null || processError !== null) {
  //   return buildResponse(
  //     {
  //       status: "internal_error",
  //       message:
  //         "Execution may have failed for an unknown reason. Exit signal / process error was expected to be null, but wasn't.",
  //       debugData: executeData,
  //     },
  //     {
  //       statusCode: 500,
  //     }
  //   );
  // }

  if (exitCode !== 0) {
    return buildResponse({
      status: "runtime_error",
      stdout,
      stderr,
      time,
      memory,
      exitCode,
    });
  }

  return buildResponse({
    status: "success",
    stdout,
    stderr,
    time,
    memory,
  });
};
