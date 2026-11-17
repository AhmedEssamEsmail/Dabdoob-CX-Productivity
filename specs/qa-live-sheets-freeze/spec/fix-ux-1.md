# fix-ux-1 — FIX leaves for reports/ux-1.md (qa-live-sheets-freeze)

Source report: `specs/qa-live-sheets-freeze/reports/ux-1.md`. One leaf per
blocking finding (4 MED: ux-1..ux-4). LOW ux-5/ux-6/ux-7 deferred per FIX
rules. Same-file serialisation: ux1-01 -> ux1-02 (heatmap-page.tsx),
ux1-03 -> ux1-04 (agents-page.tsx). The two files are independent — the two
chains may run in parallel.

## ux1-01: heatmap Empty copy stops pointing at the deleted raw-tabs path
Kind: mini
ID: ux1-01
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: ux-1 report finding ux-1 (MED)
Skills: none
Budget: files=1; actions=1; changed_lines=4; minutes=3

### Goal
The empty-state sentence under `AdminBuild` no longer instructs a workbook
workflow that no longer exists — the build now reads DB mirrors.

### Files
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | the `Empty` body string at :981 only

### Context
- `specs/qa-live-sheets-freeze/reports/ux-1.md` row ux-1 | exact replacement prescribed: `, or build one from the live data below`

### Contract
Replace `, or build one from the raw tabs below` with
`, or build one from the live data below` inside the existing conditional
(`n.canAdmin ? … : ''`). No other string, prop or markup changes.
Out of scope: every other line of the file, the `role="alert"` gaps
(ux1-02), server-side copy.

### Actions
1. heatmap-page.tsx: swap the phrase `raw tabs` -> `live data` in the `Empty` body at :981.

### Done when
- `raw tabs` no longer appears in heatmap-page.tsx.
- The `Empty` body reads `Upload a heatmap, or build one from the live data below. Not sure what the file looks like? …` for admins.
- `npx tsc --noEmit` clean on the touched file.

### Verify
- Run: `npx eslint src/features/cx-queue/components/heatmap-page.tsx` -> 0 errors

### Handoff
None. Write results/ux1-01.md (<=10 lines) under `specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.

## ux1-02: field-error surfaces in heatmap-page carry role="alert"
Kind: mini
ID: ux1-02
Parent: fix-ux-1
Owner: dev
Depends: ux1-01 (same file — serial writer)
Criteria: ux-1 report finding ux-4 (MED)
Skills: none
Budget: files=1; actions=3; changed_lines=6; minutes=4

### Goal
Every async error `<p className="field-error">` in the file announces to
screen readers (WCAG 2.2 4.1.3), matching the four surfaces that already
carry `role="alert"`.

### Files
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | the three bare `field-error` paragraphs only: AdminBuild :55, SavedSets :101, CountryChips :157

### Context
- `src/features/cx-queue/components/heatmap-page.tsx:776,856,954,999` | the existing `role="alert"` pattern already used elsewhere in the same file
- `specs/qa-live-sheets-freeze/reports/ux-1.md` row ux-4 | the three missing sites

### Contract
Add `role="alert"` to each of the three `field-error` paragraphs so they
match `<p className="field-error" role="alert">`. No text, styling or
conditional changes. Out of scope: every other line, the Empty copy
(ux1-01), hm-banner surfaces (already compliant).

### Actions
1. Add `role="alert"` to the AdminBuild error `<p>` at :55.
2. Add `role="alert"` to the SavedSets error `<p>` at :101.
3. Add `role="alert"` to the CountryChips error `<p>` at :157.

### Done when
- `grep -n 'className="field-error"'` on the file shows `role="alert"` on all six occurrences; zero bare `field-error` paragraphs remain.
- `npx tsc --noEmit` clean on the touched file.

### Verify
- Run: `npx eslint src/features/cx-queue/components/heatmap-page.tsx` -> 0 errors

### Handoff
None. Write results/ux1-02.md (<=10 lines) under `specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.

## ux1-03: ScorecardAdmin copy drops stale "read/workbook" vocabulary
Kind: mini
ID: ux1-03
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: ux-1 report finding ux-2 (MED)
Skills: none
Budget: files=1; actions=6; changed_lines=20; minutes=5

### Goal
The `ScorecardAdmin` block in agents-page.tsx no longer tells admins the
numbers are "read" from a workbook — Refresh rebuilds from
prod_daily_layers/qa_audits and the saved id is display-only.

### Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | strings inside `ScorecardAdmin` + `ReadChip` only: :284, :296, :302, :373, :425, :248-253

### Context
- `src/features/cx-people/components/agents-page.tsx:321` | the section hint already says "Refresh rebuilds the month's numbers from the live tables" — new copy must match that vocabulary
- `src/features/cx-people/components/agents-page.tsx:305-315` | `logBehaviour` also calls `setNote` — DO NOT change those strings or the shared state shape here; ux1-04 re-homes them
- `specs/qa-live-sheets-freeze/reports/ux-1.md` row ux-2 | minimum = the save note; sweep the listed labels in the same pass (same root cause)

### Contract
Reword only these user-visible strings, keeping template shapes and
pluralisation identical:
- :284 `Saved for ${m}. Press Refresh to read it now.` -> `Saved for ${m}. Press Refresh to rebuild it now.`
- :296 `${m}: read ${a.matrixRows} agent-days, …` -> `rebuilt` wording, e.g. `${m}: rebuilt ${a.matrixRows} agent-days, ${a.agents} agents, ${a.fcrRows} FCR rows, ${a.behaviourCases} behaviour cases.`; the `retryInS` branch's `read a moment ago` -> `rebuilt a moment ago`
- :302 `The numbers already read stay until that month is read again.` -> reword to the rebuild vocabulary, e.g. `The numbers already built stay until that month is rebuilt.`
- :373 header `What was read` -> `What was rebuilt`
- :425 busy label `Reading…` -> `Rebuilding…`
- ReadChip :250-252 `Not read yet` / `Last read failed` / `Read` -> `Not built yet` / `Last build failed` / `Built`
Out of scope: `Logged for`/`Already logged.` strings, the `notes[]` block at
:506+, `Reading the workbook…` at :682 (different component, not flagged),
server-side `meta` strings, the note/noteErr placement (ux1-04), any other file.

### Actions
1. Reword the save-success note (:284) per Contract.
2. Reword the refresh-result template (:296) and retry branch per Contract.
3. Reword the remove note (:302) per Contract.
4. Rename the table header (:373) per Contract.
5. Rename the refresh busy label (:425) per Contract.
6. Rename the three ReadChip labels (:250-252) per Contract.

### Done when
- `grep -n 'read\|Read' src/features/cx-people/components/agents-page.tsx` shows no remaining `read`/`Read` in the six contracted sites (`Logged`, `Already logged`, `Reading the workbook…` untouched).
- The save note reads `Saved for {m}. Press Refresh to rebuild it now.`
- `npx tsc --noEmit` clean on the touched file.

### Verify
- Run: `npx eslint src/features/cx-people/components/agents-page.tsx` -> 0 errors

### Handoff
`note`/`noteErr` state and `logBehaviour` strings unchanged — ux1-04 builds
on them. Write results/ux1-03.md (<=10 lines) under
`specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.

## ux1-04: behaviour-case form gets its own adjacent feedback notes
Kind: mini
ID: ux1-04
Parent: fix-ux-1
Owner: dev
Depends: ux1-03 (same file — serial writer)
Criteria: ux-1 report finding ux-3 (MED)
Skills: none
Budget: files=1; actions=4; changed_lines=60; minutes=8

### Goal
`Logged for {month}.`, `Already logged.` and behaviour validation errors
render adjacent to the behaviour form instead of above the months table
(offscreen at 375px once month rows exist).

### Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | `ScorecardAdmin` only: state :261-265, `run` helper :267-281, `logBehaviour` :305-315, behaviour form JSX :438-485

### Context
- `src/features/cx-people/components/agents-page.tsx:356-365` | the shared `noteErr`/`note` `cx-note` pair (role="alert" / role="status") — the exact pattern to replicate inside the behaviour card; it stays for save/refresh/remove
- `src/features/cx-people/components/agents-page.tsx:267-281` | `run(key, call, done)` clears shared `note`/`noteErr` and funnels rejections to `setNoteErr` — behaviour calls must stop using that channel
- `specs/qa-live-sheets-freeze/reports/ux-1.md` row ux-3 | prescribed fix: own note/noteErr state rendered inside the card (or move shared notes under the table — prefer own state, the report's first option)

### Contract
- Add a dedicated feedback pair, e.g. `const [behMsg, setBehMsg] =
  useState('')` + `const [behMsgErr, setBehMsgErr] = useState('')` (names
  free; do NOT reuse `note`/`noteErr` or the input state `behNote`).
- Behaviour submit path (`logBehaviour` and its `run` error branch) writes
  only to the new pair — either a `runBehaviour` variant or an extra `run`
  parameter that redirects clear/setError; save/refresh/remove keep the
  existing shared channel unchanged.
- Render the new pair with the same markup (`cx-note`, `data-status="bad"`
  + `role="alert"` for errors, `data-status="ok"` + `role="status"` for
  success) immediately inside/after the behaviour `<form>` (before its
  closing tag or directly after it) so it sits next to the submit button.
- `Logged for …`, `Already logged.` and rejection messages (e.g.
  `Give a valid agent email.`) now appear there; they must NOT also appear
  in the shared notes above the table.
Out of scope: ux-5 LOW extras (name/autoComplete/spellCheck/cx-hint —
deferred), `data-status` of the duplicate message (ux-6 LOW deferred),
strings reworded by ux1-03, any other component/file.

### Actions
1. Add the `behMsg`/`behMsgErr` state pair next to the existing `note`/`noteErr` declarations.
2. Give `logBehaviour` a feedback channel that clears/sets the new pair (variant of `run` or a parameter) and switch its `setNote` calls to the ok-state setter.
3. Render the new `cx-note` pair adjacent to the behaviour form's submit area (same classes/roles as :356-365).
4. Verify the shared `note`/`noteErr` still serve save/refresh/remove and clear on each of their runs.

### Done when
- Behaviour success/duplicate/error messages render inside or immediately after the behaviour `<form>`, below the months table.
- The shared notes above the table no longer show behaviour outcomes (they still show save/refresh/remove outcomes).
- `role="alert"` on the behaviour error note and `role="status"` on the success note.
- `npx tsc --noEmit` clean on the touched file.

### Verify
- Run: `npx eslint src/features/cx-people/components/agents-page.tsx` -> 0 errors

### Handoff
None. Write results/ux1-04.md (<=10 lines) under `specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.
