-- S01-01: tickets += subject, order_id
-- Adds the two Freshdesk "Current State" fields the port skipped.
-- Nullable, no defaults, no index — fdTicketToRow_
-- (src/features/shared/jobs/freshdesk.ts) populates them on the next
-- 15-min freshdesk_sync / cursor-reset backfill (PLAN D3).

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS order_id text;
