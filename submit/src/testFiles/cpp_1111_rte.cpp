// http://usaco.org/index.php?page=viewproblem2&cpid=1111
// RTE on some
// Standard I/O

#include <bits/stdc++.h>
using namespace std;
 
set<int> blocks;
vector<int> gaps;
 
int main(void)
{
  int N, K, years_ago, answer, last = 0;
  cin >> N >> K;
  for (int i=0; i<N; i++) { cin >> years_ago; blocks.insert ((years_ago+11)/12); }
  answer = *blocks.rbegin();
  while (!blocks.empty()) {
    gaps.push_back(*blocks.begin() - last - 1);
    last = *blocks.begin();
    blocks.erase(*blocks.begin());
  }
  sort (gaps.rbegin(), gaps.rend());
  for (int i=0; i<K-1 && i<gaps.size(); i++) answer -= gaps[i];

  assert(false);
  cout << answer * 12 << "\n";
}