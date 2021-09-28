import * as app from "./app";

test("compiles and runs C++ properly", async () => {
  const result = await app.lambdaHandler(
    {
      language: "cpp",
      compilerOptions: "",
      filename: "main.cpp",
      sourceCode:
        "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> c; cout <<a+b+c << endl;}",
      input: "1 2 3",
    },
    undefined
  );
  expect(result).toMatchInlineSnapshot(`
Object {
  "status": "success",
  "stderr": "",
  "stdout": "6
",
}
`);
});
