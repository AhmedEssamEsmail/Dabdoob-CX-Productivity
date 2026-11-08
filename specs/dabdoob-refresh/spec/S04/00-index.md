# S04: The 9 app pages restructured to their mockups
Kind: package
ID: S04
Dispatch: NEVER

## Goal and contract
PLAN #5: 9 pages match `mockups/pages/02-10` in real wiring (login =
S03-04). Keep `D()`, bindings, skeletons, gating, e2e hooks `.cxp`/
`aria-busy` `.dq-page` `.md-page` `.pv-page` `.qa-page` `.pv-*`
`.cx-chip[data-status]` `.cx-table` `.tph-grid`, heading names; drop mock
slots lacking data. refresh.css; `.cx-*` reskins ok. No data-layer changes.

## Children
| Leaf | Region -> mock lines |
|---|---|
| S04-01 | overview: head+4 stats — 02:79-112 |
| S04-02 | overview: worklist+2 side cards — 02:114-183 |
| S04-03 | my-day: head+seg+agenda card — 03:54-75 |
| S04-04 | my-day: waiting+focus cards — 03:80-105 |
| S04-05 | queue: head+5 stats — 04:66-81 |
| S04-06 | queue: mixbar+by-queue tbl — 04:82-150 |
| S04-07 | aging: head+seg+mixbar — 05:49-71 |
| S04-08 | aging: matrix tbl+footnote — 05:83-104 |
| S04-09 | audit-queue: head+seg+queue list — 06:55-96 |
| S04-10 | audit-queue: detail card — 06:97-130 (superseded -> S04-20+S04-21) |
| S04-20 | qa-shared AuditForm -> card/tbl/seg anatomy — 06:97-130 |
| S04-21 | audit-queue: mount detail card in `.md` right (dep S04-20) |
| S04-11 | status-validation: flags card — 07:48-82 |
| S04-12 | status-validation: detail card — 07:83+ |
| S04-13 | agents: head+4 stats — 08:45-64 |
| S04-14 | agents: roster tbl — 08:73-140 (superseded -> S04-22) |
| S04-22 | agents: roster `.card` `.tbl`; `.spark`->real `.delta` vs-team (no series in payload) |
| S04-23 | my-day remainder: 5 legacy side cards -> `.card`/`.workitem` (functionality kept) |
| S04-15 | tph: head+note+5 stats — 09:49-81 |
| S04-16 | tph: cap+attention cards — 09:84-128 |
| S04-17 | tph: grid inside card |
| S04-18 | my-status: head+4 stats — 10:49-61 |
| S04-19 | my-status: flags+side cards — 10:64-105 |
## Completion
Same-page leaves serial. Shot harness re-shoot (PM) clean light+dark.
