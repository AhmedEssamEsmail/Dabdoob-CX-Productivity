# tl-5 — ui-shell-polish — FIX round ux-1

Source: `reports/ux-1.md` (verdict FAIL; findings ux-1…ux-4 — 2 MED + 2 LOW,
all routed blocking per task). Fix spec: `fix-ux-1.md` (leaves ux1-01…ux1-04,
all Owner: dev). Result: **all 4 fixed; integration gates green**.

## Completed leaves

| Leaf | Files changed | Fix | Evidence |
|---|---|---|---|
| ux1-01 (ux-1 MED) | `src/app/auth/login/page.tsx` | `AbortSignal.timeout(20000)` on `/api/auth/login` fetch; `catch` maps `AbortError`/`TimeoutError` → `'Sign-in timed out — try again.'` + overlay dismissed + `setLoading(false)`. Hung fetch can no longer pin the overlay forever. | tsc 0; item3 5/5 (worker); `results/ux1-01.md` |
| ux1-02 (ux-2 MED) | `src/features/cx-hub/components/admin-page.tsx` (Rb only) | Optimistic `pending` state: `checked={pending ?? on}`, `disabled={pending !== null \|\| !row}` — pill flips on click and stays disabled for the whole request; `finally` reverts to server truth. Save/toast/error paths unchanged; Toggle.tsx/cx-kit.css untouched. | tsc 0; item5 5/5 (worker); `results/ux1-02.md` |
| ux1-03 (ux-3 LOW) | `src/app/theme.css` | `animation-delay: 0s !important;` added to both reduced-motion kill blocks (`html[data-reduce-motion] *` + media-query `*`). `.page>*` backwards-fill can no longer pin `opacity:0` for up to 360ms/144ms. | `grep -c` = 2; `results/ux1-03.md` |
| ux1-04 (ux-4 LOW) | `src/features/shared/components/shell/AppShell.tsx` | `title={user.name}` on `.who-name` — truncated rail name recoverable via native tooltip. | tsc 0; `results/ux1-04.md` |

## Integration gates (int-4)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS exit 0 (`logs/ux1-gate-tsc.log`) |
| `npx eslint` (4 changed files) | PASS exit 0 — 1 ignore-warning on theme.css (no config) (`logs/ux1-gate-eslint.log`) |
| `npx vitest run` | 85/86 files, 1295/1299 — only foreign `tests/perf/audit-queue-memo.test.tsx` ×4 (TableScroll mock; pre-existing since int-1, files untouched) (`logs/ux1-gate-vitest.log`) |
| `npx playwright test e2e/ui-shell-polish.spec.ts --workers=2` | **30/30 PASS** first pass, no flakes (`logs/ux1-gate-e2e.log`) |

Scope check: only `src/app/theme.css` newly modified vs ux-1 dispatch baseline
(owned by ux1-03); login page, admin-page, AppShell already carried prior-round
edits — all within their leaf's declared Files. No files outside leaf scope.
Approximate actual churn within budgets.

## Blocked / needs-split / deferred

- None. All findings fixed; no reviewer requests, no RESHARD_NEEDED.
- Foreign (attributed, unchanged): `tests/perf/audit-queue-memo.test.tsx` 4
  fails — ui-barrel mock missing `TableScroll` (pre-existing).

## Reviewer DELTA scope (files changed this round)

- `src/app/auth/login/page.tsx` (handleLogin fetch+catch ~62-96)
- `src/features/cx-hub/components/admin-page.tsx` (Rb ~318-368)
- `src/app/theme.css` (kill blocks ~507-530)
- `src/features/shared/components/shell/AppShell.tsx` (.who-name ~632)
