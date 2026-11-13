# ux report - qa-audit-form-ui - round 2 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/3L (all LOW deferred per tl-3 — logged only)

States checked: empty (blank answer option), error/disabled (submit gating
"(2 left)"), long text (question wraps), mobile 375 + desktop 1024 (real
stylesheets remounted in Chromium — rebuilt `logs/ux-check.cjs`,
`logs/ux2-375.png`/`ux2-1024.png`), keyboard/focus/dark (unchanged from
round 1 — no related diffs).

## Prior findings re-verified

| ID | Sev | Status | Evidence (measured, Chromium) |
|---|---|---|---|
| ux-1 | MED | FIXED | `quality.css:10` now `justify-self:start;inline-size:auto;max-inline-size:100%`. `#qa-when` = 203px at BOTH 375 (field 323px) and 1024 (field 972px) — content-sized, no longer full panel width. PLAN Expected #3 met. |
| ux-2 | MED | FIXED | `quality.css:26` `.qa-form .qa-q .cx-select{inline-size:auto;min-inline-size:6.5rem}`. All answer/why selects = 104px at both widths (was 53px). "Fail" and "Agent" render fully; empty select reads as a control (ux2-1024.png). No page h-scroll at either width (scrollWidth == innerWidth); at 375 the `tblscroll` region absorbs minor overflow — focusable + `aria-label`led. |
| ux-3 | LOW | OPEN (deferred) | `quality.css:98` dead `justify-items` on flex `.qa-score` — unchanged, tracked in TRACKER. |
| ux-4 | LOW | FIXED | `qa-shared.tsx:932` answer `Select` now carries `aria-required="true"`, parity with why-select. |
| ux-5 | LOW | OPEN (deferred) | `.qa-request` narrow-field row-packing polish — unchanged, tracked. |
| ux-6 | LOW | OPEN (deferred) | blank `<option value="">` text — unchanged, tracked. |

## New issues in changed code

None. The two new/changed rules reuse `--cx-*` tokens and the existing
`.tblscroll` overflow affordance; no ad-hoc values, no new controls, no
state regressions. `qa-score` compact restyle (PLAN #4) was already in
place — `.qa-score__num` measured 17px (`--cx-text-lg`), inline with the
footer actions.

Not verified / assumptions: fragment harness (real theme→cx-kit→refresh→
quality.css), not the routed page; live-page padding may differ slightly.
375px horizontal scrolling of the questions table happens inside the
labelled `tblscroll` region (WCAG 1.4.10 permits single-axis scroll).
Dark mode / forced-colors unchanged since round 1 (code-inspected only).
