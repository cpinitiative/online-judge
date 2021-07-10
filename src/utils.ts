import { exec as synchronousExec, ExecOptions } from "child_process";
import { firestore } from "firebase-admin/lib/firestore";
import Timestamp = firestore.Timestamp;

export enum Language {
    JAVA = "java",
    CPP = "cpp",
    PYTHON = "python",
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
    COMPILE_TIMEOUT = "compile_timeout",
    COMPILE_ERROR = "compile_error",
    RUNTIME_ERROR = "runtime_error",
    TIME_LIMIT_EXCEEDED = "time_limit_exceeded",
    EMPTY_MISSING_OUTPUT = "empty_missing_output",
    WRONG_ANSWER = "wrong_answer",
    INTERNAL_ERROR = "internal_error",
}
export type GradeResult = { caseId: number } & (
    | {
          pass: false;
          error: GradeResultError;
      }
    | {
          pass: true;

          // in milliseconds:
          time: number;
          wallTime: number;

          // in kb?
          memory: number;
      }
);
export type Submission = {
    id: string;
    problemId: string;
    userId: string;
    code: string;
    language: Language;
    timestamp: Timestamp;
    result: number;
} & (
    | {
          type: "Self Graded";
          status: any;
      }
    | ({
          type: "Online Judge";
          gradingStatus: "waiting" | "in_progress" | "done" | "judge_error";
          compilationError?: boolean;
          judgeProblemId: string;
      } & (
          | Record<string, never>
          | {
                compilationError: false;
                testCases?: GradeResult[];
            }
          | {
                compilationError: true;
                compilationErrorMessage: string;
            }
      ))
);
