# FUX-01 results
Status: done
Files: src/app/refresh.css (L519-524)
Changes: `.login-card .btn-primary` renamed to `.cx-btn--primary` (2.5rem height kept); added `.login-card .cx-btn--primary svg { width/height .95rem; flex:none }`.
Verify: `grep "login-card .btn-primary|login-card .cx-btn"` -> 2 cx-btn--primary hits, zero .btn-primary.
Blockers: none.
