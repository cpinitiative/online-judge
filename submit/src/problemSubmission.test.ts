import * as app from "./app";
import { generateRequest } from "./helpers/testUtils";

describe("C++", () => {
  it("compiles and runs", async () => {
    const result = await app.lambdaHandler(
      generateRequest({
        language: "cpp",
        compilerOptions: "",
        filename: "main.cpp",
        problemid: "usaco-1060/",
        sourceCode:
          "#include <iostream>\n" +
          "\n" +
          "#include <algorithm>\n" +
          "\n" +
          "#include <cstdio>\n" +
          "\n" +
          "\n" +
          "using namespace std;\n" +
          "\n" +
          "\n" +
          "int main(){\n" +
          "\n" +
          "\tios_base::sync_with_stdio(0); cin.tie(0);\n" +
          "\n" +
          "\tint n;\n" +
          "\n" +
          "\tcin >> n;\n" +
          "\n" +
          "\tint petals[n];\n" +
          "\n" +
          "\tfor (int i = 0; i < n; ++i) {\n" +
          "\n" +
          "\t\tcin >> petals[i];\n" +
          "\n" +
          "\t}\n" +
          "\n" +
          "\tint photos = 0;\n" +
          "\n" +
          "\tfor (int i = 0; i < n; ++i) {\n" +
          "\n" +
          "\t\tfor (int j = i; j < n; ++j) {\n" +
          "\n" +
          "\t\t\tint totalPetals = 0;\n" +
          "\n" +
          "\t\t\tfor (int k = i; k <= j; ++k) {\n" +
          "\n" +
          "\t\t\t\ttotalPetals += petals[k];\n" +
          "\n" +
          "\t\t\t}\n" +
          "\n" +
          "\t\t\tbool present = false;\n" +
          "\n" +
          "\t\t\tfor (int k = i; k <= j; ++k) {\n" +
          "\n" +
          "\t\t\t\tif (petals[k] * (j-i+1) == totalPetals) {\n" +
          "\n" +
          "\t\t\t\t\tpresent = true;\n" +
          "\n" +
          "\t\t\t\t}\n" +
          "\n" +
          "\t\t\t}\n" +
          "\n" +
          "\t\t\tif (present) {\n" +
          "\n" +
          "\t\t\t\t++photos;\n" +
          "\n" +
          "\t\t\t}\n" +
          "\n" +
          "\t\t}\n" +
          "\n" +
          "\t}\n" +
          "\n" +
          "\tcout << photos;\n" +
          "\n" +
          "\treturn 0;\n" +
          "\n" +
          "}\n",
        input: "1 2 3",
      })
    );
    const data = JSON.parse(result.body);
    // expect(data.submissionid).toBe("123");
    expect(data.verdict).toBe(
      ",correct,correct,correct,correct,correct,correct,correct,correct,correct,correct"
    );
    //  expect(data.stderr).toBe("");
    // expect(data.stdout).toBe("6\n");
    //  expect(data.memory).toMatch(/[0-9]{4}/);
    //   expect(data.time).toMatch(/\d\.\d\d/);
  }, 100000);

  it("compiles and runs Java", async () => {
    const result = await app.lambdaHandler(
      generateRequest({
        language: "java",
        compilerOptions: "",
        filename: "lightson.java",
        problemid: "usaco-570/",
        sourceCode:
          "import javax.swing.*;\n" +
          "import java.io.*;\n" +
          "import java.util.*;\n" +
          "\n" +
          "\n" +
          "public class lightson {\n" +
          "    static Kattio sc;\n" +
          "\n" +
          "    static {\n" +
          "  \n" +
          "            sc = new Kattio(); \n" +
          "    }\n" +
          "\n" +
          "    static int n, m, ans = 0;\n" +
          "    static boolean[][] visited;\n" +
          "    static boolean[][] back;\n" +
          "    static int[][] grid;\n" +
          "    static int [][] sw;\n" +
          "\n" +
          "    public static boolean switchOn(int x, int y) {\n" +
          "        boolean poss = false;\n" +
          "        for (int i = 0; i < m; i++) {\n" +
          "            if(x == sw[i][0] && y == sw[i][1]){\n" +
          "                grid[sw[i][2] - 1][sw[i][3] - 1] = 1;\n" +
          "                poss = true;\n" +
          "            }\n" +
          "        }\n" +
          "        return poss;\n" +
          "    }\n" +
          "\n" +
          "    public static void main(String[] args) {\n" +
          "        n = sc.nextInt();\n" +
          "        m = sc.nextInt();\n" +
          "\n" +
          "        visited = new boolean[n][n];\n" +
          "        back = new boolean[n][n];\n" +
          "        grid = new int[n][n];\n" +
          "        sw = new int [m][4];\n" +
          "\n" +
          "        for (int i = 0; i < m; i++) {\n" +
          "            sw[i][0] = sc.nextInt();\n" +
          "            sw[i][1] = sc.nextInt();\n" +
          "            sw[i][2] = sc.nextInt();\n" +
          "            sw[i][3] = sc.nextInt();\n" +
          "        }\n" +
          "\n" +
          "        for (int i = 0; i < n; i++) {\n" +
          "            for (int j = 0; j < n; j++) {\n" +
          "                grid[i][j] = 0;\n" +
          "                visited[i][j] = false;\n" +
          "                back[i][j] = false;\n" +
          "            }\n" +
          "        }\n" +
          "\n" +
          "        grid[0][0] = 1;\n" +
          "\n" +
          "        floodfill(0, 0);\n" +
          "        for (int i = 0; i < n; i++) {\n" +
          "            for (int j = 0; j < n; j++) {\n" +
          "                if(grid[i][j] == 1)\n" +
          "                    ++ans;\n" +
          "            }\n" +
          "        }\n" +
          "        sc.println(ans);\n" +
          "        sc.close();\n" +
          "    }\n" +
          "\n" +
          "    static void floodfill(int r, int c) {\n" +
          "        if (\n" +
          "                (r < 0 || r >= n || c < 0 || c >= n)  // if out of bounds\n" +
          "                        || grid[r][c] != 1  // wrong color\n" +
          "                        || visited[r][c]  // already visited this square\n" +
          "        ) return;\n" +
          "\n" +
          "        boolean isSwitch = false;\n" +
          "        visited[r][c] = true; // mark current square as visited\n" +
          "\n" +
          "        if(!back[r][c]) {\n" +
          "            isSwitch = switchOn(r + 1, c + 1);\n" +
          "            back[r][c] = true;\n" +
          "        }\n" +
          "\n" +
          "        if(isSwitch)\n" +
          "            visited = new boolean[n][n];\n" +
          "\n" +
          "        // recursively call flood fill for neighboring squares\n" +
          "        floodfill(r, c + 1);\n" +
          "        floodfill(r, c - 1);\n" +
          "        floodfill(r - 1, c);\n" +
          "        floodfill(r + 1, c);\n" +
          "    }\n" +
          "\n" +
          "\n" +
          "    static class Kattio extends PrintWriter {\n" +
          "        private BufferedReader r;\n" +
          "        private StringTokenizer st;\n" +
          "\n" +
          "        // standard input\n" +
          "        public Kattio() { this(System.in,System.out); }\n" +
          "        public Kattio(InputStream i, OutputStream o) {\n" +
          "            super(o);\n" +
          "            r = new BufferedReader(new InputStreamReader(i));\n" +
          "        }\n" +
          "        // USACO-style file input\n" +
          "        public Kattio(String problemName) throws IOException {\n" +
          '            super(new FileWriter(problemName+".out"));\n' +
          '            r = new BufferedReader(new FileReader(problemName+".in"));\n' +
          "        }\n" +
          "\n" +
          "        // returns null if no more input\n" +
          "        public String next() {\n" +
          "            try {\n" +
          "                while (st == null || !st.hasMoreTokens())\n" +
          "                    st = new StringTokenizer(r.readLine());\n" +
          "                return st.nextToken();\n" +
          "            } catch (Exception e) {}\n" +
          "            return null;\n" +
          "        }\n" +
          "\n" +
          "        public int nextInt() { return Integer.parseInt(next()); }\n" +
          "        public double nextDouble() { return Double.parseDouble(next()); }\n" +
          "        public long nextLong() { return Long.parseLong(next()); }\n" +
          "    }\n" +
          "\n" +
          "}\n",
        input: "1 2 3",
      })
    );
    const data = JSON.parse(result.body);
    // expect(data.submissionid).toBe("123");
    expect(data.verdict).toBe(
      ",correct,correct,correct,correct,correct,correct,runtime_error,runtime_error,runtime_error,runtime_error,runtime_error,runtime_error,runtime_error,runtime_error,runtime_error"
    );
    //  expect(data.stderr).toBe("");
    // expect(data.stdout).toBe("6\n");
    //  expect(data.memory).toMatch(/[0-9]{4}/);
    //   expect(data.time).toMatch(/\d\.\d\d/);
  }, 100000);
  //
  //   it("throws compilation error", async () => {
  //     const result = await app.lambdaHandler(
  //       generateRequest({
  //         language: "cpp",
  //         compilerOptions: "",
  //         filename: "main.cpp",
  //           problemid: "usaco-100/",
  //           sourceCode:
  //           "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> cd; cout <<a+b+c << endl;}",
  //         input: "1 2 3",
  //       })
  //     );
  //     const data = JSON.parse(result.body);
  //     expect(data).toMatchInlineSnapshot(`
  // Object {
  //   "message": "main.cpp: In function ‘int main()’:
  // main.cpp:3:42: error: ‘cd’ was not declared in this scope; did you mean ‘c’?
  //     3 | int main(){int a, b, c; cin >> a >> b >> cd; cout <<a+b+c << endl;}
  //       |                                          ^~
  //       |                                          c
  // ",
  //   "status": "compile_error",
  // }
  // `);
  //   });
  //
  //   it("throws TLE error", async () => {
  //     const result = await app.lambdaHandler(
  //       generateRequest({
  //         language: "cpp",
  //         compilerOptions: "",
  //         filename: "main.cpp",        problemid: "usaco-100/",
  //
  //           sourceCode:
  //           "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> c; while (true) c++; cout <<a+b+c << endl;}",
  //         input: "1 2 3",
  //       })
  //     );
  //     const { memory, ...data } = JSON.parse(result.body);
  //     expect(data).toMatchInlineSnapshot(`
  //       Object {
  //         "exitCode": 124,
  //         "status": "time_limit_exceeded",
  //         "stderr": "Command exited with non-zero status 124
  //       ",
  //         "stdout": "",
  //         "time": "5.00",
  //       }
  //     `);
  //   }, 8000);
  //
  //   it("throws RTE error (assertion)", async () => {
  //     const result = await app.lambdaHandler(
  //       generateRequest({
  //         language: "cpp",        problemid: "usaco-100/",
  //
  //           compilerOptions: "",
  //         filename: "main.cpp",
  //         sourceCode:
  //           "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> c; cout <<a+b+c << endl; assert(false);}",
  //         input: "1 2 3",
  //       })
  //     );
  //     const data = JSON.parse(result.body);
  //     expect(data.exitCode).toBe(134);
  //     expect(data.memory).toMatch(/\d{4}/);
  //     expect(data.status).toBe("runtime_error");
  //     expect(data.stderr).toMatch(/Assertion \`false' failed\./);
  //     expect(data.stdout).toBe("6\n");
  //   });
  //
  //   it("throws RTE error (segfault)", async () => {
  //     const result = await app.lambdaHandler(
  //       generateRequest({
  //         language: "cpp",        problemid: "usaco-100/",
  //
  //           compilerOptions: "",
  //         filename: "main.cpp",
  //         sourceCode:
  //           "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int a, b, c; cin >> a >> b >> c; vector<int> A(0); A[10] = 0; cout <<a+b+c << endl;}",
  //         input: "1 2 3",
  //       })
  //     );
  //     const data = JSON.parse(result.body);
  //     expect(data.exitCode).toBe(139);
  //     expect(data.memory).toMatch(/\d{4}/);
  //     expect(data.status).toBe("runtime_error");
  //     expect(data.stderr).toMatch(/Segmentation fault/);
  //   });
  //
  //   it("respects fsanitize flag (negative index)", async () => {
  //     const result = await app.lambdaHandler(
  //       generateRequest({
  //         language: "cpp",        problemid: "usaco-100/",
  //
  //           compilerOptions: "-fsanitize=undefined",
  //         filename: "main.cpp",
  //         sourceCode: `#include <bits/stdc++.h>
  // 				using namespace std;
  //
  // 				int main() {
  // 					vector<int> v;
  // 					cout << v[-1];
  // 				}`,
  //         input: "",
  //       })
  //     );
  //     const { memory, stderr, time, ...data } = JSON.parse(result.body);
  //     expect(stderr).toMatch(/runtime error: applying non-zero offset/);
  //     expect(stderr).toMatch(/Segmentation fault/);
  //     expect(data).toMatchInlineSnapshot(`
  //       Object {
  //         "exitCode": 139,
  //         "status": "runtime_error",
  //         "stdout": "",
  //       }
  //     `);
  //   });
  //
  //   it("respects fsanitize flag (array index out of bounds)", async () => {
  //     const result = await app.lambdaHandler(
  //       generateRequest({
  //         language: "cpp",        problemid: "usaco-100/",
  //
  //           compilerOptions: "-fsanitize=undefined",
  //         filename: "main.cpp",
  //         sourceCode: `#include <bits/stdc++.h>
  // 				using namespace std;
  //
  // 				int main() {
  // 					int v[5];
  // 					cout << v[5];
  // 				}`,
  //         input: "",
  //       })
  //     );
  //     const { time, memory, stdout, stderr, ...data } = JSON.parse(result.body);
  //     expect(stderr).toMatch(/runtime error: index 5 out of bounds for type/);
  //     expect(stderr).toMatch(
  //       /load of address .+ with insufficient space for an object of type/
  //     );
  //     expect(data).toMatchInlineSnapshot(`
  //       Object {
  //         "status": "success",
  //       }
  //     `);
  //   });
  //
  //   it("respects fsanitize=address flag", async () => {
  //     const result = await app.lambdaHandler(
  //       generateRequest({
  //         language: "cpp",        problemid: "usaco-100/",
  //
  //           compilerOptions: "-fsanitize=address",
  //         filename: "main.cpp",
  //         sourceCode: `#include <bits/stdc++.h>
  //           using namespace std;
  //
  //           int main() {
  //             vector<int> v;
  //             cout << v[-1];
  //           }`,
  //         input: "",
  //       })
  //     );
  //     const { time, memory, stderr, ...data } = JSON.parse(result.body);
  //     expect(stderr).toMatch(/AddressSanitizer: SEGV on unknown address/);
  //     expect(stderr).toMatch(
  //       /Hint: this fault was caused by a dereference of a high value address/
  //     );
  //     expect(data).toMatchInlineSnapshot(`
  //       Object {
  //         "exitCode": 1,
  //         "status": "runtime_error",
  //         "stdout": "",
  //       }
  //     `);
  //   });
});

// describe("Java", () => {
//   it("compiles and runs", async () => {
//     const result = await app.lambdaHandler(
//       generateRequest({
//         language: "java",
//         compilerOptions: "",
//         filename: "Main.java",        problemid: "usaco-100/",
//
//           sourceCode: `import java.util.Scanner;
//
//         public class Main {
//           static Scanner sc = new Scanner(System.in);
//           public static void main(String[] args) {
//             int a = sc.nextInt();
//             int b = sc.nextInt();
//             int c = sc.nextInt();
//             System.out.println(a + b + c);
//           }
//         }`,
//         input: "1 2 3",
//       })
//     );
//     const data = JSON.parse(result.body);
//     expect(data.status).toBe("success");
//     expect(data.stderr).toBe("");
//     expect(data.stdout).toBe("6\n");
//     expect(data.memory).toMatch(/[0-9]{4}/);
//     expect(data.time).toMatch(/\d\.\d\d/);
//   });
//
//   it("throws compilation error", async () => {
//     const result = await app.lambdaHandler(
//       generateRequest({
//         language: "java",
//         compilerOptions: "",
//         filename: "main.java",        problemid: "usaco-100/",
//
//           sourceCode: `import java.util.Scanner;
//
//           public class NotMain {
//             static Scanner sc = new Scanner(System.in);
//             public static void main(String[] args) {
//               int a = sc.nextInt();
//               int b = sc.nextInt();
//               int c = sc.nextInt();
//               System.out.print("sum is ");
//               System.out.println(a + b + c);
//             }
//           }`,
//       })
//     );
//     const data = JSON.parse(result.body);
//     expect(data).toMatchInlineSnapshot(`
// Object {
//   "message": "main.java:3: error: class NotMain is public, should be declared in a file named NotMain.java
//           public class NotMain {
//                  ^
// 1 error
// ",
//   "status": "compile_error",
// }
// `);
//   });
//
//   it("throws TLE error", async () => {
//     const result = await app.lambdaHandler(
//       generateRequest({
//         language: "java",
//         compilerOptions: "",
//         filename: "Main.java",        problemid: "usaco-100/",
//
//           sourceCode: `import java.util.Scanner;
//
//         public class Main {
//           static Scanner sc = new Scanner(System.in);
//           public static void main(String[] args) {
//             int a = sc.nextInt();
//             int b = sc.nextInt();
//             int c = sc.nextInt();
//             while (true) {
//               c++;
//             }
//           }
//         }`,
//       })
//     );
//     const { memory, time, ...data } = JSON.parse(result.body);
//     expect(data).toMatchInlineSnapshot(`
// Object {
//   "exitCode": 1,
//   "status": "runtime_error",
//   "stderr": "Exception in thread \\"main\\" java.util.NoSuchElementException
// 	at java.base/java.util.Scanner.throwFor(Scanner.java:937)
// 	at java.base/java.util.Scanner.next(Scanner.java:1594)
// 	at java.base/java.util.Scanner.nextInt(Scanner.java:2258)
// 	at java.base/java.util.Scanner.nextInt(Scanner.java:2212)
// 	at Main.main(Main.java:6)
// Command exited with non-zero status 1
// ",
//   "stdout": "",
// }
// `);
//   }, 8000);
//
//   it("throws RTE error", async () => {
//     const result = await app.lambdaHandler(
//       generateRequest({
//         language: "java",
//         compilerOptions: "",
//         filename: "Main.java",        problemid: "usaco-100/",
//
//           sourceCode: `import java.util.Scanner;
//
//         public class Main {
//           static Scanner sc = new Scanner(System.in);
//           public static void main(String[] args) {
//             int a = sc.nextInt();
//             int b = sc.nextInt();
//             int c = sc.nextInt();
//             System.out.print("sum is ");
//             System.out.println(a + b + c);
//           }
//         }`,
//       })
//     );
//     const { memory, time, ...data } = JSON.parse(result.body);
//     expect(data).toMatchInlineSnapshot(`
// Object {
//   "exitCode": 1,
//   "status": "runtime_error",
//   "stderr": "Exception in thread \\"main\\" java.util.NoSuchElementException
// 	at java.base/java.util.Scanner.throwFor(Scanner.java:937)
// 	at java.base/java.util.Scanner.next(Scanner.java:1594)
// 	at java.base/java.util.Scanner.nextInt(Scanner.java:2258)
// 	at java.base/java.util.Scanner.nextInt(Scanner.java:2212)
// 	at Main.main(Main.java:6)
// Command exited with non-zero status 1
// ",
//   "stdout": "",
// }
// `);
//   });
// });
//
// describe("Python", () => {
//   it("compiles and runs", async () => {
//     const result = await app.lambdaHandler(
//       generateRequest({
//         language: "py",
//         compilerOptions: "",
//         filename: "main.py",        problemid: "usaco-100/",
//
//           sourceCode: `a, b, c = map(int, input().split())
// print(a + b + c)`,
//         input: "1 2 3",
//       })
//     );
//     const data = JSON.parse(result.body);
//     expect(data.status).toBe("success");
//     expect(data.stderr).toBe("");
//     expect(data.stdout).toBe("6\n");
//     expect(data.memory).toMatch(/[0-9]{4}/);
//     expect(data.time).toMatch(/\d\.\d\d/);
//   });
//
//   it("throws TLE error", async () => {
//     const result = await app.lambdaHandler(
//       generateRequest({
//         language: "py",
//         compilerOptions: "",        problemid: "usaco-100/",
//
//           filename: "main.py",
//         sourceCode: `a = 0
//   while True:
//     a += 1
//   print(a)`,
//       })
//     );
//     const { memory, time, ...data } = JSON.parse(result.body);
//     expect(data).toMatchInlineSnapshot(`
//       Object {
//         "exitCode": 1,
//         "status": "runtime_error",
//         "stderr": "  File \\"main.py\\", line 2
//           while True:
//           ^
//       IndentationError: unexpected indent
//       Command exited with non-zero status 1
//       ",
//         "stdout": "",
//       }
//     `);
//   }, 8000);
//
//   it("throws RTE error", async () => {
//     const result = await app.lambdaHandler(
//       generateRequest({
//         language: "py",
//         compilerOptions: "",        problemid: "usaco-100/",
//
//           filename: "main.py",
//         sourceCode: `laksjdflkja`,
//       })
//     );
//     const { memory, time, ...data } = JSON.parse(result.body);
//     expect(data).toMatchInlineSnapshot(`
//       Object {
//         "exitCode": 1,
//         "status": "runtime_error",
//         "stderr": "Traceback (most recent call last):
//         File \\"main.py\\", line 1, in <module>
//           laksjdflkja
//       NameError: name 'laksjdflkja' is not defined
//       Command exited with non-zero status 1
//       ",
//         "stdout": "",
//       }
//     `);
//   });
// });
