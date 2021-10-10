import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { buildResponse, extractTimingInfo } from "./utils";

const client = new LambdaClient({
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

  if (exitSignal !== null || processError !== null) {
    return buildResponse(
      {
        status: "internal_error",
        message:
          "Execution may have failed for an unknown reason. Exit signal / process error was expected to be null, but wasn't.",
        debugData: executeData,
      },
      {
        statusCode: 500,
      }
    );
  }

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
