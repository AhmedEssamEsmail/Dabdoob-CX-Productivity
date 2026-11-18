# fix-deferred-lows — PASS

Files: agents-page.tsx (beh-* names/autoComplete/spellCheck, cx-hint, behMsgStatus ok/info, 'Workbook links', 'behaviour log'), people.css (.pw-field-grow min(18rem,100%)), scorecard-server.ts (scDateOk_ regex + Date round-trip), tlqueue.ts (pk ['row_n','record_id']), repo.ts (ReadAllPagedOptions.pk widened to string|string[] — required by the mandated array pk; runtime already handled arrays), .gitignore (+nul), migration sql (comment only), tests/platform/tlq-io-paged.test.ts (pk assertion updated to match fix).
Checks: `npx tsc --noEmit` clean (empty log, fix-lows-tsc.log); eslint touched files 0 errors (css ignored-warning only, fix-lows-eslint.log); vitest 8 files 103 tests — 1 initial fail on stale pk assertion, fixed, rerun green (fix-lows-vitest.log, fix-lows-vitest2.log).
Handoff: none. Note: repo.ts + test file were outside the named list but required by the exact data-13 fix.
