# S04-01: overview — page head + greeting sub + 4-stat grid
Kind: mini
ID: S04-01
Parent: S04
Owner: dev
Depends: S02-04, S02-06
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=180; minutes=10

## Goal
The top of `overview-page.tsx` matches mock 02: `.page-head` with a
greeting-style `.page-title` + `.page-sub` summary, `.page-actions`, then a
`.grid.grid-4` of `.stat` cards with tone strips and `.delta` chips.

## Files
- Edit: `src/features/cx-hub/components/overview-page.tsx` | head + stat-row region

## Context
- `mockups/pages/02-home.html:79-112` | head + 4 stats (bad/open/warn/ok tones, delta chips)
- `src/features/cx-hub/components/overview-page.tsx:426` | `<section className="cxp dq-page" aria-busy>` root — keep it
- `src/features/cx-hub/components/overview-page.tsx:267-425` | `Mu()` main component: existing data sources for stats
- `src/features/cx-hub/components/hub-shared.tsx:233-240` | current dq-head helper if still used here

## Contract
- Head: `.page-head` > `.page-title` (greeting: existing user-name data +
  `D('Good morning, {name}')`-style pattern if the page already computes
  one, else keep page title) + `.page-sub` one-liner built from REAL
  loaded counts (mock shows bolded counts — reuse the page's fetched
  numbers; omit any bolded item that has no data).
- `.page-actions`: keep existing refresh/primary actions as `.btn` /
  `.btn.btn-primary` (mock shows Refresh + New check-in — map to the
  page's real actions only).
- Stat grid: `.grid.grid-4` of `.stat` cards — `.stat-l` (icon + label),
  `.stat-v.num`, `.stat-d` with `.delta.up/.down/.up.good` where a real
  comparison value exists; `data-tone="bad|warn|ok"` on the matching mock
  slots. Keep `D()` on labels.
- Keep `aria-labelledby="page-title"`, `.cxp`, `aria-busy`, `D()`.

## Actions
1. Restructure the head block to `.page-head`/`.page-title`/`.page-sub`/`.page-actions`.
2. Build the stat grid from the page's loaded data (4 slots, tones/deltas per mock).
3. Remove/replace the old head + prose block it supersedes.
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Head + 4 stats render like mock 02 (tones/delta present where data exists).
- `.cxp[aria-busy]` root + `page-title` id intact.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S04-02 continues this file below the stat grid.
Write results/S04-01.md (<=10 lines); TL alone updates TRACKER.md.
