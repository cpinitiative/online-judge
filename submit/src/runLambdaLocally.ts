// This file runs app.ts locally, and does not need AWS SAM to work
// Run `npm run watch` followed by `node dist/src/runLambdaLocally.js`

import * as app from "./app";
import {
  generateCodeExecutionRequest,
  generateProblemSubmissionRequest,
} from "./helpers/testUtils";
import fetchProblemTestCases from "./problemSubmission/fetchProblemTestCases";

process.env.NODE_ENV = "test";

(async () => {
  // Code Execution
  // app.lambdaHandler(
  //   generateCodeExecutionRequest({
  //     language: "cpp",
  //     compilerOptions: "",
  //     filename: "main.cpp",
  //     sourceCode:
  //       "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, cd; cin >> a >> b >> c; cout <<a+b+c << endl;}",
  //     input: "1 2 3",
  //   }),
  //   null,
  //   (error, result) => {
  //     console.log(result);
  //   }
  // );

  // Problem Submission: Fetch test cases
  // console.log(await fetchProblemTestCases("usaco-1111"));

  // Problem Submission: complete
  app.lambdaHandler(
    generateProblemSubmissionRequest({
      language: "cpp",
      compilerOptions: "",
      filename: "main.cpp",
      sourceCode:
        "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> c; cout <<a+b+c << endl;}",
      problemID: "usaco-1111",
    }),
    null,
    (error, result) => {
      console.log(result);
    }
  );
})();
