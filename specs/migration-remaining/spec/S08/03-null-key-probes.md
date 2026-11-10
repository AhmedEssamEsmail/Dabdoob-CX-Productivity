# S08-03: run remote NULL-key / dup probes for the dedupe migrations
Kind: mini
ID: S08-03
Parent: S08
Owner: supabase-expert
Depends: none
Criteria: PLAN #5; finding qa-3 (reports/qa-1.md)
Skills: C:\Users\AHMED\AppData\Roaming\devin\skills\supabase\SKILL.md
Budget: files=1; actions=3; changed_lines=40; minutes=10

## Goal
The pending dedupe migrations decide each table's upsert conflict target at
apply time via DO-block probes: if any natural-key column still holds NULL
(or dup groups remain), the target flips to `dedupe_key` while the mappings'
`upsertOn` stay static natural keys -> live upsert would error 42P10. Answer
the probes NOW, read-only, so any needed mapping/dedupe_key fix lands before
the approval-gated apply.

## Files
- Create: `specs/migration-remaining/logs/null-key-probes.md` | the verdict table (14 rows) — the only repo artifact

## Context
- `supabase/migrations/20261109130415_dedupe_uniques_logs_ops.sql` | 6
  `-- probe:` SELECTs (refresh_log, qe_builds dup ran_at, options dup
  list_keys x2, mail_log, follow_up_done)
- `supabase/migrations/20261109130706_dedupe_uniques_queue_agg.sql` | 8
  `-- probe:` SELECTs (aging_open_tickets, agg_queue_now, agg_inflow_weekly,
  agg_inflow_monthly, agg_agent_perf, agg_agent_daily, agg_snapshots_today,
  qa_volume)
- `reports/qa-1.md` row qa-3 | the failure mode being pre-empted

## Contract
Read-only. Run each `-- probe:` statement verbatim via the Supabase MCP
against the remote project and record: table, probe, count/dup rows, verdict
(`natural-key OK` | `FALLBACK->dedupe_key needed` | `dup groups remain`).
If MCP/remote access is unavailable, stop and report `NEEDS_USER: remote DB
read access` — do NOT apply anything, do NOT guess.
Out of scope: writing/editing any migration or mapping file; fixing fallback
tables (a count>0 becomes a NEW fix leaf dispatched by the TL); remote writes
of any kind.

## Actions
1. Extract the 14 probe statements from the two files above.
2. Execute each verbatim via Supabase MCP (SELECT only).
3. Record the verdict table in `specs/migration-remaining/logs/null-key-probes.md`
   plus a one-line "needed follow-ups" list in results/S08-03.md.

## Done when
- `logs/null-key-probes.md` lists all 14 probes with a remote count + verdict.
- Any probe >0 names the table + columns needing the dedupe_key fallback fix.

## Verify
- Run: `grep -c "probe" specs/migration-remaining/logs/null-key-probes.md` -> >=14
- Run: `git status --porcelain -- src supabase migration` -> empty (no source edits)

## Handoff
TL dispatches per-table fallback fix leaves (dedupe_key column + 'mig-'
transform + upsertOn flip) for any flagged table, or records "all natural-key
OK" in the TRACKER caveat for the apply runbook.
Write results/S08-03.md (<=10 lines + the verdict table); TL alone updates
TRACKER.md.
