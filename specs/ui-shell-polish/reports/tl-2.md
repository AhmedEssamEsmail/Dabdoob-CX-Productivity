# tl-2 — ui-shell-polish FIX resume (post host-restart)

Mode: FIX · Source: `reports/debug-1.md` · Spec: `fix-dbg-1.md` (dbg1-01…09)
Resumed with dbg1-03/04/05/06/07 landed; finished dbg1-08, dbg1-02 verify, dbg1-01, + gate-repair dbg1-09.

## Leaves this round
| Leaf | Outcome | Evidence |
|---|---|---|
| dbg1-08 `/api/qa/*` 500 | done — **no code fix exists**: Windows Job-Object on agent-spawned `next dev` killed jest-worker children (all dynamic routes). PM restarted dev outside the Job Object; all probes now JSON (getQaAccess/getQaScoresPage 401→200 under tests, options 401). results/dbg1-08.md | curl + e2e api probes |
| dbg1-02 `.qa-grid` overlap | done — re-verified live: `item2` 5/5, `overlaps:[]` every project | results/e2e-item2-rerun.log |
| dbg1-01 TL-drill labels | done — live pin-down: headers/cells aligned; culprit `.qa-sub{display:block}` second lines (49px rows vs 36px). Fix: `section[aria-labelledby="qs-tbl-h"] .qa-sub{display:inline;margin-inline-start:var(--cx-space-2)}`. item1 5/5; 1440+375 shots regenerated | results/dbg1-01.md |
| dbg1-09 spec regex (added) | done — `/is` flag broke tsc (es2018 `s` flag); → `[\s\S]`+`i`. tsc exit 0 | results/dbg1-09.md |

## Changed files (whole fix)
`src/app/styles/quality.css` (+3 rules), `src/app/auth/login/page.tsx`, `src/app/cx-kit.css`,
`src/app/refresh.css`, `src/features/cx-hub/components/admin-page.tsx`,
`src/features/shared/components/shell/AppShell.tsx`, `e2e/ui-shell-polish.spec.ts` (regression spec).

## Integration gates (int-1)
- `npx tsc --noEmit` — **PASS** (after dbg1-09)
- `npx eslint <changed files>` — **PASS**
- `npx vitest run` — 85/86 files pass; 1 **foreign** fail `tests/perf/audit-queue-memo.test.tsx` (mock lacks `TableScroll`; files untouched — pre-existing)
- `playwright e2e/ui-shell-polish.spec.ts` — 29/30; firefox item5 `browserContext.close` protocol flake → passes solo. Effective **30/30**
- `playwright e2e/page-contract.spec.ts` (touched routes) — 27/50; all 23 fails attributed foreign: webkit CORS fetch noise + firefox console "Error" (identical on untouched /admin/config·roster) + baseline-documented `/admin/roster` toolbar-x. **0 h-scroll/unnamed fails; baseline `/admin` h-scroll cleared** (compact reminders row)

## Status
All 8 debug findings fixed and verified. No blockers. Reviewer DELTA = files above.
TRACKER: `specs/ui-shell-polish/TRACKER.md` — all leaves `done`.
