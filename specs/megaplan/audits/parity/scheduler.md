# Parity report — scheduler

- legacy: `.devin/work/extract/queue/pages/scheduler.closure.js` (page symbol `Ll`)
- port: `src/features/cx-queue/components/scheduler-page` (`SchedulerPage`)
- scenario: admin, current month: 2 TLs × 3 visible day columns (AM/PM/OFF+LEAVE/manual/WFH), gaps, timeline rows, month view

| side | passes | quiesced | nodes | text nodes | class tokens |
|---|---|---|---|---|---|
| legacy | 2 | true | 145 | 43 | 34 |
| port | 2 | true | 145 | 43 | 34 |

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

- legacy gas: `schedulerPlan`
- port fetch: `GET /api/queue/scheduler?year=2026&month=10`

