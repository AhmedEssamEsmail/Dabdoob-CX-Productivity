# qa report - fd-direct-mirrors - round 2 (DELTA)
Verdict: PASS
Open: 0B / 0H / 0M / 2L (qa-4, qa-5 — deferred LOW, logged only)

## Checks run
- `npx vitest run` -> exit 0: 94 files / **1347 passed, 0 failed** (log: was RED in round 1 — audit-queue-memo 4/4 now green)
- `npx tsc --noEmit` -> exit 0, empty log (clean)
- `npx eslint mirrors.ts mirrors.test.ts audit-queue-memo.test.tsx reset-fd-activities.ts` -> exit 0, 0 errors (1 warning: `migration/` ignore-patterned — expected, same as sibling scratch CLIs)
- Code read: `migration/reset-fd-activities.ts` (whole, 118 ln), `mirrors.ts:60-119`, `mirrors.test.ts:255-282`, audit-queue-memo diff (+1 ln)

## Finding verification (qa-1 -> fix)

| ID | Sev | Status | Evidence |
|---|---|---|---|
| qa-1 dedupe re-key gap | MED | FIXED (ops-pending) | `migration/reset-fd-activities.ts`: dry-by-default (`--write && !--dry`, :22); paged id-batched delete-all (:51-68); deletes `config` key `mirror_state_fd_activities` -> absent watermark forces `full:true` rebuild with API-era keys; refresh_log audit row. Dry-run verified rows=404915 watermark_present=true (results/qa1-01.md). `--write` correctly NEEDS_APPROVAL (TRACKER blocked list) — remote run pending PM sequencing at cutover; that is approval-gated ops, not an open defect. |
| qa-2 roster error swallowed | MED | FIXED | `mirrors.ts:78-79` checks select error, throws `described(error,{step:'roster directory'})`. Regression test `mirrors.test.ts:262-273` injects `h.rosterErr` -> asserts per-table error contains message AND zero `fd_activities` upserts. Would fail without the throw. |
| qa-3 vitest RED (foreign) | HIGH | FIXED | `tests/perf/audit-queue-memo.test.tsx` +1 line `TableScroll: 'table-scroll'` in ui mock — minimal in-place repair of foreign in-flight file, attributed not reverted. Full suite 1347/1347. |
| qa-4 drop-cols merge ordering | LOW | deferred | Accepted per workflow (LOW, release-sequencing decision). |
| qa-5 results files at repo root | LOW | deferred | Cosmetic move; non-blocking. |

## Regression & scope (fix-round files only)
- Changed set matches tl-3 exactly: `mirrors.ts`, `mirrors.test.ts`, `audit-queue-memo.test.tsx`, `reset-fd-activities.ts`. No edits outside fix-qa-1 leaf Files lists.
- `h.rosterErr` is a test-mock seam (mirrors.test.ts:19,70,147), no production hook added. No debug leftovers/TODOs/deps in reviewed diffs.
- CLI conforms to PLAN Convention (gitignored `migration/`, default `--dry`, NEEDS_APPROVAL `--write`, refresh_log row).

## Not verified / assumptions
- Actual remote `--write` (wipe + rebuild) runs at cutover under approval; dry-run output is the evidence.
- The 125-line mirrors.ts diff vs HEAD includes the whole task's prior work (audited round 1); fix delta is :78-79 only.

Verdict basis: all qa-1 BLOCKER/HIGH/MED findings fixed and verified; gate suite fully green.
