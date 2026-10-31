# 06 - Source Gaps and Decisions (blocking)

The mandate says the legacy application is the specification. For 36 of its 40 pages, the specification is not in this repository. This file lists exactly what is missing and the decisions needed. Phase 5 must not start for a module until its row here is resolved.

## 1. Legacy material that is not available

Searched: everything under `C:\Users\AHMED\KPIs\original_deprecated\` and, for the file names below plus "helm", the user profile `C:\Users\AHMED`. No other copy was found. (Folders `C:\Users\AHMED\cx-kpi-dashboard`, `C:\Users\AHMED\WFM` and `C:\Users\AHMED\ticketing-system` exist; they were not opened and are not known to be related.)

| Missing item | Needed for | Evidence it exists |
|---|---|---|
| **Frontend source (TSX)** for all pages other than the 4 Productivity pages: Home, Admin, People & holidays, My day, Ecosystem (3D), all Quality, Queue, People, Operations, Desk, FCR pages | Visual parity (screens, layouts, copy, modals), page workflows | Bundle registry lists them; `hs` component renders "Not built yet" for any route without a bundled component; `Xt` map has only 4 pages |
| `Quality.js`, `QaEngine.js`, `QaMigrate.js` | Quality module | Bundle `apps.quality.server` |
| `TlPerformance.js`, `KpiLogs.js`, `MailDesk.js` | TL desk | `apps.desk.server`; `gmail.send` scope |
| `Actions.js`, `Coaching.js`, `Meetings.js`, `MigrateV1Tasks.js`, `Notes.js`, `OneOnOneDelete.js`, `OneOnOneReminders.js`, `OneOnOnes.js`, `PeopleTriggers.js`, `Reminders.js`, `Scorecard.js`, `Tasks.js` | People & Performance | `apps.people.server` |
| `Trackers.js` | Operations & Trackers (trackers page; escalation matrix location unknown) | `apps.operations.server` |
| `AgingHelp.js`, `Heatmap.js`, `QueuePages.js`, `Scheduler.js`, `TlQueue.js` | Queue & Workforce | `apps.queue.server` |
| `Assistant.js` | My day (Calendar, Drive, Gmail), Notes owner gating | `Code.js:45` comment; `calendar`/`drive` scopes |
| `Setup.js`, `Aggregates.js`, `Queue.js`, `RosterSync.js`, Freshdesk sync files (`FD_*`), daily-report intake, inflow, `fc_messages` job | Queue data pipeline, roster sync, year rollover | Comments in `QueueCore.js`, `Stores.js`, `ProdCore.js`, `Health.js` |
| Header lists: `QA_HEADERS`, `MD_HEADERS`, `TLP_HEADERS`, `FD_AGING/QUEUE/INFLOW/AGENT_*` headers, people tables | Schemas | `Stores.js:88-120` references them via `typeof` |
| `src/api/types.ts` (client/server contract), `src/apps.json`, `scripts/apps.mjs`, `scripts/build-clasp.mjs`, `scripts/test-*.mjs` | Contract, app composition, existing golden tests | Comments throughout |
| `specs/ecosystem.md`, `specs/people-workflows.md`, `specs/productivity-analytics.md`, "the brief" (numbered requirements 1-17), README open questions | Owner decisions, requirement numbers on the registry (`reqs`), rule rationale | Comments throughout |
| Live deployed apps (8 web-app URLs) or screenshots of every page and state | Pixel parity for the 36 pages | Config `app_url_<app>` |
| Sample data for Quality/People/Queue/Desk beyond `Systems_Rawdata_Full.xlsx` (7 raw sheets) | Fixtures, golden vectors | Workbook contents |
| Live Supabase project state (tables, RLS, row counts) | Verifying "47 tables" claim | MCP unavailable in this session |

Any one of these routes unblocks the work, in order of value: (1) the full `cx-helm` source tree with `src/` and `server/`, (2) read access to the deployed apps for screenshots and network capture, (3) a Google Sheets/Apps Script export of every project, (4) recorded walkthroughs. Without one of them, the only legitimate deliverable for tier C pages is the shell, route, icon, role gate and legacy "Not built yet" placeholder (`03` section 1).

## 2. Decisions required from the owner

| ID | Question | Why it matters | Recommendation |
|---|---|---|---|
| D1 | **App topology.** Legacy is 8 separate GAS web apps; each rail shows its own group expanded and other groups as single links to other apps. Should the new product be one Next.js app that reproduces that rail behaviour with internal links (per-group "app context"), or 8 deployments? | Determines routing, branding (`CX Helm Quality` etc.), "not connected" state, Connected apps admin setting, screenshot parity per page | One deployment; keep per-group app context so each page's rail, title and brand match its legacy screenshot exactly; retire Connected apps URL editing or keep it read-only |
| D2 | **URL scheme.** Legacy uses `#/<path>`, `?page=`, `?tab=`. Keep hash routing, or path routing with a legacy hash shim? | "Every legacy route exists"; bookmarks, emailed links (pop-ups and mails contain `link` fields such as `#/one-on-ones?...`) | Path routes internally plus client shim that resolves `#/x?y` and `?page=x`; or keep hash routes if bookmark/mail-link fidelity matters more |
| D3 | **FCR.** Legacy FCR page is a registered but unbuilt module ("sources pending"). Deliver (a) parity: the legacy placeholder + FCR input to scorecards (fcr passed/failed/excluded) and KPI payout, or (b) build the described module (scoring, raw data, analytics, insights)? | (b) is new product scope with no legacy spec | (a) now; (b) only after sources and rules are provided |
| D4 | **Identity.** Legacy trusts Google Workspace `Session.getActiveUser()` on domain `dabdoob.com` with roster roles. Use Supabase Auth with Google OAuth restricted to the domain and the same roster-role resolution? | Security model, owner/View as, trigger vs person actions | Yes, with server-side resolution mirroring `currentUser_` |
| D5 | **Disputes in Productivity.** Server removed the dispute mechanism but the bundled UI still has dispute sections and `My status` "dispute a flag" copy. Reproduce the UI, hide it, or restore the server logic (3-day `prod_dispute_days`)? | Visible difference vs functional parity; legacy never executes it (server returns `disputes: []`) | Match runtime behaviour (no dispute UI shown, no dead endpoints) unless the owner wants it back; confirm |
| D6 | **Mail policy and dry-run.** Keep `mail_dry_run = true` default and the 2026-10-20 policy (only `qa_*` and admin-only mail leaves the tool) in production? | Behavioural parity vs notification expectations | Keep as legacy until the owner changes the setting |
| D7 | **Data of record during parallel run.** Google Sheets remain the source for Gmail/Freshdesk/Freshchat/Maqsam ingestion? New system re-ingests from APIs directly? | Determines integrations scope for WP-4/WP-8 | Direct API ingestion with Sheets read-only for backfill |
| D8 | **Scheduler platform and plan.** Per-minute (1:1 reminders), 10-minute (mail desk) and 15-minute jobs require a scheduler that supports them in the Kuwait time zone. | Vercel Cron limits depend on plan | Confirm plan; otherwise Supabase `pg_cron` / Edge Functions |
| D9 | **Requirement numbers.** Registry `reqs` reference a brief that is missing. Needed only for the "Not built yet" placeholder text. | Placeholder copy parity | Provide the brief or accept omission of the "Covers requirement N" line |
| D10 | **Existing new-app code.** Retire the Tailwind/`legacy-*` UI layer and the fake tests when verbatim CSS/DOM lands (`03` section 2)? | Prevents two competing style systems | Yes, retire after parity gates pass |

## 3. Risks if the blockers stay open

1. Implementing the 36 pages from their one-line purposes would produce plausible but unfaithful features, violating the owner's "do not redesign, do not simplify" rule. This plan refuses to do that.
2. Reusing the existing `MIGRATION_SPECIFICATION.md` inventory would encode invented function names and an invented FCR system.
3. Declaring parity on the 4 Productivity pages without the diff harness would repeat the existing situation (checked-off tracker items without measurable proof).
4. The tracker's "Phase 5 Testing: COMPLETE (119 unit tests)" is not evidence of parity: parts of that suite assert on literals. The count should not be used as a status indicator.
