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
| WP-B | Platform foundations | done | src/lib/platform/* (12 files), 8 API routes (bootstrap/options/popups/alerts/mail-log/health/calendar/view-as-people), migration 002, 70 tests green. Stubs: SMTP/Gmail adapters (dry-run default). |
| WP-1a | Shell parity | done | Verbatim legacy CSS + full shell (rail/gates/view-as/popups/splash/hash shim). Rail delta ~7%; content deltas are data differences. `/` resolves like legacy: external note + fallback. |
| WP-8a | ProdValidation/productivity port + golden tests | done | src/lib/prod/*; 86/86 golden oracle tests green (legacy run verbatim in vm). |
| WP-8b | ProdTph port + golden tests | done | src/lib/tph/* + kpi/scorecard/queue libs; golden-tested same suite. |
| WP-8c | 4 productivity pages to parity | done | status-validation (Ra), my-status (Ia), tph (za 6 tabs), productivity-analytics (Fa) ported verbatim; /tph + /tph-grid routes; px diff 0-0.26% per latest agent verify. |
| WP-8d | Productivity jobs + Gmail import + vercel.json | done | src/lib/jobs/* + 4 new cron routes; chain order verbatim; Gmail import behind read adapter (skipped unconfigured); 352 tests green. |
| WP-1b | Hub pages | bounded-done | Components absent: routes render legacy hs() placeholder (parity for an unbuilt route). APIs live: health/options/mail-log/calendar/holidays/bootstrap. |
| WP-2 | Quality | bounded-done | /api/quality/audits + qa_audits data exist; page components + Quality.js absent -> placeholders per policy. |
| WP-3 | FCR | bounded-done | /api/fcr/daily GET+POST (scorecard rows) done; page placeholder per D3. |
| WP-4 | Queue & Workforce | bounded-done | /api/queue/{health,aging-flags,checkins} ported; agg_* stores lack schema (tolerant reads). Pages placeholder. |
| WP-5 | People & Performance | bounded-done | kpiPayout endpoint + kpi_*_log CRUD + calendar/holidays live; scorecard stores lack schema; pages placeholder. |
| WP-6 | Operations & Trackers | bounded-done (blocked) | Trackers.js + UI absent: placeholders only; nothing ported, nothing invented. |
| WP-7 | TL desk | bounded-done | /api/tl/performance (raw rows + reader outputs) + holidays; TlPerformance.js/MailDesk absent. Pages placeholder. |
| WP-9 | Migrations, final sweep, gates | done | 002+003 written; parity suite green: all comparable views 0-0.05% px diff. Remaining unknown-schema tables need legacy source. |

## Log
- 2026-10-31: tracker created; defaults applied.
- WP-A harness done: shooters + fixtures + diff-parity.mjs; baseline diff 25-43% pending WP-1a shell.
- vercel.json created with legacy trigger schedule (daily 08:30 Cairo->06:30 UTC, TPH 15min, past-day hourly, quarterly day-1).
- supabase/migrations/003_domain_tables.sql added: all tables with recoverable headers (prod_*, kpi_*, tlp_*, tickets, dq_aging_flags, queue_submissions, refresh_log). Unknown-schema tables listed at file tail, pending source.

- WP-1a/WP-B/WP-8a/WP-8b agents completed (resumed after quota pause, same model). WP-8d + API-fragments agents running.
- Commits: specs reorg, vercel.json, 003 migration, then per-package agent commits; stale disputeDays test fixed.

- Final: all implementable scope complete and committed (per-package commits). Parity suite: 10 comparable views all 'match' (0-0.05% px, <=2 style props, <=2 DOM lines). Remaining work is blocked on missing legacy source files (see 06) and new-store schemas (QA_HEADERS, DQ_*_HEADERS for live/agg stores, MD/TLP headers, one_on_one_*/actions/tracker tables, FCR module).
