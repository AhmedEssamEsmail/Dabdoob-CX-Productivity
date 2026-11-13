# tl-3 report — fd-direct-mirrors FIX round (qa-1 findings)

Input: `reports/qa-1.md` (FAIL, 0B/1H/2M/2L). Routed by finding Owner;
spec `spec/fix-qa-1.md` (3 leaves, check_shards.py PASS all three).

## Completed leaves (changed files for reviewer DELTA scope)

| Leaf | Finding | Files changed | Evidence |
|---|---|---|---|
| qa1-01 (data-engineer) | qa-1 MED dedupe_key re-key gap | `migration/reset-fd-activities.ts` (new, 118 ln) | `--dry` exit 0: `rows=404915 watermark_present=true`; wipe+watermark-delete CLI (QA's "wipe fd_activities" option) — `--write` NEEDS_APPROVAL, then `run-fd-mirror.ts --write` rebuild at cutover |
| qa1-02 (dev) | qa-2 MED roster error swallowed | `src/features/shared/jobs/mirrors.ts:78-79`, `tests/jobs/mirrors.test.ts` | `fdActivityRosterNames_` throws `described(error,{step:'roster directory'})`; `h.rosterErr` seam + regression test (per-table error, zero upserts); mirrors 10/10 |
| qa1-03 (dev) | qa-3 HIGH vitest RED | `tests/perf/audit-queue-memo.test.tsx` (+1 line) | FOREIGN in-flight file — minimal in-place repair `TableScroll: 'table-scroll'`, attributed, NOT reverted; suite 4/4 |

## Deferred (LOW per workflow)

- qa-4: drop-cols migration merge-ordering reader gap — accept/stage decision sits with release sequencing.
- qa-5: worker result files at repo-root `results/` — cosmetic move, not blocking.

## Integration gates (fix-qa-1 round)

- `npx vitest run` → exit 0, **1347/1347** (was 4 failed in qa-3's file) — `reports/gate-fix-qa1.log`
- `npx tsc --noEmit` → clean (empty log) — `reports/gate-fix-qa1-tsc.log`
- `npx eslint <4 touched files>` → 0 errors (1 expected warning: `migration/` is eslint-ignored, same as sibling scratch CLIs) — `reports/gate-fix-qa1-eslint.log`

## NEEDS_APPROVAL (new, for PM)

`migration/reset-fd-activities.ts --write` deletes all ~404,915 `fd_activities`
rows + `config.mirror_state_fd_activities` (forces full API-era re-keyed
rebuild via the next sync). Sequence at API-sync cutover; dry-run output in
`results/qa1-01.md`. TRACKER updated; no reviewer/shard requests ignored.
