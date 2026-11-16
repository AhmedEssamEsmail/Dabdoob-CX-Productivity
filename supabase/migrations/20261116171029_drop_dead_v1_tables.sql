-- S02-01 (unify-roster-source): drop nine dead remote tables.
-- Verified unreferenced repo-wide 2026-11-16 (PLAN research notes: zero
-- from()/readStore()/readRows()/appendRow()/updateRow() hits for all nine).
-- IF EXISTS tolerates prior absence; NO CASCADE so a hidden dependent fails
-- loudly instead of being silently dropped.
-- Name-collision caution: `tlp` is NOT the live `tlp_*` family; `schedule` is
-- NOT `one_on_one_schedule`; the `days_off` TABLE is NOT the
-- `roster.days_off` column. Exact names only.

DROP TABLE IF EXISTS public.dq_hct;
DROP TABLE IF EXISTS public.headcount;
DROP TABLE IF EXISTS public.team_structure;
DROP TABLE IF EXISTS public.schedule;
DROP TABLE IF EXISTS public.days_off;
DROP TABLE IF EXISTS public.weekly_schedule;
DROP TABLE IF EXISTS public.tls;
DROP TABLE IF EXISTS public.tlp;
DROP TABLE IF EXISTS public.md;
