# DQ-6 — dq-refresh → cx-refresh
Status: done
Files: src/features/cx-hub/components/hub-shared.tsx:573, src/features/cx-queue/components/shared.tsx:4,388, src/app/refresh.css:541
Checks: grep `dq-refresh|dq-head` src/ = 0 hits; tsc --noEmit clean; eslint 0 errors/0 dq-refresh warns (10 pre-existing warns); vitest queue+hub-overview 20/20 pass
Notes: refresh.css free for S12-32. Handoff to TL for TRACKER.md.
