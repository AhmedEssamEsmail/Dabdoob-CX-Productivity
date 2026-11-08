-- S07-02 (PLAN #7, index group A): lookup indexes the audit found missing on
-- the hot read paths. All IF NOT EXISTS so a re-apply is a no-op; plain
-- b-trees only (uniques live in S07-01/014). Named per the idx_* convention
-- of 001/007. CONCURRENTLY is deliberately not used: the CLI applies
-- migration files inside a transaction, where it cannot run.

-- prod_intervals.date: windowed reads — api/prod/intervals/route.ts:16
-- (.eq('date')) and api/prod/flags/route.ts:112 (.gte('date', seenFrom)).
CREATE INDEX IF NOT EXISTS idx_prod_intervals_date
  ON public.prod_intervals (date);

-- prod_flags.date / agent_email: flags page filters — .or('agent_email.in…')
-- api/prod/flags/route.ts:78-79 and date windows in decided/seen queries.
CREATE INDEX IF NOT EXISTS idx_prod_flags_date
  ON public.prod_flags (date);
CREATE INDEX IF NOT EXISTS idx_prod_flags_agent_email
  ON public.prod_flags (agent_email);

-- prod_daily_layers.date: prod engine/env reads per-day layers
-- (shared/jobs/env.ts upsert keys date,email,layer; date-windowed reads).
CREATE INDEX IF NOT EXISTS idx_prod_daily_layers_date
  ON public.prod_daily_layers (date);

-- roster lower(email): requireRole identity lookup does .ilike('email', …)
-- (features/shared/platform/identity.ts:90); expression index lets the
-- case-insensitive match use it (existing idx_roster_email is case-sensitive).
CREATE INDEX IF NOT EXISTS idx_roster_lower_email
  ON public.roster (lower(email));

-- agg_inflow_hourly(year,date): inflow job reads filter by year+date
-- (existing idx_agg_inflow_hourly_year covers year alone).
CREATE INDEX IF NOT EXISTS idx_agg_inflow_hourly_year_date
  ON public.agg_inflow_hourly (year, date);
