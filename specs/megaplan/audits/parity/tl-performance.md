# Parity report — tl-performance

- legacy: `.devin/work/extract/desk/pages/tl-performance.closure.js` (page symbol `yr`)
- port: `src/features/cx-desk/components/tl-performance-page` (`default`)
- scenario: admin viewing first TL: team KPI scores, 3 responsibility areas (one rated-below w/ note, KB area w/ kb metrics), OTD, 2 projects, queue days, mail

| side | passes | quiesced | nodes | text nodes | class tokens |
|---|---|---|---|---|---|
| legacy | 3 | true | 348 | 139 | 30 |
| port | 3 | true | 348 | 139 | 30 |

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

- legacy gas: `tlPerformancePage`
- port fetch: `GET /api/tl/page?tl=`

