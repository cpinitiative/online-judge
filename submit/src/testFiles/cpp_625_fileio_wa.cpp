// http://usaco.org/index.php?page=viewproblem2&cpid=1111
// AC
// File I/O

#include <iostream>
#include <algorithm>
#include <vector>

using namespace std;

int main() {
  freopen("fencedin.in", "r", stdin);
  freopen("fencedin.out", "w", stdout);
  
  int A, B, N, M;
  cin >> A >> B >> N >> M;

  vector<int> VA(N + 1), HA(M + 1);
  for (int i = 0; i < N; i++) {
    cin >> VA[i];
  }
  for (int j = 0; j < M; j++) {
    cin >> HA[j];
  }

  sort(VA.begin(), VA.end());
  for (int i = 0; i < N; i++) {
    VA[i] = VA[i + 1] - VA[i];
  }
  VA[N] = A - VA[N];

  sort(HA.begin(), HA.end());
  for (int i = 0; i < M; i++) {
    HA[i] = HA[i + 1] - HA[i];
  }
  HA[M] = B - HA[M];

  sort(VA.begin(), VA.end());
  sort(HA.begin(), HA.end());
  N++; M++;

  long long result = 1ll * VA[0] * (M - 1) +
                     1ll * HA[0] * (N - 1);
  for (int vi = 1, hi = 1; vi < N && hi < M; ) {
    if (VA[vi] < HA[hi]) {
      result += VA[vi++] * (M - hi);
    } else {
      result += HA[hi++] * (N - vi);
    }
  }
  cout << result+1 << endl;

  return 0;
}