# S03: Server-side filtered reads on the hot paths
Kind: package
ID: S03
Dispatch: NEVER

## Goal and contract
PLAN criterion #3: the measured whole-table `select('*')` reads become
PostgREST-filtered queries. Baseline (2026-11-08 audit): prod_intervals full
scans ~994 calls/137s, popups count 2,907/44s, qa_audits 241/41s, roster
select(*) 13,443 calls. The prod_intervals piece is largely fixed by S02
(lazy preload); this package covers the page/API readers:
tphLoadStore_ date-window filtering (S03-01/02), queue inflow + check-in
stores (S03-03/04), and qa single-row lookups (S03-05a/b). The popups
table filtering ships inside S04-02 (same file, same query family).
Invariants: response shapes unchanged; `readStore`-style missingOk/`exists`
semantics preserved via a `readStoreFiltered` helper (S03-04); where a date
column cannot be trusted for a filter, the read stays full and the deviation
is recorded in results — never guess-filter.
Non-goals: new endpoints, aggregate table changes, qa_audits write paths.

## Children
Index: `S03/00-index.md`
- tph store window + 8 route call sites: S03-01, S03-02
- cx-queue jobs.ts / pages.ts+server.ts filters: S03-03, S03-04
- cx-quality single-row lookups: S03-05a, S03-05b (same file — serial)

## Completion
All children done; every filter listed in results; any table that could not
be safely filtered carries a recorded reason.
