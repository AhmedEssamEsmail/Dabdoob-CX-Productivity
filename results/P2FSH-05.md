# P2FSH-05 — rail-search title
Status: DONE
Files: src/features/shared/components/shell/AppShell.tsx (+1 line: title={D('Search or jump to…')} on .rail-search button ~L558)
Checks: npx eslint AppShell.tsx -> 0 problems; npx tsc --noEmit -> exit 0.
Handoff: B16 rail label fixed; hover/focus now exposes full text. Browser @1024 DOM check not run (no browser); title attribute is static in JSX.
Blockers: none.
