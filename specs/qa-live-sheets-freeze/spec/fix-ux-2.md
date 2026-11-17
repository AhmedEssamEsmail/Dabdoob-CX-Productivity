# fix-ux-2 — FIX leaves for reports/ux-2.md (qa-live-sheets-freeze)

Source report: `specs/qa-live-sheets-freeze/reports/ux-2.md` (DELTA round 2,
verdict FAIL). PM routed all rows as blocking: ux-8 (MED) -> ux2-01,
ux-9 (LOW, promoted) -> ux2-02. Both leaves edit the same file —
serialisation: ux2-01 -> ux2-02 (agents-page.tsx). Round-1 deferred LOWs
ux-5/ux-6/ux-7 stay deferred (not re-litigated here).

## ux2-01: main scorecard path drops residual "read/workbook" vocabulary
Kind: mini
ID: ux2-01
Parent: fix-ux-2
Owner: dev
Depends: none
Criteria: ux-2 report finding ux-8 (MED)
Skills: none
Budget: files=1; actions=8; changed_lines=12; minutes=6

### Goal
The primary (non-admin) scorecard surfaces no longer claim workbook reads
that no longer happen — scorecard-server is zero-sheet; Refresh rebuilds
from the live tables.

### Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | string literals at :391, :434, :623-624, :677-678, :709, :712, :758, :1002 only

### Context
- `specs/qa-live-sheets-freeze/reports/ux-2.md` row ux-8 | the flagged
  evidence + prescribed replacements
- `specs/qa-live-sheets-freeze/spec/fix-ux-1.md#ux1-03` | the same sweep
  already applied to the admin block — match that vocabulary
- `src/features/cx-people/components/agents-page.tsx:290-300` | sibling
  `refresh` already uses `rebuilt a moment ago` / `rebuilt N agent-days`

### Contract
Reword only these user-visible strings (template/interpolation shapes and
pluralisation otherwise identical; keep `D(...)` wrappers where present):
- :391 header `Last read` -> `Last rebuilt`
- :434 AsOfHint fallback `'Read'` -> `'Rebuilt'`
- :623 `read a moment ago` -> `rebuilt a moment ago`
- :624 `read ${m.matrixRows} agent-days from "${m.title}".` -> rebuilt
  wording, e.g. `rebuilt ${m.matrixRows} agent-days.` (drop the workbook
  title interpolation)
- :677-678 purpose `…from the monthly productivity workbook…` (both admin
  and member variants) -> `…from the live tables…`
- :709 busy label `Reading the workbook…` -> `Rebuilding…`
- :712 `what={D('Workbook')}` -> e.g. `D('Live tables')` (word free, must
  drop `Workbook`; the shared `, read` template inside AsOfHint is out of
  scope — shared.tsx is used by other features)
- :758 stat `{n} agent-days read` -> `{n} agent-days`
- :1002 `they are read from each month's workbook overnight and on Refresh
  now.` -> `they are computed from each month's data overnight and on
  Refresh now.` (apostrophe entity `&apos;` preserved)
Out of scope: every other line; `setNote`/`setNoteErr` routing (ux2-02);
`shared.tsx` AsOfHint template; server-side `m.error`/`m.title` strings
(flagged in report as out of UI-file scope); any other file.

### Actions
1. Rename `Last read` header (:391) -> `Last rebuilt`.
2. Rename AsOfHint fallback (:434) -> `'Rebuilt'`.
3. Reword refresh results (:623-624) per Contract.
4. Reword both purpose lines (:677-678) per Contract.
5. Rename busy label (:709) -> `Rebuilding…`.
6. Rename AsOfHint `what` (:712) per Contract.
7. Reword coverage stat (:758) -> `{n} agent-days`.
8. Reword scoring-tab sentence (:1002) per Contract.

### Done when
- `grep -n 'read\|Read\|workbook\|Workbook' agents-page.tsx` shows zero
  remaining hits at the eight contracted sites (other lines may still
  legitimately contain the words).
- `npx tsc --noEmit` clean on the touched file.

### Verify
- Run: `npx eslint src/features/cx-people/components/agents-page.tsx` -> 0 errors

### Handoff
`note`/`noteErr` channels unchanged — ux2-02 fixes the error routing at
:293-295 in the same file after this lands. Write results/ux2-01.md
(<=10 lines) under `specs/qa-live-sheets-freeze/results/`; TL alone
updates TRACKER.md.

## ux2-02: failed month rebuild announces as error, not success
Kind: mini
ID: ux2-02
Parent: fix-ux-2
Owner: dev
Depends: ux2-01 (same file — serial writer)
Criteria: ux-2 report finding ux-9 (LOW, promoted to blocking by PM)
Skills: none
Budget: files=1; actions=1; changed_lines=6; minutes=3

### Goal
A failed `api.refresh([m])` result (`a.status === 'error'`) renders via
the red `data-status="bad"` `role="alert"` note instead of the green
`data-status="ok"` `role="status"` one.

### Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | the `refresh` helper's `setNote(...)` call at :293-299 only

### Context
- `specs/qa-live-sheets-freeze/reports/ux-2.md` row ux-9 | prescribed fix:
  route `status === 'error'` to `setNoteErr`
- `src/features/cx-people/components/agents-page.tsx:266-300` | shared
  `note`/`noteErr` state and the `run`/`refresh` helpers in scope

### Contract
Split the single `setNote(ternary)` so the `a.status === 'error'` branch
calls `setNoteErr(`${m}: ${a.error}`)` and only the success/retry
branches call `setNote`. No markup, state or other-string changes; the
`setNotes` map at :618-626 (bulk path, different channel) is out of
scope — the report flags only :294-295.

### Actions
1. In `refresh` (:293-299), move the `status === 'error'` arm out of
   `setNote` into `setNoteErr`, keeping the same message text.

### Done when
- The `status === 'error'` branch feeds `setNoteErr`; the green
  `role="status"` note can no longer carry a rebuild error.
- `npx tsc --noEmit` clean on the touched file.

### Verify
- Run: `npx eslint src/features/cx-people/components/agents-page.tsx` -> 0 errors

### Handoff
None. Write results/ux2-02.md (<=10 lines) under
`specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.
