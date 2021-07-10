import { exec as synchronousExec, ExecOptions } from "child_process";

export enum Language {
    JAVA = "JAVA",
    CPP = "CPP",
    PYTHON = "PYTHON",
}

/**
 * async exec
 * @param cmd
 * @param options
 * @param returnStdErr
 */
export const exec = (
    cmd: string,
    options?: { encoding: "buffer" | null } & ExecOptions,
    returnStdErr = false
): Promise<{ stdout: string; stderr: string }> =>
    new Promise((resolve, reject) =>
        synchronousExec(cmd, options || {}, (err, stdout, stderr) => {
            if (err) reject(err);
            resolve({
                stdout,
                stderr,
            });
        })
    );

export enum GradeResultError {
    COMPILE_TIMEOUT = "COMPILE_TIMEOUT",
    COMPILE_ERROR = "COMPILE_ERROR",
    RUNTIME_ERROR = "RUNTIME_ERROR",
    TIME_LIMIT_EXCEEDED = "TIME_LIMIT_EXCEEDED",
    EMPTY_MISSING_OUTPUT = "EMPTY_MISSING_OUTPUT",
    WRONG_ANSWER = "WRONG_ANSWER",
    INTERNAL_ERROR = "INTERNAL_ERROR",
}
export type GradeResult =
    | {
          pass: false;
          error: GradeResultError;
      }
    | {
          pass: true;

          // in milliseconds:
          time: number;
          wallTime: number;
      };
