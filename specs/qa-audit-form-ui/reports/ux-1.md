# ux report - qa-audit-form-ui - round 1 (FULL)

Verdict: FAIL
Open: 0B/0H/2M/4L

States checked: empty (blank answer option), error (`.cx-error` + `role=alert`
in both forms), disabled (submit gating with reason text "(N left)" /
"(interaction time needed)"), long text (question wraps, no overflow),
mobile 375 + desktop 1024 (real stylesheets mounted in Chromium —
`logs/ux-check.cjs` harness, `ux-375.png`/`ux-1024.png`), keyboard (native
selects/buttons + `TableScroll` `tabindex=0` region), focus (CSS rule
verified), dark (token-inspected, all values themed).

| ID | Sev | file:line / element | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | MED | `src/app/styles/quality.css:10` (`#qa-when`) | The rule is a no-op: the input sits in `.cx-field` which is `display:grid` (`cx-kit.css:253`), so `justify-self:normal→stretch` still fills the column regardless of `inline-size:auto`. Mounted with real stylesheets: measured 924px wide at 1024px and 323px at 375px — still full panel width; PLAN Expected #3 unmet. | Add `justify-self:start` to the `#qa-when` rule (or use `inline-size:fit-content`). | dev |
| ux-2 | MED | `src/app/styles/quality.css:25` + `qa-shared.tsx:926-963` | `width:1%` on the Answer `td` plus `.cx-select{width:100%}` shrinks the selects to 53px at both 375 and 1024 (measured). Selected "Fail" visibly clips to "F" (ux-1024.png); the "why" select clips "Process" similarly; an unanswered select is a blank 53px box — barely reads as a control. | Give the answer/why selects intrinsic width: `.qa-form .qa-q .cx-select { inline-size:auto; min-inline-size:6.5rem }` (cell expands; `TableScroll` covers any 375px overflow). Optional: label the empty `<option value="">` `—` instead of a blank row (sibling selects use "Choose…"). | dev |
| ux-3 | LOW | `src/app/styles/quality.css:97` | `@media(max-width:40rem){ .qa-score{justify-items:start} }` is dead — `.qa-score` is now `display:flex`; `justify-items` is ignored. | Drop the declaration. | dev |
| ux-4 | LOW | `qa-shared.tsx:926-954` | Why-select gets `aria-required="true"`; the answer select doesn't, though both gate submit. | Add `aria-required="true"` to the answer Select for parity. | dev |
| ux-5 | LOW | `quality.css:182` + `audit-queue-detail.tsx:565-632` | `.qa-request` grid works (uniform tracks, natural-width button, no h-scroll), but because `qa-request__why` fields span 1/-1 between them, Type and Agent each sit alone on a row at ~301px (measured @1024) with ~600px whitespace; sibling `.qa-grid` forms pack narrow fields adjacently. | Optional polish: order narrow selects adjacently in DOM so they share a row, or accept. | dev |
| ux-6 | LOW | `qa-shared.tsx:933,956` | `<option value="" />` renders an entirely blank row in the dropdown (ambiguous next to "Choose…"-style placeholders used by sibling selects). | Give it text like `—` or `Unanswered`; value stays `""` (test still passes). | dev |

Contrast (measured from token values): fail text `#b3261e`/surface ≈ 6.5:1;
fail select border `#d9483f`/surface ≈ 4.2:1; `.qa-score[data-status=bad]`
fg/bg ≈ 5.5:1; `.cx-faint` (`--cx-ink-3`) ≈ 5.5:1 — all ≥ required. Focus:
`.cx-select:focus-visible` sets `--cx-focus` border + 4px ring (`--cx-focus`
#2f6fed vs surface ≈ 4.5:1). Selects' accessible names verified in markup
(`aria-label={F.text}`, `aria-labelledby=qa-why-*`). `aria-live="polite"` on
`.qa-score` retained. No horizontal scroll at either width; table reflows
(289px at 375) without needing the scroll region.

Not verified / assumptions: fragment harness (real theme→cx-kit→refresh→
quality.css) rather than the live routed page — actual page padding/context
may differ slightly; `:focus-visible` modality not triggered in harness
(rule verified in source); dark mode and forced-colors code-inspected only;
200% text zoom not tested; `qe-fd-cache` baseline failure unrelated.
