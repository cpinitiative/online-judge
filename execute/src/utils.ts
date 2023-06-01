import { execFileSync, SpawnSyncReturns } from "child_process";
import { readFileSync, unlinkSync, rmdirSync } from "fs";
import { gzip } from "zlib";

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

export interface ExecuteProcessOutput {
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  exitSignal: string | null;
  processError: string | null;
  /**
   * When executing, if `fileIOName` is given, this is
   * set to whatever is written in `[fileIOName].out`
   * or null if there's no such file.
   */
  fileOutput?: string | null;
}

export const parseReturnInfoOfSpawn = async (
  spawnReturn: SpawnSyncReturns<Buffer>,
  { isOutputCompressed } = { isOutputCompressed: true }
): Promise<ExecuteProcessOutput> => {
  if (isOutputCompressed) {
    return {
      stdout: spawnReturn.stdout
        ? (await compress(spawnReturn.stdout.toString())).toString("base64")
        : null,
      stderr: spawnReturn.stderr
        ? (await compress(spawnReturn.stderr.toString())).toString("base64")
        : null,
      processError: spawnReturn.error?.message ?? null,
      exitSignal: spawnReturn.signal,
      exitCode: spawnReturn.status,
    };
  }
  return {
    stdout: spawnReturn.stdout ? spawnReturn.stdout.toString() : null,
    stderr: spawnReturn.stderr ? spawnReturn.stderr.toString() : null,
    processError: spawnReturn.error?.message ?? null,
    exitSignal: spawnReturn.signal,
    exitCode: spawnReturn.status,
  };
};

export async function compress(data: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    gzip(data, (error, result) => {
      if (error) reject(error);
      resolve(result);
    });
  });
}
