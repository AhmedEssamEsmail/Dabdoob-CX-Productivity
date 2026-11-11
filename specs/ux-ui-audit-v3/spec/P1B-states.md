# P1B-03: States & tables — B3 empty states, B13 loading CLS, B7 table scroll
Kind: package
ID: P1B-03
Dispatch: NEVER

## Goal and contract
Data-driven `.map()` renders must be guarded by designed empty/loading/error states via shared `Empty`/`PageStates` (`src/features/shared/components/ui/Empty.tsx`, `PageStates.tsx`). Loading-conditionals that collapse layout (`{loading ? null : <X>}`) get a same-size `Skeleton` (`ui/Skeleton.tsx`) instead of unmounting. Every `<table>` sits inside a horizontal-scroll region: shared `TableScroll` (`ui/TableScroll.tsx`: `label` required, optional `minWidth`/`fade`, renders `role="region" tabIndex=0`) or an existing `overflow-x:auto` feature wrapper, which should be swapped to `TableScroll` when the change is mechanical.
Non-goals: redesigning states/tables, files not listed.

## Children
| ID | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| B3-01 | dev | B10-03, B12-02, B12-06, B9-01 | B3 queue+productivity (7 files) | 7/9/120/10 |
| B3-02 | dev | B10-02, B10-01, B12-03 | B3 quality+hub+people (8 files) | 8/9/140/10 |
| B7-01 | dev | B3-02 | B7 quality-analytics tables :150-750 | 1/9/90/10 |
| B7-02 | dev | B7-01 | B7 quality-analytics :750-1200 + charts | 2/8/80/10 |
| B7-03 | dev | B3-02 | B7 audit-queue-detail + qa-shared | 2/10/100/10 |
| B7-04 | dev | B12-03, B10-02 | B7 quality rest (9 files) | 9/9/90/10 |
| B7-05 | dev | B3-01 | B7 queue tables (4 files) | 4/9/90/10 |
| B7-06 | dev | B10-02 | B7 people tables (3 files) | 3/8/80/9 |
| B7-07 | dev | B10-01 | B7 hub tables (4 files) | 4/7/70/8 |
| B7-08 | dev | B3-01 | B7 productivity tables (5 files) | 5/10/90/10 |
| B13-01 | dev | B7-03, B7-04, B7-06, B10-01 | B13 CLS quality+people+desk (7 files) | 7/8/80/9 |
| B13-02 | dev | B7-05, B7-07, B12-01, B7-08 | B13 CLS queue+hub+prod (4 files) | 4/5/50/8 |

## B3-01: empty states — cx-queue + cx-productivity
Kind: mini
ID: B3-01
Parent: P1B-03
Owner: dev
Depends: B10-03, B12-02, B12-06, B9-01
Criteria: PLAN B3
Skills: none
Budget: files=7; actions=9; changed_lines=120; minutes=10

### Goal
Every data-driven `.map()` render in the listed files is preceded by an `Empty`/designed-state branch — no silent empty lists.

### Files
- Edit: `src/features/cx-queue/components/scheduler-page.tsx` | maps :115-1105 (25 hits; audit data lists only)
- Edit: `src/features/cx-queue/components/aging-page.tsx` | maps :64-306 (14 hits)
- Edit: `src/features/cx-queue/components/queue-page.tsx` | maps :46-316 (9 hits)
- Edit: `src/features/cx-productivity/components/tph-grid-views.tsx` | maps :84-1248 (36 hits)
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | maps :91,162
- Edit: `src/features/cx-productivity/components/pv-shared.tsx` | maps :82-318 (12 hits)
- Edit: `src/features/cx-productivity/components/tph-grid-matrix.tsx` | maps :58-469 (15 hits)

### Context
- `src/features/shared/components/ui/Empty.tsx` + `PageStates.tsx` | shared empty/loading/error
- `src/features/cx-operations/components/trackers-page.tsx:699-703` | precedent: `empty ? <Empty …/> : rows.length ? <TableScroll>…`

### Contract
For each `.map()` over fetched data, ensure the parent branch renders `<Empty title body/>` (or feature-equivalent designed state) when the collection is empty. Static option/legend maps and maps guarded upstream are out of scope — fix only unguarded data renders.
Out of scope: files already importing Empty/PageStates (covered); restyling.

### Actions
1. `scheduler-page.tsx`: audit `.map(` sites :115-1105 (25 hits; data lists only); add `Empty` guards where unguarded.
2. `aging-page.tsx`: audit `.map(` sites :64-306 (14 hits).
3. `queue-page.tsx`: audit `.map(` sites :46-316 (9 hits).
4. `tph-grid-views.tsx`: audit `.map(` sites :84-1248 (36 hits).
5. `tph-grid-page.tsx`: audit `.map(` sites :91,162.
6. `pv-shared.tsx`: audit `.map(` sites :82-318 (12 hits).
7. `tph-grid-matrix.tsx`: audit `.map(` sites :58-469 (15 hits).
8. Re-grep audited files: every unguarded data `.map` has an `Empty` branch.
9. `npx eslint` + `npx tsc --noEmit`.

### Done when
- every unguarded data `.map` in listed files has a designed empty branch
- pages show `Empty` (not blank) when the list is empty at 375/1024px

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-queue/components src/features/cx-productivity/components` -> clean

### Handoff
None.
Write results/B3-01.md (<=10 lines); TL alone updates TRACKER.md.

## B3-02: empty states — cx-quality + cx-hub + cx-people
Kind: mini
ID: B3-02
Parent: P1B-03
Owner: dev
Depends: B10-02, B10-01, B12-03
Criteria: PLAN B3
Skills: none
Budget: files=8; actions=9; changed_lines=140; minutes=10

### Goal
Every data-driven `.map()` render in the listed files has a designed empty branch.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-detail.tsx` | maps :98-1483 (24 hits)
- Edit: `src/features/cx-quality/components/audit-queue-coverage.tsx` | maps :70-154 (4 hits)
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | maps :145-1176 (21 hits)
- Edit: `src/features/cx-quality/components/my-auditor-kpis-page.tsx` | maps :47-124 (3 hits)
- Edit: `src/features/cx-hub/components/ecosystem-scene.tsx` | maps :321-2538 (16 hits; 3D-scene tags — guard only UI lists)
- Edit: `src/features/cx-hub/components/ecosystem-ui.tsx` | map :33
- Edit: `src/features/cx-people/components/carried-review.tsx` | maps :38,63
- Edit: `src/features/cx-people/components/pw.tsx` | maps :297,375

### Context
- `src/features/shared/components/ui/Empty.tsx` + `PageStates.tsx` | shared states

### Contract
As B3-01.
Out of scope: three.js scene-internal iteration (markers/geometry); files already using Empty.

### Actions
1. `audit-queue-detail.tsx`: audit `.map(` sites :98-1483 (24 hits); add `Empty` guards where unguarded.
2. `audit-queue-coverage.tsx`: audit `.map(` sites :70-154 (4 hits).
3. `quality-analytics-page.tsx`: audit `.map(` sites :145-1176 (21 hits).
4. `my-auditor-kpis-page.tsx`: audit `.map(` sites :47-124 (3 hits).
5. `ecosystem-scene.tsx`: audit `.map(` sites :321-2538 (16 hits; guard only UI lists, not scene-internal iteration).
6. `ecosystem-ui.tsx`: audit `.map(` site :33.
7. `carried-review.tsx`: audit `.map(` sites :38,63.
8. `pw.tsx`: audit `.map(` sites :297,375.
9. `npx eslint` + `npx tsc --noEmit`.

### Done when
- every unguarded data `.map` in listed files has a designed empty branch

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-quality/components src/features/cx-hub/components src/features/cx-people/components` -> clean

### Handoff
None.
Write results/B3-02.md (<=10 lines); TL alone updates TRACKER.md.

## B7-01: table scroll — quality-analytics-page tables :150-750
Kind: mini
ID: B7-01
Parent: P1B-03
Owner: dev
Depends: B3-02
Criteria: PLAN B7
Skills: none
Budget: files=1; actions=9; changed_lines=90; minutes=10

### Goal
The 9 `<table>` sites at lines ~177-741 of `quality-analytics-page.tsx` render inside `TableScroll` (or an existing `overflow-x:auto` wrapper converted to it).

### Files
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | tables :177,263,307,357,453,531,597,674,741

### Context
- `src/features/shared/components/ui/TableScroll.tsx:12-54` | `label` required; `minWidth`/`fade` optional; barrel `ui/index.ts`
- `src/features/cx-queue/components/aging-page.tsx:217,261` | precedent TableScroll usage

### Contract
Wrap each bare `<table>` in `<TableScroll label="<region name>">` with a descriptive `label`; keep existing `className` on the table. If a table already sits inside an `overflow-x:auto` wrapper, convert the wrapper div to `TableScroll` (merge className) — no double wrappers.
Out of scope: tables at lines >750 (B7-02); table markup restyle.

### Actions
1. Wrap `<table>` :177 in `TableScroll` (descriptive `label`).
2. Wrap `<table>` :263.
3. Wrap `<table>` :307.
4. Wrap `<table>` :357.
5. Wrap `<table>` :453.
6. Wrap `<table>` :531.
7. Wrap `<table>` :597.
8. Wrap `<table>` sites :674 and :741.
9. `npx eslint` + `npx tsc --noEmit`; check the page at 375px for no h-scroll.

### Done when
- every `<table>` in :150-750 is inside `TableScroll`; page has no body h-scroll at 375px

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-quality/components/quality-analytics-page.tsx` -> clean

### Handoff
B7-02 wraps the remaining tables in this file (sequential — same file).
Write results/B7-01.md (<=10 lines); TL alone updates TRACKER.md.

## B7-02: table scroll — quality-analytics-page tables :750-1200 + charts
Kind: mini
ID: B7-02
Parent: P1B-03
Owner: dev
Depends: B7-01
Criteria: PLAN B7
Skills: none
Budget: files=2; actions=8; changed_lines=80; minutes=10

### Goal
The remaining 6 `<table>` sites in `quality-analytics-page.tsx` plus the 2 in `quality-analytics-charts.tsx` render inside `TableScroll`.

### Files
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | tables :783,844,897,979,1009,1035
- Edit: `src/features/cx-quality/components/quality-analytics-charts.tsx` | tables :378,474

### Context
- `src/features/shared/components/ui/TableScroll.tsx:12-54` | API

### Contract
As B7-01.

### Actions
1. Wrap `<table>` :783 in `TableScroll`.
2. Wrap `<table>` :844.
3. Wrap `<table>` :897.
4. Wrap `<table>` :979.
5. Wrap `<table>` :1009.
6. Wrap `<table>` :1035.
7. Wrap `quality-analytics-charts.tsx` tables :378,474.
8. `npx eslint` + `npx tsc --noEmit`.

### Done when
- `grep -n "<table" src/features/cx-quality/components/quality-analytics-page.tsx` → all inside TableScroll
- no body h-scroll at 375px

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-quality/components/quality-analytics-page.tsx src/features/cx-quality/components/quality-analytics-charts.tsx` -> clean

### Handoff
B1-03 and B8-04 continue on quality-analytics-page after styles/links lands (serialized via index order).
Write results/B7-02.md (<=10 lines); TL alone updates TRACKER.md.

## B7-03: table scroll — audit-queue-detail + qa-shared
Kind: mini
ID: B7-03
Parent: P1B-03
Owner: dev
Depends: B3-02
Criteria: PLAN B7
Skills: none
Budget: files=2; actions=10; changed_lines=100; minutes=10

### Goal
All `<table>` sites in `audit-queue-detail.tsx` (6) and unwrapped ones in `qa-shared.tsx` (4) render inside `TableScroll`.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-detail.tsx` | tables :483,798,1013,1197,1244,1423
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | tables :869,1397,1427,1453 (keep sites already inside TableScroll :868/959)

### Context
- `src/features/shared/components/ui/TableScroll.tsx:12-54` | API; qa-shared already imports it (:47)

### Contract
As B7-01; skip tables already inside TableScroll — convert only bare ones, no double wrapping.

### Actions
1. `audit-queue-detail.tsx`: wrap `<table>` :483 in `TableScroll`.
2. `audit-queue-detail.tsx`: wrap `<table>` :798.
3. `audit-queue-detail.tsx`: wrap `<table>` :1013.
4. `audit-queue-detail.tsx`: wrap `<table>` :1197.
5. `audit-queue-detail.tsx`: wrap `<table>` :1244.
6. `audit-queue-detail.tsx`: wrap `<table>` :1423.
7. `qa-shared.tsx`: wrap `<table>` :869.
8. `qa-shared.tsx`: wrap `<table>` :1397.
9. `qa-shared.tsx`: wrap `<table>` sites :1427,1453 (skip :868/959 — already inside TableScroll).
10. `npx eslint` + `npx tsc --noEmit`.

### Done when
- every `<table>` in both files is inside `TableScroll`

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-quality/components/audit-queue-detail.tsx src/features/cx-quality/components/qa-shared.tsx` -> clean

### Handoff
None.
Write results/B7-03.md (<=10 lines); TL alone updates TRACKER.md.

## B7-04: table scroll — remaining cx-quality tables
Kind: mini
ID: B7-04
Parent: P1B-03
Owner: dev
Depends: B12-03, B10-02
Criteria: PLAN B7
Skills: none
Budget: files=9; actions=9; changed_lines=90; minutes=10

### Goal
All `<table>` sites in the remaining cx-quality files render inside `TableScroll`.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | tables :433,589
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | table :323
- Edit: `src/features/cx-quality/components/ctls-page.tsx` | table :462
- Edit: `src/features/cx-quality/components/audit-queue-coverage.tsx` | table :125
- Edit: `src/features/cx-quality/components/qa-forms-page.tsx` | table :402
- Edit: `src/features/cx-quality/components/disputes-page.tsx` | tables :225,280
- Edit: `src/features/cx-quality/components/my-auditor-kpis-page.tsx` | tables :57,111
- Edit: `src/features/cx-quality/components/calibration-page.tsx` | table :376
- Edit: `src/features/cx-quality/components/kb-gaps-page.tsx` | table :154 (verify — may already be inside TableScroll :153)

### Context
- `src/features/shared/components/ui/TableScroll.tsx:12-54` | API

### Contract
As B7-01.

### Actions
1. `audit-queue-page.tsx`: wrap `<table>` sites :433,589.
2. `quality-scores-page.tsx`: wrap `<table>` :323.
3. `ctls-page.tsx`: wrap `<table>` :462.
4. `audit-queue-coverage.tsx`: wrap `<table>` :125.
5. `qa-forms-page.tsx`: wrap `<table>` :402.
6. `disputes-page.tsx`: wrap `<table>` sites :225,280.
7. `my-auditor-kpis-page.tsx`: wrap `<table>` sites :57,111.
8. `calibration-page.tsx`: wrap `<table>` :376; verify `kb-gaps-page.tsx` :154 (may already be inside TableScroll :153).
9. `npx eslint` + `npx tsc --noEmit`.

### Done when
- every `<table>` in listed files is inside `TableScroll`; no h-scroll at 375px

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-quality/components` -> clean

### Handoff
None.
Write results/B7-04.md (<=10 lines); TL alone updates TRACKER.md.

## B7-05: table scroll — cx-queue tables
Kind: mini
ID: B7-05
Parent: P1B-03
Owner: dev
Depends: B3-01
Criteria: PLAN B7
Skills: none
Budget: files=4; actions=9; changed_lines=90; minutes=10

### Goal
All `<table>` sites in the listed cx-queue files render inside `TableScroll` (existing `.sch-scroll`/`.sch-tl-wrap` `overflow-x:auto` wrappers convert to it where mechanical).

### Files
- Edit: `src/features/cx-queue/components/scheduler-page.tsx` | tables :143,251,448,623
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | tables :62,685,896
- Edit: `src/features/cx-queue/components/analytics-page.tsx` | table :394
- Edit: `src/features/cx-queue/components/checkins-page.tsx` | table :207

### Context
- `src/features/shared/components/ui/TableScroll.tsx:12-54` | API
- `src/app/styles/queue.css:160,184` | `.sch-scroll`/`.sch-tl-wrap` — retire only if the wrapper becomes TableScroll

### Contract
As B7-01; converting a feature wrapper keeps its className on the TableScroll (`cx('tblscroll', className)` merges). aging-page/queue-page already use TableScroll — not in scope.
Out of scope: aging-page.tsx, queue-page.tsx (already wrapped).

### Actions
1. `scheduler-page.tsx`: wrap `<table>` :143 in `TableScroll` (convert a direct-parent scroll div where mechanical).
2. `scheduler-page.tsx`: wrap `<table>` :251.
3. `scheduler-page.tsx`: wrap `<table>` :448.
4. `scheduler-page.tsx`: wrap `<table>` :623.
5. `heatmap-page.tsx`: wrap `<table>` sites :62,685,896.
6. `analytics-page.tsx`: wrap `<table>` :394.
7. `checkins-page.tsx`: wrap `<table>` :207.
8. Retire `.sch-scroll`/`.sch-tl-wrap` css only where the wrapper became TableScroll.
9. `npx eslint` + `npx tsc --noEmit`.

### Done when
- every `<table>` in listed files is inside a scroll region; no h-scroll at 375px

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-queue/components` -> clean

### Handoff
None.
Write results/B7-05.md (<=10 lines); TL alone updates TRACKER.md.

## B7-06: table scroll — cx-people tables
Kind: mini
ID: B7-06
Parent: P1B-03
Owner: dev
Depends: B10-02
Criteria: PLAN B7
Skills: none
Budget: files=3; actions=8; changed_lines=80; minutes=9

### Goal
All `<table>` sites in the listed cx-people files render inside `TableScroll`.

### Files
- Edit: `src/features/cx-people/components/one-on-ones-views.tsx` | tables :210,717
- Edit: `src/features/cx-people/components/agents-page.tsx` | tables :160,363,704,819,846
- Edit: `src/features/cx-people/components/coaching-page.tsx` | table :106

### Context
- `src/features/shared/components/ui/TableScroll.tsx:12-54` | API

### Contract
As B7-01.

### Actions
1. `one-on-ones-views.tsx`: wrap `<table>` sites :210,717 in `TableScroll`.
2. `agents-page.tsx`: wrap `<table>` :160.
3. `agents-page.tsx`: wrap `<table>` :363.
4. `agents-page.tsx`: wrap `<table>` :704.
5. `agents-page.tsx`: wrap `<table>` :819.
6. `agents-page.tsx`: wrap `<table>` :846.
7. `coaching-page.tsx`: wrap `<table>` :106.
8. `npx eslint` + `npx tsc --noEmit`.

### Done when
- every `<table>` in listed files is inside `TableScroll`

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-people/components` -> clean

### Handoff
None.
Write results/B7-06.md (<=10 lines); TL alone updates TRACKER.md.

## B7-07: table scroll — cx-hub tables
Kind: mini
ID: B7-07
Parent: P1B-03
Owner: dev
Depends: B10-01
Criteria: PLAN B7
Skills: none
Budget: files=4; actions=7; changed_lines=70; minutes=8

### Goal
All `<table>` sites in the listed cx-hub files render inside `TableScroll`.

### Files
- Edit: `src/features/cx-hub/components/people-holidays-page.tsx` | tables :298,459
- Edit: `src/features/cx-hub/components/overview-page.tsx` | tables :79,311
- Edit: `src/features/cx-hub/components/admin-roster-page.tsx` | table :219
- Edit: `src/features/cx-hub/components/admin-config-page.tsx` | table :87

### Context
- `src/features/shared/components/ui/TableScroll.tsx:12-54` | API

### Contract
As B7-01.

### Actions
1. `people-holidays-page.tsx`: wrap `<table>` sites :298,459 in `TableScroll`.
2. `overview-page.tsx`: wrap `<table>` :79.
3. `overview-page.tsx`: wrap `<table>` :311.
4. `admin-roster-page.tsx`: wrap `<table>` :219.
5. `admin-config-page.tsx`: wrap `<table>` :87.
6. Re-grep: every `<table>` in listed files is inside `TableScroll`.
7. `npx eslint` + `npx tsc --noEmit`.

### Done when
- every `<table>` in listed files is inside `TableScroll`

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-hub/components` -> clean

### Handoff
None.
Write results/B7-07.md (<=10 lines); TL alone updates TRACKER.md.

## B7-08: table scroll — cx-productivity tables
Kind: mini
ID: B7-08
Parent: P1B-03
Owner: dev
Depends: B3-01
Criteria: PLAN B7
Skills: none
Budget: files=5; actions=10; changed_lines=90; minutes=10

### Goal
All `<table>` sites in the listed cx-productivity files render inside `TableScroll`.

### Files
- Edit: `src/features/cx-productivity/components/tph-grid-views.tsx` | tables :881,1076
- Edit: `src/features/cx-productivity/components/pv-shared.tsx` | table :215
- Edit: `src/features/cx-productivity/components/status-validation-page.tsx` | tables :165,464
- Edit: `src/features/cx-productivity/components/productivity-analytics-page.tsx` | tables :143,198,264
- Edit: `src/features/cx-productivity/components/tph-grid-matrix.tsx` | tables :186,268,327,458

### Context
- `src/features/shared/components/ui/TableScroll.tsx:12-54` | API

### Contract
As B7-01.

### Actions
1. `tph-grid-views.tsx`: wrap `<table>` :881 in `TableScroll`.
2. `tph-grid-views.tsx`: wrap `<table>` :1076.
3. `pv-shared.tsx`: wrap `<table>` :215.
4. `status-validation-page.tsx`: wrap `<table>` sites :165,464.
5. `productivity-analytics-page.tsx`: wrap `<table>` sites :143,198,264.
6. `tph-grid-matrix.tsx`: wrap `<table>` :186.
7. `tph-grid-matrix.tsx`: wrap `<table>` :268.
8. `tph-grid-matrix.tsx`: wrap `<table>` :327.
9. `tph-grid-matrix.tsx`: wrap `<table>` :458.
10. `npx eslint` + `npx tsc --noEmit`.

### Done when
- every `<table>` in listed files is inside `TableScroll`

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-productivity/components` -> clean

### Handoff
None.
Write results/B7-08.md (<=10 lines); TL alone updates TRACKER.md.

## B13-01: loading-CLS — cx-quality, cx-people, cx-desk
Kind: mini
ID: B13-01
Parent: P1B-03
Owner: dev
Depends: B7-03, B7-04, B7-06, B10-01
Criteria: PLAN B13
Skills: none
Budget: files=7; actions=8; changed_lines=80; minutes=9

### Goal
Loading-conditionals in the listed files render a same-size `Skeleton` placeholder instead of unmounting content (`? null`), so parents don't resize between loading and loaded.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | conditional :519
- Edit: `src/features/cx-quality/components/audit-queue-detail.tsx` | conditionals :378,462,573,689,779,898,998,1189,1307,1459,1471
- Edit: `src/features/cx-people/components/tl-tasks-page.tsx` | conditionals :74,774,915
- Edit: `src/features/cx-people/components/one-on-ones-views.tsx` | conditionals :697-732,1241,1716,1771,2269,2301
- Edit: `src/features/cx-people/components/meetings-page.tsx` | conditional :799
- Edit: `src/features/cx-people/components/agents-page.tsx` | conditionals :423,775
- Edit: `src/features/cx-desk/components/tl-performance-page.tsx` | conditionals :354-380

### Context
- `src/features/shared/components/ui/Skeleton.tsx` | shared placeholder
- `src/features/shared/components/ui/PageStates.tsx` | `LinesSkeleton` precedent

### Contract
Fix only conditionals driven by a loading/busy state that collapse visible layout (the null branch removes rendered size). Skeleton must approximate the final element's size (use the same classes or an explicit matching block-size). Data-conditional `? null` (feature flags, optional rows) and non-layout null branches are out of scope.
Out of scope: non-loading conditionals; files not listed.

### Actions
1. `audit-queue-page.tsx` :519 — loading-driven `? null` → same-size `Skeleton`.
2. `audit-queue-detail.tsx` :378,462,573,689,779,898,998,1189,1307,1459,1471 — classify each; replace loading-driven unmounts with matching `Skeleton`.
3. `tl-tasks-page.tsx` :74,774,915 — same.
4. `one-on-ones-views.tsx` :697-732,1241,1716,1771,2269,2301 — same.
5. `meetings-page.tsx` :799 — same.
6. `agents-page.tsx` :423,775 — same.
7. `tl-performance-page.tsx` :354-380 — same.
8. `npx eslint` + `npx tsc --noEmit`; toggle a reload on one page and confirm no jump at 375/1024px.

### Done when
- no loading-driven unmount remains in listed files; header/toolbar stays put loading→loaded

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-quality/components src/features/cx-people/components src/features/cx-desk/components` -> clean

### Handoff
None.
Write results/B13-01.md (<=10 lines); TL alone updates TRACKER.md.

## B13-02: loading-CLS — cx-queue, cx-hub, cx-productivity
Kind: mini
ID: B13-02
Parent: P1B-03
Owner: dev
Depends: B7-05, B7-07, B12-01, B7-08
Criteria: PLAN B13
Skills: none
Budget: files=4; actions=5; changed_lines=50; minutes=8

### Goal
Loading-conditionals in the listed files render a same-size `Skeleton` instead of unmounting.

### Files
- Edit: `src/features/cx-queue/components/scheduler-page.tsx` | conditional :460 (+ skeleton heights :230,316,1129 keep)
- Edit: `src/features/cx-hub/components/overview-page.tsx` | conditionals :326,424-427,493
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | conditionals :148,365,608,893
- Edit: `src/features/cx-productivity/components/tph-grid-views.tsx` | conditionals :176,291,373,824,1053,1067

### Context
- `src/features/shared/components/ui/Skeleton.tsx` | shared placeholder

### Contract
As B13-01.

### Actions
1. `scheduler-page.tsx` :460 — loading-driven `? null` → same-size `Skeleton` (keep existing skeleton heights :230,316,1129).
2. `overview-page.tsx` :326,424-427,493 — replace loading unmounts with matching `Skeleton`.
3. `my-day-page.tsx` :148,365,608,893 — same.
4. `tph-grid-views.tsx` :176,291,373,824,1053,1067 — same.
5. `npx eslint` + `npx tsc --noEmit`.

### Done when
- no loading-driven unmount remains; no layout jump loading→loaded at 375/1024px

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-queue/components src/features/cx-hub/components src/features/cx-productivity/components` -> clean

### Handoff
None.
Write results/B13-02.md (<=10 lines); TL alone updates TRACKER.md.

## Completion
All 12 child leaves done; every data `.map` has a designed empty branch, no loading conditional unmounts layout, and every `<table>` in features renders inside `TableScroll` (or a verified `overflow-x:auto` wrapper).
