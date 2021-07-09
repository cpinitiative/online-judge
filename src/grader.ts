import fs from "fs";
import { promisify } from "util";
import { exec } from "./utils";
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

export async function grade(
    code: string,
    options: {
        language: "python" | "c++";
    }
) {
    try {
        const { language } = options;
        console.log(`Running ${language} code: \n${code}`);
        const result = await run(code, language, "7\n1 2 5 10 394 495 3859");
        const pass =
            result.success &&
            result.exec.stdout === "1 4 25 100 155236 245025 14891881";
        let resultCode = "";
        if (result.stderr) {
            resultCode = "";
        } else if (!result.output) {
            resultCode = "EMPTY_OR_MISSING_OUTPUT";
        } else {
            resultCode = "WRONG_ANSWER";
        }
        if (pass) {
            resultCode = "PASS";
        }
        if (!result.success) {
            resultCode = result.errorCode;
        }
        return {
            pass,
            result: resultCode,
            ...result,
        };
    } catch (e) {
        await exec(`isolate --cg --cleanup`);
        console.warn(e);
        return {
            pass: false,
            result: "SERVER_ERROR_TRY_AGAIN_LATER",
        };
    }
}

function getIsolateCommands(
    problemName: string,
    language: "python" | "c++" | "java"
) {
    const ext = { python: "py", "c++": "cpp", java: "java" }[language];

    return {
        python: [null, `/usr/bin/python3 -O ${problemName}.${ext}`],
        "c++": [
            `/usr/bin/g++ -O2 -lm -std=c++0x ${problemName}.${ext}`,
            `./${problemName}`,
        ],
        java: [
            `/usr/lib/jvm/jdk1.8.0_271/bin/javac ${problemName}.${ext}`,
            `/usr/lib/jvm/jdk1.8.0_271/bin/java ${problemName}`,
        ],
    }[language];
}

type RunResult =
    | {
          success: false;
          status: "COMPILE_ERROR" | "COMPILE_TIME_LIMIT_EXCEEDED";
          compile: {
              time: number;
              wallTime: number;
              killed: boolean;
              stdout: string;
              stderr: string;
          };
      }
    | {
          success: boolean;
          status:
              | "SUCCESS"
              | "RUNTIME_ERROR"
              | "EMPTY_OR_MISSING_OUTPUT"
              | "TIME_LIMIT_EXCEEDED";
          compile: {
              time: number;
              wallTime: number;
              killed: boolean;
              stdout: string;
              stderr: string;
          };
          exec: {
              time: number;
              wallTime: number;
              killed: boolean;
              stdout: string;
              stderr: string;
          };
      };
export async function run(
    code: string,
    language: "python" | "c++",
    input: string
): Promise<RunResult> {
    const limits = {
        memory: 256 * 1000, // kb
        time: 1, // s
        extraTime: 1, // s
        wallTime: 10, //s
    };
    const ext = { python: "py", "c++": "cpp", java: "java" }[language];
    const problemName = "squares";
    const compileOptions = `--meta=meta.txt --processes=100 --stderr=stderr.txt --stdout=stdout.txt --mem=${limits.memory} --time=30 --wall-time=90 --extra-time=10 --wall-time=${limits.wallTime}`;
    const runOptions = `--meta=meta.txt --processes=100 --stderr=stderr.txt --stdin=stdin.txt --stdout=${problemName}.out --mem=${limits.memory} --time=${limits.time} --extra-time=${limits.extraTime} --wall-time=${limits.wallTime}`;

    const initResult = await exec(`isolate --cg --init`).catch(async (e) => {
        console.log(e);
        console.log("Cleaning up and trying again");
        await exec(`isolate --cg --cleanup`);
        return exec(`isolate --cg --init`);
    });

    const dir = initResult.stdout;
    const box = dir.replace(/\n/g, "") + "/box";

    await Promise.all([
        writeFile(`${box}/${problemName}.${ext}`, code),
        writeFile(`${box}/${problemName}.in`, input),
    ]);

    const command = getCommands(problemName, language);

    let compileOutput: IsolateResult;
    if (command[0]) {
        compileOutput = await runWithIsolate(box, compileOptions, command[0]);
        if (!compileOutput?.success) {
            // TODO
            return {
                status: "COMPILE_ERROR",
            };
        }
    }

    const runOutput = await runWithIsolate(compileOptions, command[1]);

    await exec(`isolate --cg --cleanup`);
    if (success) {
        return {
            success,
            execTime,
            execWallTime,
            output: out + "",
            stderr: err + "",
            meta: meta,
        };
    } else {
        return {
            success,
            execTime,
            execWallTime,
            output: out + "",
            stderr: err + "",
            errorCode: errorCode as "TIME_LIMIT_EXCEEDED" | "RUNTIME_ERROR",
            meta: meta,
        };
    }
}

interface IsolateResult {
    success: boolean;
    execTime: number;
    execWallTime: number;
    errorCode: string;
    fullOutput: string | {};
}

async function runWithIsolate(
    box: string,
    options: string,
    command: string
): Promise<IsolateResult> {
    try {
        const { stdout: isolateStdout, stderr: isolateStderr } = await exec(
            `isolate --cg ${options} --env=HOME=/home/user --run -- ${command}`,
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
                readFile(`${box}/stdout.txt`),
                readFile(`${box}/stderr.txt`),
                readFile(`${box}/meta.txt`),
            ])
        ).map((b) => b + "");
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
            errorCode: "",
            fullOutput: output,
        };
    } catch (e) {
        console.log({ ...e });

        let code = "UNKNOWN";
        if (e.message.toLowerCase().indexOf("time limit exceeded") > -1) {
            code = "TIME_LIMIT_EXCEEDED";
        }
        return {
            success: false,
            execTime: -1,
            execWallTime: -1,
            errorCode: code,
            fullOutput: e.message,
        };
    }
}

export async function getIsolateVersion(): Promise<string> {
    return (await exec("isolate --version")).stdout;
}
