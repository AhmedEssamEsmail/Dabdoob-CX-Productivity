-- S02-02: typed columns on the maqsam_calls + freshchat mirrors, matching the
-- 7-cell layouts the readers index today (vendor-apis.ts maqsamCallToCols
-- D..J, freshchatConvToCols A..G). All nullable, no defaults: writers
-- dual-write cols + typed columns during the transition; `cols` is dropped in
-- S05-04 once readers move off the JSON array.
-- duration/handling stay text on purpose — readers parse the exact display
-- strings ('H:MM:SS', fractional days), so verbatim cells keep adapter parity
-- lossless.

ALTER TABLE public.maqsam_calls
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration text,          -- 'H:MM:SS' display, verbatim cell
  ADD COLUMN IF NOT EXISTS agent_email text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS handling text;          -- fractional days, verbatim cell
CREATE INDEX IF NOT EXISTS idx_maqsam_calls_agent ON public.maqsam_calls(agent_email);

ALTER TABLE public.freshchat
  ADD COLUMN IF NOT EXISTS conversation_id text,
  ADD COLUMN IF NOT EXISTS initiated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS ref_key text;           -- '<convId>-<createdMs>' cell 2
CREATE INDEX IF NOT EXISTS idx_freshchat_conv ON public.freshchat(conversation_id);
