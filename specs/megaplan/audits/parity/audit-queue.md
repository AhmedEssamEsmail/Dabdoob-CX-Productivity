# Parity report — audit-queue

- legacy: `.devin/work/extract/quality/pages/audit-queue.closure.js` (page symbol `qs`)
- port: `src/features/cx-quality/components/audit-queue-page` (`default`)
- scenario: admin opens own desk (who=*, readOnly=false): 4 queue rows across open/in_progress/done/non-ticket, 2 active forms, fail-memory, quota weeks, passed list, requests, import stamp

| side | passes | quiesced | nodes | text nodes | class tokens |
|---|---|---|---|---|---|
| legacy | 3 | true | 465 | 169 | 40 |
| port | 3 | true | 465 | 169 | 40 |

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

- legacy gas: `getQaQueuePage`
- port fetch: `POST /api/qa/getQaQueuePage`

