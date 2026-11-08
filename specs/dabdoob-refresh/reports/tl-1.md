# TL report 1 — dabdoob-refresh (BUILD)

Round 1 of BUILD. 10 leaves done, 20 leaves need re-shard/fix by PM, rest blocked
downstream. Full leaf state: `specs/dabdoob-refresh/TRACKER.md`.

## Completed (evidence in `results/<id>.md`)
- S01-01 chrome strings (layout/BootSplash/registry APPS), S01-02 hub titles,
  S01-04 people templates — rebrand applied, tsc clean.
- S02-01 theme.css tokens (light+dark+auto blocks, density contract intact).
- S02-02 refresh.css base created + imported in layout.tsx.
- S02-05 cx-kit.css rail/nav/toast reskin; S02-06 kit controls/cards/tables reskin.
- S03-01 CommandPalette.tsx + 6 filter unit tests (incl. 1 resume-fix:
  react-hooks/set-state-in-effect eslint error — fixed, 0 errors).
- S03-02 AppShell rail markup (fixed "Dabdoob CX"/"Operations console" brand,
  rail-search button, avatar foot); S03-03 palette wiring (⌘K, open state, render).

## Needs PM / re-shard (RESHARD_NEEDED)
1. `spec/S02/03-refresh-data-surfaces.md` — preflight FAIL: Budget actions=7 but
   6 numbered Actions. Content is within limits; metadata-only fix. **Critical
   path**: blocks S02-04 -> S03-04, all S04 pages, all S05 leaves, S06-01.
2. `spec/S05/01..17-*.md` — preflight FAIL: Files lines lack `| bounded region`,
   file-count/budget mismatch (S05-01 also actions mismatch). Metadata-only fix.
3. S01-03 remainder — source edits applied correctly (mail/notify/maildesk/
   myday/jobs + 2 test expectation strings), but `tests/golden/desk.test.ts`
   byte-compares the port against frozen `_archive` legacy MailDesk.js which
   still emits `(via CX Helm)`. Needs a bounded fix leaf on the test harness:
   brand-normalize the legacy oracle output or a documented-divergence
   allowlist. Until then `npx vitest run` has exactly 2 failures.

## Integration checkpoint 1 (after all active writers finished)
- `npx tsc --noEmit` — clean.
- `npx eslint . --quiet` — 0 errors (213 pre-existing warnings).
- `npx vitest run` — 1115/1117 pass; only the 2 known desk.test.ts parity fails.
- Scoped diff reviewed: all changed files belong to dispatched leaves; no
  out-of-scope edits. Baseline was clean (untracked mockups/ + specs/ only).

## Notes for PM gates
- PLAN criterion #1 grep `"CX Helm\|CX Productivity"` will still hit the
  contract-required APPS title `Dabdoob CX Productivity` (substring). Gate
  regex needs to exclude it or match `"CX Productivity"` quoted/exact.
- Full gates (e2e, build, shot harness) were not run — they are PM gates and
  would be premature against the blocked S02-04+/S04 page work.
- Changed files: src/app/{theme.css,cx-kit.css,refresh.css(new),layout.tsx};
  AppShell.tsx, BootSplash.tsx, registry.ts, CommandPalette.tsx(new);
  admin-page.tsx, ecosystem-page.tsx; mail.ts, notify.ts, maildesk.ts,
  myday.ts, jobs.ts; cx-people lib x5; tests: desk.test.ts, notify.test.ts,
  tests/shell/command-palette.test.ts(new).
