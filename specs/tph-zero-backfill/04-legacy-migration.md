# 04 — Legacy-store migration (conditional)

Runs **only if 00's audit confirms** the legacy productivity store holds Jul–Oct history. Migrates what recompute cannot recreate; 03 then fills only the gaps.

## Why it's conditional

Owner answer: "No / not sure" whether the legacy store has Jul–Oct data. `00-source-health-audit.md`'s legacy-store probe decides. If the store is empty → skip this shard entirely; 03 covers what raw sources allow and reports gaps honestly.

## What can only come from migration (not recompute)

| Store | Why |
|---|---|
| `prod_tph_days` | Grid slots are TL-entered; no source to recompute from |
| `prod_tph_cases` source `tl` | TL-entered per-hour case counts |
| `prod_tph_cases` source `auto` | Hourly queue-snapshot captures (need `agg_queue_now` live history) |
| `prod_intervals` | Agent status intervals — input to flag detection + layering |
| `prod_flags`, `prod_flag_log`, `prod_flag_analytics` | Detection output depends on intervals |
| `prod_daily_layers`, `prod_daily_layers_effective` | Can be recomputed, but migrating preserves audited values |
| `prod_tph_touches`, `prod_tph_calls` | Recomputable, but migrating preserves what was actually shown |

## Mechanism

Existing `POST /api/admin/migrate` (auth via the configured migration mechanism — see `scripts/run-migration.ts`; **do not** re-expose the key in docs/code). It maps Google-Sheet tabs → Supabase tables with upsert semantics and a 300s budget.

- Add/verify tab→table mappings for the stores above (check `src/app/api/admin/migrate/route.ts` — the summary noted `fd_activities`/`maqsam_calls`/`freshchat` are *not* mapped, and don't need to be: 01 syncs them from the live source sheets).
- Run per-table, report `{table, read, written, skipped}`; idempotent via existing upsert/`ON CONFLICT`.
- Verify counts vs the sheet tab counts after each table.

## Order

1. 00 audit reports legacy `prod_*` tabs exist with Jul–Oct rows.
2. Migrate `prod_intervals` → `prod_flags`/`prod_flag_log`/`prod_flag_analytics` (inputs first).
3. Migrate `prod_tph_days` → `prod_tph_cases` → `prod_tph_touches` → `prod_tph_calls`.
4. Migrate `prod_daily_layers`/`prod_daily_layers_effective`.
5. Then 03 runs with `force:false` — it skips dates that now have real output and only fills gaps.

## Acceptance

- `source-health` re-run after migration shows the migrated tables non-empty with Jul–Oct coverage.
- `prod_tph_days` rows for migrated dates render agents on the grid.
- 03's `skipped`/`done` split reflects: migrated dates skipped (not recomputed), gap dates recomputed.
