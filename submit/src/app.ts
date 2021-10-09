import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const client = new LambdaClient({
  region: "us-west-1",
});

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
  // const executeData = JSON.parse(
  //   Buffer.from(executeResponse.Payload!).toString()
  // );

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: Buffer.from(executeResponse.Payload!).toString(),
  };
};
