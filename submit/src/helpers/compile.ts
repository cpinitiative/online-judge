import { InvokeCommand } from "@aws-sdk/client-lambda";
import { lambdaClient } from "../clients";
import updateCodeExecutionStatistics from "./updateCodeExecutionStatistics";
import { EXECUTE_FUNCTION_NAME } from "../constants";

export type CompileData = {
  language: "cpp" | "java" | "py";
  filename: string;
  compilerOptions: string;
  sourceCode: string;
};

export default async function compile(data: CompileData) {
  const compileCommand = new InvokeCommand({
    FunctionName: EXECUTE_FUNCTION_NAME,
    Payload: Buffer.from(
      JSON.stringify({
        type: "compile",
        language: data.language,
        compilerOptions: data.compilerOptions,
        filename: data.filename,
        sourceCode: data.sourceCode,
      }),
      "utf-8"
    ),
  });
  const compileResponse = await lambdaClient.send(compileCommand);
  const compileData = JSON.parse(
    Buffer.from(compileResponse.Payload!).toString()
  );

  if (compileData.status === "compile_error") {
    return compileData;
  } else if (compileData.status === "internal_error") {
    return {
      status: "internal_error",
      message: "Compilation failed with an internal error",
      debugData: compileData,
    };
  } else if (compileData.status !== "success") {
    return {
      status: "internal_error",
      message: "Compilation failed with an unknown error",
      debugData: compileData,
    };
  }

  return {
    status: "success",
    compilationMessage: compileData.processOutput?.stderr ?? null,
    output: compileData.output,
  };
}
