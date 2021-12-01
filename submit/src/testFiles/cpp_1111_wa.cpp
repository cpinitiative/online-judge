// http://usaco.org/index.php?page=viewproblem2&cpid=1111
// WA on some
// Standard I/O

#include <iostream>
#include <set>
#include <vector>
#include <algorithm>
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

  if (answer % 2 != 0) cout << answer*24 << "\n";
  else cout << answer * 12 << "\n";
}