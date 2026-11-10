# S08-03: remote NULL-key / dup-group probes (read-only)

- Date: run via PostgREST against the remote project (MCP server not
  configured; no `.mcp.json`). Method per probe below is semantically
  identical to the verbatim `SELECT`s — read-only, zero writes.
- NULL-count probes ran as `HEAD /rest/v1/<t>?<is.null filter>` with
  `Prefer: count=exact` → `Content-Range: */N`.
- Dup-group probes: remote PostgREST rejects aggregates (PGRST123 "Use of
  aggregate functions is not allowed"), so the key columns were fetched
  (qe_builds=117 rows, options=26 rows) and grouped client-side — same
  `GROUP BY ... HAVING count(*)>1` verdict.

## Verdict table (14 probes)

| # | table | probe (verbatim from migration) | count/dup | verdict |
|---|-------|----------------------------------|-----------|---------|
| 1 | refresh_log | probe: `SELECT count(*) FROM public.refresh_log WHERE log_id IS NULL;` | 0 | natural-key OK |
| 2 | qe_builds | probe: `SELECT ran_at, count(*) FROM public.qe_builds GROUP BY 1 HAVING count(*) > 1;` | 0 dup groups (117 groups/rows) | natural-key OK |
| 3 | options | probe: `SELECT list_key, lower(value), count(*) FROM public.options GROUP BY 1,2 HAVING count(*) > 1;` | 0 case-variant groups | natural-key OK (confirms remote `idx_options_list_value` holds) |
| 4 | options | probe: `SELECT list_key, value, count(*) FROM public.options GROUP BY 1,2 HAVING count(*) > 1;` | 0 exact dup groups | natural-key OK |
| 5 | mail_log | probe: `SELECT count(*) FROM public.mail_log WHERE sent_at IS NULL;` | 0 | natural-key OK |
| 6 | follow_up_done | probe: `SELECT count(*) FROM public.follow_up_done WHERE done_at IS NULL;` | 0 | natural-key OK |
| 7 | aging_open_tickets | probe: `SELECT count(*) FROM public.aging_open_tickets WHERE ticket_id IS NULL;` | 0 | natural-key OK |
| 8 | agg_queue_now | probe: `SELECT count(*) FROM public.agg_queue_now WHERE queue IS NULL OR kind IS NULL;` | 0 | natural-key OK |
| 9 | agg_inflow_weekly | probe: `SELECT count(*) FROM public.agg_inflow_weekly WHERE period IS NULL OR channel IS NULL OR country IS NULL;` | 0 | natural-key OK |
| 10 | agg_inflow_monthly | probe: `SELECT count(*) FROM public.agg_inflow_monthly WHERE period IS NULL OR channel IS NULL OR country IS NULL;` | 0 | natural-key OK |
| 11 | agg_agent_perf | probe: `SELECT count(*) FROM public.agg_agent_perf WHERE email IS NULL OR period IS NULL;` | 0 | natural-key OK |
| 12 | agg_agent_daily | probe: `SELECT count(*) FROM public.agg_agent_daily WHERE date IS NULL OR email IS NULL;` | 0 | natural-key OK |
| 13 | agg_snapshots_today | probe: `SELECT count(*) FROM public.agg_snapshots_today WHERE snapshot_key IS NULL;` | 0 | natural-key OK |
| 14 | qa_volume | probe: `SELECT count(*) FROM public.qa_volume WHERE date IS NULL OR channel IS NULL OR contact_type IS NULL;` | 0 | natural-key OK |

## Result

All 14 probes return 0 → no `FALLBACK->dedupe_key` needed, no dup groups
remain. At apply time every DO block in 20261109130706 takes the ELSE
branch (natural-key unique index), so the static natural-key `upsertOn`
in the mappings stays valid and qa-3's 42P10 failure mode is pre-empted.

Follow-ups needed: none.
