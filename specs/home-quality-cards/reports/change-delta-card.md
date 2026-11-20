# Change request: home-quality-cards "vs last month" card (user-directed)

User rejected the current delta card design ("+1 pts" as the big value). New
contract — every row blocking.

| ID | Sev | Location | Finding / requirement | Expected fix | Owner |
|---|---|---|---|---|---|
| chg-1 | REQ | `src/features/cx-hub/lib/aggregates.ts` ~478 (`out.quality`) | Last month's score is computed (`prev`, ~line 472) but not exposed; the card needs it | Add `prevMonth: prev` to `out.quality` (keep `monthDelta` as is). Update the `Quality` type comment if present | dev |
| chg-2 | REQ | `src/features/cx-hub/components/overview-page.tsx` ~500 (2nd `.stat`) | Big value must be LAST MONTH'S score in the same `.stat-v` font; the change must be a red/green signed indicator | Card becomes: `stat-l` → `Last month`; `stat-v` → `q.prevMonth == null ? '–' : `${q.prevMonth}%``; `stat-d` → a `.delta` pill (existing `:root .delta.up/.down/.flat` convention in refresh.css ~219-232): class `up` when `monthDelta > 0`, `down` when `< 0`, `flat` when `0`; content `${Ql(q.monthDelta)} pts` (Ql already gives `+n`/`−n`/`0`); when `monthDelta == null` render plain `–` text instead of the pill. Sign semantics: + = this month is UP on last month | dev |
| chg-3 | REQ | `tests/hub-home-quality.test.ts` | `prevMonth` untested; fixture already yields deterministic values | Assert `prevMonth`: admin `60`, tl `70` (same fixture math as existing its); null-safety its unchanged | test-engineer |

Verify: `npx vitest run tests/hub-home-quality.test.ts` · `npx tsc --noEmit` · `npx eslint src/features/cx-hub/components/overview-page.tsx src/features/cx-hub/lib/aggregates.ts tests/hub-home-quality.test.ts`
change-delta-card.md
