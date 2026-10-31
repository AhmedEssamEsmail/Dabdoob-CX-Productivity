# 05 - Implementation Plan (Phase 5) - NOT STARTED

Nothing here is authorised yet. Phase 5 begins when the owner has answered the decisions in `06` and supplied (or waived) the missing source. Order follows the owner's priority list: Hub, Quality, FCR, Queue & Workforce, People & Performance, Operations & Trackers, TL desk, remaining utilities. Two modules are added in front because every other module depends on them.

## 0. Principles

1. One module = one branch = one separately committed unit (repo rule in `IMPLEMENTATION_TRACKER.md`: "each part ... committed separately after all tests pass").
2. A module is done only when its **parity gates** pass: legacy-vs-new screenshot diff (`03` section 5), computed-style and DOM diff, golden-vector differential tests for each ported rule (`04` section 1), role/permission matrix tests, and job heartbeat tests.
3. Port, do not redesign: legacy CSS and DOM are reused verbatim, rule functions are ported line-for-line, then tested against the legacy code as oracle.
4. No placeholder routes: a module's nav entries become live in the same change that implements the page; disabled entries are not shipped.
5. Source gaps are tracked as blockers per work package; a blocked package is not "implemented from the description".

## 1. Work packages

| WP | Module | Contents | Source status | Depends on | Scope |
|---|---|---|---|---|---|
| WP-A | Parity harness (module 0) | Fixture-driven legacy screenshot suite (extend `.devin/work/*`), new-app mock mode (`?mock`, `?role=`), pixel/style/DOM diff, golden-vector runner (Node `vm` oracle), CI gates, replace fake tests | Available | none | M |
| WP-B | Platform foundations (module 0) | Identity resolver (Workspace email -> roster role), owner, View as guard at data layer, settings service with seeded defaults, options service, job runner + heartbeat + run log, time utilities, mail engine + notify, popups, bootstrap payload | Available (`Auth.js`, `Config.js`, `Options.js`, `Popups.js`, `Mailer.js`, `Notify.js`, `Health.js`, `Repo.js`) | D1, D4 | L |
| WP-1a | Hub shell | Verbatim legacy CSS and shell DOM: rail with all 40 icons, tones, group contexts, indicator, collapse, mobile, state screens, boot splash, error boundary, toasts, appearance (theme/accents/motion/transparency/lang), View as banner + picker, pop-ups, 1:1 alerts (+chime), hash/`?page=`/`?tab=` routing, Arabic dictionary | Available | WP-A, WP-B | L |
| WP-1b | Hub pages | Admin (roster, settings, dropdown choices, email log, scheduled jobs/health, appearance), Home, People & holidays, My day, Ecosystem | Server fragments only; UIs absent | WP-1a, queue/people data | L-XL |
| WP-8 | Productivity completion | `productivity-analytics` page; full `tph` page (6 tabs) and TPH engine; `my-status` full page; verified `status-validation`; Gmail import; productivity engine; confidence scoring; quarterly report; TPH jobs; settings seeding | Complete | WP-1a, WP-B | L |
| WP-2 | Quality | 10 pages, scoring engine, CTL and dispute workflows, forms, calibration, KB gaps, imports, reminders, `qa_*` mail | **Absent** | WP-B, WP-1a, people calendar, TL snapshots | XL |
| WP-3 | FCR | Per D3: placeholder parity plus scorecard FCR input, or full module | Partial (`WorkCore.js`, `KpiPayout.js`) | D3 | M / L-XL |
| WP-4 | Queue & Workforce | Freshdesk sync, queue aggregates, snapshots, check-ins (+ missed mail), inflow analytics, aging, heatmap, TL scheduler, daily report intake, TL queue metrics, 6 pages | Partial (`QueueCore.js`, `Stores.js`, `TlSnapshots.js`, `WorkCalendar.js`) | WP-B, Freshdesk/Freshchat/Maqsam creds | XL |
| WP-5 | People & Performance | Agents, 1:1s (+reminders, alerts, missed check, soft delete), TL tasks, meetings, my actions, notes, coaching, hard cases, scorecard builds, month-end KPI close, work calendar, `kpi` payout port | Partial (`PeopleCore.js`, `WorkCore.js`, `WorkCalendar.js`, `KpiPayout.js`, `OneOnOneAlerts.js`) | WP-B, WP-8, WP-2 (quality input), WP-3 (FCR input) | XL |
| WP-6 | Operations & Trackers | Trackers (blocked customers, promocodes, operational loss, customer strikes, ...), escalation matrix | **Absent** | WP-B | L-XL |
| WP-7 | TL desk | TL performance, KB tracker, KPI logs (+ behaviour, leave, OL), Mail desk (Gmail read, thread reply, MyFatoorah, chargebacks) | Partial (`TlSnapshots.js`, `KpiPayout.js`, `Mailer.js`) | WP-B, WP-4 (TL shifts), Gmail OAuth | XL |
| WP-9 | Remaining utilities | Hidden `ecosystem` route; scheduled-job admin UI; health diagram; any item discovered when missing source arrives; legacy URL redirects; final parity sweep | Mixed | all | M |

Notes on ordering: WP-1a is deliberately before WP-2 because Quality, People and Desk all render inside the shell and rely on pop-ups, View as and roles. WP-8 is scheduled right after the shell because it is the only module with complete source, so it proves the harness and the "port then diff" loop before any blocked module is attempted.

## 2. Per-package acceptance (examples; full lists generated from the legacy screenshots)

- **WP-1a**: for roles admin, tl, agent, specialist, unknown and View as: rail screenshots equal legacy at 4 viewports x light/dark x 4 accents x en/ar; all 40 icons match; `nav-ind` animation matches; pop-up Later vs Log it now behaviour; alert chime logic; collapse persistence; deep links `?page=quality-scores&week=...`.
- **WP-8**: `status-validation`, `my-status`, `productivity-analytics`, `tph` all tabs equal legacy screenshots for the fixture set; golden vectors for 100% of pure functions in `ProdValidation.js`, `ProdTph.js`, `productivity.js`; jobs produce identical rows from the same inputs (compare against `Systems_Rawdata_Full.xlsx` derived fixtures).
- **WP-5 KPI**: `kpiPayout_` golden vectors including every band edge (85 exactly -> 75, probation edges, FCR strictly greater, OL halving, leave window 61/92 days).
- **WP-4**: aging scale colours `--cx-age-0..6`, 13 bands, check-in slot state machine against `dqSlotState_`.
- Every package: role matrix test (each endpoint x role x scope returns allowed/denied exactly as legacy), View as write-refusal test, heartbeat shows ok/warn/down per `hbRowState_`.

## 3. Cross-cutting engineering decisions to apply (subject to D1-D6)

- Domain code in `src/lib/<module>` as framework-free TypeScript so differential tests can import it; API routes are thin.
- Schema: one migration per module under `supabase/migrations/` (the repo currently has only `001_core_tables.sql`; later tables were created out of band: reconcile first, WP-B).
- Business timezone constants centralised (`Asia/Kuwait` fixed +3, `Africa/Cairo` data tz).
- Scheduling: `vercel.json` crons for >= 1-hour jobs only if the plan allows; per-minute/15-minute/10-minute jobs on Supabase `pg_cron` + Edge Functions or an external scheduler (verify plan limits; do not downgrade cadence to fit).
- RLS and the write guard enforce View as read-only in the database, not only in routes.
- Secrets: nothing new in the repo; Gmail OAuth refresh token stored as a Vercel/Supabase secret.

## 4. Definition of done for the programme

All 40 pages + `ecosystem` live, every rail entry live per context, every workflow, rule, report and job reproduced and proven by gates, parity suite green across the state matrix, legacy `#/path` URLs and `?page=` links working, Arabic/RTL and appearance settings identical, and the owner has signed off any intentional deviation (`06`) in writing.

## 5. Immediate next steps once unblocked

1. Owner answers D1-D6 and supplies the missing source (`06`).
2. WP-A (harness) and WP-B (platform) can start without further input.
3. WP-1a (shell) starts as soon as D1/D2 are decided.
