import { readFileSync } from "fs";
import path from "path";
import {
  appHandlerPromise,
  generateProblemSubmissionRequest,
  jestCheckSubmission,
  waitForSubmissionFinish,
} from "./helpers/testUtils";

describe("C++", () => {
  it("compiles and runs", async () => {
    const result = await appHandlerPromise(
      generateProblemSubmissionRequest({
        language: "cpp",
        filename: "JEST_TEST.cpp",
        problemID: "usaco-1111",
        sourceCode: readFileSync(
          path.join(__dirname, "testFiles/cpp_1111_ac.cpp")
        ).toString(),
      })
    );
    const data = JSON.parse(result.body);
    const submission = await waitForSubmissionFinish(data.submissionID);
    jestCheckSubmission(submission);
    expect(submission.verdict).toBe("AC");
  }, 18000);

  it("handles WA", async () => {
    const result = await appHandlerPromise(
      generateProblemSubmissionRequest({
        language: "cpp",
        filename: "JEST_TEST.cpp",
        problemID: "usaco-1111",
        sourceCode: readFileSync(
          path.join(__dirname, "testFiles/cpp_1111_wa.cpp")
        ).toString(),
      })
    );
    const data = JSON.parse(result.body);
    const submission = await waitForSubmissionFinish(data.submissionID);
    jestCheckSubmission(submission);
    expect(submission.verdict).toBe("WA");
  }, 18000);

  it("handles RTE", async () => {
    const result = await appHandlerPromise(
      generateProblemSubmissionRequest({
        language: "cpp",
        filename: "JEST_TEST.cpp",
        problemID: "usaco-1111",
        sourceCode: readFileSync(
          path.join(__dirname, "testFiles/cpp_1111_rte.cpp")
        ).toString(),
      })
    );
    const data = JSON.parse(result.body);
    const submission = await waitForSubmissionFinish(data.submissionID);
    jestCheckSubmission(submission);
    expect(submission.verdict).toBe("RTE");
  }, 18000);

  it("handles CE", async () => {
    const result = await appHandlerPromise(
      generateProblemSubmissionRequest({
        language: "cpp",
        filename: "JEST_TEST.cpp",
        problemID: "usaco-1111",
        sourceCode: readFileSync(
          path.join(__dirname, "testFiles/cpp_1111_ce.cpp")
        ).toString(),
      })
    );
    const data = JSON.parse(result.body);
    const submission = await waitForSubmissionFinish(data.submissionID);
    jestCheckSubmission(submission);
    expect(submission.verdict).toBe("CE");
    expect(submission.message).toMatchInlineSnapshot(`
"JEST_TEST.cpp: In function ‘int main()’:
JEST_TEST.cpp:17:10: error: ‘NBAD’ was not declared in this scope
   17 |   cin >> NBAD >> K;
      |          ^~~~
"
`);
  }, 18000);
});
