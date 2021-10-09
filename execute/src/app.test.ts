import * as app from "./app";

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

    // hide time and memory since that might change from execution to execution
    const { time, memory, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
      Object {
        "status": "success",
        "stderr": "Hello",
        "stdout": "6
      ",
      }
    `);
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
        "message": "main.cpp: In function ‘int main()’:
      main.cpp:3:42: error: ‘cd’ was not declared in this scope
       int main(){int a, b, c; cin >> a >> b >> cd; cout <<a+b+c << endl;}
                                                ^~
      main.cpp:3:42: note: suggested alternative: ‘c’
       int main(){int a, b, c; cin >> a >> b >> cd; cout <<a+b+c << endl;}
                                                ^~
                                                c
      ",
        "status": "compile_error",
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
    const runResult = await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
      timeout: 100,
    });
    expect(runResult).toMatchInlineSnapshot(`
      Object {
        "status": "time_limit_exceeded",
        "stderr": "",
        "stdout": "Hello World!
      ",
      }
    `);
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
    // hide time and memory since that might change from execution to execution
    const { time, memory, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
      Object {
        "status": "success",
        "stderr": "prog: main.cpp:7: int main(): Assertion \`false' failed.
      Aborted
      Command exited with non-zero status 134
      ",
        "stdout": "Hello World!
      ",
      }
    `);
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

    // hide time and memory since that might change from execution to execution
    const { time, memory, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
      Object {
        "status": "success",
        "stderr": "",
        "stdout": "sum is 6
      ",
      }
    `);
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
        "message": "main.java:3: error: class NotMain is public, should be declared in a file named NotMain.java
              public class NotMain {
                     ^
      1 error
      ",
        "status": "compile_error",
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
    const runResult = await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
      timeout: 100,
    });
    expect(runResult).toMatchInlineSnapshot(`
      Object {
        "status": "time_limit_exceeded",
        "stderr": "",
        "stdout": "",
      }
    `);
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
    // hide time and memory since that might change from execution to execution
    const { time, memory, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "",
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "status": "success",
  "stderr": "Exception in thread \\"main\\" java.util.NoSuchElementException
	at java.util.Scanner.throwFor(Scanner.java:862)
	at java.util.Scanner.next(Scanner.java:1485)
	at java.util.Scanner.nextInt(Scanner.java:2117)
	at java.util.Scanner.nextInt(Scanner.java:2076)
	at Main.main(Main.java:6)
Command exited with non-zero status 1
",
  "stdout": "",
}
`);
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

    // hide time and memory since that might change from execution to execution
    const { time, memory, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "1 2 3",
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "status": "success",
  "stderr": "",
  "stdout": "6
",
}
`);
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
    const runResult = await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "",
      timeout: 100,
    });
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "status": "time_limit_exceeded",
  "stderr": "",
  "stdout": "",
}
`);
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
    // hide time and memory since that might change from execution to execution
    const { time, memory, ...runResult } = (await app.lambdaHandler({
      type: "execute",
      payload: compileResult.output,
      input: "",
    })) as app.ExecutionResult & { status: "success" };
    expect(runResult).toMatchInlineSnapshot(`
Object {
  "status": "success",
  "stderr": "Traceback (most recent call last):
  File \\"main.py\\", line 1, in <module>
    laksjdflkja
NameError: name 'laksjdflkja' is not defined
Error in sys.excepthook:
Traceback (most recent call last):
  File \\"/usr/lib/python3/dist-packages/apport_python_hook.py\\", line 63, in apport_excepthook
    from apport.fileutils import likely_packaged, get_recent_crashes
  File \\"/usr/lib/python3/dist-packages/apport/__init__.py\\", line 5, in <module>
    from apport.report import Report
  File \\"/usr/lib/python3/dist-packages/apport/report.py\\", line 30, in <module>
    import apport.fileutils
  File \\"/usr/lib/python3/dist-packages/apport/fileutils.py\\", line 23, in <module>
    from apport.packaging_impl import impl as packaging
  File \\"/usr/lib/python3/dist-packages/apport/packaging_impl.py\\", line 24, in <module>
    import apt
  File \\"/usr/lib/python3/dist-packages/apt/__init__.py\\", line 23, in <module>
    import apt_pkg
ModuleNotFoundError: No module named 'apt_pkg'

Original exception was:
Traceback (most recent call last):
  File \\"main.py\\", line 1, in <module>
    laksjdflkja
NameError: name 'laksjdflkja' is not defined
Command exited with non-zero status 1
",
  "stdout": "",
}
`);
  });
});
