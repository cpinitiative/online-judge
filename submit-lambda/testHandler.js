let app = require("./function/app.js");

// app.handler({
//   language: "cpp",
//   compilerOptions: "-std=c++17 -O2 -Wall -Wextra -Wshadow -Wconversion -Wfloat-equal -Wduplicated-cond -Wlogical-op",
//   filename: "main.cpp",
//   sourceCode: `
// #include <bits/stdc++.h>

// using namespace std;

// int main() {
//   int a, b, c; cin >> a >> b >> c;
//   cout << a+b+c;
// }`,
//   input: `1 2 3`
// }, {}, (data, ss) => {
//   console.log(data);
// });

app.handler({
  language: "java",
  compilerOptions: "",
  filename: "Main.java",
  sourceCode: `
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.*;
  
public class Main {
  
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer tokenizer = new StringTokenizer(in.readLine());
        int n = Integer.parseInt(tokenizer.nextToken());
        int m = Integer.parseInt(tokenizer.nextToken());
        List<Integer>[] adj = new List[(2 * n) + 1];
        for (int a = 1; a <= 2 * n; a++) {
            adj[a] = new ArrayList<>();
        }
        for (int j = 1; j <= m; j++) {
            tokenizer = new StringTokenizer(in.readLine());
            int a = Integer.parseInt(tokenizer.nextToken());
            int b = Integer.parseInt(tokenizer.nextToken());
            adj[a].add(b + n);
            adj[b + n].add(a);
            adj[a + n].add(b);
            adj[b].add(a + n);
        }
        int[] dist = new int[(2 * n) + 1];
        Arrays.fill(dist, -1);
        dist[1] = 0;
        LinkedList<Integer> q = new LinkedList<>();
        q.add(1);
        while (!q.isEmpty()) {
            int a = q.remove();
            for (int b : adj[a]) {
                if (dist[b] == -1) {
                    dist[b] = dist[a] + 1;
                    q.add(b);
                }
            }
        }
        int answer = 0;
        if (dist[n + 1] == -1) {
            answer = n - 1;
        } else {
            TreeMap<Pair, Integer> freq = new TreeMap<>();
            TreeMap<Pair, List<Integer>> buckets = new TreeMap<>();
            for (int a = 1; a <= n; a++) {
                freq.merge(new Pair(Math.min(dist[a], dist[n + a]), Math.max(dist[a], dist[n + a])), 1, Integer::sum);
                buckets.computeIfAbsent(new Pair(Math.min(dist[a], dist[n + a]), Math.max(dist[a], dist[n + a])), __ -> new ArrayList<>()).add(a);
            }
            TreeMap<Pair, Integer> edgeAmt = new TreeMap<>();
            for (Map.Entry<Pair, Integer> entry : freq.entrySet()) {
                Pair p = entry.getKey();
                int f = entry.getValue();
                int prev = edgeAmt.getOrDefault(new Pair(p.first - 1, p.second + 1), 0);
                if (p.second == p.first + 1) {
                    if (p.first == 0) {
                        answer += (f + 1) / 2;
                    } else if (freq.containsKey(new Pair(p.first - 1, p.second - 1))) {
                        answer += Math.max((f - prev) + ((prev + 1) / 2), (f + 1) / 2);
                    } else {
                        if (prev < f) {
                            answer += f - prev;
                        }
                        answer += (f + 1) / 2;
                    }
                } else {
                    answer += f;
                    if (p.first == 0) {
                        edgeAmt.put(p, f);
                    } else if (freq.containsKey(new Pair(p.first - 1, p.second - 1))) {
                        edgeAmt.put(p, Math.min(f, prev));
                    } else {
                        if (prev < f) {
                            answer += f - prev;
                        }
                        edgeAmt.put(p, f);
                    }
                }
            }
        }
        System.out.println(answer);
    }
  
    static class Pair implements Comparable<Pair> {
        final int first;
        final int second;
  
        Pair(int first, int second) {
            this.first = first;
            this.second = second;
        }
  
        @Override
        public int compareTo(Pair other) {
            if (first != other.first) {
                return first - other.first;
            } else {
                return second - other.second;
            }
        }
    }
}
`,
  input: `8 10
1 2
1 3
1 4
1 5
2 6
3 7
4 8
5 8
6 7
8 8`
}, {}, (data, ss) => {
  console.log(data);
});