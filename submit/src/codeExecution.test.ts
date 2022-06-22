import {
  appHandlerPromise,
  generateCodeExecutionRequest,
} from "./helpers/testUtils";

describe("C++", () => {
  it("compiles and runs", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "cpp",
        compilerOptions: "",
        filename: "main.cpp",
        sourceCode:
          "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> c; cout <<a+b+c << endl;}",
        input: "1 2 3",
      })
    );
    const data = JSON.parse(result.body);
    expect(data.status).toBe("success");
    expect(data.stderr).toBe("");
    expect(data.stdout).toBe("6\n");
    expect(data.memory).toMatch(/[0-9]{4}/);
    expect(data.time).toMatch(/\d\.\d\d/);
  });

  it("throws compilation error", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "cpp",
        compilerOptions: "",
        filename: "main.cpp",
        sourceCode:
          "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> cd; cout <<a+b+c << endl;}",
        input: "1 2 3",
      })
    );
    const data = JSON.parse(result.body);
    expect(data).toMatchInlineSnapshot(`
      Object {
        "message": "main.cpp: In function ‘int main()’:
      main.cpp:3:42: error: ‘cd’ was not declared in this scope; did you mean ‘c’?
          3 | int main(){int a, b, c; cin >> a >> b >> cd; cout <<a+b+c << endl;}
            |                                          ^~
            |                                          c
      ",
        "status": "compile_error",
      }
    `);
  });

  it("throws TLE error", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "cpp",
        compilerOptions: "",
        filename: "main.cpp",
        sourceCode:
          "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> c; while (true) c++; cout <<a+b+c << endl;}",
        input: "1 2 3",
      })
    );
    const { memory, ...data } = JSON.parse(result.body);
    expect(data).toMatchInlineSnapshot(`
      Object {
        "compilationMessage": "",
        "exitCode": 124,
        "status": "time_limit_exceeded",
        "stderr": "Command exited with non-zero status 124
      ",
        "stdout": "",
        "time": "5.00",
      }
    `);
  }, 8000);

  it("throws RTE error (assertion)", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "cpp",
        compilerOptions: "",
        filename: "main.cpp",
        sourceCode:
          "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> c; cout <<a+b+c << endl; assert(false);}",
        input: "1 2 3",
      })
    );
    const data = JSON.parse(result.body);
    expect(data.exitCode).toBe(134);
    expect(data.memory).toMatch(/\d{4}/);
    expect(data.status).toBe("runtime_error");
    expect(data.stderr).toMatch(/Assertion \`false' failed\./);
    expect(data.stdout).toBe("6\n");
  });

  it("throws RTE error (segfault)", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "cpp",
        compilerOptions: "",
        filename: "main.cpp",
        sourceCode:
          "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> c; vector<int> A(0); A[10] = 0; cout <<a+b+c << endl;}",
        input: "1 2 3",
      })
    );
    const data = JSON.parse(result.body);
    expect(data.exitCode).toBe(139);
    expect(data.memory).toMatch(/\d{4}/);
    expect(data.status).toBe("runtime_error");
    expect(data.stderr).toMatch(/Segmentation fault/);
  });

  it("respects fsanitize flag (negative index)", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "cpp",
        compilerOptions: "-fsanitize=undefined",
        filename: "main.cpp",
        sourceCode: `#include <bits/stdc++.h>
				using namespace std;
				
				int main() {
					vector<int> v;
					cout << v[-1];
				}`,
        input: "",
      })
    );
    const { memory, stderr, time, ...data } = JSON.parse(result.body);
    expect(stderr).toMatch(/runtime error: applying non-zero offset/);
    expect(stderr).toMatch(/Segmentation fault/);
    expect(data).toMatchInlineSnapshot(`
      Object {
        "compilationMessage": "",
        "exitCode": 139,
        "status": "runtime_error",
        "stdout": "",
      }
    `);
  });

  it("respects fsanitize flag (array index out of bounds)", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "cpp",
        compilerOptions: "-fsanitize=undefined",
        filename: "main.cpp",
        sourceCode: `#include <bits/stdc++.h>
				using namespace std;
				
				int main() {
					int v[5];
					cout << v[5];
				}`,
        input: "",
      })
    );
    const { time, memory, stdout, stderr, ...data } = JSON.parse(result.body);
    expect(stderr).toMatch(/runtime error: index 5 out of bounds for type/);
    expect(stderr).toMatch(
      /load of address .+ with insufficient space for an object of type/
    );
    expect(data).toMatchInlineSnapshot(`
      Object {
        "compilationMessage": "",
        "status": "success",
      }
    `);
  });

  it("respects fsanitize=address flag", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "cpp",
        compilerOptions: "-fsanitize=address",
        filename: "main.cpp",
        sourceCode: `#include <bits/stdc++.h>
          using namespace std;
          
          int main() {
            vector<int> v;
            cout << v[-1];
          }`,
        input: "",
      })
    );
    const { time, memory, stderr, ...data } = JSON.parse(result.body);
    expect(stderr).toMatch(/AddressSanitizer: SEGV on unknown address/);
    expect(stderr).toMatch(
      /Hint: this fault was caused by a dereference of a high value address/
    );
    expect(data).toMatchInlineSnapshot(`
      Object {
        "compilationMessage": "",
        "exitCode": 1,
        "status": "runtime_error",
        "stdout": "",
      }
    `);
  });

  it("shows compiler warnings even if compilation succeeds", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "cpp",
        compilerOptions:
          "-std=c++17 -O2 -Wall -Wextra -Wshadow -Wconversion -Wfloat-equal -Wduplicated-cond -Wlogical-op",
        filename: "main.cpp",
        sourceCode: `#include <bits/stdc++.h>
          using namespace std;
          
          int main() {
            int a, b, c; 
            cout << a << " " << b << " " << c;
          }`,
        input: "",
      })
    );
    const { time, memory, stderr, stdout, ...data } = JSON.parse(result.body);
    expect(data).toMatchInlineSnapshot(`
      Object {
        "compilationMessage": "main.cpp: In function ‘int main()’:
      main.cpp:6:26: warning: ‘a’ is used uninitialized in this function [-Wuninitialized]
          6 |             cout << a << \\" \\" << b << \\" \\" << c;
            |                          ^~~
      main.cpp:6:38: warning: ‘b’ is used uninitialized in this function [-Wuninitialized]
          6 |             cout << a << \\" \\" << b << \\" \\" << c;
            |                                      ^~~
      main.cpp:6:45: warning: ‘c’ is used uninitialized in this function [-Wuninitialized]
          6 |             cout << a << \\" \\" << b << \\" \\" << c;
            |                                             ^
      ",
        "status": "success",
      }
    `);
  });

  it("works with file IO", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "cpp",
        compilerOptions: "",
        filename: "main.cpp",
        sourceCode: `#include <bits/stdc++.h>\nusing namespace std;\nint main(){freopen("test.in", "r", stdin); freopen("test.out", "w", stdout); int a, b, c; cin >> a >> b >> c; cout <<a+b+c << endl;}`,
        input: "1 2 3",
        fileIOName: "test",
      })
    );
    const data = JSON.parse(result.body);
    expect(data.status).toBe("success");
    expect(data.stderr).toBe("");
    expect(data.stdout).toBe("");
    expect(data.fileOutput).toBe("6\n");
    expect(data.memory).toMatch(/[0-9]{4}/);
    expect(data.time).toMatch(/\d\.\d\d/);
  });

  it("doesn't allow malicious file IO names", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "cpp",
        compilerOptions: "",
        filename: "main.cpp",
        sourceCode: `#include <bits/stdc++.h>\nusing namespace std;\nint main(){freopen("test.in", "r", stdin); freopen("test.out", "w", stdout); int a, b, c; cin >> a >> b >> c; cout <<a+b+c << endl;}`,
        input: "1 2 3",
        fileIOName: "3%",
      })
    );
    const data = JSON.parse(result.body);
    expect(result.statusCode).toBe(400);
    expect(data.message).toMatch(/File IO Name must be an alphanumeric string/);
  });
});

describe("Java", () => {
  it("compiles and runs", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
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
            System.out.println(a + b + c);
          }
        }`,
        input: "1 2 3",
      })
    );
    const data = JSON.parse(result.body);
    expect(data.status).toBe("success");
    expect(data.stderr).toBe("");
    expect(data.stdout).toBe("6\n");
    expect(data.memory).toMatch(/[0-9]{4}/);
    expect(data.time).toMatch(/\d\.\d\d/);
  });

  it("throws compilation error", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
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
      })
    );
    const data = JSON.parse(result.body);
    expect(data).toMatchInlineSnapshot(`
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
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
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
      })
    );
    const { memory, time, ...data } = JSON.parse(result.body);
    expect(data).toMatchInlineSnapshot(`
      Object {
        "compilationMessage": "",
        "exitCode": 1,
        "status": "runtime_error",
        "stderr": "Exception in thread \\"main\\" java.util.NoSuchElementException
      	at java.base/java.util.Scanner.throwFor(Scanner.java:937)
      	at java.base/java.util.Scanner.next(Scanner.java:1594)
      	at java.base/java.util.Scanner.nextInt(Scanner.java:2258)
      	at java.base/java.util.Scanner.nextInt(Scanner.java:2212)
      	at Main.main(Main.java:6)
      Command exited with non-zero status 1
      ",
        "stdout": "",
      }
    `);
  }, 8000);

  it("throws RTE error", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
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
      })
    );
    const { memory, time, ...data } = JSON.parse(result.body);
    expect(data).toMatchInlineSnapshot(`
      Object {
        "compilationMessage": "",
        "exitCode": 1,
        "status": "runtime_error",
        "stderr": "Exception in thread \\"main\\" java.util.NoSuchElementException
      	at java.base/java.util.Scanner.throwFor(Scanner.java:937)
      	at java.base/java.util.Scanner.next(Scanner.java:1594)
      	at java.base/java.util.Scanner.nextInt(Scanner.java:2258)
      	at java.base/java.util.Scanner.nextInt(Scanner.java:2212)
      	at Main.main(Main.java:6)
      Command exited with non-zero status 1
      ",
        "stdout": "",
      }
    `);
  });
});

describe("Python", () => {
  it("compiles and runs", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "py",
        compilerOptions: "",
        filename: "main.py",
        sourceCode: `a, b, c = map(int, input().split())
print(a + b + c)`,
        input: "1 2 3",
      })
    );
    const data = JSON.parse(result.body);
    expect(data.status).toBe("success");
    expect(data.stderr).toBe("");
    expect(data.stdout).toBe("6\n");
    expect(data.memory).toMatch(/[0-9]{4}/);
    expect(data.time).toMatch(/\d\.\d\d/);
  });

  it("throws TLE error", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "py",
        compilerOptions: "",
        filename: "main.py",
        sourceCode: `a = 0
  while True:
    a += 1
  print(a)`,
      })
    );
    const { memory, time, ...data } = JSON.parse(result.body);
    expect(data).toMatchInlineSnapshot(`
      Object {
        "compilationMessage": null,
        "exitCode": 1,
        "status": "runtime_error",
        "stderr": "  File \\"main.py\\", line 2
          while True:
          ^
      IndentationError: unexpected indent
      Command exited with non-zero status 1
      ",
        "stdout": "",
      }
    `);
  }, 8000);

  it("throws RTE error", async () => {
    const result = await appHandlerPromise(
      generateCodeExecutionRequest({
        language: "py",
        compilerOptions: "",
        filename: "main.py",
        sourceCode: `laksjdflkja`,
      })
    );
    const { memory, time, ...data } = JSON.parse(result.body);
    expect(data).toMatchInlineSnapshot(`
      Object {
        "compilationMessage": null,
        "exitCode": 1,
        "status": "runtime_error",
        "stderr": "Traceback (most recent call last):
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
