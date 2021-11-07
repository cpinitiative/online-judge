import { InvokeCommand } from "@aws-sdk/client-lambda";
import { lambdaClient } from "../clients";
import { CodeExecutionRequestData, ExecuteResult } from "../types";
import updateCodeExecutionStatistics from "./updateCodeExecutionStatistics";
import { buildResponse, extractTimingInfo } from "./utils";

export default async function execute(
  requestData: CodeExecutionRequestData,
  problemInput: string
) {
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
  const compileResponse = await lambdaClient.send(compileCommand);
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
        input: problemInput,
        timeout: 5000,
      })
    ),
  });
  const executeResponse = await lambdaClient.send(executeCommand);
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
}
