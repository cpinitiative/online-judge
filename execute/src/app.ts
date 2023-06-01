import { spawnSync, execFileSync, spawn } from "child_process";
import {
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  rmdirSync,
  readFileSync,
} from "fs";
import {
  ExecuteProcessOutput,
  compress,
  parseReturnInfoOfSpawn,
  zipAndRemoveOutDir,
} from "./utils";
import { gunzipSync } from "zlib";
import { Readable } from "stream";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({ region: "us-west-1" });

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
      /**
       * If true, fetches input from S3. expects file.Key
       * Defaults to false
       */
      fetchInputFromS3?: boolean;
      /**
       * If provided, in addition to standard input/output,
       * file I/O will also be used. [fileIOName].in will
       * be written and [fileIOName].out will be read.
       */
      fileIOName?: string;
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
      message: string;
    }
  | {
      status: "success";
      /**
       * Base64 encoded ZIP file containing the output
       */
      output: string;
      processOutput: ExecuteProcessOutput | null;
    };

export type ExecutionResult =
  | {
      status: "success";
    } & ExecuteProcessOutput;

const MAX_BUFFER_SIZE = 1024 * 1024 * 30; // 30mb. note that 6mb is API gateway limit for lambda

export const promiseLambdaHandler = async function (
  event: ExecuteEvent
): Promise<CompilationResult | ExecutionResult> {
  if (existsSync("/tmp/out")) {
    rmdirSync("/tmp/out", { recursive: true });
  }
  if (existsSync("/tmp/program")) {
    rmdirSync("/tmp/program", { recursive: true });
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
    const cppCompilationCommand = process.env.AWS_EXECUTION_ENV
        ? "/opt/rh/devtoolset-10/root/usr/bin/g++"
        : "g++",
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
    const processOutput = await parseReturnInfoOfSpawn(spawnResult, {
      isOutputCompressed: false,
    });
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
    // if (event.fetchInputFromS3) {
    //   const fileParams = {
    //     Bucket: "cpi-onlinejudge",
    //     Key: event.input,
    //   };
    //   const fileCommand = new GetObjectCommand(fileParams);
    //   const response = (await s3Client.send(fileCommand)) as any;
    //   const content = await streamToString(response.Body);
    //   event.input = content;
    // } else {
    event.input = decompress(Buffer.from(event.input, "base64"));
    // }
    writeFileSync("/tmp/program.zip", event.payload, "base64");
    execFileSync("unzip", ["-o", "/tmp/program.zip", "-d", "/tmp/program"]);

    if (event.fileIOName) {
      writeFileSync(`/tmp/program/${event.fileIOName}.in`, event.input);
    }

    const spawnResult = spawnSync(
      // uncomment the below for macs (also run brew install coreutils)
      // `/opt/homebrew/bin/gtime -v /opt/homebrew/bin/gtimeout ${(
      `ulimit -c 0 && ulimit -s unlimited && /usr/bin/time -v /usr/bin/timeout ${(
        (event.timeout ?? 5000) / 1000
      ).toFixed(3)}s sh /tmp/program/run.sh`,
      {
        cwd: "/tmp/program",
        input: event.input,
        shell: true,
        maxBuffer: MAX_BUFFER_SIZE,
      }
    );

    let fileIOInfo: Partial<ExecuteProcessOutput> = {};
    if (event.fileIOName) {
      if (existsSync(`/tmp/program/${event.fileIOName}.out`)) {
        fileIOInfo.fileOutput = readFileSync(
          `/tmp/program/${event.fileIOName}.out`
        ).toString();
      } else {
        fileIOInfo.fileOutput = null;
      }
    }

    unlinkSync("/tmp/program.zip");
    rmdirSync("/tmp/program", { recursive: true });
    rmdirSync("/tmp/out", { recursive: true });

    return {
      status: "success",
      ...(await parseReturnInfoOfSpawn(spawnResult)),
      ...fileIOInfo,
    };
  } else {
    return {
      status: "internal_error",
      // @ts-expect-error
      message: "Unknown event type " + event.type,
    };
  }
};

export function decompress(data: Uint8Array): string {
  return gunzipSync(data).toString();
}

declare const awslambda: any;

export const lambdaHandler = awslambda.streamifyResponse(
  async (event: any, responseStream: any) => {
    const resp = await promiseLambdaHandler(event);
    responseStream.write(JSON.stringify(resp));
    responseStream.end();
  }
);

export async function streamToString(stream: Readable): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}
