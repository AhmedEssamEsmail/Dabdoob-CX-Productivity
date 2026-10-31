# Legacy Parity - Implementation Tracker (Phase 5)

Started 2026-10-31. Rule: each work package commits separately after its gates pass.

Defaults applied for the undecided questions in `06` (reversible):
- **D1** one deployment; rail keeps per-group "app context" so each page's sidebar matches its legacy screenshot; Connected apps admin section retained read-only.
- **D2** path routes internally; `?page=`/`?tab=` and `#/path` accepted and redirected.
- **D3** FCR = registered page + scorecard/KPI input; module built only when sources arrive.
- **D5** dispute UI hidden (server removed it in legacy; `disputes: []`).
- **D6** `mail_dry_run` true, `qa_*`-only mail policy kept.

**Blocked (owner action):** full UI/workflow source for 36 pages; see `06`. Those pages ship as exact legacy "Not built yet" placeholders (title, purpose, icon, gate) until source arrives — that is what the legacy shell renders for an unbuilt route.

| WP | Task | Status | Notes |
|---|---|---|---|
| WP-A | Parity harness (shoot-new, mock, diff) | done (baseline) | `shoot-legacy.mjs`, `shoot-new.mjs`, `legacy-fixtures.mjs`, `lib-shots.mjs`, `diff-parity.mjs` in `.devin/work`; pixel+style+DOM diff → `shots/parity-report.md`. Baseline diff 25–43% (old shell); re-run after WP-1a. |
| WP-B | Platform foundations | in progress (agent) | |
| WP-1a | Shell parity | in progress (agent) | |
| WP-8a | ProdValidation/productivity port + golden tests | in progress (agent) | |
| WP-8b | ProdTph port + golden tests | in progress (agent) | |
| WP-8c | 4 productivity pages to parity | pending | |
| WP-8d | Productivity jobs + Gmail import + vercel.json | pending | |
| WP-1b | Hub pages (admin, overview, people-holidays, my-day, ecosystem) | pending | |
| WP-2 | Quality | partially blocked | routes + schemas now; source absent |
| WP-3 | FCR | pending (bounded) | D3 applied |
| WP-4 | Queue & Workforce | partially blocked | fragments port now; jobs need Freshdesk |
| WP-5 | People & Performance | partially blocked | KpiPayout + calendar port now; pages blocked |
| WP-6 | Operations & Trackers | blocked | Trackers.js absent |
| WP-7 | TL desk | partially blocked | KpiPayout readers + TlSnapshots port; MailDesk absent |
| WP-9 | Migrations, final sweep, gates | pending | |

## Log
- 2026-10-31: tracker created; defaults applied.
- WP-A harness done: shooters + fixtures + diff-parity.mjs; baseline diff 25-43% pending WP-1a shell.
- vercel.json created with legacy trigger schedule (daily 08:30 Cairo->06:30 UTC, TPH 15min, past-day hourly, quarterly day-1).
- supabase/migrations/003_domain_tables.sql added: all tables with recoverable headers (prod_*, kpi_*, tlp_*, tickets, dq_aging_flags, queue_submissions, refresh_log). Unknown-schema tables listed at file tail, pending source.
