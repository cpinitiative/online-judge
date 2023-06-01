import { InvokeCommand } from "@aws-sdk/client-lambda";
import { lambdaClient } from "../clients";
import { CodeExecutionRequestData, CodeExecutionResult } from "../types";
import compile from "./compile";
import updateCodeExecutionStatistics from "./updateCodeExecutionStatistics";
import {
  buildResponse,
  compress,
  decompress,
  extractTimingInfo,
  getLambdaStreamingResponse,
} from "./utils";

export default async function execute(
  compiledExecutable: string,
  problemInput: string,
  executionStatisticsData: { language: "cpp" | "java" | "py" },
  timeout: number = 5000,
  fileIOName?: string,
  fetchInputFromS3 = false
) {
  // deliberately async -- don't hold up the rest of the function execution while waiting for dynamodb
  updateCodeExecutionStatistics(executionStatisticsData);

  const fileIOInfo = fileIOName ? { fileIOName } : {};
  const executeResponse = await getLambdaStreamingResponse({
    FunctionName: "online-judge-ExecuteFunction-Stage",
    Payload: Buffer.from(
      JSON.stringify({
        type: "execute",
        payload: compiledExecutable,
        input: fetchInputFromS3
          ? problemInput
          : (await compress(problemInput)).toString("base64"),
        timeout,
        ...fileIOInfo,
        fetchInputFromS3,
      })
    ),
  });
  let executeData: CodeExecutionResult = JSON.parse(executeResponse);

  if (executeData.status !== "success") {
    return {
      status: "internal_error",
      message: "Execution failed for an unknown reason",
      debugData: executeData,
    };
  }

  executeData.stdout = executeData.stdout
    ? decompress(Buffer.from(executeData.stdout, "base64"))
    : "";
  executeData.stderr = executeData.stderr
    ? decompress(Buffer.from(executeData.stderr, "base64"))
    : "";

  const { stdout, exitCode, exitSignal, processError, fileOutput } =
    executeData;

  const {
    restOfString: stderr,
    time,
    memory,
  } = extractTimingInfo(executeData.stderr);

  // 124 is the exit code returned by linux `timeout` command
  if (exitCode === 124) {
    return {
      status: "time_limit_exceeded",
      stdout,
      stderr,
      time,
      memory,
      exitCode,
      fileOutput,
    };
  }

  if (exitCode !== 0) {
    return {
      status: "runtime_error",
      stdout,
      stderr,
      time,
      memory,
      exitCode,
      fileOutput,
    };
  }

  return {
    status: "success",
    stdout,
    stderr,
    time,
    memory,
    fileOutput,
  };
}
