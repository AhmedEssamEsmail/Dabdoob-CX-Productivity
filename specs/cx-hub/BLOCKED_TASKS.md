# Blocked tasks — manual action required

Everything that cannot be completed autonomously lands here. Each entry: the issue, why it's blocked, and the fix needed from the owner.

---

## B1 — Live Supabase verification & pg_cron setup

**Issue:** The `supabase` MCP server is unavailable (`Failed to list tools for server 'supabase'`), so nothing can inspect the live database: applied migrations, RLS policies, existing out-of-band tables, row counts, or enabling `pg_cron`.

**Impact:** Can't verify schema parity vs `supabase/migrations/*.sql`, can't confirm RLS correctness for role gates, can't install the `pg_cron` schedules required by decision D-SCHED (15-min jobs).

**Fix (pick one):**
1. Restore the supabase MCP server for this session, or
2. Enable `pg_cron` in the Supabase dashboard (Database → Extensions → `pg_cron`) and run `scripts/ops/probe-db.ts` + `scripts/verify-db.js` manually and share output, or
3. Grant direct `psql` access (connection string in `.env.local`) so verification runs via scripts.

**Status:** pending — rechecked each session until resolved.

---

## B2 — Google access (shard 90 — STOP gate)

**Issue:** Per decision D-GOOGLE, all Google-dependent work is deferred to the end and requires a live-access discussion. Items:

| # | Item | Needs |
|---|------|-------|
| G1 | Roster sync (HCT master sheet) | Service-account share or export of `CC_DATA_SPREADSHEET_ID` roster tab |
| G2 | Mail Desk sync | Gmail read/modify scope on the ops mailbox (or a delegated service account) |
| G3 | My Day live data (calendar/mail widgets) | Calendar read scope; mailbox read scope |
| G4 | Gmail Agents-Activity import | Gmail search access + label conventions from `MailDesk.js` |
| G5 | QA Google Forms imports (`qa_queue_import`, `qa_history_import`) | Form response sheets shared to service account + form IDs |
| G6 | Full Sheets→Supabase historical migration | All `Stores.js` spreadsheet IDs shared to `GOOGLE_SERVICE_ACCOUNT_EMAIL`, or one-time CSV exports |
| G7 | Drive file attachments (task/action `drive_file_id`) | Drive read scope on legacy files, or export archive |

**Note:** `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_SHEET_ID` are already present in `.env.local` — the unknowns are (a) which legacy sheets the SA can actually see, (b) whether Gmail/Calendar/Drive scopes are granted. B2 is a verification + scoping discussion, not necessarily new credentials.

**Fix:** when module shards reach their Google-dependent seams, stop and enumerate per item above; owner confirms each before proceeding.

**Status:** pending — scheduled as the final phase.

---

## B3 — Vendor credential validation (Freshdesk / Freshchat / Maqsam)

**Issue:** `FRESHCHAT_API_KEY`, `FRESHDESK_*`, `MAQSAM_*` env vars exist in code paths but their validity/permissions can't be confirmed without hitting live APIs.

**Impact:** Queue & Workforce sync jobs (`freshdesk_sync`, `inflow`, `fc_messages`) and TL queue metrics can't be validated end-to-end.

**Fix:** confirm the keys in `.env.local` are current, or provide sandbox credentials. Non-destructive `GET` probes can run once confirmed.

**Status:** pending — needed before queue shard's live-sync gate.

---

## B4 — Vercel project name (cosmetic)

**Issue:** Vercel project is still named `dabdoob-cx-productivity`; the repo is now `CX-Hub`. Deploys keep working (linked by `projectId`).

**Fix:** rename in Vercel dashboard → Settings → General, at owner's convenience. Zero code impact.

**Status:** pending — cosmetic, anytime.

---

## B5 — Cron secret & schedule verification

**Issue:** `vercel.json` cron entries call routes protected by `CRON_SECRET`; sub-hourly jobs must move to `pg_cron` (D-SCHED). Whether `CRON_SECRET` is set in the Vercel project env, and the current deploy's cron list, can't be verified without Vercel access.

**Fix:** confirm `CRON_SECRET` exists in Vercel env; after pg_cron lands, disable the moved entries in `vercel.json` (code-side, but a deploy is needed to take effect).

**Status:** pending — verify when B1 is unblocked.

---

*Non-blockers already resolved: repo rename `Dabdoob-CX-Productivity` → `CX-Hub` (done by owner, 2026-11-05).*
