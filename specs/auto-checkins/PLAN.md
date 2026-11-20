# PLAN: auto-checkins
Type: feature   Status: draft
Date: 2026-11-20   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Check-ins must be recorded automatically at the required slot times (config `checkin_slots`
= 09:30, 13:00, 18:30, 22:00 Kuwait). Today they exist only when a TL/admin manually submits
on the Check-ins page, so "Check-ins in today" stays 0 when nobody submits. Extend the
existing 15-minute `jobDataTick` -> `dqCheckinTick_` path so that when a slot's queue snapshot
is captured and no submission row exists for that (slot_date, slot), the system inserts the
`queue_submissions` row itself. TLs can still open the check-in afterwards and correct it —
`submitCheckin`'s existing update path already handles a pre-existing row.

## Success criteria
1. When `dqCheckinTick_` captures a slot snapshot (post-`readAfter`, `tick.fresh` gate as today)
   and no `queue_submissions` row exists for that `cp.key`, it inserts one row with:
   `snapshot_key = cp.key`, `status` = 'submitted' ('late' if now > cp.dueAt),
   `submitted_by` = a recognizable system actor (e.g. 'system'), `queues_json` built from the
   same captured rows. Per-queue entries carry the manual shape keys (`queue`, `agents`,
   `status`, `note`) plus the captured numbers (`open`, `oldestH`, `unassigned`, `stale`,
   `sourceAsOf`/`data_as_of`); `agents` = null and `status` = 'Auto' (no human judgment
   exists at capture time — do NOT fabricate agent counts or 'On track').
2. The tick never overwrites an existing submission (human or auto) — insert-only, one row
   per (slot_date, slot); rerunning the tick is idempotent.
3. Auto-submitted slots count as done: `dqSlotState_` -> 'done', Home "Check-ins in today"
   increments, Check-ins page shows the slot submitted by the system actor, and
   `dqRemindMissedCheckins_` does not fire for them (same-tick ordering already guarantees
   submissions are seen).
4. Slots whose snapshot is never captured inside the existing 6-hour window (pipeline stale /
   tick not fresh) still go 'missed' and still trigger the missed-check-in reminder —
   auto-submit must not silently substitute stale data.
5. `resolvePopups('queue_checkin_missed', cp.key, actor)` runs on auto-insert so a reminder
   raised before a late auto-capture is cleared.
6. Vitest: auto-insert on capture, skip when a submission already exists, 'late' status when
   past dueAt, queues_json shape/values match the snapshot rows.

## Scope / Non-goals
In: `dqCheckinTick_` in `src/features/cx-queue/lib/jobs.ts`, a small queues_json builder
(co-located or in `src/features/cx-queue/lib/index.ts`), unit tests.
Out: no schema migration (all `queue_submissions` columns exist); no pg_cron/vercel.json
change (tick already runs */15); no UI redesign — the "Earlier check-ins" card may render an
'Auto' status chip and empty Agents cell, acceptable; no auto-fill of the human fields
(agents on it, how it's going, driving note); manual submit/correct flow unchanged.

## Risk flags (y/n)
arch n · db n · data y (scheduled job pipeline + submission record semantics) · auth n ·
external-api n · ui n · perf n · deps n · tests n (vitest inside the leaf) · docs n · deploy n
Review gates: QA (always) · Security: skip (no new endpoint/authz surface; write happens inside
the existing requireJobCaller-gated cron job) · Data: run · Performance: skip · UX/UI: skip

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`
e2e: `npm run test:e2e`  security: `npm run test:security`  build: `npm run build`

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Forbidden: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`.
- Leaf results go to `specs/auto-checkins/results/`, never repo-root `results/`.
- Cron writes use actor 'system:job'/'system' (appendRow actor arg), matching existing jobs.
- `import 'server-only'` in jobs.ts — vitest stubs it via resolve.alias; do not add to root tsconfig paths.
- Bound heavy output to log files + bounded tails; never cat full vitest/diff output.
- One commit per work package, only when the user asks; never push.

## Research notes
- `queue_submissions.status` is free text (no CHECK constraint) — see
  `supabase/migrations/20261031193219_domain_tables.sql:154`.
- `dqValidateCheckin_` (index.ts:656) requires per-queue `agents` (int) + `status` (non-empty)
  so it CANNOT be reused for auto-submit — write the row directly instead, mirroring the
  `submitCheckin` row shape (pages.ts:235-239).
- `dqRemindMissedCheckins_` runs at the end of the same `dqCheckinTick_` call, so an
  auto-inserted submission is visible to it immediately — no ordering hazard.
- pg_cron job `cxh-job-data-tick` fires `/api/cron/job-data-tick` every 15 min
  (migration `20261108231643_job_data_tick_pg_cron.sql`); first tick >= readAfter captures,
  so auto-submit lands ~readAfter+0-15 min — inherent to the existing cadence, accepted by user.
- Manual `queues_json` entries do NOT store `open`; auto entries may add number fields —
  jsonb is schemaless; verify no consumer breaks (earlier-cards read queue/agents/status/note only).

## Key pointers
- `src/features/cx-queue/lib/jobs.ts:342-385` — `dqCheckinTick_`: snapshot capture loop; the
  auto-insert belongs in the `if (rows.length)` block right after the queue_snapshots upsert,
  reusing the same `rows`/`cp` so submission data == frozen snapshot.
- `src/features/cx-queue/lib/pages.ts:219-258` — `submitCheckin`: canonical submission row
  shape and update-if-existing semantics.
- `src/features/cx-queue/lib/index.ts:656-697` — `dqValidateCheckin_`: manual queues_json keys
  {queue, agents, status, note, openCorrected?} that consumers read.
- `src/features/shared/lib/queue-core.ts:111-152` — `dqSlotState_`/`dqCheckpoints_`: any
  submission row => 'done'; cp.key = `${date}|${slot}`; readAfter/opensAt/dueAt instants.
- `src/features/shared/platform/settings.ts:46` — `checkin_slots` config values.
- `src/features/cx-queue/lib/jobs.ts:289-336` — `dqRemindMissedCheckins_`: submission lookup
  pattern (`dqSubmissionsFor_` over slot_date range) to reuse for the existence check.
- `tests/golden/queue-checkin.test.ts` + `tests/golden/hub-fakes` — in-memory supabase harness;
  extend for tick auto-submit coverage.
