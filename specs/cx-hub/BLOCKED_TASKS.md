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

**ENV AUDIT 2026-11-05 (correction):** `.env.local` contains ONLY `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_*`, `VERCEL_OIDC_TOKEN`. **No** `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY`/`GOOGLE_SHEET_ID`, no vendor keys, no `CRON_SECRET`, no `MIGRATION_SECRET_KEY` — they exist only as code references. So this phase needs real credentials handed over, not just scope confirmation.

| # | Item | Needs |
|---|------|-------|
| G1 | Roster sync (`dq_hct` — HCT master; `roster.ts` refuses honestly without it) | SA creds + HCT sheet share, or exported roster tab → `dq_hct` mirror |
| G2 | Mail Desk sync (`maildesk.ts` gmail seams) | Gmail read/modify/send on ops mailbox |
| G3 | My Day live data (`myday-google.ts`: awaiting-reply, mail search, calendar/focus blocks, Drive recents, morning digest) | Gmail read + Calendar + Drive scopes; returns `{configured:false}` today |
| G4 | Gmail Agents-Activity import | Gmail search + label conventions |
| G5 | QA imports (`qaImportHistory` Sheets env, form response sheets) | SA + form IDs/sheet shares |
| G6 | Full Sheets→Supabase historical migration (shard 80) | SA share on every legacy sheet, or one-time CSV exports |
| G7 | Drive attachments (`pwSaveTaskFile_`, `action_updates.drive_file_id`) | Drive read scope or export archive |
| G8 | V1 task import (`MigrateV1Tasks.js` V1 spreadsheet) + scorecard workbook refresh (`scRefreshMonth_` `fetchWorkbookTabs`) | Same SA share as G6 |

**Status:** pending — scheduled as the final phase; every seam already degrades gracefully (skipped runs / `{configured:false}` / honest refusals).

---

## B3 — Vendor credential validation (Freshdesk / Freshchat / Maqsam)

**Issue (revised after env audit):** `FRESHCHAT_API_KEY`, `FRESHDESK_API_KEY`/`FRESHDESK_DOMAIN`, `MAQSAM_*` are **absent from `.env.local`** — only referenced in code. `freshdesk.ts` records a skipped run when the key is missing; `qeFdFillMissingDetail_` and mail/maqsam seams are the same.

**Impact:** Queue sync jobs (`freshdesk_sync`, `inflow`, `fc_messages`), TL queue metrics, `qeFdFillMissingDetail_`, mail-desk send/read — all degrade honestly but produce no data.

**Fix:** provide the live keys (`.env.local` + Vercel env). Non-destructive `GET` probes can run once present.

**Status:** pending — keys don't exist locally at all.

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
