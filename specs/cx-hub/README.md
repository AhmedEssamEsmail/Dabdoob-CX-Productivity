# CX Hub — Complete Legacy Parity Migration (Master Plan)

> One-sentence summary: the legacy CX Helm suite (8 Google Apps Script apps, 40 routes + 1 hidden, ~58k lines of server code) is the product specification; this repository (to be renamed **CX-Hub**) becomes a single Next.js/Supabase deployment that reproduces every module, page, workflow, rule, job and visual as a set of per-product **features**, with the existing code carried forward as the `cx-productivity` feature.

## 0. What changed since `specs/legacy-parity/` was written

The earlier programme assumed most legacy source was missing. **That assumption is now obsolete.** The workspace now contains all 8 deployed app builds:

| Legacy dir | `CC_APP` | Module-unique server files now present | Bundle size |
|---|---|---|---|
| `Command_Center_V2_deprecated` | hub | Aggregates, Assistant, FreshdeskSync, FreshchatSync, HomeCards, Queue, RosterSync, Setup, Triggers | 923 KB (incl. Three.js for Ecosystem) |
| `Quality_deprecated` | quality | Quality.js (3621), QaEngine.js (2166), QaMigrate.js (628) | 322 KB |
| `Productivity_Depricated` | productivity | ProdTph, ProdValidation, ProductivityApp, productivity.js | 251 KB |
| `Queue_deprecated` | queue | Scheduler (1927), TlQueue, Heatmap, QueuePages, AgingHelp | 295 KB |
| `People_deprecated` | people | OneOnOnes, Scorecard, Tasks, Meetings, Actions, Reminders, OneOnOneDelete, OneOnOneReminders, Notes, Coaching, PeopleTriggers, MigrateV1Tasks | 321 KB |
| `Operations_deprecated` | operations | Trackers.js (802) | 155 KB |
| `Desk_deprecated` | desk | MailDesk, TlPerformance, KpiLogs | 168 KB |
| `FCR_deprecated` | fcr | *(none — unbuilt in legacy)* | 128 KB (shell only) |

Every app shares identical core libraries (Auth, Config, Options, Popups, Notify, Mailer, Repo, Stores, Health, ViewAs, WorkCore, WorkCalendar, PeopleCore, ProdCore, QueueCore, KpiPayout, TlSnapshots, OneOnOneAlerts, Apps, Code). `Config.js` differs in two variants (per-app `app_url_*` defaults) — the hub copy is canonical.

**Consequence:** every "blocked" item in `specs/legacy-parity/06` for *server* code is now unblocked. Page *components* exist only inside each app's bundled `index.html` — each bundle ships its own module's pages (bundle-size deltas confirm; FCR's shell-only bundle proves the baseline). The same decompile-and-port loop used for the 4 Productivity pages applies per module.

## 1. Locked decisions (owner, 2026-11-05)

| ID | Decision |
|---|---|
| D1 | One Next.js deployment serving all groups; the rail keeps per-group **app context** so each page renders the rail/brand/title exactly as the legacy app that owned it. (Implemented — see shard 01.) |
| D2 | Path routes internally; `#/path`, `?page=`, `?tab=` accepted via the existing HashShim. |
| D-FCR | **FCR skipped entirely.** A dedicated plan will be written later. The registered `fcr` route stays a placeholder; scorecard FCR inputs ship with cx-people. |
| D-SCHED | Sub-hourly jobs run on **Supabase pg_cron + Edge Functions** (or internal endpoints). Every-1-minute jobs are normalized to **15-minute cadence** (oo_reminders, mail_desk→15 min unless owner says otherwise; 10–20 min jobs keep their cadence where expressible). |
| D-DATA | **Full historical migration** of every store/tab to Supabase, verified against source sheet counts. |
| D-GOOGLE | All Google-Workspace-dependent work (Gmail read/send, Calendar, Drive, Google-Form imports, HCT roster sync) is deferred to the **final phase**; when it is reached the programme **stops** for a discussion of required credentials/manual actions. Until then those features are built behind adapters or with migrated data only. |
| D5 | Productivity dispute UI stays hidden (server removed it; `disputes: []`). |
| D6 | `mail_dry_run` true and `qa_*`-only mail policy preserved. |

## 2. Repository topology

```
C:\Users\AHMED\KPIs\
  *_deprecated\            # 8 legacy app builds (the specification — read-only)
  CX-Hub\                  # this repo after rename
    src\app\               # routes only: page.tsx + thin api/*/route.ts
    src\features\
      shared\              # shell, platform, vendor, jobs infra, time, repo
      cx-productivity\     # MOVED: existing prod/tph/kpi/jobs code
      cx-hub\              # home, admin, people-holidays, my-day, ecosystem, aggregates, roster sync
      cx-quality\          # 10 pages + QaEngine + workflows
      cx-queue\            # 6 pages + scheduler/heatmap/tl-queue + syncs
      cx-people\           # 9 pages + 1:1s/tasks/meetings/actions/scorecard
      cx-operations\       # trackers + escalation matrix
      cx-desk\             # tl-performance, kb-tracker, kpi-logs, mail-desk
    specs\cx-hub\          # this plan + task shards
    migration\             # sheets→supabase pipeline, extended per module
    supabase\migrations\   # one migration per module
```

Feature convention: `src/features/<name>/{lib,components,server.ts,types.ts}` — domain logic is framework-free TypeScript (golden-testable against the legacy oracle); `src/app/*/route.ts` files stay thin and import from features. Routes/pages must live under `src/app` (Next.js constraint).

## 3. Per-module port recipe (every shard follows this)

1. **Extract** the module's `index.html` bundle → pretty-print → split page components (`Xt` map), shared widgets, copy strings. Output to `.devin/work/extract/<app>/`.
2. **Inventory** the module's public server functions (`function` without trailing `_` = `google.script.run` API) — the shard lists them verbatim.
3. **Schema**: write `supabase/migrations/NNN_<module>.sql` from the module's `*_HEADERS` constants.
4. **Domain port**: `server .js` → `src/features/<f>/lib/` line-for-line; Sheets `dq*`/`Repo` calls → `src/features/shared/platform/repo.ts` Supabase equivalents.
5. **API**: thin routes exposing the same function surface (page-shaped payloads — do not reshape).
6. **Pages**: components → `src/app/<route>/page.tsx` importing `features/<f>/components`; DOM/classes/copy verbatim; register in `BUILT_ROUTES`.
7. **Jobs**: port job functions; `vercel.json` for ≥1 h cadence, pg_cron for sub-hourly (15-min floor per D-SCHED); heartbeat rows written per `hbBeat_` semantics.
8. **Data**: extend `migration/` for the module's tables; verify counts vs sheets.
9. **Gates**: golden-oracle tests (legacy code in Node `vm` vs port), role/gate matrix, parity screenshots via `.devin/work` harness extended to this module's fixtures.

## 4. Shard index (execution order = owner priority)

| # | Shard | Status | Scope |
|---|---|---|---|
| 00 | `00-repo-restructure.md` — rename dir → CX-Hub; move existing code to `features/cx-productivity` + `features/shared` | blocked: OS rename denied in session | M |
| 01 | `01-shell-unification.md` — per-group app context in the unified shell | **done** | — |
| 02 | `02-extraction-pipeline.md` — per-app bundle decompile tooling | pending | M |
| 10 | `10-hub.md` — Hub: Home, Admin, People & holidays, My day, Ecosystem + hub jobs | pending | XL |
| 20 | `20-quality.md` — Quality: 10 pages, QA engine, CTL/disputes/calibration/KB gaps, jobs | pending | XL |
| — | FCR | **skipped (D-FCR)** | — |
| 30 | `30-queue.md` — Queue & Workforce: 6 pages + scheduler/heatmap + syncs | pending | XL |
| 40 | `40-people.md` — People & Performance: 9 pages + scorecard + reminders | pending | XL |
| 50 | `50-operations.md` — Trackers + Escalation matrix | pending | L |
| 60 | `60-desk.md` — TL desk: 4 pages + mail desk | pending | XL |
| 70 | `70-utilities.md` — sweep: hidden route, admin job UI, redirects, audits | pending | M |
| 80 | `80-data-migration.md` — full historical migration + validation | pending (runs per-module, closes last) | L |
| 90 | `90-google-access.md` — **STOP**: Gmail/Calendar/Drive/HCT/Forms credentials phase | gate: discuss with owner first | M |

## 5. Programme gates

- `tsc --noEmit` clean; `eslint` no new errors; `vitest` green (golden suites per module).
- Parity: pixel diff ≤ 0.1% vs legacy captures on identical fixtures; computed-style diff empty; DOM-outline diff empty modulo framework wrappers; per `specs/legacy-parity/03` checklist (roles × themes × accents × lang × viewports).
- Role/gate matrix: every endpoint × role × View-as returns exactly what the legacy function would.
- Each shard commits separately per `IMPLEMENTATION_TRACKER.md`.

## 6. Evidence conventions

`[V]` verified in a legacy file; `[B]` read from a bundled app (extract under `.devin/work/extract/`); `[H]` hypothesis needing verification. Legacy paths are relative to `C:\Users\AHMED\KPIs\<App>_deprecated\`.
