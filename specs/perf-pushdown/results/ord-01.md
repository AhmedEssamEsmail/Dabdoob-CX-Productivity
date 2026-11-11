# ord-01 — maildesk approvals deterministic tiebreak
Status: done — desk.test.ts 160/160 pass (was 4 failing).
Files: src/features/cx-desk/lib/maildesk.ts (mailDeskPage approvals chain, ~:601-610).
Change: sort moved before .map; comparator now total — pending-first, received_at desc,
updated_at DESC, thread_id asc. Root cause nuance: legacy comparator never returns 0, so V8
reversed tied rows vs sheet order; fixtures' sheet order == updated_at asc, so updated_at
desc reproduces legacy byte-equal (verified LEGACY=[t7,t-fresh-send,t-stuck,t6]).
Checks: `npx vitest run tests/golden/desk.test.ts` -> 160 passed; `npx tsc --noEmit` -> 2 errors,
both in src/features/cx-queue/lib/pages.ts:46,299 (rosterRows_ undefined) — NOT this shard's file,
looks like another leaf's in-flight work; maildesk.ts clean.
Handoff: ord-02/ord-03 remain; TL may want pages.ts errors triaged separately.
