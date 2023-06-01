import {
  InvokeWithResponseStreamCommand,
  InvokeWithResponseStreamCommandInput,
} from "@aws-sdk/client-lambda";
import { APIGatewayProxyResult } from "aws-lambda";
import type { Readable } from "stream";
import { gunzip, gunzipSync, gzip } from "zlib";
import { lambdaClient } from "../clients";
import { TextDecoder } from "util";

export const extractTimingInfo = (
  data: string | null
): {
  restOfString: string | null;
  /**
   * Measured in seconds
   */
  time: string | null;
  /**
   * Measured in kilobytes
   */
  memory: string | null;
} => {
  if (data === null) {
    return {
      restOfString: null,
      time: null,
      memory: null,
    };
  }
  const startIndex = data.lastIndexOf(`\tCommand being timed:`);
  if (startIndex === -1) {
    return {
      restOfString: data,
      time: null,
      memory: null,
    };
  }
  const restOfString = data.substring(0, startIndex);
  const timeOutput = data.substring(startIndex);
  const wallTime = timeOutput.match(
    /\tElapsed \(wall clock\) time \(h:mm:ss or m:ss\): (.+)/
  )?.[1];
  const memoryUsage = timeOutput.match(
    /\tMaximum resident set size \(kbytes\): (.+)/
  )?.[1];
  return {
    restOfString,
    time: wallTime?.substring(3) ?? null, // time format is 0:00.00
    memory: memoryUsage ?? null,
  };
};

export const buildResponse = (
  data: object,
  extraData?: Partial<APIGatewayProxyResult>
): APIGatewayProxyResult => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(data),
    ...(extraData || {}),
  };
};

export async function streamToString(stream: Readable): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

export async function compress(data: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    gzip(data, (error, result) => {
      if (error) reject(error);
      resolve(result);
    });
  });
}

export function decompress(data: Uint8Array): string {
  return gunzipSync(data).toString();
}

function Decodeuint8arr(uint8array: any) {
  return new TextDecoder("utf-8").decode(uint8array);
}

export async function getLambdaStreamingResponse(
  params: InvokeWithResponseStreamCommandInput
) {
  const compileCommand = new InvokeWithResponseStreamCommand(params);
  const response = await lambdaClient.send(compileCommand);

  const events = response.EventStream;

  let str = "";
  for await (const event of events!) {
    // `PayloadChunk`: These contain the actual raw bytes of the chunk
    // It has a single property: `Payload`
    if (event.PayloadChunk) {
      // Decode the raw bytes into a string a human can read
      str += Decodeuint8arr(event.PayloadChunk.Payload);
    }

    // `InvokeComplete`: This event is sent when the function is done streaming.
    // It has the following properties:
    // `LogResult`: Contains the last 4KiB of execution logs as a base64 encoded
    //     string when Tail Logs are enabled.
    // `ErrorCode`: The error code if the function ran into an error mid-stream.
    // `ErrorDetails`: Additional details about the error if the function ran into
    //     an error mid-stream.
    if (event.InvokeComplete) {
      if (event.InvokeComplete.ErrorCode) {
        console.error(
          "Error Code (invoking streaming lambda response failed):",
          event.InvokeComplete.ErrorCode
        );
        console.error("Details:", event.InvokeComplete.ErrorDetails);
      }

      if (event.InvokeComplete.LogResult) {
        // const buff = Buffer.from(event.InvokeComplete.LogResult, "base64");
        // console.log("Logs:", buff.toString("utf-8"));
      }
    }
  }

  return str;
}
