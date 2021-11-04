import { APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";
import { buildResponse, extractTimingInfo } from "./utils";
import { S3Client, AbortMultipartUploadCommand, ListObjectsCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
const { DynamoDBClient, ListTablesCommand, CreateTableCommand, CreateTableCommandInput, PutItemCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");
import { Readable } from 'stream';
const { v4: uuidv4 } = require('uuid');
import * as dotenv from 'dotenv';
const crypto = require('crypto');



dotenv.config();
const config = {
  accessKeyId: "AKIAWCOXREPQHOPUGP3E",
  secretAccessKey: "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",
};

const client = new LambdaClient({
  region: "us-west-1",
  credentials: config
});
const db = new DynamoDBClient({credentials: config,   region: "us-west-1"});
const s3 = new S3Client({credentials: config,   region: "us-west-1"});

var salt = crypto.randomBytes(128).toString('base64');

// Temporarily copy pasted from the execute lambda...
interface ExecuteResult {
  status: "success";
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  exitSignal: string | null;
  processError: string | null;
}

// Note: for problem submission, some flags to keep in mind: http://usaco.org/index.php?page=instructions

export const lambdaHandler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestData = JSON.parse(event.body || "{}");
  let body;

  switch (event.httpMethod) {
    case 'POST': // create a new problem submission (POST)
      const submissionID = uuidv4();
      // todo validate structure of body?


      const params =  {
        Bucket:'cpi-onlinejudge',
        Delimiter: '/',
        Prefix: requestData.problemid
      };

      // store expected in and put in a map
      // iterate through map elemntes and run a execute function and process/store the result in an  array
      // return that array to the fromtend...

      let outFiles:string [] = [];
      let inFiles :string [] = [];
      let len:number = 0;

      const command =  new ListObjectsCommand(params);
      const data = await s3.send(command);
      const fileDetails:any = data.Contents;
      for (const file of fileDetails) {
        len++;
        const fileParams = {
          Bucket: 'cpi-onlinejudge',
          Key: file.Key
        }
        const fileCommand = new GetObjectCommand(fileParams);
        const response = await s3.send(fileCommand);
        let stream = response.Body!;
        const rawFileContent = await streamToString(stream);
        let processedContent = rawFileContent.trim();

        const dot: number = file.Key.indexOf('.');
        const slash:number = file.Key.indexOf('/');
        const tcNum: number = Number(file.Key.substr(slash+1,  dot - (slash+1))); // get the tc number as specfied by the fileName.
        file.Key.indexOf('out') !== -1 ? outFiles[tcNum] = processedContent : inFiles[tcNum] = processedContent; // match the file content to the correct index
      }

      len /= 2;
      console.log(len)
      let results: string[] = []; // execute general output
      let status: string[] = []; // judge verdict when comparing s3 output to execute lambda user stdout
      for (let i = 1; i <= len; i++) {
        // console.log(inFiles[i])
        const execData = await execute(requestData, event, inFiles[i]);
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
          }else{
            status[i] = JSON.parse(results[i]).status;
          }
      }

      console.log(submissionID + " " + results + " " + status)
      console.log(status.toString())
      const dbParams = {
        TableName: "online-judge",
        Item: {
          "submissionID": {
            S: submissionID
          },
          "results": {
            SS: results
          },
          "verdict": {
            S: status.toString()
          },
          "cases": {
            N: len.toString()
          }
        }
      }

      const dbCommand = new PutItemCommand(dbParams);
      const response = await db.send(dbCommand);

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          submissionID: submissionID,
          verdict: status.toString(),
          testCases: len,
          detailed: results
        })
      };
      break;

    case 'POST /execute':

      return execute(requestData, event,  requestData.input);

      break;
    case 'GET /submissions/{submissionId}':
      const dbGetParams = {
        TableName: "online-judge",
        Key: {
          id: event.pathParameters!.submissionid
        }
      }

      const getCommand = new GetItemCommand(dbGetParams);
      const getResponse = await db.send(getCommand);

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          status: getResponse
        })
      };

      break;
    default:
      return {
        statusCode: 100,
        headers: {
          'Content-Type': 'application/json',
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          status: "Inavalid event"
        })
      };
  }

};

const execute = async (requestData:any, event:APIGatewayProxyEvent, problemInput:string) => {
  if (!requestData.language) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Unknown language.",
      }),
    };
  }

  const compileCommand = new InvokeCommand({
    FunctionName: "online-judge-ExecuteFunction",
    Payload: Buffer.from(
        JSON.stringify({
          type: "compile",
          language: requestData.language,
          compilerOptions: requestData.compilerOptions,
          filename: requestData.filename,
          sourceCode: requestData.sourceCode,
        }),
        "utf-8"
    ),
  });
  const compileResponse = await client.send(compileCommand);
  const compileData = JSON.parse(
      Buffer.from(compileResponse.Payload!).toString()
  );

  if (compileData.status === "compile_error") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: Buffer.from(compileResponse.Payload!).toString(),
    };
  } else if (compileData.status === "internal_error") {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        status: "internal_error",
        message: "Compilation failed with an internal error",
        debugData: compileData,
      }),
    };
  } else if (compileData.status !== "success") {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        status: "internal_error",
        message: "Compilation failed with an unknown error",
        debugData: compileData,
      }),
    };
  }

  const executeCommand = new InvokeCommand({
    FunctionName: "online-judge-ExecuteFunction",
    Payload: Buffer.from(
        JSON.stringify({
          type: "execute",
          payload: compileData.output,
          input: problemInput,
          timeout: 5000,
        })
    ),
  });
  const executeResponse = await client.send(executeCommand);
  const executeData: ExecuteResult = JSON.parse(
      Buffer.from(executeResponse.Payload!).toString()
  );

  if (executeData.status !== "success") {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        status: "internal_error",
        message: "Execution failed for an unknown reason",
        debugData: executeData,
      }),
    };
  }

  const { stdout, exitCode, exitSignal, processError } = executeData;

  const {
    restOfString: stderr,
    time,
    memory,
  } = extractTimingInfo(executeData.stderr);

  // 124 is the exit code returned by linux `timeout` command
  if (exitCode === 124) {
    return buildResponse({
      status: "time_limit_exceeded",
      stdout,
      stderr,
      time,
      memory,
      exitCode,
    });
  }

  if (exitCode !== 0) {
    return buildResponse({
      status: "runtime_error",
      stdout,
      stderr,
      time,
      memory,
      exitCode,
    });
  }

  return buildResponse({
    status: "success",
    stdout,
    stderr,
    time,
    memory,
  });
};

async function streamToString (stream: Readable): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

function hashOutput(salt: any, pwd: any) {
  var hmac = crypto.createHmac('sha256', salt);
  return hmac.update(pwd).digest('hex');
};
