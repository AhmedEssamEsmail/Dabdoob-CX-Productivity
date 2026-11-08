# qa report - reminders-master-switch - round 2 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/2L

Checks run:
- `npx tsc --noEmit` -> clean, 0 errors
- `npx vitest run` -> 1152/1152 pass (53 files)
- `npx eslint` (scoped: popups.ts, jobs.ts, server.ts + 3 reminders-off test files) -> 0 errors, 3 warnings (pre-existing unused vars at server.ts:321/349/390, outside diffs)
- e2e: not run — still red for foreign in-flight redesign work per tl-2; no fix file implicated, no e2e spec covers Admin.

Delta verification (qa-1 findings vs tl-2 changed files):
- qa-1 MED -> FIXED. jobs.ts:247/274-283 — `raisePopup` dedupe row now unconditional, only `sendMail` gated; `sent[]` rebuilt from popup rows each run so re-enable cannot refire a trailing-window check-in. server.ts:2128/2130/2142-2154 — backfill + notify loop gated by `on`, but the `qaTx_` marking `reminded_date = today` runs unconditionally. Both now write a dedupe mark while off, satisfying criterion 6.
- qa-2 MED -> FIXED. popups.ts:15,65 — `raisePopup` skips only `REMINDER_POPUP_KINDS` (`missed_1on1`, `qa_ctl_due`); event kinds + `queue_checkin_missed` still append+dedupe, reads stay empty while off and rows resurface on re-enable. Matches updated criterion 3.
- qa-3 LOW -> OPEN (deferred per FIX rules). admin-page.tsx Rb still defaults `on=true` while `rows` is null — brief flash of "Reminders are on" before getConfigRows resolves.
- qa-4 LOW -> OPEN (deferred; may be covered by pending UX/UI gate). Still no component/e2e evidence for criterion 2's Admin block — code inspection + tsc only.

Test quality: the three updated reminders-off-{popups,dq,qa} tests are mutation-sensitive — each would fail under the round-1 gates (wholesale raisePopup drop, whole-job early returns). Off+on arms assert dedupe marks (`reminded_date`, popup rows) and explicitly prove no retroactive fire on re-enable (dq: only the new 15:00 slot mails; qa: `reminded:0` post-flip).

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|----|-----|-----------|------------------------------|-----------|-------|
| qa-3 | LOW | src/features/cx-hub/components/admin-page.tsx:375 | Carried from round 1: block flashes "on" state while `rows` is null. | Render nothing/disabled until `rows` set. | dev |
| qa-4 | LOW | src/features/cx-hub/components/admin-page.tsx:372-404 | Carried from round 1: no automated evidence for criterion 2 Reminders block. | Component/golden test or rely on UX/UI gate. | test-engineer |

Not verified / assumptions:
- e2e gate remains unverified (foreign redesign failures); re-run after that work integrates.
- On re-enable, stale `popupsPoll` cache entries can hide resurfaced popups up to POPUPS_POLL_S (300s) — same pre-existing cache window as config; acceptable, consistent with round-1 note.
- Scope check clean: fix diffs confined to the 3 source + 3 test files in tl-2's list; large unrelated redesign churn in tree is foreign to this spec; no debug leftovers, TODOs, or new deps in the delta.
