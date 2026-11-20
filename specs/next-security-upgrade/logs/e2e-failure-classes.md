# S01-06: e2e failure classification (147 failures from logs/e2e.log)

Source: `logs/e2e.log` numbered failure lines (`logs/e2e-failures.txt`, 147 lines).
Classes (first match wins, precedence login-failed > toHaveCount > timeout > other):
- `login-failed`: block contains the thrown header `Error: e2e login failed for ...` (e2e/users.ts retry-exhausted).
- `toHaveCount`: block contains `expect(locator).toHaveCount(expected) failed`.
- `timeout`: block contains `Test timeout of Nms exceeded` / `exceeded the test timeout` / `Timeout was reached`.
- `other`: none of the above (first error line quoted verbatim below).

Note: `e2e login failed` also appears as a code-frame source line in any block whose stack touches `e2e/users.ts`; classification keys on the thrown `Error:` header only.

## Signature x project counts

| signature | chromium | firefox | webkit | mobile | tablet | total |
|---|---|---|---|---|---|---|
| timeout | 3 | 29 | 11 | 7 | 28 | 78 |
| login-failed | 0 | 10 | 1 | 3 | 0 | 14 |
| toHaveCount | 3 | 5 | 1 | 0 | 9 | 18 |
| other | 6 | 6 | 10 | 6 | 9 | 37 |
| **total** | 12 | 50 | 23 | 16 | 46 | **147** |

Cross-signal: 46 of the 78 `timeout` blocks have `e2e/users.ts` (login helper) in their stack — login-under-load timeouts, matching S01-04's "firefox/tablet dominated by login-timeouts".
9 `toHaveCount` blocks also contain timeout text (assertion pending when the test timeout hit).

## Per-project failing spec files (ranked by failure count)

### chromium — 12 failures, 5 spec files

| spec file | failures |
|---|---|
| `e2e\aging-refresh-layout.spec.ts` | 3 |
| `e2e\page-frame.spec.ts` | 3 |
| `e2e\toolbar-stability.spec.ts` | 3 |
| `e2e\page-contract.spec.ts` | 2 |
| `e2e\ui-shell-polish.spec.ts` | 1 |

### firefox — 50 failures, 8 spec files

| spec file | failures |
|---|---|
| `e2e\page-contract.spec.ts` | 35 |
| `e2e\aging-refresh-layout.spec.ts` | 3 |
| `e2e\my-status.spec.ts` | 3 |
| `e2e\page-frame.spec.ts` | 3 |
| `e2e\toolbar-stability.spec.ts` | 3 |
| `e2e\auth.spec.ts` | 1 |
| `e2e\hash-anchors.spec.ts` | 1 |
| `e2e\ui-shell-polish.spec.ts` | 1 |

### webkit — 23 failures, 9 spec files

| spec file | failures |
|---|---|
| `e2e\page-contract.spec.ts` | 7 |
| `e2e\aging-refresh-layout.spec.ts` | 3 |
| `e2e\my-status.spec.ts` | 3 |
| `e2e\toolbar-stability.spec.ts` | 3 |
| `e2e\hash-anchors.spec.ts` | 2 |
| `e2e\page-frame.spec.ts` | 2 |
| `e2e\auth.spec.ts` | 1 |
| `e2e\input-sizing.spec.ts` | 1 |
| `e2e\ui-shell-polish.spec.ts` | 1 |

### mobile — 16 failures, 7 spec files

| spec file | failures |
|---|---|
| `e2e\ui-shell-polish.spec.ts` | 4 |
| `e2e\aging-refresh-layout.spec.ts` | 3 |
| `e2e\toolbar-stability.spec.ts` | 3 |
| `e2e\page-contract.spec.ts` | 2 |
| `tests\e2e\a11y-keyboard.spec.ts` | 2 |
| `e2e\page-frame.spec.ts` | 1 |
| `e2e\status-validation.spec.ts` | 1 |

### tablet — 46 failures, 9 spec files

| spec file | failures |
|---|---|
| `e2e\page-contract.spec.ts` | 24 |
| `e2e\ui-shell-polish.spec.ts` | 5 |
| `e2e\aging-refresh-layout.spec.ts` | 3 |
| `e2e\my-status.spec.ts` | 3 |
| `e2e\toolbar-stability.spec.ts` | 3 |
| `tests\e2e\a11y-keyboard.spec.ts` | 3 |
| `e2e\auth.spec.ts` | 2 |
| `e2e\hash-anchors.spec.ts` | 2 |
| `e2e\nav-no-splash.spec.ts` | 1 |

## `other`-class failures (37) — verbatim numbered line + first error line

- `  1) [chromium] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 1440px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  2) [chromium] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 1024px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  3) [chromium] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 768px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  6) [chromium] › e2e\toolbar-stability.spec.ts:108:7 › /aging toolbar stays anchored through refresh states`
  - `Error: /aging @375 "Refresh now": .page-head .cx-refresh > button x moved 151px`
- `  7) [chromium] › e2e\toolbar-stability.spec.ts:108:7 › /queue toolbar stays anchored through refresh states`
  - `Error: /queue @375 "Refresh now": .page-head .cx-refresh > button x moved 151px`
- `  8) [chromium] › e2e\toolbar-stability.spec.ts:108:7 › /overview toolbar stays anchored through refresh states`
  - `Error: /overview @375 "Refresh now": .page-head .page-actions x moved 41.140625px`
- `  9) [firefox] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 768px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  10) [firefox] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 1024px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  11) [firefox] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 1440px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  56) [firefox] › e2e\toolbar-stability.spec.ts:108:7 › /aging toolbar stays anchored through refresh states`
  - `Error: /aging @375 "Refresh now": .page-head .cx-refresh > button x moved 151px`
- `  57) [firefox] › e2e\toolbar-stability.spec.ts:108:7 › /queue toolbar stays anchored through refresh states`
  - `Error: /queue @375 "Refresh now": .page-head .cx-refresh > button x moved 151px`
- `  58) [firefox] › e2e\toolbar-stability.spec.ts:108:7 › /overview toolbar stays anchored through refresh states`
  - `Error: /overview @375 "Refresh now": .page-head .page-actions x moved 41.149993896484375px`
- `  59) [webkit] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 1024px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  60) [webkit] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 768px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  61) [webkit] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 1440px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  67) [webkit] › e2e\hash-anchors.spec.ts:38:5 › legacy #/path and ?page= deep links still rewrite to their route`
  - `Error: #/aging did not rewrite to /aging`
- `  76) [webkit] › e2e\page-contract.spec.ts:100:9 › /overview contract @1024px ──────────────────────`
  - `Error: .page-actions x moved on /overview`
- `  80) [webkit] › e2e\toolbar-stability.spec.ts:108:7 › /aging toolbar stays anchored through refresh states`
  - `Error: /aging @375 "Refresh now": .page-head .cx-refresh > button x moved 151px`
- `  81) [webkit] › e2e\toolbar-stability.spec.ts:108:7 › /queue toolbar stays anchored through refresh states`
  - `Error: /queue @375 "Refresh now": .page-head .cx-refresh > button x moved 151px`
- `  82) [webkit] › e2e\toolbar-stability.spec.ts:108:7 › /overview toolbar stays anchored through refresh states`
  - `Error: /overview @375 "Refresh now": .page-head .page-actions x moved 41.140625px`
- `  83) [mobile] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 768px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  84) [mobile] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 1440px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  85) [mobile] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 1024px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  90) [webkit] › e2e\page-frame.spec.ts:181:7 › uniform head geometry across routes @1440px ────────`
  - `Error: 1 frame geometry violation(s) @1440px:`
- `  91) [mobile] › e2e\toolbar-stability.spec.ts:108:7 › /queue toolbar stays anchored through refresh states`
  - `Error: /queue @375 "Refresh now": .page-head .cx-refresh > button x moved 151px`
- `  92) [mobile] › e2e\toolbar-stability.spec.ts:108:7 › /aging toolbar stays anchored through refresh states`
  - `Error: /aging @375 "Refresh now": .page-head .cx-refresh > button x moved 151px`
- `  93) [webkit] › e2e\page-frame.spec.ts:181:7 › uniform head geometry across routes @1024px ────────`
  - `Error: 1 frame geometry violation(s) @1024px:`
- `  95) [tablet] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 768px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  96) [tablet] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 1024px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  97) [tablet] › e2e\aging-refresh-layout.spec.ts:10:7 › aging toolbar stays anchored through refresh states at 1440px`
  - `Error: expect(received).toBeCloseTo(expected, precision)`
- `  102) [mobile] › e2e\ui-shell-polish.spec.ts:94:5 › item2: /calibration AssignForm — fields do not overlap`
  - `Error: expect(locator).toBeVisible() failed`
- `  106) [tablet] › e2e\hash-anchors.spec.ts:38:5 › legacy #/path and ?page= deep links still rewrite to their route`
  - `Error: #/aging did not rewrite to /aging`
- `  108) [tablet] › e2e\my-status.spec.ts:12:7 › My Status Page › agent can view own productivity score`
  - `Error: expect(locator).toBeVisible() failed`
- `  109) [tablet] › e2e\my-status.spec.ts:37:7 › My Status Page › intervals list displays correctly ──`
  - `Error: expect(locator).toBeVisible() failed`
- `  110) [tablet] › e2e\my-status.spec.ts:54:7 › My Status Page › status colors match design ─────────`
  - `Error: expect(locator).toBeVisible() failed`
- `  136) [tablet] › e2e\toolbar-stability.spec.ts:108:7 › /queue toolbar stays anchored through refresh states`
  - `Error: /queue @375 "Refresh now": .page-head .cx-refresh > button x moved 151px`
- `  137) [tablet] › e2e\toolbar-stability.spec.ts:108:7 › /aging toolbar stays anchored through refresh states`
  - `Error: /aging @375 "Refresh now": .page-head .cx-refresh > button x moved 151px`
