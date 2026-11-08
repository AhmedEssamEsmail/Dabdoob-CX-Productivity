# S05: One merged 60s poll — popups + 1:1 alerts
Kind: package
ID: S05
Dispatch: NEVER

## Goal and contract
PLAN criterion #5: `/api/alerts/one-on-one` GET and `/api/popups` GET merge
into ONE polled endpoint — one auth chain and one payload per 60s tick per
tab. Server: `/api/popups` GET returns `{ popups, alerts, now }` computed
from a single `currentEmail()` (already request-memoized by S01-02);
`oneOnOneAlerts` gains an email-taking variant. The `/api/alerts/one-on-one`
GET is removed; its POST (seen/dismiss) stays. Client: `Popups.tsx` owns the
single 60s poller and hands `alerts` to `OneOnOneAlerts` as a prop.
Invariants: alert shapes (OoAlert/ShellPopup), dismiss/chime/seen behavior,
remindersOn() gates. Non-goals: Realtime push (PLAN non-goal), poll interval
changes.

## Children
Index: `S05/00-index.md`
- server merge: S05-01 | client merge: S05-02

## Completion
Both done; one network request per 60s tick serves both widgets.
