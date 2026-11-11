# P2FSH-06 — rail blank band ≤820
Status: DONE
Files: src/app/cx-kit.css (@media max-width:820px .shell/.shell.rail-off)
Change: added `grid-template-rows: auto minmax(0,1fr)` so rail row hugs content, main fills rest; desktop/nav-open untouched.
Checks: eslint css -> n/a (no matching config); `npx tsc --noEmit` -> clean.
Browser re-audit (/fcr, /my-actions @375) not run — no dev server; auditor to re-check rail height.
