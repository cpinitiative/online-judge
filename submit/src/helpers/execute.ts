import { InvokeCommand } from "@aws-sdk/client-lambda";
import { lambdaClient } from "../clients";
import { CodeExecutionRequestData, CodeExecutionResult } from "../types";
import compile from "./compile";
import updateCodeExecutionStatistics from "./updateCodeExecutionStatistics";
import { buildResponse, extractTimingInfo } from "./utils";
import { EXECUTE_FUNCTION_NAME } from "../constants";

export default async function execute(
  compiledExecutable: string,
  problemInput: string,
  executionStatisticsData: { language: "cpp" | "java" | "py" },
  timeout: number = 5000,
  fileIOName?: string
) {
  // deliberately async -- don't hold up the rest of the function execution while waiting for dynamodb
  updateCodeExecutionStatistics(executionStatisticsData);

  const fileIOInfo = fileIOName ? { fileIOName } : {};
  const executeCommand = new InvokeCommand({
    FunctionName: EXECUTE_FUNCTION_NAME,
    Payload: Buffer.from(
      JSON.stringify({
        type: "execute",
        payload: compiledExecutable,
        input: problemInput,
        timeout,
        ...fileIOInfo,
      })
    ),
  });
  const executeResponse = await lambdaClient.send(executeCommand);
  const executeData: CodeExecutionResult = JSON.parse(
    Buffer.from(executeResponse.Payload!).toString()
  );

  if (executeData.status !== "success") {
    return {
      status: "internal_error",
      message: "Execution failed for an unknown reason",
      debugData: executeData,
    };
  }

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
