# P1B-06: Formatting — B17 shared number/date helpers
Kind: package
ID: P1B-06
Dispatch: NEVER

## Goal and contract
One shared format module `src/features/shared/lib/format.ts` owns the duplicated helpers (`fmt = (n:number)=>n.toLocaleString('en-US')` currently copy-pasted in `cx-queue/components/shared.tsx:34` and `cx-people/components/shared.tsx:31`; `formatDate_` in `shared/lib/adapters.ts:133`). Display-level `toLocaleString`/`toFixed`/`Intl.*` call sites in components migrate to these helpers. Lib-level data logic (`adapters.ts`, `heatmap-engine.ts`, `tph/*.ts`, `settings.ts`, `grid-slots.ts`, `prod-validation.ts`, `PageStates.tsx` internal) keeps its formatting — it IS the shared layer or non-display logic; recorded here so nobody re-flags it.
Non-goals: changing formatted output, locale behavior, or helper signatures beyond consolidation.

## Children
| ID | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| B17-01 | dev | B4-01 | B17 foundation format.ts | 3/5/80/8 |
| B17-02 | dev | B17-01, B4-04, B13-01, B16-01 | B17 quality+people+ops consumers (5 files) | 5/7/60/9 |
| B17-03 | dev | B17-01, B16-02, B4-03, B4-02, B5-03 | B17 queue+hub+prod consumers (7 files) | 7/8/70/10 |

## B17-01: shared format.ts foundation
Kind: mini
ID: B17-01
Parent: P1B-06
Owner: dev
Depends: B4-01
Criteria: PLAN B17
Skills: none
Budget: files=3; actions=5; changed_lines=80; minutes=8

### Goal
`src/features/shared/lib/format.ts` exists exporting `fmt` (and `fmtDate` if the two `fmt` copies have date siblings); both duplicate feature `fmt` definitions re-export it.

### Files
- Create: `src/features/shared/lib/format.ts` | `export const fmt = (n:number)=>n.toLocaleString('en-US')` (+ any variant both copies need)
- Edit: `src/features/cx-queue/components/shared.tsx` | `fmt` :34 → `export { fmt } from '@/features/shared/lib/format'` (keep the exported name)
- Edit: `src/features/cx-people/components/shared.tsx` | `fmt` :31 → same re-export

### Context
- `src/features/shared/lib/adapters.ts:133` | `formatDate_` precedent (not moved — different domain)

### Contract
`fmt` keeps signature `(n:number)=>string` and identical output. Feature `shared.tsx` files keep re-exporting `fmt` so existing consumers don't change imports.
Out of scope: consumer migration (B17-02/03); adapters.ts.

### Actions
1. Create `src/features/shared/lib/format.ts` exporting `fmt = (n:number)=>n.toLocaleString('en-US')` with a doc comment.
2. `cx-queue/components/shared.tsx`: replace local `fmt` def :34 with `export { fmt } from '@/features/shared/lib/format'`.
3. `cx-people/components/shared.tsx`: replace local `fmt` def :31 with the same re-export.
4. Re-grep: `fmt` resolves from format.ts in both files; consumer imports unchanged.
5. `npx eslint` + `npx tsc --noEmit`.

### Done when
- `grep -rn "toLocaleString('en-US')" src/features/cx-queue/components/shared.tsx src/features/cx-people/components/shared.tsx` → 0 hits; `fmt` resolves from format.ts

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/shared/lib/format.ts src/features/cx-queue/components/shared.tsx src/features/cx-people/components/shared.tsx` -> clean

### Handoff
`@/features/shared/lib/format` is the published helper for B17-02/03.
Write results/B17-01.md (<=10 lines); TL alone updates TRACKER.md.

## B17-02: format-helper consumers — cx-quality + cx-people + cx-operations
Kind: mini
ID: B17-02
Parent: P1B-06
Owner: dev
Depends: B17-01, B4-04, B13-01, B16-01
Criteria: PLAN B17
Skills: none
Budget: files=5; actions=7; changed_lines=60; minutes=9

### Goal
Display-level `toLocaleString`/`toFixed`/`Intl.*` call sites in the listed components use the shared format helpers instead of scattered inline formatting.

### Files
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | :69,81,89,93
- Edit: `src/features/cx-quality/components/audit-queue-detail.tsx` | :1083,1211,1258
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | :622,1152,1242,1264,1283
- Edit: `src/features/cx-people/components/one-on-ones-views.tsx` | :116
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | :146,147,247

### Context
- `src/features/shared/lib/format.ts` | `fmt` (created by B17-01)
- `src/features/shared/lib/adapters.ts:133` | `formatDate_` for date pattern formatting

### Contract
Replace display number formatting with `fmt(n)`; replace date-pattern formatting with `formatDate_` where the pattern matches an existing helper. Keep call sites whose output semantics differ (e.g. `toFixed(1)` for precision-sensitive labels) — note them in results. No output changes allowed.
Out of scope: lib files; `PageStates.tsx`; files not listed.

### Actions
1. `quality-scores-page.tsx`: swap display sites :69,81,89,93 to `fmt`/`formatDate_` where output identical.
2. `audit-queue-detail.tsx`: swap sites :1083,1211,1258.
3. `qa-shared.tsx`: swap sites :622,1152,1242,1264,1283.
4. `one-on-ones-views.tsx`: swap site :116.
5. `trackers-page.tsx`: swap sites :146,147,247.
6. Record kept (semantically different) sites in results.
7. `npx eslint` + `npx tsc --noEmit`.

### Done when
- listed files use shared helpers for display formatting (or sites documented as intentionally different)

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-quality/components src/features/cx-people/components/one-on-ones-views.tsx src/features/cx-operations/components` -> clean

### Handoff
None.
Write results/B17-02.md (<=10 lines); TL alone updates TRACKER.md.

## B17-03: format-helper consumers — cx-queue + cx-hub + cx-productivity
Kind: mini
ID: B17-03
Parent: P1B-06
Owner: dev
Depends: B17-01, B16-02, B4-03, B4-02, B5-03
Criteria: PLAN B17
Skills: none
Budget: files=8; actions=9; changed_lines=70; minutes=10

### Goal
Display-level `toLocaleString`/`toFixed`/`Intl.*` call sites in the listed components use the shared format helpers.

### Files
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | :542,713
- Edit: `src/features/cx-queue/components/checkins-page.tsx` | :17,18
- Edit: `src/features/cx-queue/components/shared.tsx` | :22,23,229,243,278,280 (`fmt` already re-exported; migrate remaining direct calls)
- Edit: `src/features/cx-hub/components/hub-shared.tsx` | :40,46,279,290,293,407,409
- Edit: `src/features/cx-hub/components/ecosystem-scene.tsx` | :316,317,2677,2866
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | :433
- Edit: `src/features/cx-productivity/components/pv-shared.tsx` | :17,23,233,241
- Edit: `src/features/cx-productivity/components/my-status-page.tsx` | :112

### Context
- `src/features/shared/lib/format.ts` | `fmt` (B17-01)
- `src/features/shared/lib/adapters.ts:133` | `formatDate_`

### Contract
As B17-02. `queue/components/shared.tsx` keeps the `fmt` re-export; its other direct `Intl`/`toLocaleString` calls migrate too.
Out of scope: lib files (`heatmap-engine.ts`, `tph/*`, `settings.ts`, `prod-validation.ts` — data formatting, not display); files not listed.

### Actions
1. `heatmap-page.tsx`: swap sites :542,713 to shared helpers where output identical.
2. `checkins-page.tsx`: swap sites :17,18.
3. `queue/components/shared.tsx`: swap remaining direct `Intl`/`toLocaleString` calls :22,23,229,243,278,280 (keep `fmt` re-export).
4. `hub-shared.tsx`: swap sites :40,46,279,290,293,407,409.
5. `ecosystem-scene.tsx`: swap sites :316,317,2677,2866.
6. `my-day-page.tsx`: swap site :433.
7. `pv-shared.tsx`: swap sites :17,23,233,241.
8. `my-status-page.tsx`: swap site :112; record kept sites in results.
9. `npx eslint` + `npx tsc --noEmit`.

### Done when
- listed files use shared helpers for display formatting (or sites documented as intentionally different)

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-queue/components src/features/cx-hub/components src/features/cx-productivity/components` -> clean

### Handoff
None.
Write results/B17-03.md (<=10 lines); TL alone updates TRACKER.md.

## Completion
All 3 child leaves done; `fmt` lives in `shared/lib/format.ts`, feature duplicates re-export it, and component display formatting routes through shared helpers.
