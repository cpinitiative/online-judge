import * as app from "./app";
import { generateRequest } from "./helpers/executeTestUtil";

describe("C++", () => {
  it("compiles and runs", async () => {
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
    const data = JSON.parse(result.body);
    expect(data.status).toBe("success");
    expect(data.stderr).toBe("");
    expect(data.stdout).toBe("6\n");
    expect(data.memory).toMatch(/[0-9]{4}/);
    expect(data.time).toMatch(/\d\.\d\d/);
  });

  it("throws compilation error", async () => {
    const result = await app.lambdaHandler(
      generateRequest({
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
    const result = await app.lambdaHandler(
      generateRequest({
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
    const result = await app.lambdaHandler(
      generateRequest({
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
    const result = await app.lambdaHandler(
      generateRequest({
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
    const result = await app.lambdaHandler(
      generateRequest({
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
        "exitCode": 139,
        "status": "runtime_error",
        "stdout": "",
      }
    `);
  });

  it("respects fsanitize flag (array index out of bounds)", async () => {
    const result = await app.lambdaHandler(
      generateRequest({
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
        "status": "success",
      }
    `);
  });

  it("respects fsanitize=address flag", async () => {
    const result = await app.lambdaHandler(
      generateRequest({
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
        "exitCode": 1,
        "status": "runtime_error",
        "stdout": "",
      }
    `);
  });
});

describe("Java", () => {
  it("compiles and runs", async () => {
    const result = await app.lambdaHandler(
      generateRequest({
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
    const result = await app.lambdaHandler(
      generateRequest({
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
    const result = await app.lambdaHandler(
      generateRequest({
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
    const result = await app.lambdaHandler(
      generateRequest({
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
    const result = await app.lambdaHandler(
      generateRequest({
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
    const result = await app.lambdaHandler(
      generateRequest({
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
    const result = await app.lambdaHandler(
      generateRequest({
        language: "py",
        compilerOptions: "",
        filename: "main.py",
        sourceCode: `laksjdflkja`,
      })
    );
    const { memory, time, ...data } = JSON.parse(result.body);
    expect(data).toMatchInlineSnapshot(`
      Object {
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
