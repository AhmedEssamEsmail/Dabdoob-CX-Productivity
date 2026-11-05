# Blocked tasks — manual action required

Everything that cannot be completed autonomously lands here. Each entry: the issue, why it's blocked, and the fix needed from the owner.

---

## B1 — Supabase DDL access (pg_cron + migrations) — PARTIALLY RESOLVED 2026-11-05

**Verified working:** `.env.local` service-role credentials reach project `uugeyulccyytvgcabzzx` via PostgREST. 53 live tables enumerated — `qa_*` (7), `sc_*`, `kpi_*`, `md`, `tlp`, `tls`, `team_structure`, `weekly_schedule`, `days_off`, `esc_seen` already exist out-of-band beyond `supabase/migrations/*.sql` (only 4 files). Read/verify/data ops are unblocked without MCP.

**Still needed:** DDL — no `rpc/` functions are exposed, and the `supabase` CLI account (logged in, `projects list` empty) has no access to this project. Enabling `pg_cron` and pushing new migrations requires one of:
1. `pg_cron` enabled in the Supabase dashboard (Database → Extensions) by the owner, or
2. The database password / connection string for `psql` or `supabase db push`, or
3. A CLI login on an account with project access, or
4. The supabase MCP server restored.

**Reconcile task:** live table set must be diffed against `supabase/migrations/` during each module shard; missing tables become new migration files awaiting a DDL path.

**Status:** DDL blocked; reads unblocked.

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
