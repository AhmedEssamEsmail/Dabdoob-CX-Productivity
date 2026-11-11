# P2FQA-02 — kb-gaps Type chips wrap mid-word
Status: DONE
Files: src/features/cx-quality/components/kb-gaps-page.tsx (Type `<td>` + class `qa-kbgaps__type`), src/app/styles/quality.css (appended scoped rule: white-space:nowrap; overflow-wrap:normal)
Checks: eslint on kb-gaps-page.tsx -> 0 problems; tsc --noEmit -> clean. Table stays inside TableScroll minWidth=44rem; only the Type cell is nowrap.
Handoff: visual re-check @1440/@375 for auditor; no blockers.
