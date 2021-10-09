import { spawnSync, execFileSync } from "child_process";
import {
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  rmdirSync,
} from "fs";
import { extractTimingInfo, zipAndRemoveOutDir } from "./utils";

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
  | {
    status: "compile_error";
    /**
     * Compilation error message
     */
    message: string;
  }
  | {
    status: "success";
    /**
     * Base64 encoded ZIP file containing the output
     */
    output: string;
  };

export type ExecutionResult = {
  status: "success",
  stdout: string,
  stderr: string,
  time: string,
  memory: string,
} | {
  status: "runtime_error",
  message: string,
  stdout: string,
  stderr: string,
  time: string,
  memory: string,
} | {
  status: "time_limit_exceeded",
  stdout: string,
  stderr: string,
};

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
      };
    }

    const cppCompilationCommand = "g++",
      javaCompilationCommand = "javac";
    const cppCompilationOptions = ["-o", "/tmp/out/prog"],
      javaCompilationOptions = ["-d", "/tmp/out"];
    const cppExecutionCommand = "./prog",
      javaExecutionCommand = 'java "' + event.filename.split(".")[0] + '"';

    const { status, stderr } = spawnSync(
      event.language === "cpp"
        ? cppCompilationCommand
        : javaCompilationCommand,
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
      }
    );
    if (status !== 0) {
      return {
        status: "compile_error",
        message: stderr.toString(),
      };
    }

    writeFileSync(
      "/tmp/out/run.sh",
      event.language === "cpp"
        ? cppExecutionCommand
        : javaExecutionCommand
    );

    return {
      status: "success",
      output: zipAndRemoveOutDir(),
    };
  } else if (event.type === "execute") {
    writeFileSync("/tmp/program.zip", event.payload, "base64");
    execFileSync("unzip", ["-o", "/tmp/program.zip", "-d", "/tmp/program"]);

    const { stdout, stderr: stderrWithTime, error, signal } = spawnSync(
      "/usr/bin/time -v sh /tmp/program/run.sh",
      {
        cwd: "/tmp/program",
        input: event.input,
        timeout: event.timeout ?? 5000,
        shell: true,
      }
    );

    unlinkSync("/tmp/program.zip");
    rmdirSync("/tmp/program", { recursive: true });
    rmdirSync("/tmp/out", { recursive: true });

    if (signal === "SIGTERM" && error?.message.toString() === "spawnSync /bin/sh ETIMEDOUT") {
      return {
        status: "time_limit_exceeded",
        stdout: stdout.toString(),
        stderr: stderrWithTime.toString(),
      }
    }

    const {
      restOfString: stderr,
      time,
      memory
    } = extractTimingInfo(stderrWithTime.toString());

    if (!time || !memory) {
      return {
        status: "internal_error",
        message: "Time and memory are null but they shouldn't be",
      };
    }
    
    if (error) {
      return {
        status: "runtime_error",
        message: error.message,
        stdout: stdout.toString(),
        stderr: stderr,
        time,
        memory
      };
    }

    return {
      status: "success",
      stdout: stdout.toString(),
      stderr: stderr,
      time,
      memory
    };
  } else {
    return {
      status: "internal_error",
      // @ts-expect-error
      message: "Unknown event type " + event.type,
    };
  }
};
