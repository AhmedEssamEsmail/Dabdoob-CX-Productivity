# DQ-3 — DONE
- Files: aging-page.tsx (`cxp dq-page`→`cxp page` :107; dropped both `className="dq-help"` spans), checkins-page.tsx :107, queue-page.tsx :393 (`dq-page`→`page` bare), cx-kit.css (deleted `.dq-head`, `.dq-head .page-purpose`, `.dq-head__aside`).
- dq-head gate: only shared.tsx:4 comment hit; `dq-headline` is a separate refresh.css family (untouched).
- Grep: zero `dq-page`/`dq-help` in the three tsx; zero `dq-head` in cx-kit.css.
- Verify: `npx tsc --noEmit` clean; eslint 0 errors (7 loser warnings remain — all DQ-4 families: dq-statusline/correct/agebar/groupbreak); vitest queue.test.ts 10/10 pass.
- Handoff: queue-page/checkins → DQ-4; cx-kit.css `.page,.dq-page` selectors → DQ-7; shared.tsx:4 `dq-head` comment → DQ-6.
