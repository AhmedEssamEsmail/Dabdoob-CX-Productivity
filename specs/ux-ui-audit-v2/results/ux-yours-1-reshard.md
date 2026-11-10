# RESHARD/FIX: reports/ux-yours-1.md ux-1 (MED) → ux1-01
Status: spec written — spec/leaves.md#ux1-01 (READY, Depends DQ-3); index note added in 00-index.md.
Decision: option (a) CSS-contract patch — `:root .cx-panel > .cx-section__head{padding,border-block-end}` in cx-kit.css:547/549 gap. Rejected (b) `cx-section` DOM restructure: ~50 sites / >10 files exceeds leaf caps; DECISION additive-first; canonical head-outside-panel siblings unaffected via `>` selector.
Preserved: all foreign work — S12-22..S12-33 verified migrations (no markup revert), `.card*` refresh.css rules stay for S12-32, S13-07 checkpoint memo edits untouched.
Deferred (explicit): ux-2 `.cx-empty`, ux-3 `.trk-outside` LOW findings.
Size: files=1, actions=3, changed_lines=10, minutes=4, checks=3, context=5 → PASS.
Not dispatched: TL assigns + updates TRACKER (untouched); results/ux1-01.md is the worker's artifact.
