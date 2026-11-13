# TL report 1 — fd-direct-mirrors (BUILD resume)

## Resume reconciliation (TRACKER vs disk)
- S00-02, S01-02, S03-01, S05-02: results files never written (workers killed),
  but code verified landed on disk — evidence recorded in TRACKER rows.
- S03-03: partially landed (toRow hook + upsert merge via S03-04 worker);
  fd_activities spec switch + tests were missing — re-dispatched fresh dev,
  now done (results/S03-03.md).
- Package roll-ups: S02 done, S03 done (was pending).

## This session's changes
- `src/features/shared/jobs/mirrors.ts` — fd_activities spec → per-UTC-day
  `fdActivityExport_` loop + `fdActivityToCells_` flatten, roster byId +
  `fdGroups_` names, `windowMs: 86400000`, `tsMs=Date.parse(cells[0])`, 9-col
  `toRow`, header updated; `fetchWorkbookTabs` import removed.
- `tests/jobs/mirrors.test.ts` — freshdesk mock + rewritten fd_activities cases.

## Gates (checkpoint)
- `npx tsc --noEmit` clean; vitest 27/27 across mirrors + fd-activity +
  mirror-cells suites (reports/gate-s03.log). mirror-cells re-verify 6/6
  (reports/verify-s0502.log).

## Done
S00, S01, S02, S03 packages + S05-01 (dry-run), S05-02 (script+tests).

## Blocked — NEEDS_APPROVAL (remote writes; PM must obtain user approval)
1. Remote-apply migrations 20261112150304 + 20261112150305 (S02 typed cols) —
   hard blocker for S05-02 --dry/--write. CLI is linked to prod; remote calls
   need `--remote`, check `Target:`, prefix `env -u SUPABASE_ACCESS_TOKEN`.
2. `migration/purge-mirrors-pre-sep.ts --write` (S05-01).
3. `migration/backfill-mirror-columns.ts --write` (S05-02) — after 1+2.
4. Then S04-01 → S04-02 (reader cutover) → S05-03 (stop cols) → S05-04
   (drop-cols migration; its remote apply also NEEDS_APPROVAL).
Also pending remote apply (auto-applies on merge to main): 20261112150724,
20261112150725.

No review gates run (PM's role); no commits made.
