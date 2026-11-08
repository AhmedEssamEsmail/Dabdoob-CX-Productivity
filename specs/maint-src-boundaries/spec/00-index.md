# Spec index: maint-src-boundaries
Kind: index
Size gate: PASS

| ID | Kind | Spec/index path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01/00-index.md | - | - | #1 fetchJson single shared home | not dispatchable |
| S02 | package | S02/00-index.md | - | - | #2 grid-slots ownership | not dispatchable |
| S03 | package | S03/00-index.md | - | - | #3 server-only boundary (88 files) | not dispatchable |
| S04 | mini | S04-qa-typing.md | dev | none | #4 QA dispatcher `as never` casts | 2/2/35/10 |
| S05 | package | S05/00-index.md | - | S01-03, S01-04 | #5 thin routes | not dispatchable |
| S06 | package | S06/00-index.md | - | S03-01 | #6 fixture-only test suites | not dispatchable |
| S07 | package | S07/00-index.md | - | S02-02 | #7 boundaries docs + eslint guard | not dispatchable |

Ready work: `S03-01` (foundation), `S01-01`, `S02-01`, `S04`, `S05-05`, `S05-06`.
Marking leaves S03-02..32 unblock after S03-01; max 4 workers; no two leaves
share an edit file (page files serialize S01-03/04 -> S05-01..04; test-file
halves serialize S06-02->S06-04, S06-03->S06-05 via Depends).

Size gate evidence: manual review vs LIMITS.md — every leaf ≤3 named files /
≤3 actions / ≤200 authored lines / ≤10 min (checker cap). Moved page/component bodies and the
grid-slots copy are verbatim relocations; leaves declare authored lines only.
PM/TL preflight: `python "%APPDATA%\devin\skills\spec-sharding\check_shards.py" <leaf paths>`.

Hard forbiddens (PLAN): `package.json`/lockfile, `.env*`, `cx-kpis-*.json`,
`shared/components/shell/registry.ts`, `src/app/globals.css`, `vercel.json`,
`tests/golden/helpers-oracle.ts`, `scripts/oracle.mjs`. No new deps: `server-only`
is handled inside Next's webpack (`node_modules/next/dist/compiled/server-only/`).
