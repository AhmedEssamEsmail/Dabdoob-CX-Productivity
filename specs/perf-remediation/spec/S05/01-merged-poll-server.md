# S05-01: GET /api/popups returns { popups, alerts, now } from one auth chain
Kind: mini
ID: S05-01
Parent: S05
Owner: dev
Depends: S01-02, S04-02
Criteria: PLAN #5 (one polled endpoint, one auth chain per 60s tick)
Skills: none
Budget: files=3; actions=4; changed_lines=80; minutes=7

## Goal
The single client poll hits `GET /api/popups` and receives both open popups
and due 1:1 alerts, computed off ONE `currentEmail()`. `oneOnOneAlerts`
gains an `oneOnOneAlertsFor(email)` variant; `GET /api/alerts/one-on-one`
is removed (POST stays for dismissals).

## Files
- Edit: `src/features/shared/platform/notify.ts` | split `oneOnOneAlerts` (231-261) into `oneOnOneAlertsFor(email)` + a thin `oneOnOneAlerts()` wrapper
- Edit: `src/app/api/popups/route.ts` | merged GET payload
- Edit: `src/app/api/alerts/one-on-one/route.ts` | delete the GET handler; keep POST

## Context
- `src/features/shared/platform/notify.ts:231-261` | body to extract; it calls `currentEmail()` internally today
- `src/features/shared/platform/popups.ts:121-141` | `popupsPoll(email)` — takes the email, composes inside the merged route
- `src/app/api/popups/route.ts` | current thin GET (currentEmail -> popupsPoll)
- `src/app/api/alerts/one-on-one/route.ts` | GET to remove, POST (oneOnOneAlertsSeen) to keep
- `src/features/shared/platform/index.ts` | barrel `export *` — add nothing unless needed (notify.ts already `export *`-ed if it is; check before adding)

## Contract
- `oneOnOneAlertsFor(email: string)` = today's `oneOnOneAlerts` body minus the `currentEmail()` line; `oneOnOneAlerts()` remains a working wrapper (existing callers/tests).
- `GET /api/popups` -> `{ popups, alerts, now }` where popups comes from `popupsPoll(email)`, alerts/`now` from `oneOnOneAlertsFor(email)`; `currentEmail()` called ONCE.
- Error mapping unchanged (401 'Unauthorized' else 403/500); `remindersOn()` gates already inside both callees.
- No GET handler remains on /api/alerts/one-on-one.
Out of scope: client components (S05-02), popups.ts internals, seen POST logic.

## Actions
1. notify.ts: extract `oneOnOneAlertsFor(email)`; keep `oneOnOneAlerts()` delegating via `currentEmail()`.
2. platform barrel: export `oneOnOneAlertsFor` if the file isn't already covered by `export *` (check index.ts line for './notify').
3. api/popups route: build the merged payload from one `currentEmail()`.
4. api/alerts/one-on-one route: remove GET; leave POST untouched.

## Done when
- GET /api/popups payload contains popups + alerts + now; exactly one currentEmail() call in the route.
- GET /api/alerts/one-on-one returns 405/404 (handler gone); POST still accepts `{keys}`.
- `npx tsc --noEmit` clean; `npx vitest run tests/platform/notify.test.ts tests/golden/reminders-off-alerts.test.ts` green.

## Verify
- Run: `npx vitest run tests/platform/notify.test.ts tests/golden/reminders-off-alerts.test.ts` -> all pass.

## Handoff
Client contract for S05-02: `GET /api/popups` => `{ popups: ShellPopup[],
alerts: OneOnOneAlert[], now: string }`. Write results/S05-01.md (<=10 lines);
TL alone updates TRACKER.md.
