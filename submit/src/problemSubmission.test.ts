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
        filename: "main.cpp",
        problemID: "usaco-1111",
        sourceCode: readFileSync(
          path.join(__dirname, "testFiles/cpp_1111_ac.cpp")
        ).toString(),
      })
    );
    const data = JSON.parse(result.body);
    jestCheckSubmission(await waitForSubmissionFinish(data.submissionID));
  }, 18000);

  it("handles WA", async () => {
    const result = await appHandlerPromise(
      generateProblemSubmissionRequest({
        language: "cpp",
        filename: "main.cpp",
        problemID: "usaco-1111",
        sourceCode: readFileSync(
          path.join(__dirname, "testFiles/cpp_1111_wa.cpp")
        ).toString(),
      })
    );
    const data = JSON.parse(result.body);
    jestCheckSubmission(await waitForSubmissionFinish(data.submissionID));
  }, 18000);
});
