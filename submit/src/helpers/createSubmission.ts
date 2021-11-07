import { dbClient, s3Client } from "../clients";
import { ProblemSubmissionRequestData } from "../types";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { ListObjectsCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import execute from "./execute";
const crypto = require("crypto");

var salt = crypto.randomBytes(128).toString("base64");

export default async function createSubmission(
  submissionID: string,
  requestData: ProblemSubmissionRequestData
) {
  const params = {
    Bucket: "cpi-onlinejudge",
    Delimiter: "/",
    Prefix: requestData.problemID,
  };

  let outFiles: string[] = [];
  let inFiles: string[] = [];
  let len: number = 0;

  const command = new ListObjectsCommand(params);
  const data = await s3Client.send(command);
  const fileDetails: any = data.Contents;
  for (const file of fileDetails) {
    len++;
    const fileParams = {
      Bucket: "cpi-onlinejudge",
      Key: file.Key,
    };
    const fileCommand = new GetObjectCommand(fileParams);
    const response = await s3Client.send(fileCommand);
    let stream = response.Body!;
    const rawFileContent = await streamToString(stream);
    let processedContent = rawFileContent.trim();

    // process file name to extract test_case number
    const dot: number = file.Key.indexOf(".");
    const slash: number = file.Key.indexOf("/");
    const tcNum: number = Number(file.Key.substr(slash + 1, dot - (slash + 1))); // get the tc number as specfied by the fileName.
    file.Key.indexOf("out") !== -1
      ? (outFiles[tcNum] = processedContent)
      : (inFiles[tcNum] = processedContent); // match the file content to the correct index
  }

  len /= 2;
  console.log(len);
  let results: string[] = []; // execute general output
  let status: string[] = []; // judge verdict when comparing s3 output to execute lambda user stdout
  for (let i = 1; i <= len; i++) {
    // console.log(inFiles[i])
    const execData = await execute(requestData as any, inFiles[i]);
    results[i] = execData.body;

    if (JSON.parse(results[i]).status == "success") {
      let output: string = JSON.parse(results[i]).stdout;
      output = output.trim(); /// removes any whitespace before and after the string
      outFiles[i] = outFiles[i].trim();
      outFiles[i] = outFiles[i].replace(/(\r\n|\n|\r)/gm, ""); // trimming new lines

      if (hashOutput(salt, output) == hashOutput(salt, outFiles[i])) {
        status[i] = "correct";
      } else {
        status[i] = "wrong";
      }
    } else {
      status[i] = JSON.parse(results[i]).status;
    }
  }

  console.log(submissionID + " " + results + " " + status);
  console.log(status.toString());
  const dbParams = {
    TableName: "online-judge",
    Item: {
      submissionID: {
        S: submissionID,
      },
      results: {
        SS: results,
      },
      verdict: {
        S: status.toString(),
      },
      cases: {
        N: len.toString(),
      },
    },
  };

  const dbCommand = new PutItemCommand(dbParams);
  const response = await dbClient.send(dbCommand);

  return {
    statusCode: 500,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      submissionID: submissionID,
      verdict: status.toString(),
      testCases: len,
      detailed: results,
    }),
  };
}

async function streamToString(stream: Readable): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

function hashOutput(salt: any, pwd: any) {
  var hmac = crypto.createHmac("sha256", salt);
  return hmac.update(pwd).digest("hex");
}
