# ux report - qa-live-sheets-freeze - round 2 (DELTA)

Verdict: FAIL        (1 MED open — residual stale copy on the primary refresh path)
Open: 0B/0H/1M/4L

Scope: verified round-1 findings ux-1..ux-7 against tl-11 changed lines only —
`heatmap-page.tsx` (:55, :101, :157, :981) and `agents-page.tsx`
(:248-253, :266-267, :284-332, :390-391, :434, :442, :455-512). No other UI
files changed; states/contrast/dark-mode results from ux-1 stand (no new
visual surface beyond relocated `cx-note` pairs).

## Round-1 verification

- **ux-1 CLOSED** — `Empty` body now `, or build one from the live data below`
  (:981), additionally gated on `n.canAdmin` so non-admins no longer see copy
  pointing at a control they can't see. `raw tabs` 0 hits.
- **ux-2 CLOSED (contracted sites)** — note `Press Refresh to rebuild it now.`
  (:286), `rebuilt N agent-days` (:298), `rebuilt a moment ago` (:297),
  remove note `…until that month is rebuilt` (:304), header `What was rebuilt`
  (:390), busy `Rebuilding…` (:442), ReadChip `Not built yet`/`Last build
  failed`/`Built` (:250-252). Residual re-scoped as ux-8 below.
- **ux-3 CLOSED** — dedicated `behMsg`/`behMsgErr` (:266-267) via
  `runBehaviour` (:307-321); `cx-note` pair renders immediately after the
  behaviour `</form>` (:503-512), adjacent to submit. `role="alert"`/`status`
  preserved.
- **ux-4 CLOSED** — all five `field-error` in the file now carry
  `role="alert"` (:55, :101, :157, :776, :856; grep-verified).
- **ux-5, ux-6, ux-7 OPEN (LOW)** — intentionally deferred by tl-11; still
  reproducible at same lines (inputs :467/:479/:491 no `name`/`autoComplete`;
  `Already logged.` :330 in `data-status="ok"`; `.pw-field-grow` unchanged).

States checked: loading (unchanged), empty (updated copy verified), error
(see ux-9), success (see ux-6/ux-9), disabled (busyKey covers new path —
`runBehaviour` sets 'behaviour' and `!!busyKey` still gates row buttons),
long text, mobile, dark, keyboard, focus — no regressions introduced.

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|----|-----|----------------------------|----------|-----------|------------|
| ux-8 | MED | agents-page.tsx — main page (non-admin) surfaces | Re-scoped residual of ux-2, invited by tl-11. The admin block was reworded but the primary path still claims workbook reads that no longer happen (scorecard-server is zero-sheet now): busy label `Reading the workbook…` (:709), result `read a moment ago` / `read N agent-days from "{title}"` (:623-624), coverage stat `{n} agent-days read` (:758), column header `Last read` (:391 — directly beside the new `What was rebuilt` column), AsOfHint `'Read'` fallback (:434) and `D('Workbook')` (:712), purpose `…from the monthly productivity workbook` (:677-678), scoring tab `read from each month's workbook` (:1002) | Same rebuild vocabulary sweep: `Rebuilding…`, `rebuilt N agent-days`, `{n} agent-days`, `Last rebuilt`, `'Rebuilt'`, purpose `…from the live tables`, `computed from each month's data`. One pass, no semantics change | dev |
| ux-9 | LOW | agents-page.tsx:294-295 — refresh error path | A failed month rebuild (`a.status === 'error'`) is pushed through `setNote`, which renders `data-status="ok"` (green, role="status") — an error presented/announced as success. Lines were touched this round; same class as ux-6 | Route the `status === 'error'` branch to `setNoteErr` (red `role="alert"`) instead of `setNote` | dev |

## What passed

- Fix quality: no new classes/px/colors; `cx-note` pattern reused verbatim;
  behaviour notes are outside the `<form>` so they don't disturb submit
  semantics; success path still clears the three inputs, duplicate path keeps
  them.
- Conditional empty-state copy on `canAdmin` is a correctness bonus beyond
  the literal fix.
- No new a11y regressions: all touched controls remain labelled, focusable,
  token-styled; `role` usage consistent.

## Not verified / assumptions

- No Playwright run (unchanged layout; copy/state fixes judgeable from code).
- Server-side strings feeding `m.error`/`m.title` may contain their own
  "read/workbook" wording — out of UI-file scope, flagged here only as the
  same vocabulary family as ux-8.
- ux-5/ux-6/ux-7 remain open as LOW per the FIX-round deferral; they are not
  re-litigated, only re-confirmed.
