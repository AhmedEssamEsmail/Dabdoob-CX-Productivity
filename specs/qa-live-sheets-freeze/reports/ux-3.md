# ux report - qa-live-sheets-freeze - round 3 (DELTA)

Verdict: PASS        (ux-8 MED closed; only LOW polish items remain)
Open: 0B/0H/0M/4L

Scope: verified ux-8 (MED) + ux-9 (LOW) against tl-12 changed lines in
`src/features/cx-people/components/agents-page.tsx` only — the single UI file
touched this round (header/AsOfHint :391-:436, refresh notes :292-301, main-page
copy :623-:760, scoring explainer :1002). Copy-only diff: no new classes, px,
colors, or controls, so round-1/2 states/contrast/dark-mode results stand.

## Round-2 verification

- **ux-8 CLOSED** — all eight contracted sites swept to rebuild/live-tables
  vocabulary, verified in file (line numbers shifted +1-3 vs tl-12, same edits):
  - col header `Last rebuilt` (:393, beside `What was rebuilt` :392)
  - AsOfHint `what=…'Rebuilt'` (:436), `D('Live tables')` (:714)
  - refresh result `rebuilt a moment ago…` / `rebuilt N agent-days.` (:625-626)
  - purpose `…from the live tables…` both team + personal (:679-680)
  - busy label `D('Rebuilding…')` (:711)
  - coverage stat `{n} agent-days` (:760)
  - scoring explainer `computed from each month's data` (:1004)
  Residual `workbook`/`read` grep hits are code comments (:247/:255), the
  still-real workbook *link* entity (:306/:338/:367/:390/:408 — the admin
  link-mapping feature still exists), or leftovers tl-12 disclosed — tab label
  (:668) and the `workbook's log` clause (:1002), rolled into ux-10.
- **ux-9 CLOSED** — `refresh` error arm now routes `a.status === 'error'` to
  `setNoteErr` (:293-294, red `role="alert"`); success/retry arms still use
  `setNote` (:296-300). Error no longer announced as success.
- **ux-5, ux-6, ux-7 OPEN (LOW)** — still deferred, unchanged at same spots
  (behaviour inputs :469-:494 lack `name`/`autoComplete`; `Already logged.`
  :332 green `role="status"`; `.pw-field-grow` :489). Re-confirmed, not
  re-litigated.

States checked: error (ux-9 fix verified — correct alert channel), success
(setNote copy updated, reload preserved), disabled (`busyKey`/`refreshing`
gates unchanged), loading/empty/long-text/mobile/dark/keyboard/focus — no
regressions (copy-only diff; prior-round results stand).

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|----|-----|----------------------------|----------|-----------|------------|
| ux-10 | LOW | agents-page.tsx:668, :1002 | Residual stale workbook vocabulary tl-12 disclosed but didn't contract: admin tab `label: 'Workbook imports'` (:668 — nothing is imported from a workbook post-freeze; the block registers link records) and scoring explainer `one case in the workbook's log or the KPI logs` (:1002 — behaviour cases now live in `sc_behaviour`/admin form) | Optional copy pass: e.g. `'Monthly sources'`/`'Workbook links'` for the tab, and `…in the behaviour log` for :1002. Non-blocking; fold into any future fix-batch | dev |

## What passed

- Exact minimal edit set: every ux-8 fix-string applied verbatim; workbook-title
  interpolation correctly dropped from the result message.
- Consistency: `Rebuilt`/`Rebuilding…`/`Last rebuilt`/`live tables` wording now
  uniform across admin and main paths; AsOfHint `what` values match neighbours.
- No a11y regression: error→`setNoteErr` keeps messages in the correct
  `role="alert"` channel; all touched controls unchanged and labelled.
- Web Interface Guidelines: copy-only change; no new patterns introduced.

## Not verified / assumptions

- No Playwright run (copy-only diff; nothing layout-affecting changed).
- `shared.tsx:36` AsOfHint renders `{what}, read {date}…` — the generic `, read`
  timestamp verb remains; it describes fetch time, is shared with features where
  it's accurate, and was explicitly out of tl-12 scope. Not a finding.
- Server-side `m.error`/`m.title` strings may still carry workbook wording —
  out of UI-file scope (same caveat as round 2).
