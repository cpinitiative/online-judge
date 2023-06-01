import { InvokeWithResponseStreamCommand } from "@aws-sdk/client-lambda";
import updateCodeExecutionStatistics from "./updateCodeExecutionStatistics";
import { getLambdaStreamingResponse } from "./utils";

export type CompileData = {
  language: "cpp" | "java" | "py";
  filename: string;
  compilerOptions: string;
  sourceCode: string;
};

export default async function compile(data: CompileData) {
  const compileResponse = await getLambdaStreamingResponse({
    FunctionName: "online-judge-ExecuteFunction-Stage",
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
  const compileData = JSON.parse(compileResponse);

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
