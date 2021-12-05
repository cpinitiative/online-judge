import { readFileSync } from "fs";
import path from "path";
import {
  appHandlerPromise,
  generateProblemSubmissionRequest,
  jestCheckSubmission,
  waitForSubmissionFinish,
} from "./helpers/testUtils";
import { v4 as uuidv4 } from "uuid";
import { ProblemSubmissionResult } from "./types";

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
    const { submissionID, testCases, ...submissionToCheck } = submission;
    expect(submissionToCheck).toMatchSnapshot();
    testCases.forEach((x) => {
      expect(x).not.toBeNull();
      if (x) {
        const { time, memory, ...tc } = x;
        expect(tc.verdict).toBe("RTE");
        expect(tc.stderr).toMatch(/Assertion \`false' failed\./);
      }
    });
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

  // it("handles very large input files", async () => {
  //   const result = await appHandlerPromise(
  //     generateProblemSubmissionRequest({
  //       language: "cpp",
  //       filename: "JEST_TEST.cpp",
  //       problemID: "usaco-674",
  //       sourceCode: readFileSync(
  //         path.join(__dirname, "testFiles/cpp_roboherd_ac.cpp")
  //       ).toString(),
  //     })
  //   );
  //   const data = JSON.parse(result.body);
  //   const submission = await waitForSubmissionFinish(data.submissionID);
  //   jestCheckSubmission(submission);
  //   expect(submission.verdict).toBe("AC");
  // }, 18000);

  it("supports waiting", async () => {
    const result = await appHandlerPromise(
      generateProblemSubmissionRequest({
        language: "cpp",
        filename: "JEST_TEST.cpp",
        problemID: "usaco-1111",
        sourceCode: readFileSync(
          path.join(__dirname, "testFiles/cpp_1111_ac.cpp")
        ).toString(),
        wait: true,
      })
    );
    const submission: ProblemSubmissionResult = JSON.parse(result.body);
    jestCheckSubmission(submission);
    expect(submission.verdict).toBe("AC");
  }, 18000);

  it("supports a custom submission ID", async () => {
    const id = uuidv4();
    const result = await appHandlerPromise(
      generateProblemSubmissionRequest({
        language: "cpp",
        filename: "JEST_TEST.cpp",
        problemID: "usaco-1111",
        sourceCode: readFileSync(
          path.join(__dirname, "testFiles/cpp_1111_ac.cpp")
        ).toString(),
        submissionID: id,
      })
    );
    const data = JSON.parse(result.body);
    const submission = await waitForSubmissionFinish(data.submissionID);
    jestCheckSubmission(submission);
    expect(submission.submissionID).toBe(id);
    expect(submission.verdict).toBe("AC");

    // should reject duplicate submission IDs
    const result2 = await appHandlerPromise(
      generateProblemSubmissionRequest({
        language: "cpp",
        filename: "JEST_TEST.cpp",
        problemID: "usaco-1111",
        sourceCode: readFileSync(
          path.join(__dirname, "testFiles/cpp_1111_wa.cpp")
        ).toString(),
        submissionID: id,
      })
    );
    const data2 = JSON.parse(result2.body);
    expect(data2).toMatchInlineSnapshot(`
Object {
  "message": "A submission with the given submissionID already exists.",
}
`);
  }, 18000);
});
