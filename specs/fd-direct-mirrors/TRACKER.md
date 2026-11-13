# TRACKER: fd-direct-mirrors

Baseline dirty tree at TL start (NOT ours — user/other-agent edits; do not
revert; scope checks use assignment-local diffs only):
`src/features/cx-queue/lib/jobs.ts`, `src/features/cx-queue/lib/tlqueue.ts`,
`tests/golden/*` (8 files), `src/features/cx-quality/lib/{pure,server}.ts`,
`src/features/cx-quality/components/*`, `src/features/cx-hub/*`,
`src/features/cx-people/*`, `src/features/cx-productivity/lib/tph/page.ts`,
`src/features/shared/{migration/mappings/hct,platform/calendar,platform/identity}.ts`,
`tests/{perf,platform}/*`, `specs/ui-shell-polish/reports/*`,
`docs/Reference_Code.gs` (??), `specs/headcount-access-split/` (??),
`supabase/migrations/20261112142701_headcount_access_split.sql` (??),
`tests/quality/` (??), `scripts/ops/backfill-hct-headcount.mts` (??).

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S00 | package/- | - | - | n/a | not dispatchable | done | both children done; grep verified clean (only sheet keys + logs remain per D6) |
| S00-01 | mini/S00 | supabase-expert | none | 1/3/20/5 | PASS | done | results/S00-01.md; migration 20261112150725, tsc clean; remote apply NEEDS_APPROVAL |
| S00-02 | mini/S00 | dev | S00-01 | 8/6/50/10 | PASS | done | results file missing (worker killed); TL re-verified on disk: backfill-fc-messages.ts deleted, fc_messages grep clean (logs only), docs clean |
| S01 | package/- | - | - | n/a | not dispatchable | done | all 3 children done; tsc+vitest+eslint clean |
| S01-01 | mini/S01 | supabase-expert | none | 1/2/15/5 | PASS | done | results/S01-01.md; migration 20261112150724, tsc clean; remote apply NEEDS_APPROVAL |
| S01-02 | mini/S01 | dev | S01-01 | 2/5/45/10 | PASS | done | results file missing (worker killed); TL re-verified: fdTicketToRow_ emits subject/order_id (freshdesk.ts:101-102); qeReadTicketDetail_ selects+maps them (engine-live.ts:284,291-292) |
| S01-03 | mini/S01 | data-engineer | S01-02 | 2/5/70/10 | PASS | done | results/S01-03.md; qe_fd_cache upsert+30d prune non-fatal; qe-fd-cache.test 5/5, tsc+eslint clean |
| S02 | package/- | - | - | n/a | not dispatchable | done | both migrations authored + tsc clean; remote apply NEEDS_APPROVAL |
| S02-01 | mini/S02 | supabase-expert | none | 1/4/35/5 | PASS | done | results/S02-01.md; migration 20261112150305, tsc clean; remote apply NEEDS_APPROVAL |
| S02-02 | mini/S02 | supabase-expert | none | 1/4/40/5 | PASS | done | results/S02-02.md; migration 20261112150304, tsc clean; remote apply NEEDS_APPROVAL |
| S03 | package/- | - | - | n/a | not dispatchable | done | all 4 children done; integration gate tsc+vitest 27/27 green (reports/gate-s03.log) |
| S03-01 | mini/S03 | data-engineer | none | 2/6/190/10 | PASS | done | freshdesk.ts fdActivityExport_ (:233) + tests/jobs/fd-activity-export.test.ts 5/5 green (TL-verified); results file missing (worker killed/oversight) |
| S03-02 | mini/S03 | data-engineer | S03-01 | 2/6/160/10 | PASS | done | results/S03-02.md; fdActivityToCells_ returns unknown[][] (multi-row expansion, documented deviation); export has group (cell8), no old-value (cell7 ''); vitest 7/7 |
| S03-03 | mini/S03 | dev | S03-02, S02-01 | 2/6/130/10 | PASS | done | results/S03-03.md (attempt 2, fresh dev); fd_activities API day-loop + 9-col toRow + windowMs + roster/groups; tsc clean, mirrors 9/9, zero fetchWorkbookTabs; TL gate reports/gate-s03.log |
| S03-04 | mini/S03 | dev | S02-02 | 2/5/90/10 | PASS | done | results/S03-04.md; toRow hook added (S03-03 not yet landed) + typed emission; mirrors.test 9/9, tsc+eslint clean |
| S04 | package/- | - | S03, S05-02 | n/a | not dispatchable | done | both children done; final integration gate PASS (reports/gate-final.log) |
| S04-01 | mini/S04 | dev | S03-03, S03-04, S05-02 | 3/5/100/10 | PASS | done | results/S04-01.md; mirror-cells.ts created, tlqueue+engine-live typed selects; tsc clean, queue-tlqueue golden 50/50, eslint clean |
| S04-02 | mini/S04 | dev | S04-01 | 3/5/80/10 | PASS | done | results/S04-02.md; jobs/tph-run/touches typed selects+adapters; tsc clean, golden tph+productivity 39/39, zero select('cols in src, eslint clean |
| S05 | package/- | - | - | n/a | not dispatchable | done | all 4 children done; cols purge/backfill/removal complete; drop migration authored, ships merge-to-main |
| S05-01 | mini/S05 | data-engineer | none | 1/4/110/10 | PASS | done | results/S05-01.md; --write on prod exit 0, 495345 deleted (fd=301053 maqsam=73690 fc=0 tickets=120602, matched dry counts), refresh_log row written; reports/purge-write.log |
| S05-02 | mini/S05 | data-engineer | S02-01, S02-02, S05-01 | 2/5/140/10 | PASS | done | results/S05-02.md; --write on prod exit 0: fd=404915 maqsam=42413 fc=1753, skipped=0, refresh_log ok; post-write --dry pending=0; reports/backfill-write.log |
| S05-03 | mini/S05 | dev | S04-02, S05-02 | 3/6/60/10 | PASS | done | results/S05-03.md; cols dropped from upsert payload, tests assert absent, dedupe_key unchanged; tsc clean, mirrors 9/9, eslint clean |
| S05-04 | mini/S05 | supabase-expert | S05-03 | 1/3/25/5 | PASS | done | results/S05-04.md; migration 20261113115521_drop_mirror_cols.sql authored (DROP cols x3, IF EXISTS); remote apply = merge-to-main, NOT approved |
| remote-ddl | op/- | supabase-expert | none | 4 migrations | n/a | done | results/remote-migrations.md; db query -f + batched repair (push refused on pre-existing remote-only versions); migration list confirms all 4 applied; Target=prod verified |
| qa1-01 | mini/fix-qa-1 | data-engineer | none | 1/4/120/10 | PASS | done | results/qa1-01.md; migration/reset-fd-activities.ts (118 ln); --dry exit 0 rows=404915 watermark_present=true; tsc clean; --write NEEDS_APPROVAL |
| qa1-02 | mini/fix-qa-1 | dev | none | 2/3/60/10 | PASS | done | results/qa1-02.md; roster select error -> throw described(step:'roster directory'); h.rosterErr seam + new test; mirrors 10/10, tsc clean |
| qa1-03 | mini/fix-qa-1 | dev | none | 1/1/2/5 | PASS | done | results/qa1-03.md; FOREIGN repair: +`TableScroll: 'table-scroll'` in ui mock, 1 line; audit-queue-memo 4/4 |
| data1-01 | mini/fix-data-1 | data-engineer | none | 2/4/140/10 | PASS | done | results/data1-01.md; RETENTION_FLOOR_MS + w-clamp + consume skip (mirrors.ts:46,279,305); mirrors 13/13; rebuild now floor-safe once deployed |
| data1-02 | mini/fix-data-1 | data-engineer | none | 3/4/90/10 | PASS | done | results/data1-02.md; fdFloorCursor_ clamp at fdSyncLoop_ entry (freshdesk.ts:35,42,308) + PLAN.md D3 -> Sep-1; fd-ticket-floor 5/5 |
| ops1-01 | mini/ops-1 | data-engineer | FRESHDESK_API_KEY in .env.local | 1/5/15/10 | PASS | blocked | results/ops1-01.md; reset exit0 404915→0 + refresh_log row; rebuild exit0 x2 written=66212 partial=true — `--write` forces full:true → cut=-Infinity → rerun treadmills at Sep-1 (mirrors.ts:242-244,305); table covers Sep-1→Oct-1, watermark re-seeded Oct-2; Oct-2→now gap needs deployed-cron incremental OR fresh approval for non-full invocation (grant #4c = literal cmd only) |
| ops1-02 | mini/ops-1 | data-engineer | none | 1/4/15/5 | PASS | done | results/ops1-02.md; key was absent -> inserted `2026-09-01T00:00:00Z`, read-back exact, Target=prod x3, updated_by=system:ops; next job-data-tick starts Sep-1 repopulation |
| ops1-03 | mini/ops-1 | data-engineer | ops1-01 partial (Oct-2 watermark) | 2/5/35/10 | PASS | in-progress | grant #6; add `--resume` (non-full syncMirror) to run-fd-mirror.ts, run ≤4 capped invocations to close Oct-2→now gap |

## Order / notes
- S00, S01, S02, S03-01 are independent — can parallelize (S03-03 same-file
  chain after S03-02; S03-04 after S02-02).
- S05-01 (purge) should run ASAP once approved — it shrinks S05-02's backfill.
- Required chain: S03 writers dual-write → S05-01 purge → S05-02 backfill →
  S04 reader cutover → S05-03 writers stop emitting cols → S05-04 drop cols.
- Remote applies (--write, migration apply on merge) are user-approved only.
- Resume reconciliation (fresh TL): S00-02/S01-02/S03-01/S05-02 code verified
  landed despite missing results files; S03-03 partially landed, re-dispatched.

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 dedupe_key re-key gap (MED) | reports/qa-1.md | qa1-01 (data-engineer) | done | wipe+watermark-reset CLI authored+dry-run; remote --write NEEDS_APPROVAL |
| qa-2 roster error swallowed (MED) | reports/qa-1.md | qa1-02 (dev) | done | described throw + regression test (mirrors 10/10) |
| qa-3 TableScroll mock, vitest RED (HIGH) | reports/qa-1.md | qa1-03 (dev) | done | FOREIGN 1-line repair, attributed not reverted; suite green |
| qa-4 drop-cols merge ordering (LOW) | reports/qa-1.md | - | deferred | LOW per workflow |
| qa-5 results files at repo root (LOW) | reports/qa-1.md | - | deferred | LOW per workflow |
| data-1 corrupt fd_activities ts_ms/performed_at (BLOCKER) | reports/data-1.md | ops only — reset --write + rebuild --write | done | corruption eliminated: 404,915 wiped, future_dated=0, performed_at≡ts_ms spot-check 3/3, floor enforced (min_pa=Sep-1); Sep-1→Oct-1 rebuilt API-direct (66,212); Oct-2→now gap = ops1-01 blocked row |
| data-2 no Sep-1 retention floor in mirror sync (HIGH) | reports/data-1.md | data1-01 (data-engineer) | done | floor inside syncMirror covers run-fd-mirror + admin backfill; mirrors 13/13 |
| data-3 D3 cursor reset would re-insert purged tickets (HIGH) | reports/data-1.md | data1-02 (data-engineer) | done | fdFloorCursor_ enforced in code + PLAN.md D3 corrected; prod cursor write still NEEDS_APPROVAL |
| data-4 group_name fallback missing (LOW) | reports/data-1.md | - | deferred | LOW per workflow |
| data-5 --check sheet-era parity model (LOW) | reports/data-1.md | - | deferred | LOW per workflow |

## Blocked / needs user
- APPROVALS.md (2026-11-12) granted, one-shot each: (1) remote apply of
  migrations 20261112150304/20261112150305/20261112150724/20261112150725,
  (2) S05-01 purge --write, (3) S05-02 backfill --write after 1+2 and a clean
  --dry. Chain running serially.
- Still NOT approved: S05-04 drop-cols remote apply — merge-to-main path only;
  any other remote write is a fresh NEEDS_APPROVAL.
- NEW (qa-1 fix): `migration/reset-fd-activities.ts --write` (deletes ~404,915
  fd_activities rows + `mirror_state_fd_activities` config key; dry-run
  verified rows=404915 watermark_present=true) followed by the
  `run-fd-mirror.ts --write` full rebuild — both NEEDS_APPROVAL, sequenced by
  PM at API-sync cutover (wipe must precede/coincide with first API-era sync).
- data-1 BLOCKER makes that wipe+rebuild MANDATORY, not optional: prod
  fd_activities ts_ms/performed_at are corrupt (274,882 rows future-dated;
  sheet DD/MM parsed as MM/DD). Required order: (1) data1-01 floor lands +
  deploys, (2) reset --write, (3) run-fd-mirror --write — all before the
  first post-deploy job-productivity-daily cron run.
- NEW (data-3 fix): prod config write `v2_fd_inc_cursor =
  2026-09-01T00:00:00Z` (NOT `freshdesk_full_sync_start` = 2026-04-20 — that
  re-inserts ~120,602 purged tickets). Repopulates subject/order_id on the
  56,014 retained tickets. APPROVALS #5 granted — ops1-02 dispatched;
  safe pre/post-deploy (value IS the floor `fdFloorCursor_` clamps to).
- OPS round 3 (approval #6): ops1-03 dispatched — resume-mode `--resume` flag
  (minimal local-script edit, in-scope per task) + incremental runs to close
  Oct-2→now gap; verify n≈156k, future_dated=0, performed_at≡ts_ms, max≈now.
- OPS round (approvals #4/#5): ops1-01 ran 2026-11-13 ~15:08-15:17 UTC
  (key pasted, len=20). Reset wiped 404,915; rebuild wrote 66,212 then
  stopped at the 240s SYNC_BUDGET (partial=true) — `--write` is full:true
  only, so reruns restart at Sep-1 (proven, 2 runs identical). Watermark
  re-seeded at Oct-2 → remaining Oct-2→now gap (~42d, est. ~90k rows) can
  ONLY close via (a) deployed incremental cron runs once the API+floor
  build is live (likely 2 daily runs — 240s budget each), or (b) a fresh
  NEEDS_APPROVAL for a local non-full/incremental invocation (e.g.
  --resume runner) — grant #4c covers the literal --write command only.
- CRITICAL pre-06:30-UTC precondition: deployed prod build MUST carry
  S03-03 API writer + data1-01 floor before `job-productivity-daily`
  fires — else it resumes sheet ingest at the Oct-2 watermark and
  reinserts MM/DD-corrupt rows. Deploy approval is separate (PM).
- Cron timing risk (checked vercel.json + routes, 2026-11-13 ~15:00 UTC):
  `job-productivity-daily` 06:30 UTC is the only scheduled fd_activities
  WRITER (syncAllMirrors, productivity.ts:326) — hard deadline for
  wipe+rebuild AND for the floor-code deploy; if prod still runs pre-floor
  code at 06:30 it reinserts sub-floor/corrupt rows. `job-tph-hourly`
  (:05/:55) and dashboards only READ fd_activities — empty during the
  wipe→rebuild gap, self-heals. `job-data-tick` (~15 min, pg_cron) reads
  `v2_fd_inc_cursor` — picks up the ops1-02 value next run (intended).

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| resume | S03 integration | `npx tsc --noEmit && npx vitest run tests/jobs/{mirrors,fd-activity-export,fd-activity-cells,mirror-cells}.test.ts` | PASS — tsc clean, 27/27 (reports/gate-s03.log) |
| resume | S05-02 re-verify | `npx vitest run tests/jobs/mirror-cells.test.ts` | PASS 6/6 (reports/verify-s0502.log) |
| cont-2 | final integration | `npx tsc --noEmit && npx vitest run tests/jobs/{mirrors,fd-activity-export,fd-activity-cells,mirror-cells}.test.ts tests/golden/{queue-tlqueue,tph,productivity}.test.ts` + tests/quality/qe-fd-cache.test.ts | PASS — tsc clean, 121/121 (reports/gate-final.log) |
| fix-qa-1 | FIX integration | `npx vitest run` + `npx tsc --noEmit` + `npx eslint <4 touched files>` | PASS — vitest 1347/1347 (was 4 failed), tsc clean, eslint 0 errors (migration/ ignored by config) — reports/gate-fix-qa1{,-tsc,-eslint}.log |
| fix-data-1 | FIX integration | `npx vitest run tests/jobs/{mirrors,fd-ticket-floor,fd-activity-export,fd-activity-cells,backfill}.test.ts` + `npx tsc --noEmit` + `npx eslint <4 touched files>` | PASS — vitest 37/37, tsc clean, eslint 0 — reports/gate-fix-data1-{vitest,tsc,eslint}.log |
