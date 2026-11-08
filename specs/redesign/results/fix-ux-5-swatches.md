status: done
files: src/app/theme.css (8 :root tokens + 2x dark redeclare sets), src/app/styles/hub.css ([data-accent-preview] l.98-105, .ap-swatch l.206-211 hex->var)
checks: `grep -nE "#[0-9a-fA-F]{3,8}" src/app/styles/hub.css` -> only 9 --eco3-*/.eco3-s-* hexes remain (l.114-135); colors identical light/dark via token redeclares
blockers: none; .eco3-head h1 untouched (sibling leaf fix-ux-5-eco3-h1)
