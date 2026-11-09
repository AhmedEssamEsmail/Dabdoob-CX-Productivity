# FIX-03 result
Status: done
Files: src/app/styles/quality.css (one `.card:has(.qa-ctl)` 72rem rule), tests/ui/qa-strip-overflow.pw.ts (submitCard fixture + wide-viewport test)
Checks: `npx playwright test qa-strip-overflow.pw.ts --project=chromium` -> 3 passed, exit 0 (1400px, 320px, new 1600px cases)
Handoff: none
