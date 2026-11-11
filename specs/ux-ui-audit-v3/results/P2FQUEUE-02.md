# P2FQUEUE-02 — /checkins 1px h-overflow @375 — DONE

Status: PASS (fixed). Culprit: `.cx-input`/`.cx-textarea` use `width:100%` with default `box-sizing:content-box`; inside `.chk-grid` (325px cell) the agents `input#q-Chats-ag` and note `textarea#q-Chats-n` measured 351px → right edge 376 > 375. Bisect: hiding `.main` dropped scrollWidth 376→375; element chain probe pinpointed the two controls (logs/p2fqueue02-chain.json).
Fix: added `chk-form` class to the checkins `<form>` (checkins-page.tsx:123) + rule `[data-app="queue"] .chk-form :is(.cx-input,.cx-textarea,.cx-select){box-sizing:border-box}` in queue.css:239 — scoped to checkins only, no cover-up overflow-x.
Files: src/features/cx-queue/components/checkins-page.tsx, src/app/styles/queue.css (+ probe/verify scripts in specs/ux-ui-audit-v3/logs/).
Verify: playwright @375/768/1024 → documentElement.scrollWidth == innerWidth at all widths (logs/p2fqueue02-verify.json). eslint: 0 problems on tsx (css ignored by config). tsc --noEmit: EXIT=0.
Handoff: none. Note for TL — same content-box `width:100%` pattern exists app-wide in cx-kit.css:275-291; other routes pass only because their containers have slack. Consider a shared border-box fix in a future shard.
