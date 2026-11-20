# auto-checkins — leaves

## AC-01: dqCheckinTick_ auto-submits a queue_submissions row on snapshot capture
Kind: mini
ID: AC-01
Parent: none
Owner: dev
Depends: none
Criteria: PLAN #1 (insert row at capture), #2 (insert-only/idempotent), #3 (slot counts as done), #4 (uncaptured slots still missed), #5 (resolvePopups on insert), #6 (vitest coverage)
Skills: none
Budget: files=2; actions=6; changed_lines=350; minutes=10

### Goal
When `dqCheckinTick_` captures a slot's `queue_snapshots` upsert and no
`queue_submissions` row exists for that `(slot_date, slot)`, insert one row
stamped by actor `'system:job'` whose `queues_json` is built from the same
captured rows; never update an existing row; resolve `queue_checkin_missed`
popups for the checkpoint.

### Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | `dqCheckinTick_` (~lines 342-385) + one new private helper next to it + popups import line 16
- Create: `tests/golden/queue-checkin-auto.test.ts` | vitest cases for the same behaviour via the hub-fakes harness

### Context
- `src/features/cx-queue/lib/jobs.ts:342-385` | the capture loop; insert inside the `if (rows.length)` block right after the `queue_snapshots` upsert, reusing `rows`/`cp`/`now`
- `src/features/cx-queue/lib/jobs.ts:296-307` | `dqRemindMissedCheckins_` submissions lookup pattern (`.gte('slot_date', lo).lte('slot_date', hi + '\ufffd')` + `dqSubmissionsFor_`) to reuse for the existence check
- `src/features/cx-queue/lib/pages.ts:235-248` | canonical submission row shape and the `resolvePopups('queue_checkin_missed', cp.key, actor)` call
- `src/features/cx-queue/lib/index.ts:656-697` | `dqValidateCheckin_` — manual `queues_json` keys `{queue, agents, status, note}` consumers read; NOT reusable here (requires human `agents`/`status`)
- `tests/golden/reminders-off-dq.test.ts` | harness pattern: `vi.mock` supabase+auth with `./hub-fakes`, `hubSetTables`, `cacheClear`, direct call of a jobs.ts export

### Contract
- New private helper in jobs.ts, e.g. `dqAutoCheckinQueues_(rows)`, maps each snapshot row just built in the loop to
  `{ queue, agents: null, status: 'Auto', note: '', open, oldestH, unassigned, stale, data_as_of }`
  where `oldestH` copies `r.oldest_h`, `data_as_of` copies `r.data_as_of`, and `open`/`unassigned`/`stale` copy the same-named fields. `agents` stays `null` and `status` stays `'Auto'` — never fabricate counts or 'On track'.
- In `dqCheckinTick_`: lazily (first capture only, like `live`) select `queue_submissions` for the two cp dates already in scope and build `subDone[date + '|' + slot]` via `dqSubmissionsFor_`; inside `if (rows.length)` after a successful upsert, when `!subDone[cp.key]` `appendRow(DQ_QUEUE_SUBMISSIONS_TABLE, {...}, 'system:job')` with `submission_id: newId('qs')`, `slot_date: cp.date`, `slot: cp.slot`, `snapshot_key: cp.key`, `status: now > cp.dueAt ? 'late' : 'submitted'`, `queues_json`, `corrections_json: {}`, `correction_reason: ''`, `general_note: ''`, `help_needed: false`, `help_note: ''`; then set `subDone[cp.key] = true` and `await resolvePopups('queue_checkin_missed', cp.key, 'system:job')`.
- Invariants: insert-only (no update path — do NOT call `submitQueueCheckin`, it updates); one row per `(slot_date, slot)` even across tick reruns; slots whose snapshot is not captured (pre-`readAfter`, >6h window, or `tick.fresh` false / stale `aggAt`) get no row and keep flowing to `dqRemindMissedCheckins_`.
- `appendRow` already stamps `submitted_by`/`submitted_at` from the actor; needed imports (`resolvePopups` from platform/popups — extend line 16; `appendRow`, `newId`, `dqSubmissionsFor_`, `DQ_QUEUE_SUBMISSIONS_TABLE`) are all already imported in jobs.ts.
Out of scope: schema/migration changes, UI changes, `submitCheckin`/`submitQueueCheckin`/`dqValidateCheckin_` edits, auto-filling human fields, anything outside the two listed files.

### Actions
1. jobs.ts: add `resolvePopups` to the platform/popups import; add the `dqAutoCheckinQueues_` helper beside `dqCheckinTick_`.
2. jobs.ts: in `dqCheckinTick_`, add the lazy submissions read + `subDone` map (null until first capture), and inside `if (rows.length)` after the upsert add the existence check, `appendRow`, `subDone[cp.key] = true`, and `resolvePopups` call.
3. Create the test file: `vi.mock` supabase/auth via `./hub-fakes`; seed `config` (business_tz Asia/Kuwait, checkin_slots ['14:00'], checkin_read_delay_min 20, checkin_due_after_min 30, checkin_open_before_min 15, checkin_owner_emails {}, mail_dry_run, admin_emails), `agg_queue_now` rows, empty `queue_snapshots`, `queue_submissions`, `popups`, `roster` (one tl), `mail_log`, `view_as`; `cacheClear()` per seed; call `dqCheckinTick_(now, { fresh: true })` with `now` past `readAfter`.
4. Case: capture auto-inserts — assert one `queue_submissions` row with `snapshot_key`=`cp.key`, `status`='submitted', `submitted_by`='system:job', and `queues_json` entries carrying `{queue, agents:null, status:'Auto', note:'', open, oldestH, unassigned, stale, data_as_of}` matching the seeded `agg_queue_now` numbers.
5. Cases: idempotency/late — rerun the tick → still one row; seed an existing submission for the slot → unchanged, still one row; `now` past `dueAt` → `status`='late' and a pre-seeded open `queue_checkin_missed` popup for `cp.key` gains `resolved_at`.
6. Case: stale gate — call with `tick = { fresh: false }` → no submission row, and the past-due cp still produces the missed-check-in popup from `dqRemindMissedCheckins_`.

### Done when
- A captured slot with no prior submission has exactly one `queue_submissions` row: `snapshot_key = cp.key`, `status` 'submitted' ('late' when `now > cp.dueAt`), `submitted_by` 'system:job', `queues_json` shape above with real captured numbers.
- Tick reruns and pre-existing (human or auto) submissions are never overwritten or duplicated.
- An open `queue_checkin_missed` popup for the captured `cp.key` is resolved on auto-insert.
- A non-fresh tick inserts nothing and still raises the missed reminder.
- `npx tsc --noEmit` clean for the touched files.

### Verify
- Run: `npx vitest run tests/golden/queue-checkin-auto.test.ts tests/golden/queue-checkin.test.ts tests/golden/reminders-off-dq.test.ts` -> all pass (log full output to a file if long; tail only).
- Run: `npx tsc --noEmit` -> no new errors.

### Handoff
`queue_submissions` may now contain rows written by actor `system:job` with
`queues_json[].status = 'Auto'` and `agents = null`; consumers (`dqSlotState_`,
check-ins page, Home counter, `dqRemindMissedCheckins_`) require no further
changes — a row's presence already means 'done'.
Write results/AC-01.md (<=10 lines); TL alone updates TRACKER.md.
