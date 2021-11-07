import { readFileSync } from "fs";
import path from "path";
import {
  appHandlerPromise,
  generateProblemSubmissionRequest,
} from "./helpers/testUtils";

describe("C++", () => {
  it("compiles and runs", async () => {
    const result = await appHandlerPromise(
      generateProblemSubmissionRequest({
        language: "cpp",
        compilerOptions: "",
        filename: "main.cpp",
        problemid: "usaco-1111/",
        sourceCode: readFileSync(
          path.join(__dirname, "testFiles/cpp_1111_ac.cpp")
        ),
      })
    );
    const data = JSON.parse(result.body);
    console.log(data);
    // todo actually fetch submission info and test
  }, 100000);
});
