# S12-27 reshard — stale Files map + unmapped `card--flat`
Status: DONE — spec-only, no product edits.
- S12-27 marked superseded (spec/leaves.md#S12-27); residual → new leaf `## S12-33` (spec/leaves.md#S12-33).
- File map corrected by grep: `tph-grid-page.tsx` had 0 `card` hits → real hits `tph-grid-views.tsx:597-603` (4 sites); `login:83` = exempt `login-card`, PageStates = comment → both dropped. Verified counts: analytics 21, status-validation 13, tph-grid-views 4, my-status 13, trackers 4.
- `card--flat` resolved via DECISION B documented-raw-class contract: `card card--flat` → `cx-panel pv-card--flat` (`-card`-suffixed productivity skin like `tph-card`; `pv-` = area prefix); productivity.css :232-233 selectors retarget in-leaf (`h2.cx-section__title`, `.pv-card--flat`) so styling follows.
- Depends S12-15/S12-21/S13-08/S12-11 all DONE → READY. Rewired: S12-30, S12-32, DQ-2 (leaf + package table) S12-27→S12-33; index reshard note appended. Handoff refs in done leaves S12-15/S12-21 left as provenance.
- Checker: PASS (manual rule application — no exec tool): files=6, actions=6, ≤5 checks, ≤5 context, all fields/sections present.
