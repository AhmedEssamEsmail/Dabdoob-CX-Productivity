# TL report 2 — fd-direct-mirrors (BUILD continuation 2, approvals executed)

## Approved remote chain — all 3 grants consumed, in order
1. **Migrations applied to prod** (`uugeyulccyytvgcabzzx`, Target verified):
   20261112150304, 20261112150305, 20261112150724, 20261112150725.
   `db push --remote` refused on pre-existing remote-only versions
   (20261112162628/20261112165502); fallback `db query --remote -f` per file +
   one batched `migration repair --status applied --remote`. `migration list
   --remote` confirms all 4 applied; nothing else touched.
   Evidence: results/remote-migrations.md.
2. **S05-01 purge `--write`**: exit 0; deleted 495,345 rows
   (fd=301,053 · maqsam=73,690 · fc=0 · tickets=120,602 — matched approved
   dry counts exactly); refresh_log `mirror_purge`. reports/purge-write.log.
3. **S05-02 backfill `--write`**: `--dry` clean first, then write exit 0;
   updated 449,081 rows (fd=404,915 · maqsam=42,413 · fc=1,753), skipped=0;
   refresh_log `mirror_backfill`; post-write `--dry` pending=0 all tables.
   reports/backfill-write.log.

## Code chain (serial, all done)
- S04-01: `src/features/shared/jobs/mirror-cells.ts` created (3 adapters);
  tlqueue + engine-live typed selects. Golden queue-tlqueue 50/50.
- S04-02: jobs.ts, tph/run.ts, api/tph/touches/route.ts typed selects +
  adapters; zero `select('cols` in src. Golden tph+productivity 39/39.
- S05-03: `cols` removed from mirrors.ts upsert payload (dedupe_key
  unchanged); tests assert its absence. mirrors 9/9.
- S05-04: migration `20261113115521_drop_mirror_cols.sql` authored
  (`DROP COLUMN IF EXISTS cols` x3). **Remote apply NOT approved — ships via
  merge-to-main only.**

## Gates
- Final integration: `tsc --noEmit` clean; vitest 121/121 across mirrors,
  fd-activity, mirror-cells, golden tlqueue/tph/productivity, qe-fd-cache.
  reports/gate-final.log.

## Status
All packages S00–S05 done. No review gates run (PM's role); no commits.

## Remaining (not TL scope)
- Merge to main applies 20261113115521 (drop cols) + any unapplied local
  migrations via the Supabase GitHub integration.
- S05-04's remote drop is destructive-by-design (cols jsonb retired); it is
  safe only because reads+writes are fully typed — gate it on this code
  deploying, which the merge ordering provides.
