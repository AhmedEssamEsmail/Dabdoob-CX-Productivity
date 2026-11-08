-- S10-01: public.app_cache — server-only key/value store with expiry.
-- Replaces the instance-local Map cache (src/features/shared/platform/repo.ts)
-- for cross-instance caches such as the my-day section cache
-- (keys `cc_myday_v2_<part>`, JSON string values, TTL 21600s).
--
-- Access model: SERVICE ROLE ONLY. RLS is enabled with NO policies, so
-- anon/authenticated are denied; only db() (service role, S08-01) reaches it,
-- consistent with the S08-04 lockdown. Do not add policies for public roles.

CREATE TABLE IF NOT EXISTS public.app_cache (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_cache ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: deny-by-default for anon/authenticated.

-- Supports expired-row sweeps (DELETE ... WHERE expires_at < now()) without a
-- seq scan; a partial index is not possible since now() is not immutable.
CREATE INDEX IF NOT EXISTS app_cache_expires_at_idx
  ON public.app_cache (expires_at);
