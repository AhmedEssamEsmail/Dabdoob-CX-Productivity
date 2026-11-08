# Spec index: perf-remediation
Kind: index
Size gate: PASS

| ID | Kind | Spec/index path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01/00-index.md | - | none | #1 auth chain | not dispatchable |
| S02 | package | S02/00-index.md | - | none | #2 job env lazy loads | not dispatchable |
| S03 | package | S03/00-index.md | - | S02-01 | #3 server-side filtered reads | not dispatchable |
| S04 | package | S04/00-index.md | - | none | #4 batched writes | not dispatchable |
| S05 | package | S05/00-index.md | - | S01-02, S04-02 | #5 merged 60s poll | not dispatchable |
| S06 | package | S06/00-index.md | - | S01-02 | #6 __CC_BOOT__ + lazy options | not dispatchable |
| S07 | package | S07/00-index.md | - | none | #7 uniques + indexes | not dispatchable |
| S08 | package | S08/00-index.md | - | S04-01, S03-01 | #8 service role + RLS lockdown | not dispatchable |
| S09 | package | S09/00-index.md | - | S02-03 | #9 vercel crons + tph budget | not dispatchable |
| S10 | package | S10/00-index.md | - | S07-03, S08-01 | #10 shared my-day cache | not dispatchable |
| S11-01 | mini | S11/01-architecture-cron-doc.md | tech-writer | S09-01 | #11 docs (ARCHITECTURE.md cron table) | 1/2/20/4 |

Ready work (dependency-ready now; same-file writers serialized; max 4 workers):
S01-01, S01-02, S02-01, S03-03, S03-05a, S04-01, S04-02, S06-01, S07-01, S09-01.
Gates (PM-run, not shards): `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`,
`npm run test:security`, `next build`; perf budgets verified post-deploy.
Conventions for all leaves: no package.json/lockfile/.env edits; lazy-init env
clients; migration FILES only (remote apply needs user approval); Next APIs
differ from training — cite `node_modules/next/dist/docs/` where noted.
Size gate evidence: every leaf manually checked vs LIMITS.md (<=10 files,
<=10 actions, <=5 checks, <=2000 lines, <=10 min); `check_shards.py` to be
run by PM/TL before dispatch. No NEEDS_USER.
