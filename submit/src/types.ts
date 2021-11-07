// WIP
export interface CodeExecutionRequestData {
  language: "cpp" | "java" | "py";
  filename: string;
  compilerOptions: string;
  sourceCode: string;
}

export interface ProblemSubmissionRequestData {
  problemID: string;
}

// Temporarily copy pasted from the execute lambda...
export interface ExecuteResult {
  status: "success";
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  exitSignal: string | null;
  processError: string | null;
}
