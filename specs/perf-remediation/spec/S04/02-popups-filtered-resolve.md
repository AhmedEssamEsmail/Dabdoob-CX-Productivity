# S04-02: popups.ts reads filtered rows; resolvePopups is one update
Kind: mini
ID: S04-02
Parent: S04
Owner: dev
Depends: none
Criteria: PLAN #3 (popups whole-table reads — 2,907 calls/44s) + PLAN #4 (per-row resolve loop removed)
Skills: none
Budget: files=1; actions=5; changed_lines=80; minutes=8

## Goal
`platform/popups.ts` stops reading the whole `popups` table: the pending /
dupe / resolve reads carry PostgREST filters, and `resolvePopups` resolves
matching rows with a single `.update()` (no per-row `updateRows` loop).

## Files
- Edit: `src/features/shared/platform/popups.ts` | `pendingPopupsFor` (34-54), `raisePopup` dupe check (69-75), `resolvePopups` (95-113)

## Context
- `src/features/shared/platform/popups.ts:34-54` | pendingPopupsFor: today readRows(table) then filter recipient/!resolved/kind!=='queue_checkin_missed'
- `src/features/shared/platform/popups.ts:66-91` | raisePopup dupe check shape
- `src/features/shared/platform/popups.ts:95-113` | resolvePopups loop + per-recipient `cacheRemove('pop:poll:'+email)` to preserve
- `src/features/shared/platform/stores.ts:20-35` | missingOk contract (try/catch -> []/{popups:[]})
- `tests/golden/reminders-off-popups.test.ts`, `tests/golden/reminders-off-alerts.test.ts` | suites guarding behavior

## Contract
- `pendingPopupsFor`: `db().from('popups').select('popup_id,kind,title,body,link,created_at,submitted_at').eq('recipient', normEmail(email)).is('resolved_at', null).neq('kind','queue_checkin_missed')` — keep remindersOn() gate, try/catch -> [], same PendingPopup mapping.
- `raisePopup` dupe check: filtered read `.eq('recipient', ...).eq('kind', p.kind).eq('ref', p.ref||'').is('resolved_at', null)` — first row wins, same return.
- `resolvePopups`: ONE `.update({ resolved_at: now }).eq('kind', kind).eq('ref', ref).is('resolved_at', null).select('popup_id,recipient')` — return `data.length`; `cacheRemove(POPUPS_POLL_KEY + normEmail(recipient))` per RETURNED row's recipient (preserves the poll-invalidation side effect). assertWritable() stays first.
- `popupsPoll` count-stamp design unchanged.
Out of scope: repo.ts, the /api/popups route (S05-01), notify.ts.

## Actions
1. Filter pendingPopupsFor's read per contract.
2. Filter raisePopup's dupe check per contract.
3. Rewrite resolvePopups as the single filtered update + per-recipient cacheRemove.
4. Drop now-unused `readRows`/`updateRows` imports if fully removed.
5. Re-check every popups-table read in the file is filtered (none selects '*').

## Done when
- No unfiltered `popups` select remains; resolvePopups issues exactly 1 write call regardless of row count.
- `npx vitest run tests/golden/reminders-off-popups.test.ts tests/golden/reminders-off-alerts.test.ts` green; `npx tsc --noEmit` clean.

## Verify
- Run: `npx vitest run tests/golden/reminders-off-popups.test.ts tests/golden/reminders-off-alerts.test.ts` -> all pass.

## Handoff
S05-01 adds the merged poll payload in the sibling route file (no conflict).
Write results/S04-02.md (<=10 lines); TL alone updates TRACKER.md.
