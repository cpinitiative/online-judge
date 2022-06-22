export interface CodeExecutionRequestData {
  language: "cpp" | "java" | "py";
  filename: string;
  compilerOptions: string;
  sourceCode: string;
  input: string;
  // If given, will support stdio + fileIOName.in / fileIOName.out
  fileIOName?: string;
}

export interface CodeExecutionResult {
  status: "success";
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  exitSignal: string | null;
  processError: string | null;
  // output of compile.
  // note: if error, this won't be set and stderr will be set instead.
  // future todo, fix this behavior?
  compilationMessage: string | null;
  // for file I/O submissions
  fileOutput?: string | null;
}

export interface ProblemSubmissionRequestData {
  problemID: string;
  language: "cpp" | "java" | "py";
  filename: string;
  sourceCode: string;
  submissionID?: string; // if given, uses this as the submission ID. must be uuidv4
  wait?: boolean; // if true, request will wait until the submission finishes grading.
  firebase?: {
    userID: string;
    idToken: string; // used to authenticate REST api
    collectionPath: string;
  };
  // An internal-only flag signalling that the given submission ID
  // has already been created, and that it should be used for this submission.
  // This is used to handle submission requests without a submission ID:
  // The first lambda creates the submission, calls the submission lambda again
  // with this flag set to true, and then immediately returns the submission ID.
  __INTERNAL_SUBMISSION_ALREADY_CREATED?: boolean;
}

export interface ProblemSubmissionResult {
  submissionID: string;
  timestamp: number; // milliseconds since epoch
  status: "compiling" | "executing" | "done";
  verdict?: ExecutionVerdict;
  testCases: (ProblemSubmissionTestCaseResult | null)[];

  problemID: string;
  language: string;
  filename: string;
  sourceCode: string; // gzipped in dynamodb
  message?: string; // gzipped in dynamodb. used either for compiling or internal error.
  debugData?: string; // gzipped in dynamodb. optionally provided for internal_error
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

export type ExecutionVerdict =
  | "AC"
  | "WA"
  | "RTE"
  | "MLE"
  | "TLE"
  | "CE"
  | "IE"; // IE is internal error

export interface FirebaseSubmission {
  language: string;
  problemID: string;
  score: number;
  submissionID: string;
  userID: string;
  type: string;
  verdict: string;
  timestamp: any; // milliseconds
}
