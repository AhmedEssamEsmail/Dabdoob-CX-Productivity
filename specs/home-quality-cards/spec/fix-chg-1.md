# Fix leaves for reports/change-delta-card.md (user-directed change, all rows blocking)

## chg1-01: expose prevMonth in the quality aggregate
Kind: mini
ID: chg1-01
Parent: S01
Owner: dev
Depends: none
Criteria: change-delta-card chg-1
Skills: none
Budget: files=1; actions=2; changed_lines=5; minutes=5

### Goal
`out.quality` exposes last month's score as `prevMonth` so the card can show it.

### Files
- Edit: `src/features/cx-hub/lib/aggregates.ts` | the `out.quality = { ... }` literal (~line 478-483)

### Context
- `src/features/cx-hub/lib/aggregates.ts:471-483` | `month`, `prev`, `monthDelta` already computed; `prev` currently not exported
- `specs/home-quality-cards/reports/change-delta-card.md` | row chg-1

### Contract
Add `prevMonth: prev` to the `out.quality` object (keep `month`, `monthDelta`, `week`, `openCtls` unchanged). No type declaration exists for this object in the file — the shape is inferred.
Out of scope: any other field, the catch path, UI.

### Actions
1. Add `prevMonth: prev,` to the `out.quality` literal (after `month`, before `monthDelta` is fine).
2. Run the targeted check below.

### Done when
- `out.quality` includes `prevMonth` equal to `prev` (null-safe by construction)
- `npx tsc --noEmit` exits 0

### Verify
- Run: `npx tsc --noEmit` -> exit 0

### Handoff
`quality.prevMonth: number | null` is now available to chg1-02 (UI) and chg1-03 (tests).
Write results/chg1-01.md (<=10 lines); TL alone updates TRACKER.md.

## chg1-02: delta card shows last month's score with signed pill
Kind: mini
ID: chg1-02
Parent: S01
Owner: dev
Depends: chg1-01
Criteria: change-delta-card chg-2
Skills: none
Budget: files=1; actions=3; changed_lines=15; minutes=5

### Goal
The second quality `.stat` card shows LAST MONTH's score as the big value and the month-over-month change as a red/green/flat `.delta` pill.

### Files
- Edit: `src/features/cx-hub/components/overview-page.tsx` | inline `q` type (~391-396) and the 2nd `.stat` block (~499-503)

### Context
- `src/features/cx-hub/components/overview-page.tsx:391-396` | inline type for `q` — add `prevMonth?: number | null`
- `src/features/cx-hub/components/overview-page.tsx:499-503` | current "vs last month" card to replace
- `src/app/refresh.css:219-232` | existing `:root .delta` / `.up` / `.down` / `.flat` pill classes — reuse, no CSS changes
- `specs/home-quality-cards/reports/change-delta-card.md` | row chg-2 (sign semantics: + = this month is UP on last month)

### Contract
Replacement card markup:
- `stat-l` → `Last month`
- `stat-v` (same `num` class/font) → `q.prevMonth == null ? '–' : `${q.prevMonth}%``
- `stat-d` → when `q.monthDelta == null`: plain `–` text; otherwise `<span className={`delta ${q.monthDelta > 0 ? 'up' : q.monthDelta < 0 ? 'down' : 'flat'}`}>{Ql(q.monthDelta)} pts</span>` (Ql already renders `+n`/`−n`/`0`)
Out of scope: other stat cards, refresh.css, other pages.

### Actions
1. Add `prevMonth?: number | null` to the inline `q` type.
2. Replace the 2nd `.stat` block (label, value, delta pill) per Contract.
3. Run the targeted checks below.

### Done when
- Big value is `q.prevMonth` with `%` (or `–` when null)
- Delta renders as `.delta.up/.down/.flat` pill by sign of `monthDelta`, `–` text when null
- `npx tsc --noEmit` and scoped eslint exit 0

### Verify
- Run: `npx tsc --noEmit` -> exit 0
- Run: `npx eslint src/features/cx-hub/components/overview-page.tsx` -> exit 0

### Handoff
None. Write results/chg1-02.md (<=10 lines); TL alone updates TRACKER.md.

## chg1-03: test coverage for quality.prevMonth
Kind: mini
ID: chg1-03
Parent: S01
Owner: test-engineer
Depends: chg1-01
Criteria: change-delta-card chg-3
Skills: none
Budget: files=1; actions=2; changed_lines=10; minutes=5

### Goal
`tests/hub-home-quality.test.ts` asserts the new `prevMonth` field with the fixture's deterministic values.

### Files
- Edit: `tests/hub-home-quality.test.ts` | `Quality` type (~line 73) and the two existing admin/tl `its` (~92-105)

### Context
- `tests/hub-home-quality.test.ts:73` | local `Quality` type — add `prevMonth: number | null`
- `tests/hub-home-quality.test.ts:82-107` | admin expects monthDelta 16.7 (prev = 60); tl expects monthDelta 15 (prev = 70) — same fixture math
- `specs/home-quality-cards/reports/change-delta-card.md` | row chg-3

### Contract
In the admin it add `expect(q.prevMonth).toBe(60)`; in the tl it add `expect(q.prevMonth).toBe(70)`. Extend the local `Quality` type. Null-safety its (lines ~114-131) unchanged — `prevMonth` is not asserted there.
Out of scope: other test files, source code, fixtures.

### Actions
1. Add `prevMonth: number | null` to the local `Quality` type.
2. Add the two `prevMonth` assertions (admin 60, tl 70).

### Done when
- `npx vitest run tests/hub-home-quality.test.ts` passes with the new assertions

### Verify
- Run: `npx vitest run tests/hub-home-quality.test.ts` -> all tests pass

### Handoff
None. Write results/chg1-03.md (<=10 lines); TL alone updates TRACKER.md.
