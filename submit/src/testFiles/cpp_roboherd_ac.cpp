// http://www.usaco.org/index.php?page=viewproblem2&cpid=674
// AC
// Standard I/O

#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

int N, M;
vector<int> A[100010];
int F[100010];
int totalcount;
long long savings;

void search(int x, long long budget) {
  if (totalcount >= M) {
    return;
  }
  if (x != -1 && budget < A[x][0]) {
    x = upper_bound(F, F + x, (int)budget) - F - 1;
  }
  if (x == -1) {
    totalcount++;
    return;
  }
  search(x - 1, budget);
  for (int i = 0; i < A[x].size() && A[x][i] <= budget; i++) {
    search(x - 1, budget - A[x][i]);
  }
}

void enumerate(int x, long long budget) {
  if (x != -1 && budget < A[x][0]) {
    x = upper_bound(F, F + x, (int)budget) - F - 1;
  }
  if (x == -1) {
    savings += budget + 1;
    return;
  }
  enumerate(x - 1, budget);
  for (int i = 0; i < A[x].size() && A[x][i] <= budget; i++) {
    enumerate(x - 1, budget - A[x][i]);
  }
}

int main() {
  cin >> N >> M;
  
  long long base = 0;
  long long mx = 0;
  for (int i = 0; i < N; i++) {
    int sz; cin >> sz;
    
    vector<int> V(sz);
    for (int j = 0; j < sz; j++) {
      cin >> V[j];
    }
    sort(V.begin(), V.end());
    
    base += V[0];
    if (sz == 1) {
      i--;
      N--;
      continue;
    }
    for (int j = 1; j < sz; j++) {
      A[i].push_back(V[j] - V[0]);
    }
    mx += A[i].back();
  }
  
  sort(A, A + N);
  for (int i = 0; i < N; i++) {
    F[i] = A[i][0];
  }
  
  long long lo = 0;
  long long hi = mx;
  while (lo < hi) {
    long long md = (lo + hi) / 2;
    totalcount = 0;
    search(N - 1, md);
    if (totalcount < M) {
      lo = md + 1;
    } else {
      hi = md;
    }
  }
  
  savings = 0;
  if (lo > 0) {
    enumerate(N - 1, lo - 1);
  }
  cout << (base + lo) * M - savings << endl;
  
  return 0;
}