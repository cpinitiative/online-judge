import { APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";
import { buildResponse, extractTimingInfo } from "./utils";
const AWS = require('aws-sdk')
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient, CreateTableCommand, CreateTableCommandInput } from "@aws-sdk/client-dynamodb";

import { v4 as uuidv4 } from 'uuid';


const client = new LambdaClient({
  region: "us-west-1",
});

AWS.config.update({
  accessKeyId: "AKIAWCOXREPQGDVKJOOV",
  secretAccessKey: "AKIAWCOXREPQGDVKJOOV",
  region: "us-west-1"
});

const dynamo = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

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
    case 'POST /submissions': // create a new problem submission (POST)
      const submissionID = uuidv4();
      // todo validate structure of body?


      const params =  {
        Bucket:'cpi-onlinejudge',
        Delimiter: '/',
        Prefix: requestData.problemid + '/'
      };

      // store expected in and put in a map
        // iterate through map elemntes and run a execute function and process/store the result in an  array
        // return that array to the fromtend...

      let outFiles:string [] = [];
      let inFiles :string [] = [];
      let len:number = 0;

      s3.listObjects(params, function (err:any, data:any) { // get file content, number of test cases
        if (err) {
          console.log('There was an error getting your files: ' + err);
          return;
        }
        console.log('Successfully get files.', data);

        const fileDetails = data.Contents;
        len = fileDetails.length;
        console.log(len)

        for (const file of fileDetails) {
          const fileParams = {
            Bucket: 'cpi-onlinejudge',
            Key: file.key // name of the file
          }
          let data = s3.getObject(params).promise().Body.toString('utf-8') // get file content
          const dot: number = file.key.indexOf('.');
          const tcNum: number = Number(file.key.substr(0, dot)); // get the tc number as specfied by the fileName.

          file.key.indexOf('out') !== -1 ? outFiles[tcNum] = data : inFiles[tcNum] = data; // match the file content to the correct index
        }
        ;
      });

      let results: string[] = []; // execute each test case
      let status: string[] = []; // execute each test case
      for (let i = 1; i <= len; i++) {
        const execData = await execute(requestData, event, inFiles[i]);
          results[i] = execData.body;
          status[i] = JSON.parse(results[i]).status;
      }

      await dynamo
          .put({
            TableName: "statusTable",
            Item: {
              submissionId: submissionID,
              results: JSON.stringify(results),
              verdict: status,  //  one string result for each case ie ("compile_error")
            }
          })
          .promise();

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          submissionId: submissionID
        })
      };
      break;

    case 'POST /execute':

      return execute(requestData, event,  requestData.input);

      break;
    case 'GET /submissions/{submissionId}':
      body = await dynamo
          .get({
            TableName: "statusTable",
            Key: {
              id: event.pathParameters!.submissionid
            }
          })
          .promise();

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          body
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

const execute = async (requestData:any, event:APIGatewayProxyEvent, input:string) => {
  if (!requestData.language) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        status: "Unknown language.",
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
          input:  input,
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

  const {stdout, exitCode, exitSignal, processError} = executeData;

  const {
    restOfString: stderr,
    time,
    memory,
  } = extractTimingInfo(executeData.stderr);




  // 124 is the exit code returned by linux `timeout` command
  if (exitCode === 124) {
    let statusList = [{
      status: "time_limit_exceeded", // get the test cases from S3 bucket;
      // TODO: Edit execute function such that it returns an array of test cases
      stdout: stdout,
      stderr: stderr,
      time: time,
      memory: memory,
      exitCode: exitCode,
    }]

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
}
