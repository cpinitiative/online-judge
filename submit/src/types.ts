// WIP
export interface CodeExecutionRequestData {
  language: "cpp" | "java" | "py";
  filename: string;
  compilerOptions: string;
  sourceCode: string;
}
