import { execFileSync, SpawnSyncReturns } from "child_process";
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

export interface ExecuteProcessOutput {
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  exitSignal: string | null;
  processError: string | null;
}

export const parseReturnInfoOfSpawn = (spawnReturn: SpawnSyncReturns<Buffer>): ExecuteProcessOutput => {
  return {
    stdout: spawnReturn.stdout?.toString() ?? null,
    stderr: spawnReturn.stderr?.toString() ?? null,
    processError: spawnReturn.error?.message ?? null,
    exitSignal: spawnReturn.signal,
    exitCode: spawnReturn.status,
  };
}
