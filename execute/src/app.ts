import { spawnSync, execFileSync, spawn } from "child_process";
import {
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  rmdirSync,
} from "fs";
import {
  ExecuteProcessOutput,
  parseReturnInfoOfSpawn,
  zipAndRemoveOutDir,
} from "./utils";

export type ExecuteEvent =
  | {
      type: "compile";
      filename: string;
      sourceCode: string;
      compilerOptions: string;
      language: "cpp" | "java" | "py";
    }
  | {
      type: "execute";
      payload: string;
      input: string;
      timeout?: number;
    };

export type CompilationResult =
  | {
      status: "internal_error";
      /**
       * Ex. "Unknown Language"
       */
      message: string;
    }
  | ({
      status: "compile_error";
      message: string;
    })
  | {
      status: "success";
      /**
       * Base64 encoded ZIP file containing the output
       */
      output: string;
      processOutput: ExecuteProcessOutput | null,
    };

export type ExecutionResult =
  | {
      status: "success";
    } & ExecuteProcessOutput;

const MAX_BUFFER_SIZE = 1024*1024*30; // 30mb. note that 6mb is API gateway limit for lambda

export const lambdaHandler = async function (
  event: ExecuteEvent
): Promise<CompilationResult | ExecutionResult> {
  if (existsSync("/tmp/out")) {
    rmdirSync("/tmp/out", { recursive: true });
  }
  mkdirSync("/tmp/out");

  if (event.type === "compile") {
    writeFileSync(`/tmp/out/${event.filename}`, event.sourceCode);

    if (!["cpp", "java", "py"].includes(event.language)) {
      return {
        status: "internal_error",
        message: "Unknown Language: " + event.language,
      };
    }

    if (event.language === "py") {
      writeFileSync("/tmp/out/run.sh", 'python3.8 "' + event.filename + '"');

      return {
        status: "success",
        output: zipAndRemoveOutDir(),
        processOutput: null,
      };
    }

    // if process.env.AWS_EXECUTION_ENV is set, then we're running in Amazon Linux 2, which has a special path to g++
    const cppCompilationCommand = process.env.AWS_EXECUTION_ENV ? "/opt/rh/devtoolset-10/root/usr/bin/g++" : "g++",
      javaCompilationCommand = "javac";
    const cppCompilationOptions = ["-o", "/tmp/out/prog"],
      javaCompilationOptions = ["-d", "/tmp/out"];
    const cppExecutionCommand = "./prog",
      javaExecutionCommand = 'java "' + event.filename.split(".")[0] + '"';

    const spawnResult = spawnSync(
      event.language === "cpp" ? cppCompilationCommand : javaCompilationCommand,
      [
        ...event.compilerOptions.split(" "),
        ...(event.language === "cpp"
          ? cppCompilationOptions
          : javaCompilationOptions),
        event.filename,
      ].filter((x) => !!x),
      {
        cwd: "/tmp/out",
        timeout: 6000,
        shell: true,
      }
    );
    const processOutput = parseReturnInfoOfSpawn(spawnResult);
    if (spawnResult.status !== 0) {
      return {
        status: "compile_error",
        message: processOutput.stderr ?? "",
      };
    }

    writeFileSync(
      "/tmp/out/run.sh",
      event.language === "cpp" ? cppExecutionCommand : javaExecutionCommand
    );

    return {
      status: "success",
      output: zipAndRemoveOutDir(),
      processOutput: processOutput,
    };
  } else if (event.type === "execute") {
    writeFileSync("/tmp/program.zip", event.payload, "base64");
    execFileSync("unzip", ["-o", "/tmp/program.zip", "-d", "/tmp/program"]);

    const spawnResult = spawnSync(`/usr/bin/time -v /usr/bin/timeout ${((event.timeout ?? 5000)/1000).toFixed(3)}s sh /tmp/program/run.sh`, {
      cwd: "/tmp/program",
      input: event.input,
      shell: true,
      maxBuffer: MAX_BUFFER_SIZE
    });

    unlinkSync("/tmp/program.zip");
    rmdirSync("/tmp/program", { recursive: true });
    rmdirSync("/tmp/out", { recursive: true });

    return {
      status: "success",
      ...parseReturnInfoOfSpawn(spawnResult),
    };
  } else {
    return {
      status: "internal_error",
      // @ts-expect-error
      message: "Unknown event type " + event.type,
    };
  }
};
