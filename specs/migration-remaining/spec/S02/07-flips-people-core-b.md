# S02-07: upsertOn flips — people-core.ts (ops part)
Kind: mini
ID: S02-07
Parent: S02
Owner: dev
Depends: S02-02, S02-06
Criteria: PLAN #5 (mapping idempotency, people part B)
Skills: none
Budget: files=1; actions=5; changed_lines=100; minutes=8

## Goal
Flip the 5 remaining insert-only mappings in `people-core.ts` to `upsertOn`
using exactly the keys S02-02 recorded.

## Files
- Edit: `src/features/shared/migration/mappings/people-core.ts` | mapping literals (~lines 226-285)

## Context
- `results/S02-02.md` | authoritative table→upsertOn key list (required)
- `src/features/shared/migration/mappings/people-core.ts:226-285` | Options,
  MailLog, holidays, FollowUpDone, sc_behaviour literals
- `results/S02-05.md` | confirms any dedupe_key transforms already landed in
  queue-quality.ts ROW_TRANSFORMS (read before flipping those tables)

## Contract
Add `upsertOn: '<key>'` to exactly these 5 mappings, keys verbatim from
S02-02's results: options, mail_log, holidays, follow_up_done, sc_behaviour.
For `dedupe_key` tables set `upsertOn: 'dedupe_key'` and confirm S02-05's
results already list the matching transform (if not, note it in your results —
do not add transforms here). Keep existing `require`; touch nothing else.
Out of scope: transforms, DECISIONS, other files, remote apply.

## Actions
1. options: add `upsertOn` inside its mapping literal (key verbatim from
   `results/S02-02.md`).
2. mail_log: same.
3. holidays: same.
4. follow_up_done: same.
5. sc_behaviour: same.

## Done when
- All 5 mappings carry the S02-02 key; no other edit in the file.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s02-07-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
people-core.ts fully flipped. Write `results/S02-07.md` (<=10 lines); TL
updates TRACKER.md.
