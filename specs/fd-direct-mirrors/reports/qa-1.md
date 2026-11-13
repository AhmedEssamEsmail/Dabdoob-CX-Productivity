# qa report - fd-direct-mirrors - round 1 (FULL)
Verdict: FAIL
Open: 0B / 1H / 2M / 2L

## Checks run
- `npx tsc --noEmit` -> exit 0, log empty (clean)
- `npx vitest run` -> exit 1: 1342 passed / 4 failed, all in `tests/perf/audit-queue-memo.test.tsx` ("No TableScroll export on @/features/shared/components/ui mock", audit-queue-page.tsx:436). Task suites all green: mirrors 9/9, fd-activity-export 5/5, fd-activity-cells 7/7, mirror-cells 6/6, qe-fd-cache 5/5, golden queue-tlqueue 50/50, tph 23/23, productivity 16/16.
- `npx eslint <14 touched files>` -> exit 0, log empty
- `grep "select('cols" src/` -> 0 hits; `fc_messages` in src/migration -> sheet-config keys only (D6-allowed) + migration/logs
- Evidence reviewed: mirrors/vendor-apis/freshdesk/engine-live/tlqueue/jobs/tph-run/touches diffs, mirror-cells.ts, 5 migrations, purge-write.log (495,345 deleted, refresh_log written)

## Criteria coverage
1. FD export per UTC day, zero Sheets reads, day windowMs, dedupe-key idempotent — VERIFIED (mirrors.ts:87-113, tests assert sheetCalls=0).
2. Typed cols + adapter, golden suites pass — VERIFIED.
3. tickets subject/order_id mapped + real values + qe_fd_cache upsert w/ 30d prune — VERIFIED (freshdesk.ts:101-102, engine-live.ts:280-318, QE_FD_CACHE_KEEP_DAYS=30).
4. cols readers/writers removed + drop migration authored — VERIFIED code-side; remote DROP pending merge-to-main (unapproved by design).
5. Purge executed — VERIFIED via reports/purge-write.log.
6. fc_messages retired — VERIFIED (drop migration, tooling grep clean, sheet path intact).
7. Gates — tsc/eslint clean; vitest RED on foreign test (qa-3).

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| qa-1 | MED | src/features/shared/jobs/mirrors.ts:206-208,280 | dedupe_key = sha1(JSON cells). 404,915 backfilled fd_activities rows carry sheet-era keys (cell0 = DD/MM/YYYY display); API writer emits ISO cell0 -> different key -> duplicate rows for the same activity in the 24h overlap at cutover, and a future `full:true` resync duplicates ALL post-Sep-1 rows. Spec silent on re-keying. | Before enabling API sync: wipe fd_activities (rebuildable mirror) or delete sheet-keyed rows; alternatively hash a canonical key (performed_at|ticket_id|field_changed|new_value). NEEDS_APPROVAL for remote delete. | data-engineer |
| qa-2 | MED | src/features/shared/jobs/mirrors.ts:76-85 | `fdActivityRosterNames_` reads `data` without checking `error`; a transient roster failure silently yields `User <id>` performer names baked into cells AND dedupe_key -> mislabeled persisted rows + dupes when roster recovers (fdGroups_ is .catch-guarded; roster is not). | Check the select error and throw `described` (fail the window like a day-export failure), or skip the write when roster read fails. | dev |
| qa-3 | HIGH | tests/perf/audit-queue-memo.test.tsx:249 / src/features/cx-quality/components/audit-queue-page.tsx:436 | Required gate `npx vitest run` is RED: 4 tests fail — component renders `<TableScroll>` but the test's UI mock lacks the export. FOREIGN edit (files in TRACKER baseline; last touched by commits 752bd5c/593fb30, not this task). | Add `TableScroll` to the `@/features/shared/components/ui` mock in tests/perf/audit-queue-memo.test.tsx. | dev (foreign editor) |
| qa-4 | LOW | supabase/migrations/20261113115521_drop_mirror_cols.sql | Merge-to-main applies DROP COLUMN via Supabase integration while the old deploy still `.select('cols')` -> brief reader errors until Vercel redeploy completes (TL-2 flagged; inherent to merge ordering). | Accept (minutes-scale) or stage: deploy code first, then apply migration. | dev |
| qa-5 | LOW | results/S00-02.md,S01-02.md,S03-01.md,S05-02.md | Worker result files landed at repo-root `results/` instead of `specs/fd-direct-mirrors/results/`; also foreign deletions of `results/qa1-*.md` in tree. | Move the four files into the spec results dir. | tech-writer |

## Regression & scope
- All modified source files are inside shard Files lists; `docs/PERF_BASELINE.md` edit = sanctioned fc_messages row removal (S00-02). PNG/test-result churn, `specs/headcount-access-split/`, `docs/Reference_Code.gs`, `results/qa1-*.md` deletions = foreign in-flight per TRACKER baseline — attributed, not reverted.
- Remote chain (4 migrations, purge, backfill) matches APPROVALS.md grants exactly; counts match dry-runs; drop-cols remote apply correctly NOT done.
- Test quality: new tests assert real values (typed col contents, ISO ts, roster-name resolution, multi-row expansion, blank->NULL->'' parity, error paths, missing-credentials) — would fail without the change.

## Not verified / assumptions
- Prod post-merge state (drop-cols apply, cursor reset per D3) is release-ops, out of audit scope.
- `tickets.subject`/`order_id` on existing rows stay NULL until the approved `v2_fd_inc_cursor` reset runs (D3) — expected, not a defect.
