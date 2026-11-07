# Parity report — meetings

- legacy: `.devin/work/extract/people/pages/meetings.closure.js` (page symbol `pa`)
- port: `src/features/cx-people/components/meetings-page` (`MeetingsPage`)
- scenario: tl with 2 series (BR chaired by me w/ 2 meetings + open actions, team meeting by other chair), 2 open my-actions, 3 people

| side | passes | quiesced | nodes | text nodes | class tokens |
|---|---|---|---|---|---|
| legacy | 4 | true | 74 | 24 | 29 |
| port | 4 | true | 74 | 24 | 29 |

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

- legacy gas: `meetingsPage`
- port fetch: `GET /api/people/meetings`

