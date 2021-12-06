import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { dbClient } from "../clients";
import { decompress } from "../helpers/utils";
import {
  ProblemSubmissionResult,
  ProblemSubmissionTestCaseResult,
  ExecutionVerdict,
} from "../types";

export default async function getSubmission(
  submissionID: string
): Promise<ProblemSubmissionResult> {
  const dbGetParams = {
    TableName: "online-judge",
    Key: {
      submissionID: {
        S: submissionID,
      },
    },
  };

  const getCommand = new GetItemCommand(dbGetParams);
  const response = (await dbClient.send(getCommand)).Item!;

  const data: ProblemSubmissionResult = {
    timestamp: parseInt(response.timestamp.S!),
    submissionID: response.submissionID.S!,
    status: response.status.S! as "compiling" | "executing" | "done",
    problemID: response.problemID.S!,
    language: response.language.S!,
    filename: response.filename.S!,
    sourceCode: decompress(response.sourceCode.B!),
    testCases: Object.keys(response.testCases.M!)
      .map((x) => parseInt(x))
      .sort()
      .map((idx) => response.testCases.M!["" + idx])
      .map<ProblemSubmissionTestCaseResult | null>((tc) =>
        tc.NULL
          ? null
          : {
              verdict: tc.M!.verdict.S! as ExecutionVerdict,
              time: tc.M!.time.S!,
              memory: tc.M!.memory.S!,
              input: decompress(tc.M!.input.B!),
              expectedOutput: decompress(tc.M!.expectedOutput.B!),
              stdout: decompress(tc.M!.stdout.B!),
              stderr: decompress(tc.M!.stderr.B!),
            }
      ),
  };

  if (response.message) {
    data.message = decompress(response.message.B!);
  }
  if (response.verdict) {
    data.verdict = response.verdict.S as ExecutionVerdict;
  }
  if (response.debugData) {
    data.debugData = decompress(response.debugData!.B!);
  }

  return data;
}
