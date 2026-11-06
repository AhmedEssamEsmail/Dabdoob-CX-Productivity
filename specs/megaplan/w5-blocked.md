# Wave 5 — Blocked gates (owner-action items)

> Nothing here executes until its blocker clears. Each WP documents *exactly* what's needed so the owner can unblock one item at a time. See `../cx-hub/BLOCKED_TASKS.md` for the live register — keep both files in sync.

## WP-50 — Cron secret + pg_cron scheduling (B5)

- **Needs:** `CRON_SECRET` set in Vercel env (and `.env.local` for local runs); canonical production app URL confirmed.
- **Then:** apply the draft SQL from WP-24 (`cron.schedule` batch for `job-data-tick` `*/15`, `job-nightly-aggregates` `30 6 * * *`, `job-tl-queue-metrics` `15 0 * * *`, people crons, `job-qa-engine`, `api/desk/job/mail` `*/15`), verify first heartbeat rows appear in `health` table with `ok` states.

## WP-51 — Google access → full historical migration (B2/G6 + shard 80)

- **Needs:** `GOOGLE_SERVICE_ACCOUNT_EMAIL` shared on every legacy spreadsheet (CC2 Core/Tickets/Live/Data {year}/Quality/Productivity + tracker sheets) — or one-time CSV exports. Check `../cx-hub/80-data-migration.md` inventory.
- **Then:** run the extended pipeline (WP-30/31/32 mappings), `migrate:validate`, commit `specs/megaplan/migration-report.md`.

## WP-52 — Google-access phase items (shard 90 — STOP gate)

- **Needs:** per-item owner discussion per `../cx-hub/90-google-access.md`: G1 roster sync (HCT sheet share → enables `runRosterSync`/`jobRosterSync`), G2 mail desk Gmail read+send, G3 My Day live data (Gmail+Calendar+Drive), G4 Gmail Agents-Activity import (`importProductivityEmail`), G5 QA Google Forms imports, G6 = WP-51, G7 Drive file attachments, G8 V1 task import + scorecard workbook refresh.
- **Then:** implement each behind the existing adapter seams (`myday-google.ts`, `maildesk.ts`, `platform/mail.ts` gmail reply), one item per sub-task, flipping `{configured:false}` to live reads. `mail_dry_run`/`mail_approval_dry_run` stay true until owner flips.

## WP-53 — Vendor keys completion (B3)

- **Needs:** `FRESHCHAT_API_KEY` (absent everywhere); confirm `FRESHDESK_API_KEY`/`MAQSAM_*` work post-WP-34 probes.
- **Then:** port `jobFreshchatMessages`, `backfillFreshchat`, `backfillEscalationSightings` (FreshchatSync.js), enable `fc_messages` job + daily-report intake path; verify `qeFdFillMissingDetail_` and TL queue metrics produce data.

## WP-54 — Cutover readiness (programme phases 6–8)

- **Needs:** parity gates green (waves 0–4 done); owner go-ahead for parallel run.
- **Then:** produce `audits/cutover-plan.md`: parallel-run comparison procedure (same fixtures → GAS vs CX-Hub outputs), write-mode switch plan, GAS trigger disable list (per app `install*Trigger` inventory), rollback doc, decommission checklist.

## Exit criteria

Each WP's blocker resolved + evidence committed; when WP-50/51 land, `audit/jobs.md` scheduling column all green + migration-report all green.
