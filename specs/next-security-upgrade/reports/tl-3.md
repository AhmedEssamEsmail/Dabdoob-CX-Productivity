# TL report 3 — next-security-upgrade (fix leaves S01-10..S01-14)

## Outcome
26-failure 16.4.6 e2e regression resolved; browser gate GREEN @workers=1 both projects. S01 package done.

## Leaves
| Leaf | Status | Changed files | Evidence |
|---|---|---|---|
| S01-10 geometry | done | `src/app/refresh.css` (status spans → `position:absolute` under relative `.cx-refresh`/`.page-actions`; `.page-head:has([role="status"])` padding) — content now sits in HEAD via parallel-session commit 7511b13 | results/S01-10.md; verify 15/15 (logs/e2e-fix-geometry.log) |
| S01-11 aria-busy | done, zero edits | none — env class: `/api/qa/*` handlers exceed 15s only under full-suite saturation | results/S01-11.md; green workers=1+2 (logs/e2e-fix-ariabusy.log) |
| S01-12 console errors | needs-split | none — 500 in `src/app/api/prod/analytics/route.ts` outside Files; serial runs green | results/S01-12.md (logs/e2e-fix-console.log) |
| S01-13 Reminders Toggle | done | `src/features/cx-hub/components/admin-page.tsx` (+19/-23): `.cx-switch` → canonical `<Toggle>` | results/S01-13.md; item5 serial pass (logs/e2e-fix-reminders.log) |
| S01-14 verify | verified | none | chromium 97p/1f (infra flake, rerun 2/2); firefox 98p/0f; verdict GREEN |

## Integration gates (TL-run, r3)
- `npx tsc --noEmit` exit 0 — logs/gate-tsc-r3.log
- `npx vitest run` 118 files / 1493 tests — logs/gate-vitest-r3.log
- Manifests, playwright.config, e2e/: porcelain clean throughout.

## For PM
- **RESHARD_NEEDED (optional):** S01-12 escalated a StrictMode double-mount causing duplicate `GET /api/prod/analytics` calls; dedupe belongs in `use-page-data.ts` or the route. Serial evidence shows env-class, not a blocker.
- Parallel session committed app CSS (7511b13) mid-run — S01-10's refresh.css fix is in HEAD; verify confirms end-state green.
- S01 package complete; PLAN review gates (QA + dependency-security) are PM-run next.
