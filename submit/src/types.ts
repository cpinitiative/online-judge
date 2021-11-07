export interface CodeExecutionRequestData {
  language: "cpp" | "java" | "py";
  filename: string;
  compilerOptions: string;
  sourceCode: string;
  input: string;
}

// Temporarily copy pasted from the execute lambda...
export interface CodeExecutionResult {
  status: "success";
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  exitSignal: string | null;
  processError: string | null;
}

export interface ProblemSubmissionRequestData {
  problemID: string;
  language: string;
  filename: string;
  sourceCode: string;
}

export interface ProblemSubmissionResult {
  submissionID: string;
  status: "compiling" | "executing" | "done" | "internal_error";
  verdict: ExecutionVerdict;
  testCases: ProblemSubmissionTestCaseResult[];

  problemID: string;
  language: string;
  filename: string;
  sourceCode: string; // gzipped in dynamodb
}

export interface ProblemSubmissionTestCaseResult {
  verdict: ExecutionVerdict;
  time: string;
  memory: string;

  // each of these is truncated to 4kb then gzipped in dynamodb
  input: string;
  expectedOutput: string;
  stdout: string;
  stderr: string;
}

export type ExecutionVerdict = "AC" | "WA" | "RTE" | "MLE" | "TLE" | "CE"; // IE is internal error
