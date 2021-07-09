import { exec as synchronousExec, ExecOptions } from "child_process";

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
