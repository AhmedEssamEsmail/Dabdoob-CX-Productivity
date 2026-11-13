# debug report - qa-audit-form-ui - 1

Verdict: ROOT_CAUSE_FOUND (all three defects confirmed by code inspection; defect 2 additionally proven by a failing regression test)

Repro: `npx vitest run tests/quality/audit-form-controls.test.tsx` -> exit=1,
2 failed. Test 1: "Seg radio groups must not appear in audit questions:
expected [ Array(2) ] to have a length of +0 but got 2". Test 2: "'why it
failed' must be a Select labelled by qa-why-q1: expected [] to have a length
of 1 but got +0". Defects 1 and 3 are pure CSS and verified by rule
inspection below (no DOM env in vitest config).

Root cause (overview):
- d1: `.qa-request` is a flex row (`quality.css:181-183`) where `.cx-field`
  gets `flex:1 1 10rem` but `.qa-request__why` gets `flex:3 1 16rem`; the
  controls inside are `width:100%` (`cx-kit.css:281`), so selects shrink to
  ~10rem while the two `__why` inputs grow ~3x wider. `.qa-actions` is a bare
  flex item with no width/flex rule, so the submit row looks stretched.
- d2: answer + reason controls are `Seg` radio groups rendered inside
  `<td className="num">` (`qa-shared.tsx:925-955`) whose cell is forced to
  `width:1%` by `quality.css:24`; `.cx-seg` wraps (`cx-kit.css:356-364`) and
  its radios are `opacity:0` (`cx-kit.css:382`), so option labels stack
  vertically like plain text — matches the screenshot.
- d3: `#qa-when` is a `.cx-input` (`width:100%`, `cx-kit.css:281`) inside a
  grid `.cx-field` in the `.qa-form` grid (`quality.css:9`); nothing bounds
  its inline size.

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| dbg-1 | HIGH | src/app/styles/quality.css:181-184 | `.qa-request` flex + `flex:1 1 10rem` vs `.qa-request__why{flex:3 1 16rem}` -> Type/Agent selects ~10rem, Reference/Note inputs ~3x wider; submit `.qa-actions` unstretched-rule row. Used by `NonTicketForm` (audit-queue-detail.tsx:548-637: Type L565, Reference `__why` L582 + hint L595, Agent L599, Note `__why` L616) and `RequestForm` (L161-259: ticket L187, why `__why` L200, agent L216, channel L233, actions L250). Controls `width:100%` at cx-kit.css:281. | Restyle `.qa-request` as a grid mirroring `.qa-grid` (quality.css:85-88): `display:grid;gap:var(--cx-space-3);grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));align-items:end`; `.qa-request>*{min-inline-size:0}`; `.qa-request :is(input:not([type=checkbox]):not([type=radio]),select,textarea){box-sizing:border-box;min-inline-size:0;max-inline-size:100%}`; `.qa-request .qa-request__why, .qa-request .cx-error{grid-column:1/-1}` (or span 2); `.qa-request .qa-actions{justify-self:start}` so the button keeps natural width. No markup change needed. | dev |
| dbg-2 | HIGH | src/features/cx-quality/components/qa-shared.tsx:926-935 (answer Seg), 941-953 (why Seg) inside `<td className="num">` L925 | Cell squeezed by quality.css:24 `.qa-form .cx-table :is(th,td):nth-child(n+2){width:1%}`; `.cx-seg` wraps; radios hidden (cx-kit.css:382) -> options render as stacked plain text; fail tint via quality.css:30. Proven by failing test (2 Segs in tree). | In AuditForm replace answer `Seg` with `Select`: `value={Je ?? ''}`, `onChange={_ => O(F.id, _.currentTarget.value)}`, `aria-label={F.text}`; children = `<option value="">` + `da.map(le => <option value={le}>{QA_ANSWER[le]}</option>)`. Keeps `missing` gating (`''` is not pass/fail/na -> missing in qaScoreAnswers L638/L662) and `da` Pass/Fail-only fatal logic (L886-891). Replace why `Seg` with `Select`: `value={f[F.id] ?? ''}`, `onChange={_ => g(ha => ({...ha,[F.id]:_.currentTarget.value}))}`, `aria-labelledby={\`qa-why-${F.id}\`}`; `<option value="">` + QA_WHY options; `A` gating (L750 `!f[N]`) unchanged since `''` is falsy. Then quality.css:30 becomes dead -> restyle as `[data-answer=fail] .cx-select` border/text tint or drop the rule; L24 may stay (selects shrink-to-fit) or narrow to `:nth-child(2)`. | dev |
| dbg-3 | MED | src/features/cx-quality/components/qa-shared.tsx:825-832 (`Input id="qa-when"`) + cx-kit.css:281 | `.cx-input{width:100%}` fills grid `.cx-field` (cx-kit.css:253) inside `.qa-form` grid -> input spans full panel width; no `#qa-when` rule exists in quality.css. | Add `[data-app="quality"] #qa-when{inline-size:auto;max-inline-size:100%}` in quality.css near the `.qa-form` block (label + `required` already present, untouched). | dev |

Regression test: `tests/quality/audit-form-controls.test.tsx` — status:
failing now for the right reason (vitest exit=1; asserts zero `Seg` and
`<select>` answer/why controls with empty option, accessible names, and
fatal-question Pass/Fail-only options). Post-fix it must pass.

Siblings:
- `AuditForm` (qa-shared.tsx:701) is shared by all audit flows:
  audit-queue-page.tsx (queue audits), audit-queue-coverage.tsx:183
  (`askReasons`, non-ticket/off-queue), calibration-page.tsx:293. One fix in
  qa-shared.tsx covers every audit form.
- `.qa-request` consumers: only `RequestForm` and `NonTicketForm`
  (audit-queue-detail.tsx:162, 549) — the single CSS change fixes both.
- `Seg` legitimately remains for `BasisSeg` (qa-shared.tsx:1340), CTL
  pickers and tabs (PLAN non-goals) — do not sweep `.cx-seg` globally;
  scope the dead-rule cleanup at quality.css:30 to `.qa-q`.
- Risk check: submit-button disabled math (`C.missing`, `A`, `b`) and the
  `Z` submit payload (qa-shared.tsx:758-774) depend only on state keys —
  `'pass'|'fail'|'na'|''` and `f[qid]` — so Select swaps cannot regress
  scoring, `missing`, or payload shape. `v(z,...)` skip-section (L740-748)
  unaffected.
