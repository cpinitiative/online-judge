import * as app from "./app";
import compileEvent from "../events/compile.json";

test("compiles and runs C++ properly", async () => {
  const compileResult = await app.lambdaHandler(
    compileEvent as app.ExecuteEvent
  );
  expect(compileResult.status).toBe("success");

  const runResult = await app.lambdaHandler({
    type: "execute",
    payload: compileResult.output,
    input: "1 2 3",
  });
  expect(runResult).toMatchSnapshot();
});
