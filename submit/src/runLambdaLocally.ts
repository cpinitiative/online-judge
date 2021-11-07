// This file runs app.ts locally, and does not need AWS SAM to work
// Run `npm run watch` followed by `node dist/src/runLambdaLocally.js`

import * as app from "./app";
import { generateRequest } from "./helpers/testUtils";

process.env.NODE_ENV = "test";

(async () => {
  const result = await app.lambdaHandler(
    generateRequest({
      language: "cpp",
      compilerOptions: "",
      filename: "main.cpp",
      sourceCode:
        "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> c; cout <<a+b+c << endl;}",
      input: "1 2 3",
    })
  );

  console.log(result);
})();
