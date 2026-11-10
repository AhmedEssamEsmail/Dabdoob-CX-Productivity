# verify-1 — audit verification pass
Status: DONE (1 item PARTIAL-by-data, rest verified).
Files: specs/ux-ui-audit-v2/capture-verify.mjs, probe-verify-extra.mjs (new), reports/verify-1.md, shots/verify/ (10 png + 2 json). No src/ edits.
Checks: ink-3 ≥5.10:1 light+dark (est. refuted); va-banner-error 6.47:1; md-status-blocked token 5.58:1; dark/RTL/palette/view-as shots OK; /overview@320 h-scroll VERIFIED (docScrollW 474, .cx-ladder grid blowout); /admin@390 = 209,051px caused by JSON .setting-value wrap (top row 75.7k px); login img loads (timing artifact); .qa-q NOT verified — empty queue/no open calibration (would need a write).
Handoff: seed QA queue/calibration data or accept code verdict for .qa-q; rendered md-status-blocked needs a blocked agenda item.
