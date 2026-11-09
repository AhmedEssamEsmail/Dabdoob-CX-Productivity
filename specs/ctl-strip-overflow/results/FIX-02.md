# results/FIX-02
Status: done
Files: src/app/styles/quality.css (lines 226-227 only); tests/ui/qa-strip-overflow.pw.ts (added narrow-viewport test)
Checks: playwright qa-strip-overflow.pw.ts --project=chromium -> 2 passed, exit 0
Notes: .qa-name now flex:0 1 auto + min-width:0/overflow:hidden/ellipsis; removed from flex:none group. New 320px test asserts no doc h-scroll, strip edges inside .qa-list, overflow:hidden and scrollWidth>clientWidth.
Handoff: none
