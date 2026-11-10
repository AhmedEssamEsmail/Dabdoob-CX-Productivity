# S03: dq_hct mirror table + HCT mapping
Kind: package
ID: S03
Dispatch: NEVER

## Goal and contract
PLAN #2: create `dq_hct` and populate it from the Egypt Operations HCT sheet
(`1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw`, tab `Sheet1`) so
`dqReadHct_`/`runRosterSync` stop refusing. Contract: `readStore('dq_hct')`
does `SELECT *`, so column names must be the adapter record keys verbatim —
`name,email,position,department,section,manager,status,lwd` plus the quoted
camelCase `"hiringDate","fdId","fdName","maqsamName"`. `email` is UNIQUE
(idempotent re-import). One DB leaf + one mapping leaf (wired by S05-01).
Non-goal: applying DDL / running the import (approval gate).

## Children
Index: `S03/00-index.md`
- PLAN #2 table -> S03-01 ; mapping -> S03-02 (needs S01-01 headers)

## Completion
DDL drafted, mapping wired, `migrate-all --dry` reads the HCT tab; live run is
approval-gated (PM). Not a developer assignment.
