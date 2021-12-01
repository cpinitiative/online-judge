import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../clients";
import { streamToString } from "../helpers/utils";

export interface ProblemTestCase {
  id: number;
  input: string;
  expectedOutput: string;
}

export default async function fetchProblemTestCases(problemID: string) {
  const fetchProblemDirectoryParams = {
    Bucket: "cpi-onlinejudge",
    Delimiter: "/",
    Prefix: problemID + "/",
  };

  const resp = await s3Client.send(
    new ListObjectsV2Command(fetchProblemDirectoryParams)
  );
  const files = resp.Contents;

  if (!files) {
    throw new Error(
      "Could not find test cases for problem " +
        problemID +
        ". Does this problem exist?"
    );
  }

  const numTestCases = files.length / 2;
  const testCases: ProblemTestCase[] = new Array(numTestCases)
    .fill(null)
    .map((_, i) => ({
      id: i,
      input: "",
      expectedOutput: "",
    }));

  await Promise.all(
    files.map(async (file) => {
      const fileParams = {
        Bucket: "cpi-onlinejudge",
        Key: file.Key,
      };
      const fileCommand = new GetObjectCommand(fileParams);
      const response = await s3Client.send(fileCommand);
      const content = await streamToString(response.Body);

      const regexMatch = file.Key!.match(/\/(\d+)\.(in|out)/);
      if (!regexMatch) {
        throw new Error("Failed to parse file name " + file.Key);
      }
      const testCaseNumber = parseInt(regexMatch[1]);
      const isInput = regexMatch[2] === "in";
      if (isInput) {
        testCases[testCaseNumber - 1].input = content;
      } else {
        testCases[testCaseNumber - 1].expectedOutput = content;
      }
    })
  );

  return testCases;
}
