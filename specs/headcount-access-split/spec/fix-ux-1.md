# fix-ux-1 — headcount-access-split ux round 1 (blocking findings)

Source: `../reports/ux-1.md`. Finding ux-1 (MED) routed to `dev` as leaf
ux1-01. LOW findings ux-2 (cx-hint grid span), ux-3 (mobile input type),
ux-4 (cx-switch disabled cursor) are deferred per FIX routing — recorded in
TRACKER "Review findings", no leaves created here.

## ux1-01: "Leave unchanged" status option becomes a real no-op
Kind: mini
ID: ux1-01
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: ux-1.md finding ux-1 (MED)
Skills: none
Budget: files=1; actions=2; changed_lines=3; minutes=5

### Goal
The Status select's empty option reads "Leave unchanged" and must actually
leave the stored status unchanged: the save payload must not send
`employmentStatus` when the select holds `''`, so the server skips the key
instead of writing `employment_status = ''`.

### Files
- Edit: `src/features/cx-hub/components/people-holidays-page.tsx` | `C()` save payload, `employmentStatus: emp` (line ~126)

### Context
- `src/features/cx-hub/components/people-holidays-page.tsx:90` | `emp` state = `useState<string>(n.employmentStatus || '')`
- `src/features/cx-hub/components/people-holidays-page.tsx:235-244` | the select: options `''`/"Current"/"Left", label at :241 is "Leave unchanged"
- `src/features/cx-hub/components/hub-shared.tsx:92-93` | `setPerson` posts `{ action:'setPerson', email, fields }` as JSON — `undefined` object keys are dropped
- `src/features/cx-hub/lib/roster.ts:601-608` | server: `if (f.employmentStatus !== undefined) { patch.employment_status = ...; if ('') skips active }` — `undefined` means no write; `''` means clear

### Contract
- Payload becomes `employmentStatus: emp || undefined` (equivalent conditional form acceptable): `emp === ''` -> key absent server-side -> `setPersonV2Fields` neither writes `employment_status` nor touches `active`. `'Current'`/`'Left'` pass through unchanged, including the existing `active` sync (roster.ts:607-608).
- Keep the option label "Leave unchanged" — it is now truthful. Do NOT rename the option and do NOT change the select, the `emp` state, or any other payload field.
- Out of scope: roster.ts server logic, every other editor field, ux-2/ux-3/ux-4 findings (deferred).

### Actions
1. Change the one payload line so `''` serialises to `undefined`.
2. Run Verify; write results/ux1-01.md.

### Done when
- With `emp === ''`, the request body carries no `employmentStatus` key, so a stored status is never cleared by choosing "Leave unchanged".
- `emp` of 'Current'/'Left' still writes and still syncs `active` exactly as before.
- tsc + eslint clean on the file; `tests/golden/hub-people-holidays.test.ts` green.

### Verify
- Run: `npx vitest run tests/golden/hub-people-holidays.test.ts && npx tsc --noEmit && npx eslint src/features/cx-hub/components/people-holidays-page.tsx` -> exit 0

### Handoff
None (leaf-local behaviour).
Write results/ux1-01.md (<=10 lines); TL alone updates TRACKER.md.
