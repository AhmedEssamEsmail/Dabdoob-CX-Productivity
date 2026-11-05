# Shard 90 — Google-access phase (**STOP: discuss with owner before starting**)

> Locked decision D-GOOGLE: everything migratable goes to Supabase first (one-time reads are fine), then the app updates Supabase only. This shard enumerates the remaining Google-Workspace-dependent features. **Work stops here — go through items one by one with the owner: what is needed, what manual actions are required.**

## Inventory of Google-dependent work

| # | Feature | Google surface | Legacy source | Depends on |
|---|---|---|---|---|
| G1 | **My day** (meetings, deadlines, mail waiting, recent files, focus blocks; `getMyDay`, `searchMyMail`, `markFollowUpDone`, `createFocusBlock`, digest/warm jobs) | Gmail read, Calendar read/write, Drive recent files | `Assistant.js` | OAuth or service acct w/ domain delegation; owner-only page |
| G2 | **Mail desk sync** (`jobMailDesk`: response-tracked threads, approval mails; reply in thread `sendGmailReply_`) | Gmail read + `gmail.send` scope | `MailDesk.js`, `Mailer.js` | mailbox = Desk project owner's; `mail_approval_dry_run` stays true until owner flips |
| G3 | **Roster sync from HCT** (`jobRosterSync`, `runRosterSync`) | Sheets read (roster master `1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw`) | `RosterSync.js` | read-only sheet creds |
| G4 | **Gmail Agents-Activity import** (`importProductivityEmail` inside `jobProductivityDaily`) | Gmail read (CSV attachment) | `ProductivityApp.js` | mailbox creds; alternative: scheduled sheet drop → migrate |
| G5 | **QA form imports** (`jobQualityHistory`, Voice/Texting QA Google Forms; `importQaQueueNow` external queue source when `!qa_engine_live`) | Forms/Sheets read | `QaMigrate.js`, `QaEngine.js` | form response sheet creds |
| G6 | **Tracker sheet-backed storage** (any tracker with `storage_mode` pointing at a sheet) | Sheets read (live) | `Trackers.js` | after migration decide: cut to internal storage or keep read link |
| G7 | **Action file attachments** (`action_updates.drive_file_id`) | Drive upload/read | `Actions.js`/`Tasks.js` | Drive scope |
| G8 | **Daily report intake** (`daily_report` job: Freshchat/Maqsam tabs in `daily_report_ss_id`) | Sheets read | `Stores.js` DQ_SETTINGS | may already be covered by vendor-API mirrors (maqsam live) |
| G9 | **Roster View-as / owner mail identity** | none extra | `Auth.js` | n/a (Supabase auth) |

## Per-item discussion template (owner)

- What manual action is needed? (OAuth consent, service-account JSON, sheet share to SA, mailbox delegation, API key)
- One-time import vs ongoing read? (default: one-time → Supabase)
- Secret storage: Vercel env / Supabase vault — never in repo.
- Dry-run flags that must stay on until owner flips: `mail_dry_run`, `mail_approval_dry_run`.

## Non-Google integrations tracked separately

- **Freshdesk** (`freshdesk_sync`, ticket links, `verifyQaFreshdesk`): API token — vendor work started (`src/lib/vendor/`).
- **Freshchat** (`fc_messages`, daily report): blocked on API key per git log.
- **Maqsam** (calls): live via vendor mirror.
