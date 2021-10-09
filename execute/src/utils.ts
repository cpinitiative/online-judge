import { execFileSync } from "child_process";
import { readFileSync, unlinkSync, rmdirSync } from "fs";

/**
 * Zips /tmp/out, deletes the directory, and returns the base64 encoded ZIP file
 *
 * @returns Base64-encoded ZIP file of the out directory
 */
export const zipAndRemoveOutDir = (): string => {
  execFileSync("zip", ["-r", "/tmp/out.zip", "-j", "/tmp/out"]);

  const base64Output = readFileSync("/tmp/out.zip", {
    encoding: "base64",
  });

  unlinkSync("/tmp/out.zip");
  rmdirSync("/tmp/out", { recursive: true });

  return base64Output;
};

export const extractTimingInfo = (
  data: string
): {
  restOfString: string;
  /**
   * Measured in seconds
   */
  time: string | null;
  /**
   * Measured in kilobytes
   */
  memory: string | null;
} => {
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
    time: wallTime ?? null,
    memory: memoryUsage ?? null,
  };
};
