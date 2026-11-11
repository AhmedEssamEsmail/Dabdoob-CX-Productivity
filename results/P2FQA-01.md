# P2FQA-01 — /quality-analytics svg min-inline-size blows out grid @375
Status: done (CSS fix applied; browser scrollWidth check pending auditor re-run)
Files: src/app/styles/quality.css — added `.qa-cols__grid > * { min-inline-size:0 }` after line 126 (1 line)
Checks: `npx tsc --noEmit` → EXIT 0 clean. No markup/JS change; svg min-inline-size:360px and `.qa-trend__scroll{overflow-x:auto}` untouched, so chart keeps internal h-scroll.
Handoff: auditor re-runs Q4 /quality-analytics @375 (expect scrollWidth=375, chart scrolls inside card) and spot-checks @768/1024/1440 + sibling .qa-cols figures.
Blockers: none. Browser scrollWidth not measurable from this env; fix follows standard grid min-content pattern per shard contract.
