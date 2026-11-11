# perf1-03 result — DONE (path A: coverage proven, migration removed)
- Coverage: `prod_window_hist_date_class_key` UNIQUE btree `(date, class)` (PERF_BASELINE.md:77 recorded indexdef) has `date` leftmost -> serves route.ts `gte/lte('date')` range; job prefetch is unbounded (env.ts TABLE_BOUNDS); upsert key `['date','class']` uses the same index.
- Deleted: `supabase/migrations/20261111083859_add_prod_window_hist_date_index.sql` (redundant narrower duplicate; table 126 rows). pm1-02 approval recorded as superseded.
- Doc: appended `### prod_window_hist index decision (perf-3)` at end of `## After` in `docs/PERF_BASELINE.md` (kept last per handoff).
- Verify: `git status -- supabase/migrations docs/PERF_BASELINE.md` -> migration absent; doc `??` (untracked baseline doc, never committed — expected).
- No remote access, no new migration, no remote write. perf-3 closed.
