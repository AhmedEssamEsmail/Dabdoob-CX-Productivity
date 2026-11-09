# FIX-01 result — Constrain .qa-list grid track
Status: done
Files: src/app/styles/quality.css (line 217, .qa-list rule only)
Change: added grid-template-columns:minmax(0,1fr); 1 line changed.
Verify: `cd tests/ui && npx playwright test --config playwright.config.ts qa-strip-overflow.pw.ts --project=chromium` -> exit 0, 1 passed.
Blockers/handoff: none.
