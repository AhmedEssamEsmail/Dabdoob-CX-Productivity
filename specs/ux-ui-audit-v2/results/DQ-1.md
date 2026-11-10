# DQ-1 — `dq-page` → `page` token swap (hub + cx-people)

Status: done
Files: overview-page.tsx (comment :4 + class :430), people-holidays-page.tsx (:254), agents-page.tsx (:566), my-actions-page.tsx (:129)
Checks: `grep -rn 'dq-page'` on 4 files → 0 hits; `npx tsc --noEmit` → clean (exit 0); eslint on 4 files → 0 errors, 38 dq-* loser warnings, none for `dq-page` (remaining dq-* are DQ-4 scope); vitest golden hub-overview + hub-people-holidays + people → 47/47 pass.
Handoff: overview/people-holidays/agents serialize onward to DQ-4 (shared-helper + refresh.css renames). TRACKER.md untouched.
