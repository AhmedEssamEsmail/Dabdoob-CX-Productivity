# FIX leaves: reports/qa-1.md

## qa1-01: Keep malformed QA settings inside the quality fallback
Kind: mini
ID: qa1-01
Parent: S01
Owner: dev
Depends: none
Criteria: PLAN #2 (quality never throws -> out.quality=null); finding qa-1
Skills: none
Budget: files=1; actions=2; changed_lines=15; minutes=5

### Goal
A malformed `qa_engine_settings` config must not reject `getHomePage`; the
existing quality catch block must handle it by setting `out.quality = null`.

### Files
- Edit: `src/features/cx-hub/lib/aggregates.ts` | move only the `weekStartsOn`/`weekStart` computation (currently ~205-207) into the existing quality `try` (~446-488)

### Context
- `src/features/cx-hub/lib/aggregates.ts:199-207` | quality date keys and the settings parse currently outside the guarded block
- `src/features/cx-hub/lib/aggregates.ts:446-488` | existing role gate, quality `try/catch`, and `out.quality = null` fallback
- `src/features/cx-quality/lib/engine.ts:319-336` | `qeSettingsFrom_` throws on invalid `qa_engine_settings` JSON

### Contract
Preserve the current formula
`Number(qeSettingsFrom_(dqSetting_(cfg, 'qa_engine_settings')).weekStartsOn) === 1 ? 1 : 0`
and `qaPeriodOf_(today, 'week', weekStartsOn)`, but evaluate it inside the
quality `try`. Any throw there must follow the existing catch path.
Out of scope: other `getHomePage` reads, tests, UI, settings defaults beyond the existing catch-to-null behaviour.

### Actions
1. Move the `weekStartsOn` and `weekStart` declarations into the existing quality `try` block before the store reads.
2. Remove the now-unneeded outer declarations without changing month/prev-month date keys or any other logic.

### Done when
- Invalid `qa_engine_settings` cannot escape the quality `try`; `getHomePage` resolves with `out.quality === null`.
- Valid settings still drive the week-start calculation exactly as before.
- No other `getHomePage` behaviour or files change.

### Verify
- Run: `npx vitest run tests/hub-home-quality.test.ts` -> all tests pass.

### Handoff
Reviewer can delta-check the moved settings parse inside the existing quality
fallback. Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.
