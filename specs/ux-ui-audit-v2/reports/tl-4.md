# tl-4 — reshard batch: S03-18, S04-08, S06-18, S12-13, S12-31, S14-06 (+fix tsc1-01)

Batch-only dispatch, mode BUILD. 6 leaves, all `dev`, 2 waves (4+2, disjoint files; serialization verified: S03-18 sole shell/ui.tsx writer, S12-13 sole cx-kit.css writer). Preflight `check_shards.py` PASS ×6.

## Done
| Leaf | Files changed | Evidence |
|---|---|---|
| S03-18 | qa-shared.tsx, quality-analytics-charts.tsx, pv-shared.tsx, shell/ui.tsx | 6 symbols→ChipStatus, local Chip→re-export; goldens 80/80 |
| S04-08 | queue-page.tsx, agents-page.tsx, my-status-page.tsx | `.delta` verdict-tone swap; `up good` 0 hits; goldens 50/50 |
| S06-18 | my-actions-page.tsx | local Chip deleted → barrel Chip; people 24/24 |
| S14-06 | src/app/tph/page.tsx | /tph renders TphGridPage; foreign tph-grid redirect untouched; unblocks S14-07 |
| S12-13 | src/app/cx-kit.css | 8 dead `.cx-*` rule blocks deleted; live cx-grid-2/cx-split intact |
| S12-31 | results/dq-map.md (created) | read-only: 48 dq-* tokens mapped + DQ-1..07 leaf split proposed |
| tsc1-01 (fix leaf, spec/fix-tsc-1.md) | audit-queue-detail.tsx | `ticketUrl` props → required; tsc exit 0 |

## Integration gates
- `npx vitest run tests/golden/{quality,productivity,queue,people}.test.ts` — PASS 114/114 (log: logs/tl4-vitest.log)
- `npx tsc --noEmit` — r1 FAIL: audit-queue-detail.tsx:363+:887 TS2322, an S13-05 split residual (prop typed optional vs `TicketRef url: string`; pre-split code passed `any`). Routed as bounded fix leaf **tsc1-01** → fixed. Final tsc exit 0 (logs: tl4-tsc.log, tl4-tsc-final.log)

## Handoffs to PM
- `results/dq-map.md` → spec-architect for S12-DQ reshard (DQ-1..07 per map).
- S14-07 (e2e re-run of a11y-keyboard.spec.ts) now unblocked — ready, was not in this batch's scope.
- Remaining needs-split unchanged: S13-07 (S13-08 leaf exists in leaves.md, ready), plus S12-14..S12-30 warn-family leaves serialized behind done deps — schedulable next batch.

No reviewer shards requested/dispatched; baseline dirty tree untouched.
