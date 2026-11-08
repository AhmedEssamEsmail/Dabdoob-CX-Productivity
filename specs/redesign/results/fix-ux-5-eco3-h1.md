# fix-ux-5-eco3-h1 result
Status: DONE
Files: src/app/styles/hub.css (l.167 `.eco3-head h1` font-size only)
Change: font-size:1rem -> font-size:var(--cx-text-lg) (resolves 1.0625rem; slight tightening)
Checks: `grep -nE "font-size:[ \t]*[0-9.]+(px|rem|em)" src/app/styles/hub.css` -> 0 hits
Handoff: hub.css fully tokenized for font-size; no downstream changes needed.
Blockers: none.
