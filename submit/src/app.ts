import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const client = new LambdaClient({
  region: "us-west-1",
});

export const lambdaHandler = async (event: any, context: any): Promise<any> => {
  const compileCommand = new InvokeCommand({
    FunctionName: "online-judge-ExecuteFunction",
    Payload: Buffer.from(
      JSON.stringify({
        type: "compile",
        language: event.language,
        compilerOptions: event.compilerOptions,
        filename: event.filename,
        sourceCode: event.sourceCode,
      }),
      "utf-8"
    ),
  });
  const compileResponse = await client.send(compileCommand);
  const compileData = JSON.parse(
    Buffer.from(compileResponse.Payload!).toString()
  );

  const executeCommand = new InvokeCommand({
    FunctionName: "online-judge-ExecuteFunction",
    Payload: Buffer.from(
      JSON.stringify({
        type: "execute",
        payload: compileData.output,
        input: event.input,
      })
    ),
  });
  const executeResponse = await client.send(executeCommand);
  const executeData = JSON.parse(
    Buffer.from(executeResponse.Payload!).toString()
  );

  return executeData;
};
