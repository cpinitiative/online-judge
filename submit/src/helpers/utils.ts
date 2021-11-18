import { APIGatewayProxyResult } from "aws-lambda";
import type { Readable } from "stream";

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
