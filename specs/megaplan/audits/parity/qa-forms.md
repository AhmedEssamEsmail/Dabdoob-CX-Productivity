# Parity report — qa-forms

- legacy: `.devin/work/extract/quality/pages/qa-forms.closure.js` (page symbol `yl`)
- port: `src/features/cx-quality/components/qa-forms-page` (`QaFormsPage`)
- scenario: two forms (weighted Call v3 + deduction placeholder Cash-refund v1), one non-ticket audit type, three channels

| side | passes | quiesced | nodes | text nodes | class tokens |
|---|---|---|---|---|---|
| legacy | 3 | true | 63 | 25 | 16 |
| port | 3 | true | 63 | 25 | 16 |

## Verdict: **MATCH** — no divergence on any axis

### Classes only in legacy (0)

_none_

### Classes only in port (0)

_none_

### Copy only in legacy (0)

_none_

### Copy only in port (0)

_none_

### Render errors (0)

_none_

### Structure (element add/remove/reorder) (0)

_none_

### Attribute diffs (0)

_none_

### Text diffs (matched position) (0)

_none_

### Calls made

- legacy gas: `getQaFormsPage`
- port fetch: `POST /api/qa/getQaFormsPage`

