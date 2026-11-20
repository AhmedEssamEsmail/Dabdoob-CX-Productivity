# FIX leaves: reports/low-findings.md

## low1-01: Open CTLs shows en-dash when quality is null
Kind: mini
ID: low1-01
Parent: S01
Owner: dev
Depends: none
Criteria: PLAN #2 (quality card null-safe); finding ux-2 / low-1
Skills: none
Budget: files=1; actions=1; changed_lines=5; minutes=5

### Goal
When `out.quality` is null (quality catch path), the Open CTLs `.stat-v`
must render the same `–` placeholder as sibling scores, never a false `0`.

### Files
- Edit: `src/features/cx-hub/components/overview-page.tsx` | only the Open CTLs `.stat-v` expression at ~line 511

### Context
- `src/features/cx-hub/components/overview-page.tsx:493-514` | quality stat card; siblings already use `x == null ? '–' : ...`
- `src/features/cx-hub/lib/aggregates.ts:446-488` | quality catch sets `out.quality = null` (see reports/low-findings.md low-1)

### Contract
Change `{Hi(q.openCtls ?? 0)}` to `{q.openCtls == null ? '–' : Hi(q.openCtls)}`
so a null/undefined value renders `–`. A real `0` open-CTL count still renders
`0` via `Hi`. No markup, className, or sibling changes.
Out of scope: the `.stat-d` copy strings (leaf low1-02), aggregates.ts, tests.

### Actions
1. Replace the single expression in the Open CTLs `.stat-v` span per the contract.

### Done when
- `q.openCtls == null` renders `–`; a numeric value (including `0`) renders via `Hi`.
- Diff touches only the one expression in overview-page.tsx.

### Verify
- Run: `npx eslint src/features/cx-hub/components/overview-page.tsx` -> exit 0.

### Handoff
low1-02 edits the same file serially after this leaf lands.
Write results/low1-01.md (<=10 lines); TL alone updates TRACKER.md.

## low1-02: Plain-language .stat-d copy for quality deltas
Kind: mini
ID: low1-02
Parent: S01
Owner: dev
Depends: low1-01
Criteria: PLAN #2 (quality card copy); finding ux-3 / low-2
Skills: none
Budget: files=1; actions=2; changed_lines=4; minutes=5

### Goal
Replace the jargon `.stat-d` hints "signed change" and "quota week" with plain
sibling-style copy: "score points vs last month" and "current week".

### Files
- Edit: `src/features/cx-hub/components/overview-page.tsx` | only the two `.stat-d` strings at ~lines 502 and 507

### Context
- `src/features/cx-hub/components/overview-page.tsx:493-514` | quality stat card; sibling hints are plain phrases like "audits so far" / "needing coaching"
- `reports/low-findings.md` row low-2 | the ux-1 suggested wording

### Contract
Line ~502: `signed change` -> `score points vs last month`.
Line ~507: `quota week` -> `current week`.
String text only; no markup, className, or expression changes.
Out of scope: the Open CTLs expression (leaf low1-01), other `.stat-d` hints, tests.

### Actions
1. Replace the `.stat-d` text under "vs last month" with `score points vs last month`.
2. Replace the `.stat-d` text under "Quality this week" with `current week`.

### Done when
- Both strings updated exactly as specified; no other copy or markup changes.

### Verify
- Run: `npx eslint src/features/cx-hub/components/overview-page.tsx` -> exit 0.

### Handoff
Write results/low1-02.md (<=10 lines); TL alone updates TRACKER.md.

## low1-03: Cover the quality catch path and weekStartsOn=1 window
Kind: mini
ID: low1-03
Parent: S01
Owner: test-engineer
Depends: none
Criteria: PLAN #2 (quality fallback + quota week); finding qa-2 / low-3
Skills: none
Budget: files=1; actions=3; changed_lines=80; minutes=10

### Goal
Add two tests to the existing quality suite: (a) malformed
`qa_engine_settings` resolves with no error and `quality === null`; (b)
`weekStartsOn: 1` shifts the quota-week window to Monday so a countable
`2026-05-03` audit is excluded.

### Files
- Edit: `tests/hub-home-quality.test.ts` | two new `it` cases inside the existing describe; no fixture-default changes

### Context
- `tests/hub-home-quality.test.ts:24-71` | `fx()` fixture factory; `over.tables`/`over.settings` merge hooks; default `qa_audits` rows on 05-03 are all non-counting
- `tests/hub-home-quality.test.ts:6-8` | frozen clock Wed 2026-05-06; Sun-start week 05-03..05-06, Mon-start week 05-04..05-06
- `src/features/cx-quality/lib/engine.ts:319-336` | `qeSettingsFrom_` parses `qa_engine_settings` and throws on invalid JSON
- `src/features/cx-hub/lib/aggregates.ts:446-488` | quality `try/catch` -> `out.quality = null` fallback

### Contract
Test (a): override settings `qa_engine_settings` with invalid JSON (match the
raw-string format `qeSettingsFrom_` reads); assert `res.err` undefined AND
`res.ok.quality === null`.
Test (b): `qa_engine_settings` = `{ weekStartsOn: 1 }`, plus a custom
`qa_audits` table via `fx({ tables: { qa_audits: [...] } })` containing a
countable audit dated `2026-05-03` (and whatever rows needed to prove the
window); assert `quality.week` reflects the Mon-start window 05-04..05-06,
i.e. the 05-03 audit is excluded (Sun-start would include it).
Both tests must fail on the pre-qa1-01/unshifted behaviour respectively.
Out of scope: source files, other tests, fixture default rows.

### Actions
1. Add `it` case (a): invalid `qa_engine_settings` -> no err, `quality === null`.
2. Add `it` case (b): `weekStartsOn: 1` + custom `qa_audits` with a countable 2026-05-03 audit -> week excludes it.
3. Run the targeted suite and record results.

### Done when
- Both new tests pass; all existing tests in the file still pass.
- Test (b) genuinely discriminates: it would fail if weekStartsOn were ignored (Sun-start includes 05-03).

### Verify
- Run: `npx vitest run tests/hub-home-quality.test.ts` -> all tests pass.

### Handoff
Write results/low1-03.md (<=10 lines); TL alone updates TRACKER.md.
