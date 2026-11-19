# PLAN: qa-build-no-touches
Type: bugfix   Status: draft
Date: 2026-11-19   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
"Build the queue now" (QA audit queue, `P.importNow()` -> `/api/qa/[action]` -> `qeBuildPool_`)
fails with: "No agent touches found in the 3-day window. Newest activity in the source is
2026-11-19 00:13. Window coverage: 2026-11-17: 0, 2026-11-18: 0, 2026-11-19: 0. Scanned 1000
rows of 'fd_activities', 1000 performers unresolved, roster 50 users." Expected: the build
finds agent touches and produces the day's sample. The source data IS fresh (newest activity
today 00:13) — this is NOT a stale-sync problem; all 1000 scanned rows fail
`qeResolvePerformer_` so `pairs` ends up empty.

## Success criteria
1. `qeReadTouches_` resolves performers for in-window fd_activities rows (unresolved count
   ≈ 0 for rows whose performer is a rostered agent) — verify against production data or a
   faithful fixture.
2. "Build the queue now" completes without the "No agent touches" error (queue items are
   produced, or the next actionable downstream error — e.g. missing ticket detail — is
   reported instead).
3. Regression test: a unit/integration test covering the performer-resolution mismatch
   (e.g. `User <id>` rows resolving via roster fd ids, or freshdesk-name vs roster-name).

## Scope / Non-goals
In: performer resolution in `qeReadTouches_`/`qeResolvePerformer_`/`qeReadAgentRoster_`,
    fd_activities writer mapping (`fdActivityToCells_`/`fdActivityRosterNames_`), roster
    column population — whichever the debugger proves is broken.
Out: changing sync cadence (see research: fd_activities sync is daily by design; data is
     fresh so cadence is not the bug), QA engine logic beyond the resolution path.

## Risk flags (y/n)
arch n · db n · data y (KPI queue pipeline) · auth n · external-api y (Freshdesk/roster
identity) · ui n · perf n · deps n · tests y · docs n · deploy n
Review gates: QA (always) · Security: run (external-api flag) · Data: skip (resolution fix,
no metric definition change) · Performance: skip · UX/UI: skip

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit -p tsconfig.json` (log to file, tail it)
lint: `npx eslint src/features/cx-quality src/features/shared/jobs` (bounded tail)
unit: `npx vitest run src/features/cx-quality` (log file + tail)
build: `npx next build` (log file + tail)

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Heavy command output to log files; read bounded tails only (OUTPUT-BUDGET.md).
- No commits without explicit user approval. No remote DB writes without approval —
  debugging is SELECT-only via the Supabase MCP server.
- Next.js 16 app router; `server-only` imports in jobs/platform files.
- `readRows`/`db()` live in `src/features/shared/platform/repo.ts`.

## Research notes
- fd_activities mirror: written by `syncMirror('fd_activities')` in
  `src/features/shared/jobs/mirrors.ts` — runs inside `mirror_sync` step of
  `jobProductivityDaily` (Vercel cron 06:30 UTC) and on demand via
  `POST /api/admin/mirrors`. Newest row is today 00:13 -> it IS running.
- Tickets snapshot: synced by `fdSyncIncremental_` inside `jobDataTick`, invoked every
  15 min by Supabase pg_cron+pg_net -> `src/app/api/cron/job-data-tick/route.ts`.
- Writer side: `fdActivityToCells_` (src/features/shared/jobs/vendor-apis.ts:178) sets
  performer cell = `rosterNames[performer_id]` (freshdesk_id -> freshdesk_name) else
  `User <id>`. Roster names come from `fdActivityRosterNames_` (mirrors.ts:79) reading
  `roster.freshdesk_id`/`freshdesk_name`.
- Reader side: `qeReadAgentRoster_` (engine-live.ts:117) builds byId from
  `r.fd_id || r.freshdesk_id`, byName from `r.fd_name || r.name`.
  `qeResolvePerformer_` (engine-live.ts:82) resolves `User \d+`/bare >=6-digit ids via
  byId, else exact byName; returns null otherwise (counted as `unresolved`).
- Per-day coverage counts only RESOLVED performers (engine-live.ts:216-218), so the 0/0/0
  window and 1000/1000 unresolved are the same signal: name resolution is broken, not the
  window or the sync.
- Hypotheses to check against real data: (a) performer_name holds `User <id>` while roster
  freshdesk_id is empty; (b) performer_name holds Freshdesk display names that don't equal
  roster `fd_name`/`name` (e.g. punctuation/full-name differences); (c) roster read returns
  rows lacking the fd columns entirely (column rename), (d) unresolvedSamples in the thrown
  path already hint which rawName shapes fail — message doesn't surface them, debugger
  should query a sample.

## Key pointers
- src/features/cx-quality/lib/engine-live.ts:175-255 — qeReadTouches_ (scans fd_activities)
- src/features/cx-quality/lib/engine-live.ts:82-96 — qeResolvePerformer_
- src/features/cx-quality/lib/engine-live.ts:117-140 — qeReadAgentRoster_
- src/features/cx-quality/lib/engine-live.ts:397-405 — qeBuildPool_ throws the toast error
- src/features/shared/jobs/mirrors.ts:79-137 — fd_activities spec + roster name dir
- src/features/shared/jobs/vendor-apis.ts:178-219 — fdActivityToCells_
- src/features/cx-queue/lib/jobs.ts:391-412 — jobDataTick (15-min pg_cron ticket sync)
