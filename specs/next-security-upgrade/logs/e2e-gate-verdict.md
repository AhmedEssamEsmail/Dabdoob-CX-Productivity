# S01-09: browser-gate verdict — REGRESSION

Verdict rule (spec/S01.md#S01-09): `GREEN-ENV` iff S01-07 reports zero
`still-failing` among the original 12 AND S01-08 reports zero persistent
failures outside the timeout/login env class. Both conditions fail ->
**REGRESSION**.

## Env class — proven, then exhausted
- S01-08 serial firefox @workers=1 (`logs/e2e-firefox-serial.log`): 50 -> 10
  failures; all 29 `timeout` + 10 `login-failed` signatures recovered, matching
  the remote-Supabase-auth saturation precedent (`specs/e2e-contract-green/reports/tl-1.md:20-21`).
- Signature partition: `logs/e2e-failure-classes.md` (timeout 78 / login-failed 14
  / toHaveCount 18 / other 37 = 147).

## S01-07 chromium @workers=2 verdicts (`logs/e2e-chromium-rerun.log`, exit 1; 82 pass / 16 fail)
- Original 12: 10 `still-failing`, 2 `now-passing` (page-frame @1024 geometry;
  375px no-h-scroll).
- 6 NEW page-contract failures not in the original 12.

## Persistent failures — verbatim (project | spec | signature)
chromium (`logs/e2e-chromium-rerun.log`):
1. `[chromium] e2e\aging-refresh-layout.spec.ts:10:7 aging toolbar stays anchored... at 768px` — `toBeCloseTo`: expected 91.078, received 32 (diff 59.08)
2. same @1024px — expected 347.078, received 32 (diff 315.08)
3. same @1440px — expected 763.078, received 346.375 (diff 416.70)
4. `[chromium] e2e\page-contract.spec.ts:100:9 /aging contract @375px` — `.page-actions x moved on /aging` received 151
5. `[chromium] ... /overview contract @1024px` — `.page-actions x moved` received 263.27 (NEW)
6. `[chromium] ... /productivity-analytics contract @1024px` — `console errors` (NEW)
7. `[chromium] ... /productivity-analytics contract @375px` — `console errors` (NEW)
8. `[chromium] ... /quality-analytics contract @375px` — `[aria-busy="true"] toHaveCount(0)` got 1 @15s
9. `[chromium] ... /quality-analytics contract @1024px` — same
10. `[chromium] ... /quality-scores contract @375px` — same (NEW)
11. `[chromium] ... /quality-scores contract @1024px` — same (NEW)
12. `[chromium] e2e\page-frame.spec.ts:181:7 uniform head geometry @1440px` — `1 frame geometry violation(s)`
13. `[chromium] e2e\toolbar-stability.spec.ts:108:7 /aging` — `.cx-refresh > button x moved 151px`
14. `[chromium] ... /queue` — `.cx-refresh > button x moved 151px`
15. `[chromium] ... /overview` — `.page-actions x moved 41.14px`
16. `[chromium] e2e\ui-shell-polish.spec.ts:227:5 item5: /admin Reminders — compact row with Toggle` — `toHaveCount(1)` got 0

firefox serial (`logs/e2e-firefox-serial.log`, exit 1; 102 pass / 10 fail):
17. `[firefox] aging-refresh-layout.spec.ts:10:7 ... at 768px` — `toBeCloseTo` (diff 59.17)
18. same @1024px (diff 315.17); 19. same @1440px (diff 416.63)
20. `[firefox] page-contract.spec.ts:100:9 /aging contract @1024px` — `.page-actions x moved` 263.28
21. `/overview contract @375px` — moved 42.30; 22. `/overview @1024px` — moved 134.70
23. `[firefox] toolbar-stability.spec.ts:108:7 /aging` — `.cx-refresh > button x moved 151px`
24. `/queue` — 151px; 25. `/overview` — `.page-actions x moved 41.15px`
26. `[firefox] ui-shell-polish.spec.ts:227:5 item5 Reminders Toggle` — `toHaveCount(1)` got 0

Cross-project identical assertions (aging-refresh toBeCloseTo, toolbar 151px,
Reminders Toggle, page-actions moved) persist at workers=1 — deterministic
16.4.6 layout/DOM regression, not flake. Escalate: `RESHARD_NEEDED: S01-09`.
