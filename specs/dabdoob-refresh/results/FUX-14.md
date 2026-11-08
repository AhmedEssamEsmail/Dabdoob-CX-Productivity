# FUX-14 — refresh.css shell LOWs (ux-9/10/11)
Status: DONE
Files: src/app/refresh.css (only)
Checks: `grep -c 'cpk-input input'` -> 0; `.cpk-input` rewritten as bare-input styles
  (border:0, --cx-ink, ::placeholder --cx-ink-3, :focus-visible --cx-focus); dead
  descendant selector deleted. `.topbar .crumbs` + `.ag-t` -> --cx-ink-2.
  `.rail-search` gained min-height/nowrap, `.rail-search-label` ellipsis rule,
  `.rail-off` icon-only rules.
Handoff: FUX-15 markup adds `.rail-search-label` span. No blockers.
