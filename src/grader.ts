import fs from "fs";
import { promisify } from "util";
import {
    exec,
    ExecutionStatus,
    GradeResult,
    GradeResultError,
    Language,
} from "./utils";
import * as admin from "firebase-admin";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
/**
 *
 * @param filePath - path to file
 * @param silent - if true and an error occurs (such as file not found), an empty string is returned. If false, the error is thrown.
 */
const readThenDelete = async (
    filePath: string,
    silent = false
): Promise<string> => {
    try {
        const data = await readFile(filePath);
        await unlink(filePath);
        return data + "";
    } catch (e) {
        if (!silent) throw e;
        return "";
    }
};

export async function grade(
    testCases: {
        input: string;
        expectedOutput: string;
    }[],
    fileName: string,
    code: string,
    language: Language,
    submissionRef: admin.firestore.DocumentReference
): Promise<
    | {
          success: true;
          results: GradeResult[];
      }
    | {
          success: false;
          error:
              | GradeResultError.COMPILE_ERROR
              | GradeResultError.COMPILE_TIMEOUT;
          errorMessage?: string;
      }
    | {
          success: false;
          error: GradeResultError.INTERNAL_ERROR;
      }
> {
    try {
        await submissionRef.update({
            gradingStatus: "in_progress",
        });
        console.log(`Running ${language} code: \n${code}`);

        const ext = {
            [Language.PYTHON]: "py",
            [Language.CPP]: "cpp",
            [Language.JAVA]: "java",
        }[language];

        if (!fs.existsSync("./tmp")) {
            fs.mkdirSync("./tmp");
        }
        await exec(`cd ./tmp`);

        const initResult = await exec(`sudo isolate --cg --init`).catch(
            async (e) => {
                console.log(e);
                console.log("Cleaning up and trying again");
                await exec(`isolate --cg --cleanup`);
                return exec(`sudo isolate --cg --init`);
            }
        );

        const dir = initResult.stdout;
        const box = dir.replace(/\n/g, "") + "/box";

        await writeFile(`${box}/${fileName}.${ext}`, code);

        let compileResult: IsolateResult | null = null;
        if (language === Language.CPP) {
            compileResult = await getIsolateOutput(
                box,
                `sudo isolate -b 0 -p -E PATH --meta=${fileName}.meta --stdout=${fileName}.out --stderr=${fileName}.err --run /usr/bin/g++ -- -std=c++17 -o ${fileName} -O2 ` +
                    `-Im ${fileName}.cpp`,
                fileName
            );
        } else if (language === Language.JAVA) {
            compileResult = await getIsolateOutput(
                box,
                `sudo isolate -b 0 -p -E PATH --meta=${fileName}.meta --stdout=${fileName}.out --stderr=${fileName}.err --run /usr/lib/jvm/java-11-openjdk-amd64/bin/javac ${fileName}.java`,
                fileName
            );
        }

        // for python, which doesn't need compilation, compileResult won't exist
        if (compileResult && !compileResult.success) {
            await exec(`sudo isolate --cg  --cleanup`);

            await submissionRef.update({
                compilationError: true,
                compilationErrorMessage:
                    "stdout " +
                    compileResult.stdout +
                    " | stderr " +
                    compileResult.stderr +
                    " | isoerr " +
                    compileResult.errorMessage,
                result: 0,
                gradingStatus: "done",
            });

            return {
                success: false,
                error:
                    compileResult.errorCode === "TIME_LIMIT_EXCEEDED"
                        ? GradeResultError.COMPILE_TIMEOUT
                        : GradeResultError.COMPILE_ERROR,
                errorMessage:
                    "stdout " +
                    compileResult.stdout +
                    " | stderr " +
                    compileResult.stderr +
                    " | isoerr " +
                    compileResult.errorMessage,
            };
        }
        const results: GradeResult[] = [];
        for (let i = 0; i < testCases.length; i++) {
            const { input, expectedOutput } = testCases[i];
            await writeFile(`${box}/${fileName}.in`, input);
            let runResult: IsolateResult | null = null;
            if (language === Language.CPP) {
                runResult = await getIsolateOutput(
                    box,
                    `sudo isolate --cg --stderr=${fileName}.err --stdin=${fileName}.in --stdout=${fileName}.out --meta=${fileName}.meta --mem=256000 ` +
                        `--time=2 --extra-time=1 --wall-time=10 --run ./${fileName}`,
                    fileName
                );
            } else if (language === Language.JAVA) {
                runResult = await getIsolateOutput(
                    box,
                    `sudo isolate --cg --stderr=${fileName}.err --stdin=${fileName}.in --stdout=${fileName}.out --meta=${fileName}.meta --time=5 --extra-time=2 --wall-time=10 -p -d /etc --run /usr/bin/java -- -Xss256m ${fileName}`,
                    fileName
                );
            } else if (language === Language.PYTHON) {
                runResult = await getIsolateOutput(
                    box,
                    `sudo isolate --cg --stderr=${fileName}.err --stdin=${fileName}.in --stdout=${fileName}.out --meta=${fileName}.meta --mem=256000 --time=5 --extra-time=2 --wall-time=10 --env=HOME=/home/user --run /usr/bin/python3 ${fileName}.py`,
                    fileName
                );
            }
            if (!runResult) {
                console.log("language", language);
                throw new Error(
                    "Unable to find run result. This can happen if the language is not java, cpp, or python."
                );
            }

            if (!runResult.success) {
                const result: {
                    caseId: number;
                    pass: false;
                    error: GradeResultError;
                } = {
                    caseId: i,
                    pass: false,
                    error:
                        runResult.errorCode === "TIME_LIMIT_EXCEEDED"
                            ? GradeResultError.TIME_LIMIT_EXCEEDED
                            : GradeResultError.RUNTIME_ERROR,
                };
                await submissionRef.update({
                    compilationError: false,
                    testCases: admin.firestore.FieldValue.arrayUnion(result),
                });
                results.push(result);
                continue;
            }
            if (!runResult.stdout) {
                const result: {
                    caseId: number;
                    pass: false;
                    error: GradeResultError;
                } = {
                    caseId: i,
                    pass: false,
                    error: GradeResultError.EMPTY_MISSING_OUTPUT,
                };
                await submissionRef.update({
                    compilationError: false,
                    testCases: admin.firestore.FieldValue.arrayUnion(result),
                });
                results.push(result);
                continue;
            }
            if (runResult.stdout !== expectedOutput) {
                const result: {
                    caseId: number;
                    pass: false;
                    error: GradeResultError;
                } = {
                    caseId: i,
                    pass: false,
                    error: GradeResultError.WRONG_ANSWER,
                };
                await submissionRef.update({
                    compilationError: false,
                    testCases: admin.firestore.FieldValue.arrayUnion(result),
                });
                results.push(result);
                continue;
            }

            const result: {
                caseId: number;
                pass: true;
                time: number;
                wallTime: number;
                memory: number;
            } = {
                caseId: i,
                pass: true,
                time: runResult.execTime,
                wallTime: runResult.execWallTime,
                memory: runResult.memory,
            };
            await submissionRef.update({
                compilationError: false,
                testCases: admin.firestore.FieldValue.arrayUnion(result),
            });
            results.push(result);
        }

        await exec(`sudo isolate --cg  --cleanup`);

        await submissionRef.update({
            result:
                results.reduce(
                    (numCorrect, r) => numCorrect + (r.pass ? 1 : 0),
                    0
                ) / testCases.length,
            gradingStatus: "done",
        });
        return {
            success: true,
            results,
        };
    } catch (e) {
        await exec(`isolate --cg --cleanup`);
        console.warn(e);
        return {
            success: false,
            error: GradeResultError.INTERNAL_ERROR,
        };
    }
}

type IsolateResult =
    | {
          success: true;
          execTime: number;
          execWallTime: number;
          stdout: string;
          stderr: string;
          memory: number;
      }
    | {
          success: false;
          errorCode: string;
          errorMessage: string;
          stdout?: string;
          stderr?: string;
      };

async function getIsolateOutput(
    box: string,
    command: string,
    fileName: string
): Promise<IsolateResult> {
    try {
        const { stdout: isolateStdout, stderr: isolateStderr } = await exec(
            command,
            undefined,
            true
        );
        const times = /OK \(([.\w]+) sec real, ([.\w]+) sec wall\)/
            .exec(isolateStderr)
            ?.slice(1) || ["-1", "-1"];
        const [execTime, execWallTime] = times.map((t) =>
            Math.round(parseFloat(t) * 1000)
        );

        const [stdout, stderr, meta] = await Promise.all([
            readThenDelete(`${box}/${fileName}.out`),
            readThenDelete(`${box}/${fileName}.err`),
            readThenDelete(`${fileName}.meta`),
        ]);

        const parsedMeta: Record<string, any> = meta
            .split("\n")
            .map((x) => x.split(":"))
            .reduce((acc, x) => {
                acc[x[0]] = x[1];
                return acc;
            }, {} as Record<string, any>);

        return {
            success: true,
            execTime,
            execWallTime,
            memory: parseInt(parsedMeta["cg-mem"], 10),
            stdout: stdout,
            stderr: stderr,
        };
    } catch (e) {
        let code = "OTHER_ERROR";
        if (e.message.toLowerCase().indexOf("time limit exceeded") > -1) {
            code = "TIME_LIMIT_EXCEEDED";
        } else {
            console.log(e);
            console.log("error:", { ...e });
        }

        const [stdout, stderr] = await Promise.all([
            readThenDelete(`${box}/${fileName}.out`, true),
            readThenDelete(`${box}/${fileName}.err`, true),
        ]);

        return {
            success: false,
            errorCode: code,
            errorMessage: e.message,
            stdout,
            stderr,
        };
    }
}

export async function getIsolateVersion(): Promise<string> {
    return (await exec("isolate --version")).stdout;
}
