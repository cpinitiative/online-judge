import "source-map-support/register";

import { exec, execFile, execFileSync } from "child_process";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  rmdirSync,
} from "fs";

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
    };

export type ExecuteResult = {
  status: string;
  [key: string]: string;
};

export const lambdaHandler = async function (
  event: ExecuteEvent
): Promise<ExecuteResult> {
  if (event.type === "compile") {
    if (!existsSync("/tmp/out")) mkdirSync("/tmp/out");
    writeFileSync(`/tmp/out/${event.filename}`, event.sourceCode);

    if (!["cpp", "java", "py"].includes(event.language)) {
      return {
        status: "error",
        message: "Unknown Language " + event.language,
      };
    }

    if (event.language === "py") {
      writeFileSync(
        "/tmp/out/run.sh",
        'python3.8 "' + event.filename + '"'
      );
      execFileSync("zip", ["-r", "/tmp/out.zip", "-j", "/tmp/out"]);

      const base64Output = readFileSync("/tmp/out.zip", {
        encoding: "base64",
      });

      unlinkSync("/tmp/out.zip");
      rmdirSync("/tmp/out", { recursive: true });

      return {
        status: "success",
        output: base64Output,
      };
    }

    const command = {
      cpp: "g++",
      java: "javac",
    }[event.language];

    return await new Promise((resolve, reject) => {
      execFile(
        command,
        [
          ...event.compilerOptions.split(" "),
          ...(event.language === "cpp"
            ? ["-o", "/tmp/out/prog"]
            : ["-d", "/tmp/out"]),
          `/tmp/out/${event.filename}`,
        ].filter((x) => !!x),
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }

          writeFileSync(
            "/tmp/out/run.sh",
            event.language === "cpp"
              ? "./prog"
              : 'java "' + event.filename.split(".")[0] + '"'
          );
          execFileSync("zip", ["-r", "/tmp/out.zip", "-j", "/tmp/out"]);

          const base64Output = readFileSync("/tmp/out.zip", {
            encoding: "base64",
          });

          resolve({
            status: "success",
            output: base64Output,
          });

          unlinkSync("/tmp/out.zip");
          rmdirSync("/tmp/out", { recursive: true });
        }
      );
    });
  } else if (event.type === "execute") {
    if (!existsSync("/tmp/out")) mkdirSync("/tmp/out");
    writeFileSync("/tmp/program.zip", event.payload, "base64");
    writeFileSync("/tmp/input.txt", event.input);
    execFileSync("unzip", ["-o", "/tmp/program.zip", "-d", "/tmp/program"]);
    return await new Promise((resolve, reject) => {
      exec(
        "cd /tmp/program; sh /tmp/program/run.sh < /tmp/input.txt",
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
          }
          resolve({
            status: "success",
            stdout,
            stderr,
          });
          unlinkSync("/tmp/program.zip");
          unlinkSync("/tmp/input.txt");
          rmdirSync("/tmp/program", { recursive: true });
          rmdirSync("/tmp/out", { recursive: true });
        }
      );
    });
  }
  return {
    status: "error",
    // @ts-expect-error
    message: "Unknown event type " + event.type,
  };
};
