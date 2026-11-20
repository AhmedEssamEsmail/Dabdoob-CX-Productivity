# ux report - ui-label-size-sweep - round 1 (FULL)

Verdict: PASS
Open: 0/0/0/3

States checked: loading/busy labels kept (`Skipping…`, `Waiving…`, `Saving…`, `Adding…`), disabled, long text (60ch caps + `overflow-wrap` siblings), mobile (`max-inline-size:100%` on every cap), keyboard/focus (unchanged, native controls), label association (`htmlFor`/`Field` wrapper verified on all touched fields). Not rendered-checked: see below.

## Scope reviewed
All 24 applied autofix changes (diff vs HEAD): 12 textarea `rows` props, 7 `size="sm"` buttons, 1 rows+60ch precedent item, 4 scoped CSS width caps. Verified each selector/prop against the live DOM nesting and the FINDINGS spec; `propose` findings confirmed not applied (`chk-note`, `.other-row`, L-class renames).

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | L | `src/app/styles/people.css:36` vs `one-on-ones-views.tsx:1746,1761`, `tl-tasks-page.tsx:777` | `.pw-textarea{min-height:72px}` floors ~3 lines, so `rows={2}` changes nothing visually; sibling convention `pw-textarea--short` (`people.css:311`) already used at `one-on-ones-views.tsx:1353` | If visible compaction was intended, pair `rows={2}` with `className="pw-textarea pw-textarea--short"`; otherwise accept as attribute hygiene | dev |
| ux-2 | L | `audit-queue-detail.tsx:77,83` (PassForm toasts) | Foreign qa-audit-footer-compact hunk renamed the submit to `Confirm skip`/`Skipping…`, but success copy still reads `Passed #…` / `was passed` — button↔feedback vocabulary mismatch inside the same form the sweep resized | Align toast copy to "Skipped #…" in the owning spec (qa-audit-footer-compact); do not edit from this spec — foreign hunk | dev |
| ux-3 | L | `audit-queue-detail.tsx:307` (WaiveForm submit) | `Confirm waive` uses "waive" as a noun; clear meaning but awkward copy on a now-sm button | Optional: `Confirm waiver` | dev |

## Pass notes
- **Consistency**: all fixes verbatim-port the `#qa-comment` precedent (`rows` + scoped `max-inline-size:60ch` + `size="sm"`); selectors confirmed against DOM: `.qa-card--strip .qa-detail textarea` (disputes:150/171), `.qa-ctlbox textarea` (my-audits:74), `#kb-d` (kb-gaps:128). `.qa-form__foot`/`.qa-actions` sm pairs match the audit-form footer precedent; inline `Add question`/`Add section` staying md mirrors the reference form's mix.
- **G2 rubric honoured**: sm applied only to footer/confirm pairs, not row CTAs (those are the deferred propose item).
- **C-group caps**: `inline-size:auto;max-inline-size:100%` on date/number/short inputs only — `type="url"` and text inputs in `.trk-form` correctly excluded; `hol-date` (`.dq-holform`, already ~16rem cell) correctly left alone per inventory.
- **A11y**: labels programmatically associated everywhere touched (`htmlFor`/`Field` auto-id clone). `.cx-btn--sm` min-height 1.9rem (30.4px) ≥ 24px target (2.5.8). Busy/disabled states, `role="alert"` errors, `aria-expanded` on Deny all preserved. No color/motion/semantics changes.

## Not verified / assumptions
- Rendered 375/320px reflow and focus-visible appearance not screenshot-verified; judged from code (all caps carry `max-inline-size:100%`; focus styles inherited unchanged).
- `rows={2}` on `.cx-textarea` fields (checkins `#gen`/`#help`, status-validation `rs-`) equals the UA default — no visual delta; accepted as the spec'd hygiene fix. `rows={3}`/`{4}` items (my-actions, coaching, meetings, tl-tasks desc/expectation) render slightly *taller* than before — matches FINDINGS' intent for paragraph-length inputs.
- Foreign dirty hunks (`.qa-whylist li`, quality-analytics Status column, `jobs.ts`, `hub-fakes.ts`) excluded per PLAN Conventions.
