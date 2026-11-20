# ux report - table-center-align - round 3 (FULL, S04 leaves only)

Verdict: FAIL
Open: 0B/0H/3M/2L
States checked: long text, mixed-content cells, empty/'–' variants, mobile (CSS reasoning), dark (tokens unchanged). Not verified: live render/screenshots.

Scope reviewed: `cx-kit.css:661` (`td:has(.cx-chip)`), `quality.css:84` (`.cx-select.qa-narrow`), `quality-analytics-page.tsx:407` + `:1250`, `quality-scores-page.tsx:376`, `tests/css/table-center-align.test.ts`. Swept all 50 `<td>` blocks containing a chip repo-wide for breadth fallout.

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | MED | `checkins-page.tsx:208` — "Status given" td | `<Chip/>` + `<span className="cx-statusline">{A.note}</span>`; `.cx-statusline` is `display:block` (refresh.css:502) so the free-text "What is driving it?" note renders as centered multi-line paragraph text, and rows without a note stay differently shaped. Chip is incidental; note is the payload. | Opt the cell out of the chip rule: add a start-align class (e.g. `cx-start`/`text-align:start` at ≥(0,3,1)) on this td, or exclude via `td:has(.cx-chip):not(:has(.cx-statusline))`. | dev |
| ux-2 | MED | `queue-page.tsx:326-338` — "By queue" name td | Queue name `.lead` + `.sub` status line + conditional `StatusChip` "Stale: these figures are from the daily report of…" (two sentences). When `m.stale`, the whole name cell — including the queue name — centers; sibling rows stay start. Per-row alignment flip in a label column. | Same opt-out class on this td (the chip is supplementary to a text-primary cell). | dev |
| ux-3 | MED | `audit-queue-page.tsx:417-425` — "Agent" td | `{w.agentName}` + tlName `qa-sub` + conditional warn chip "N repeat fails". Rows with repeat fails center the agent name; other rows stay start — inconsistent name column. | Same opt-out class on this td. | dev |
| ux-4 | LOW | mixed-variant columns | Per-row alignment flips where a cell renders text XOR chip: `people-holidays-page.tsx:453-467` (TL email vs "Not found in the HCT"), `:468-476` (country vs "Not set"); `quality-analytics-page.tsx:991-998` ('–' / "Sets the audit to 0" / chip); `productivity-analytics-page.tsx:169-176` ("+N pp" text vs warn chip — this td also lacks `cx-num` unlike every sibling column); `trackers-page.tsx:722-731` (chip vs name+`trk-when`). | Add `cx-num` to `productivity-analytics-page.tsx:169`; accept or opt out the others — cosmetic only. | dev |
| ux-5 | LOW | `quality-analytics-page.tsx:198-207` — "Why" td | `.qa-whylist li` is `display:flex` (quality.css:208); `text-align:center` on the td does not center flex items, so chips+reason text stay start-packed. PLAN-R2 SC1 claim "covers Why" is not visually achieved — harmless, arguably preferable (centered flex list would look worse), but the criterion is unmet as written. | None required for UX; TL/PM to note the SC wording vs actual behavior. | dev |

## Verified OK
- `.cx-select.qa-narrow { inline-size:auto }` (quality.css:84): specificity (0,3,0) beats `:root .cx-select { width:100% }` (0,2,0); 12rem cap retained; scoped to selects — `Input.qa-narrow` (audit-queue-detail:1184, renders `.cx-input`) and `.cx-field.qa-narrow` (disputes:83) untouched per SC4.
- `quality-scores-page.tsx:376`: `cx-num` only in count mode; label mode stays start per SC2.
- `quality-analytics-page.tsx:407`: Channels td `cx-num` — stacked `qa-sub` rows center per SC3.
- Chip-primary cells (Confidence cols :292/:330/:403, StatusChip+`qa-sub` status cols in audit-queue-detail/audit-queue-page:446, kb-gaps:191, ScoreChip cells) match the already-established `cx-num` chip+sub centered pattern — consistent.
- `th:has(.cx-chip)` absent; `tbody th` / `.qa-cov__name` row labels keep `text-align:start` (SC5); numeric inputs unchanged.
- Tests cover the new rules + the `th` guard + markup contracts (20/20 per tl-5).

## Not verified / assumptions
- No runtime screenshots; `:has()` breadth assessed by static scan of all 50 chip-bearing `<td>` blocks.
- ux-1..3 severity assumes notes/names render as readable multi-line content (they do per `display:block` sub classes).
