import fs from "fs";
import { promisify } from "util";
import { exec, GradeResult, GradeResultError, Language } from "./utils";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

export async function grade(
    testCases: {
        input: string;
        expectedOutput: string;
    }[],
    fileName: string,
    code: string,
    language: Language
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
        console.log(`Running ${language} code: \n${code}`);

        const ext = {
            [Language.PYTHON]: "py",
            [Language.CPP]: "cpp",
            [Language.JAVA]: "java",
        }[language];

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
                `sudo isolate -b 0 -p -E PATH --meta=${fileName}.meta --run /usr/bin/g++ -- -std=c++17 -o ${fileName} -O2 ` +
                    `-Im ${fileName}.cpp`,
                fileName
            );
        } else if (language === Language.JAVA) {
            compileResult = await getIsolateOutput(
                box,
                `sudo isolate -b 0 -p -E PATH --meta=${fileName}.meta --run /usr/lib/jvm/java-11-openjdk-amd64/bin/javac ${fileName}.java`,
                fileName
            );
        }

        // for python, which doesn't need compilation, compileResult won't exist
        if (compileResult && !compileResult.success) {
            await exec(`sudo isolate --cg  --cleanup`);
            return {
                success: false,
                error:
                    compileResult.errorCode === "TIME_LIMIT_EXCEEDED"
                        ? GradeResultError.COMPILE_TIMEOUT
                        : GradeResultError.COMPILE_ERROR,
                errorMessage: compileResult.errorMessage,
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
                await exec(`isolate --cg --cleanup`);
                throw new Error(
                    "Unable to find run result. This can happen if the language is not java, cpp, or python."
                );
            }
            if (!runResult.success) {
                results.push({
                    pass: false,
                    error:
                        runResult.errorCode === "TIME_LIMIT_EXCEEDED"
                            ? GradeResultError.TIME_LIMIT_EXCEEDED
                            : GradeResultError.RUNTIME_ERROR,
                });
                continue;
            }
            if (!runResult.stdout) {
                results.push({
                    pass: false,
                    error: GradeResultError.EMPTY_MISSING_OUTPUT,
                });
                continue;
            }
            if (runResult.stdout !== expectedOutput) {
                results.push({
                    pass: false,
                    error: GradeResultError.WRONG_ANSWER,
                });
                continue;
            }
            results.push({
                pass: true,
                time: runResult.execTime,
                wallTime: runResult.execWallTime,
                memory: runResult.memory,
            });
        }

        await exec(`sudo isolate --cg  --cleanup`);
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
          memory: number;
      }
    | {
          success: false;
          errorCode: string;
          errorMessage: string;
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

        const [stdout, stderr, meta] = (
            await Promise.all([
                readFile(`${box}/${fileName}.out`),
                readFile(`${box}/${fileName}.err`),
                readFile(`${box}/${fileName}.meta`),
            ])
        ).map((b) => b + "");
        await Promise.all([
            unlink(`${box}/${fileName}.out`),
            unlink(`${box}/${fileName}.err`),
            unlink(`${box}/${fileName}.meta`),
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
            memory: parsedMeta["cg-mem"],
            stdout: stdout,
        };
    } catch (e) {
        let code = "OTHER_ERROR";
        if (e.message.toLowerCase().indexOf("time limit exceeded") > -1) {
            code = "TIME_LIMIT_EXCEEDED";
        } else {
            console.log(e);
            console.log("error:", { ...e });
        }

        return {
            success: false,
            errorCode: code,
            errorMessage: e.message,
        };
    }
}

export async function getIsolateVersion(): Promise<string> {
    return (await exec("isolate --version")).stdout;
}
