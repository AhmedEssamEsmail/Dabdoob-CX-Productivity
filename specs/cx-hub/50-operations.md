# Shard 50 — Operations & Trackers module (`features/cx-operations`)

> Priority 6. Scope L. Legacy dir: `Operations_deprecated/` (`CC_APP="operations"`).
> Depends on: 02 extraction, shared platform.

## Pages (registry: group `operations`, tone `system`, default `trackers`)

| Route | Title | Roles | Reqs |
|---|---|---|---|
| `trackers` | Trackers | admin, tl, agent | 16 |
| `escalation-matrix` | Escalation matrix | admin, tl | 10 |

## Public server API (verbatim, `Trackers.js`)

`getTrackersPage`, `getTrackerRecords`, `addTrackerRecord`, `addTrackerField`, `updateTrackerField`, `createTracker`, `setupTrackers`

## Tables (`009_operations.sql`)

- `Trackers` (`TRACKERS_HEADERS`: tracker_id, name, storage_mode, spreadsheet_id, tab_name, header_row, access_mode, …)
- `TrackerFields` (`TRACKER_FIELDS_HEADERS`: field_id, tracker_id, position, label, column_header, type, required, …)

## Notes / open discovery

- `storage_mode` + `spreadsheet_id`/`tab_name`/`header_row` indicate trackers can read rows live from a configured sheet OR store internally — port both modes; internal mode writes to Supabase tables, sheet-backed mode reads via the sheets adapter (read-only source — flag under D-GOOGLE if it needs live Sheets API; migrate data where possible per owner rule).
- `escalation-matrix` has no dedicated server file — it is either a tracker instance (storage_mode record in `Trackers`) or its server fns live inside `Trackers.js`/bundle calls; confirm during extraction which `google.script.run` fn the page invokes; if none, build page on the trackers API.
- Dropdown keys like `tracker.promocodes.reason` integrate with the shared Options service.

## Feature map

```
features/cx-operations/lib/{trackers,fields,records,escalation}.ts
app/{trackers,escalation-matrix}/page.tsx
app/api/trackers/{page,records,fields}/route.ts
```

## Gates

- Golden tests for field typing/validation (`addTrackerField`, `updateTrackerField` type coercion per `type`), access_mode enforcement, record CRUD ordering.
- Parity shots for trackers list + record grid + escalation matrix.
