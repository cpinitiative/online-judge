import { APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";
import { buildResponse, extractTimingInfo } from "./utils";
import { S3Client, AbortMultipartUploadCommand, ListObjectsCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
const { DynamoDBClient, ListTablesCommand, CreateTableCommand, CreateTableCommandInput, PutItemCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");
import { v4 as uuidv4 } from 'uuid';


const client = new LambdaClient({
  region: "us-west-1",
});

const config = {
  accessKeyId: "AKIAWCOXREPQGDVKJOOV",
  secretAccessKey: "AKIAWCOXREPQGDVKJOOV",
};

  const db = new DynamoDBClient({credentials: config,   region: "us-west-1"});
  const s3 = new S3Client({credentials: config,   region: "us-west-1"});

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

      const command =  new ListObjectsCommand(params);
      const data = await s3.send(command);

      const fileDetails:any = data.Contents;
      len = fileDetails.length;
      console.log(len)

      for (const file of fileDetails) {
        const fileParams = {
          Bucket: 'cpi-onlinejudge',
          Key: file.key // name of the file
        }
        const fileCommand = new GetObjectCommand(fileParams);
        const response = await s3.send(fileCommand);
        let rawFileContent = response.Body.toString('utf-8')// get file content

        const dot: number = file.key.indexOf('.');
        const tcNum: number = Number(file.key.substr(0, dot)); // get the tc number as specfied by the fileName.
        file.key.indexOf('out') !== -1 ? outFiles[tcNum] = rawFileContent : inFiles[tcNum] = rawFileContent; // match the file content to the correct index
      }

      let results: string[] = []; // execute each test case
      let status: string[] = []; // execute each test case
      for (let i = 1; i <= len; i++) {
        const execData = await execute(requestData, event, inFiles[i]);
          results[i] = execData.body;
          const output:string = JSON.parse(results[i]).body.stdout;
          if(output == outFiles[i]){
            status[i] = "correct";
          }else{
            status[i] = "wrong";
          }
      }

      const dbParams = {
      TableName: "statusTable",
          Item: {
        submissionId: submissionID,
            results: JSON.stringify(results),
            verdict: status,  //  one string result for each case ie ("compile_error")
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
          submissionId: submissionID
        })
      };
      break;

    case 'POST /execute':

      return execute(requestData, event,  requestData.input);

      break;
    case 'GET /submissions/{submissionId}':
      const dbGetParams = {
        TableName: "statusTable",
        Key: {
          id: event.pathParameters!.submissionid
        }
      }

      const getCommand = new GetItemCommand(dbGetParams);
      const getResponse = await client.send(getCommand);

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
