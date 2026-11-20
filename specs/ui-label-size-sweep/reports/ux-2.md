# ux report - ui-label-size-sweep - round 2 (DELTA)

Verdict: PASS
Open: 0/0/0/3

States checked: busy labels preserved (`Skipping…`, `Waiving…`, `Rebuilding…`, `Adding…`, `Submitting…`, `Checking Gmail…`), disabled on every new `size="sm"` button, error (`role="alert"`/`field-error`/`ErrMsg` untouched), long text (Seg `flex-wrap` + 60ch/28rem caps, all caps carry `max-inline-size:100%`), keyboard/focus (native radios/buttons, `focus-visible` rings unchanged, `aria-expanded`/`aria-pressed` kept), label association (`htmlFor` verified on `dn-`, `nh-`, `qa-access-find`; Seg radiogroup `aria-label`). Not rendered-verified: see below.

## Prior findings (DELTA verification)
- **ux-1 — CLOSED.** `.pw-textarea--short` + `rows={2}` now applied at `tl-tasks-page.tsx:777`, `one-on-ones-views.tsx:1746,1761`. Floor is `people.css:311` `min-height:3.5rem` — real visual compaction, matches `oo-views:1353` precedent.
- **ux-2 — still open (LOW, foreign-owned).** `audit-queue-detail.tsx:77,83` toasts still read `Passed #…` / `was passed` while the same form's submit now reads `Confirm skip`/`Skipping…` (foreign qa-audit-footer-compact hunk, kept intact per PM ruling).
- **ux-3 — still open (LOW).** `audit-queue-detail.tsx:306` `Confirm waive` unchanged; `size="sm"` added around it.

## Scope reviewed this round
Full working-tree diff vs HEAD (30 files, ~109 ins): S04 labels, S05 row-CTA `size="sm"` convention, S06 pair fixes + scoped CSS. All DECISIONS rows verified verbatim: disputes Seg labels (`Uphold dispute: void the audit`/`re-score`/`Reject dispute`, escalate untouched), `Deny: it did not happen`, mail-desk `Approve`/`Reject` (ConfirmInline copy untouched), `Mark done`, `If` aria-label `Jump to up next (Now|Next: <at>)` forwarded via Button `{...rest}`. Every listed `.qa-actions`/`.sch-actions`/card/row CTA now `size="sm"`; `.cx-btn--sm` 1.9rem ≥ 24px target (2.5.8). S06 CSS lands exactly as pinned: `#ctl-reason,#ctl-notes{min-block-size:auto}`, `.chk-note[id$="-n"]{min-block-size:auto}` (matches sole `q-*-n` textarea, floor kept for other users), `.chk-grid .cx-num` cap on the agents-now input, `#ctl-ref`, `#qa-access-find{max-inline-size:28rem}`, `[id^="hd-mobile"|"hd-hr"]` cap matching actual ids, and the `:root .other-row :is(.cx-btn,.btn){justify-self:start}` rule.

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-2 | L | `audit-queue-detail.tsx:77,83` | Toast `Passed #…` / `was passed` vs `Confirm skip` button — vocabulary mismatch inside the resized form; owned by sibling spec | Align toast copy to `Skipped` in qa-audit-footer-compact; do not edit here | dev |
| ux-3 | L | `audit-queue-detail.tsx:306` | `Confirm waive` uses "waive" as a noun on a now-sm button | Optional: `Confirm waiver` | dev |
| ux-4 | L | `queue.css:260` `.chk-grid .cx-num` | Selector also matches `td.cx-num` in the earlier-checkins panel (`checkins-page.tsx:208`); `inline-size:auto` is a no-op on `td` so zero visual delta | Optional: scope to `.chk-grid :is(input,select).cx-num` for hygiene | dev |

## Pass notes
- **Consistency**: `.other-row` rule applies to all 5 identical "Other… input + Add choice + Cancel" sites (qa-shared:473, pw.tsx:322, queue shared.tsx:567, plus the 2 DECISIONS named) — uniform, better than the named subset; same pattern, same fix.
- **mail-desk**: `Approve`/`Reject`/`Send reply only` all `size="sm"`, imperative verbs; confirm dialog copy (`Send now`/`Record decision` + question text) unchanged per DECISIONS.
- **disputes Seg**: `.cx-seg` is `inline-flex;flex-wrap;max-inline-size:100%` — the longer labels wrap cleanly, no overflow; each radio's accessible name comes from its wrapping label.
- **my-audits**: `Deny: it did not happen` toggle keeps `aria-expanded`; the reveal textarea `nh-` has `htmlFor` label + `rows={2}`, submit `size="sm"` — matches card-action convention.
- **checkins**: `.chk-grid .cx-num` hits only the intended `q-*-ag` input (the conditional corrected-count input at :153 lives in `.cx-readout`, correctly not capped).
- **meetings**: `Log N actions` now `sm` beside already-`sm` `Add another action` — mix resolved.
- **a11y**: `If` aria-label now carries the action verb (4.1.2/2.4.6 improvement); busy/disabled/`aria-pressed`/`aria-expanded` all preserved.

## Not verified / assumptions
- Rendered 375/320px reflow and focus-visible appearance judged from code only (every cap carries `max-inline-size:100%`; `.cx-seg` wraps; focus styles inherited unchanged).
- Foreign hunks excluded per PLAN: `quality-analytics-page.tsx` Status-column split + `.qa-whylist` CSS rewrite, PassForm label hunk, `jobs.ts`/`hub-fakes.ts`.
- `rows={3}`/`{4}` textareas (meetings, coaching, my-actions, tl-tasks desc/expectation) render taller — round-1 accepted per FINDINGS intent; no new delta.
- qa-2 test files (`tests/quality/ui-label-sweep*.test.tsx`) are test-engineer scope, not UI.
