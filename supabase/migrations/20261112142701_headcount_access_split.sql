-- S01-01: headcount access split — additive, nullable columns only.
-- dq_hct: names equal the hct mapping's adapter keys verbatim; "contactNumber"
-- keeps the quoted camelCase convention (PostgREST returns it as written).
-- refresh_log: appendRows (src/features/shared/platform/repo.ts) always stamps
-- submitted_by/submitted_at; missing columns broke dqLogRun_ after roster sync.
ALTER TABLE dq_hct ADD COLUMN IF NOT EXISTS code text, ADD COLUMN IF NOT EXISTS gender text, ADD COLUMN IF NOT EXISTS "contactNumber" text;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS gender text, ADD COLUMN IF NOT EXISTS mobile text, ADD COLUMN IF NOT EXISTS hr_id text, ADD COLUMN IF NOT EXISTS employment_status text;
ALTER TABLE refresh_log ADD COLUMN IF NOT EXISTS submitted_by text, ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
