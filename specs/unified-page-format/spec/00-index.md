# Spec index: unified-page-format
Kind: index
Size gate: PASS

| ID | Kind | Spec path#section | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01.md | - | none | #1 #2 #6 slot API + CSS + Spinner + RefreshButton + doc | not dispatchable |
| S02 | package | S02.md | - | S01-03 | #5 #6 instant nav, no splash | not dispatchable |
| S03 | package | S03.md | - | S01-01 S01-02 | #3 #4 cx-queue pages | not dispatchable |
| S04 | package | S04.md | - | S01-01 S01-02 | #3 #4 cx-hub pages | not dispatchable |
| S05 | package | S05.md | - | S01-01 S01-02 | #3 #4 cx-quality pages | not dispatchable |
| S06 | package | S06.md | - | S01-01 S01-02 | #3 #4 cx-people pages | not dispatchable |
| S07 | package | S07.md | - | S01-01 S01-02 | #3 #4 productivity/desk/ops pages | not dispatchable |
| S08 | package | S08.md | - | S02 S03 S04 S05 S06 S07 | #3 #5 #7 e2e specs | not dispatchable |
| S09 | package | S09.md | - | S01-02 S03-01 S04-01 | #4 dead head CSS removal | not dispatchable |

Route inventory at spec time (44 `src/app/**/page.tsx`): `[...slug]` (catch-all placeholder), `auth/login`, `auth/logout` (bare, no shell) and `ecosystem` (bare `.eco3` chrome, AppShell early-return) are out of the frame contract. The other 40 routes + `/` map to `src/features/*/components/*-page.tsx` and migrate in S03–S07 batched per feature dir. `#7` (existing contracts stay green) is verified by S08 leaves + PM gates; `#8` gates are PM-run, not a shard.

Ready work: S01-01 ∥ S01-02 (parallel) → S01-03 → {S01-04 ∥ S02-01 ∥ migrations}. Same-file writers serialized: refresh.css (S01-02→S01-03→S09-01), ui/index.ts (S01-03→S01-04). Max 4 workers across migration packages.
Size gate evidence: manual review vs LIMITS.md — all 20 leaves ≤10 files, ≤10 actions, ≤5 checks, ≤2000 lines, ≤10 min; largest leaf S05-02 (6 files / ~10 min). Run `check_shards.py` on dispatch.
