import * as app from "./app";

const checkTimeStderr = (stderr: string | null) => {
  expect(stderr).not.toBeNull();
  expect(stderr).toMatch(/Elapsed \(wall clock\) time/);
  expect(stderr).toMatch(/Maximum resident set size \(kbytes\): [0-9]{4}/);
};

describe("C++", () => {
  it("compiles and runs", async () => {
    const compileResult = (await app.lambdaHandler({
      type: "compile",
      language: "cpp",
      compilerOptions: "",
      filename: "main.cpp",
      sourceCode: `#include <bits/stdc++.h>
      using namespace std;
      int main() {
        int a, b, c;
        cin >> a >> b >> c;
        cerr << "Hello";
        cout <<a+b+c << endl;
      }`,
    })) as app.CompilationResult & { status: "success" };
    expect(compileResult.status).toBe("success");

    // the stderr output from the time command may change from execution to execution
    const { stderr, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "exitCode": 0,
  "exitSignal": null,
  "processError": null,
  "status": "success",
  "stdout": "6
",
}
`);
    checkTimeStderr(stderr);
  });

  it("throws compilation error", async () => {
    const compileResult = await app.lambdaHandler({
      type: "compile",
      language: "cpp",
      compilerOptions: "",
      filename: "main.cpp",
      sourceCode:
        "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> cd; cout <<a+b+c << endl;}",
    });
    expect(compileResult).toMatchInlineSnapshot(`
Object {
  "exitCode": 1,
  "exitSignal": null,
  "processError": null,
  "status": "compile_error",
  "stderr": "main.cpp: In function ‘int main()’:
main.cpp:3:42: error: ‘cd’ was not declared in this scope
 int main(){int a, b, c; cin >> a >> b >> cd; cout <<a+b+c << endl;}
                                          ^~
main.cpp:3:42: note: suggested alternative: ‘c’
 int main(){int a, b, c; cin >> a >> b >> cd; cout <<a+b+c << endl;}
                                          ^~
                                          c
",
  "stdout": "",
}
`);
  });

  it("throws TLE error", async () => {
    const compileResult = (await app.lambdaHandler({
      type: "compile",
      language: "cpp",
      compilerOptions: "",
      filename: "main.cpp",
      sourceCode: `#include <bits/stdc++.h>
  using namespace std;
  int main() {
    int a, b, c;
    cin >> a >> b >> c;
    cout << "Hello World!" << endl;
    for (long long i = 0;i < 100000000000; i++) c++;
    cout <<a+b+c << endl;
  }`,
    })) as app.CompilationResult & { status: "success" };
    expect(compileResult.status).toBe("success");
    // the stderr output from the time command may change from execution to execution
    const { stderr, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
      timeout: 100,
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "exitCode": 124,
  "exitSignal": null,
  "processError": null,
  "status": "success",
  "stdout": "Hello World!
",
}
`);
    checkTimeStderr(stderr);
  });

  it("throws Runtime Error", async () => {
    const compileResult = (await app.lambdaHandler({
      type: "compile",
      language: "cpp",
      compilerOptions: "",
      filename: "main.cpp",
      sourceCode: `#include <bits/stdc++.h>
using namespace std;
int main() {
  int a, b, c;
  cin >> a >> b >> c;
  cout << "Hello World!" << endl;
  assert(false);
  cout <<a+b+c << endl;
}`,
    })) as app.CompilationResult & { status: "success" };
    expect(compileResult.status).toBe("success");
    // the stderr output from the time command may change from execution to execution
    const { stderr, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "exitCode": 134,
  "exitSignal": null,
  "processError": null,
  "status": "success",
  "stdout": "Hello World!
",
}
`);
    expect(stderr).toMatch(/Assertion `false' failed/);
    expect(stderr).toMatch(/Command exited with non-zero status 134/);
    checkTimeStderr(stderr);
  });
});

describe("Java", () => {
  it("compiles and runs", async () => {
    const compileResult = (await app.lambdaHandler({
      type: "compile",
      language: "java",
      compilerOptions: "",
      filename: "Main.java",
      sourceCode: `import java.util.Scanner;

      public class Main {
        static Scanner sc = new Scanner(System.in);
        public static void main(String[] args) {
          int a = sc.nextInt();
          int b = sc.nextInt();
          int c = sc.nextInt();
          System.out.print("sum is ");
          System.out.println(a + b + c);
        }
      }`,
    })) as app.CompilationResult & { status: "success" };
    expect(compileResult.status).toBe("success");

    // the stderr output from the time command may change from execution to execution
    const { stderr, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "exitCode": 0,
  "exitSignal": null,
  "processError": null,
  "status": "success",
  "stdout": "sum is 6
",
}
`);
    checkTimeStderr(stderr);
  });

  it("throws compilation error", async () => {
    const compileResult = await app.lambdaHandler({
      type: "compile",
      language: "java",
      compilerOptions: "",
      filename: "main.java",
      sourceCode: `import java.util.Scanner;

        public class NotMain {
          static Scanner sc = new Scanner(System.in);
          public static void main(String[] args) {
            int a = sc.nextInt();
            int b = sc.nextInt();
            int c = sc.nextInt();
            System.out.print("sum is ");
            System.out.println(a + b + c);
          }
        }`,
    });
    expect(compileResult).toMatchInlineSnapshot(`
Object {
  "exitCode": 1,
  "exitSignal": null,
  "processError": null,
  "status": "compile_error",
  "stderr": "main.java:3: error: class NotMain is public, should be declared in a file named NotMain.java
        public class NotMain {
               ^
1 error
",
  "stdout": "",
}
`);
  });

  it("throws TLE error", async () => {
    const compileResult = (await app.lambdaHandler({
      type: "compile",
      language: "java",
      compilerOptions: "",
      filename: "Main.java",
      sourceCode: `import java.util.Scanner;

      public class Main {
        static Scanner sc = new Scanner(System.in);
        public static void main(String[] args) {
          int a = sc.nextInt();
          int b = sc.nextInt();
          int c = sc.nextInt();
          while (true) {
            c++;
          }
        }
      }`,
    })) as app.CompilationResult & { status: "success" };
    expect(compileResult.status).toBe("success");
    // the stderr output from the time command may change from execution to execution
    const { stderr, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
      timeout: 100,
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "exitCode": 124,
  "exitSignal": null,
  "processError": null,
  "status": "success",
  "stdout": "",
}
`);
    checkTimeStderr(stderr);
  });

  it("throws Runtime Error", async () => {
    const compileResult = (await app.lambdaHandler({
      type: "compile",
      language: "java",
      compilerOptions: "",
      filename: "Main.java",
      sourceCode: `import java.util.Scanner;

      public class Main {
        static Scanner sc = new Scanner(System.in);
        public static void main(String[] args) {
          int a = sc.nextInt();
          int b = sc.nextInt();
          int c = sc.nextInt();
          System.out.print("sum is ");
          System.out.println(a + b + c);
        }
      }`,
    })) as app.CompilationResult & { status: "success" };
    expect(compileResult.status).toBe("success");
    // the stderr output from the time command may change from execution to execution
    const { stderr, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "exitCode": 0,
  "exitSignal": null,
  "processError": null,
  "status": "success",
  "stdout": "sum is 6
",
}
`);
    checkTimeStderr(stderr);
  });
});

describe("Python", () => {
  it("runs", async () => {
    const compileResult = (await app.lambdaHandler({
      type: "compile",
      language: "py",
      compilerOptions: "",
      filename: "main.py",
      sourceCode: `a, b, c = map(int, input().split())
print(a + b + c)`,
    })) as app.CompilationResult & { status: "success" };
    expect(compileResult.status).toBe("success");

    // the stderr output from the time command may change from execution to execution
    const { stderr, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "exitCode": 0,
  "exitSignal": null,
  "processError": null,
  "status": "success",
  "stdout": "6
",
}
`);
    checkTimeStderr(stderr);
  });

  it("throws TLE error", async () => {
    const compileResult = (await app.lambdaHandler({
      type: "compile",
      language: "py",
      compilerOptions: "",
      filename: "main.py",
      sourceCode: `a = 0
while True:
  a += 1
print(a)`,
    })) as app.CompilationResult & { status: "success" };
    expect(compileResult.status).toBe("success");
    // the stderr output from the time command may change from execution to execution
    const { stderr, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
      timeout: 100,
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "exitCode": 124,
  "exitSignal": null,
  "processError": null,
  "status": "success",
  "stdout": "",
}
`);
    checkTimeStderr(stderr);
  });

  it("throws Runtime Error", async () => {
    const compileResult = (await app.lambdaHandler({
      type: "compile",
      language: "py",
      compilerOptions: "",
      filename: "main.py",
      sourceCode: `laksjdflkja`,
    })) as app.CompilationResult & { status: "success" };
    expect(compileResult.status).toBe("success");
    // the stderr output from the time command may change from execution to execution
    const { stderr, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "exitCode": 1,
  "exitSignal": null,
  "processError": null,
  "status": "success",
  "stdout": "",
}
`);
    checkTimeStderr(stderr);
  });
});
