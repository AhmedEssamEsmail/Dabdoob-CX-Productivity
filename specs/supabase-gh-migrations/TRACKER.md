# TRACKER: supabase-gh-migrations
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree at TL start (pre-existing, NOT shard scope — never revert):
`M specs/megaplan/migration-report.md`, `M specs/perf-remediation/TRACKER.md`,
`M src/features/shared/migration/engine.ts`, `M .../mappings/{desk-operations,
people-core,queue-quality,route-core}.ts`, untracked: `docs/UX-UI Improvement
v2.md`, `reports/`, `results/`, `specs/megaplan/audits/migration-run-2.md`,
`specs/migration-remaining/`, `specs/supabase-gh-migrations/`,
`specs/ux-ui-audit-v2/`, `src/features/shared/migration/mappings/{hct,ops-tabs,
v1-ops-misc,v1-ops-people,v1-ops-sched,v1-ops}.ts`, 6 untracked
`supabase/migrations/20261109*.sql`, `tests/lib/migration-*.test.ts`.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | in-progress | children 01/02 verified; 03 PM-gated |
| S01-01 | mini/S01 | dev | none | 10/4/10/8 | PASS (struct+semantic) | verified | results/S01-01.md — 10 R renames, 0 mods; final_v(010)=20261105172448 |
| S01-02 | mini/S01 | dev | S01-01 | 6/6/15/10 | PASS (struct+semantic) | verified | results/S01-02.md — 4 R + del APPLY_PENDING + workflow bullet; all 28 conform |
| S01-03 | mini/S01 | supabase-expert | S01-02 + PM gate (user `supabase link` + remote-write approval) | 1/5/30/10 | PASS | verified | results/S01-03.md + remote-history.md; 14 marked applied, 32 ghost rows reverted, db push dry-run = only domain-gate pending |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| preflight | shard size | `python check_shards.py spec/S01.md#{S01-01,S01-02,S01-03}` | PASS (structure; semantic OK vs LIMITS.md) |
| integration | filename regex | `ls supabase/migrations` non-`^\d{14}_.+\.sql$` count | PASS — 0 non-conforming of 28 |
| integration | typecheck | `npx tsc --noEmit` (log: results/gate-tsc.log) | PASS — exit 0 |
| integration | lint | `npx eslint .` (log: results/gate-eslint.log) | PASS — empty output |
| final | remote migration list diff | `npx supabase migration list --remote` | PASS — 28 rows: 27 applied, 1 pending, 0 remote-only (results/migration-list-after.txt) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|

## Blocked / needs user
- S01-03: requires user-side `npx supabase link --project-ref uugeyulccyytvgcabzzx` + explicit remote-write approval. PM-gated; TL does not dispatch.
