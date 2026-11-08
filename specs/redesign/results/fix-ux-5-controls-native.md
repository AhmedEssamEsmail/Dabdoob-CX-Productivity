# fix-ux-5-controls-native — done
Status: done. Added shared `:root input[type="checkbox"|"radio"]` restyle block in src/app/cx-kit.css between `.cx-switch` end and `.cx-tabs` (lines ~427-443): 1.125rem size, `accent-color:var(--cx-accent)`, pointer cursor, flex:none, margin:0; disabled dimmed to opacity .55.
Checks: `grep -n "accent-color" src/app/cx-kit.css` -> exactly 1 hit (l.434, inside new block). No `appearance`/`::before`/`::after` added; `.cx-toggle`/`.cx-switch` visuals unchanged (inert on opacity:0 inputs).
Files: src/app/cx-kit.css only.
Blockers/handoff: none; spot-render of accent check deferred to TL integration.
