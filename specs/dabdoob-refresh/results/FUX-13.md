# FUX-13 — agents page 4-tab chrome
Status: done. File: src/features/cx-people/components/agents-page.tsx only.
- viewTabs (rank/detail/workbook/scoring) rendered as `.tabs` anchors role=tab/aria-selected; Seg removed; workbook tab admin-gated.
- ScorecardAdmin now mounts only inside the workbook pane; scoring pane carries the moved cx-hint explainer; Period keeps head/hint + warnNotes.
- "My team only" cx-switch preserved (cx-filters, rank view, scope tl). Agent scope (!teamView) unchanged: own scorecard renders directly, no tabs (mock is TL/admin view).
Checks: eslint file clean (exit 0); tsc --noEmit clean (exit 0); grep confirms single tabs row + single ScorecardAdmin mount.
New raw user-facing strings for i18n sweep: "Stack ranking", "Agent detail", "Workbook imports", "How scoring works", "Scorecard view", "My team only" (pre-existing raw).
