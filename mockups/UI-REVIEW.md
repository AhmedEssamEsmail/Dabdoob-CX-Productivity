# CX-Hub UI review — 8 Nov 2026

Method: all 43 routes screenshotted via `.devin/work/shoot-new.mjs` (admin/agent/
stranger contexts, light + dark, mobile for 6 routes, RTL for 3). Output:
`.devin/work/shots/redesign/` (103 shots + computed-style dumps + DOM outlines).
Findings below are grouped global → pages. Mockups for the 10 main screens live
in `mockups/pages/` (open `mockups/index.html`).

## Global / shell

| # | Finding | Evidence |
|---|---------|----------|
| G1 | Nav items render literal `•` list markers — `<li>` bullets never reset. Looks like a bug on every page. | every shot, rail |
| G2 | "N Insight" toast is fixed bottom-left, overlapping rail footer and nav links (covers "Operations & Trackers", "FCR"). | home.png, audit-queue.png |
| G3 | Product identity fragments: login says "CX Productivity"; rail brand swaps "CX Helm" / "CX Helm Quality" / "CX Helm Productivity" / "CX Helm People" per section. One product, five names. | auth-login.png vs section shots |
| G4 | No search / command palette — 40 destinations, nav-only discovery. | all |
| G5 | Sparse pages render as one huge gray skeleton panel — no designed empty state, no partial layout while loading. | status-validation, my-status, audit-queue, team-scores, 1:1s |
| G6 | Aesthetic is hairline-only: monochrome gray + single pine accent, minimal elevation and no visual anchor. Reads "wireframe" on sparse pages, "austere" on dense ones. | all |
| G7 | Notifications/"Insights" have no home — single floating toast only. | all |

## Pages

### Sign in (`/auth/login`) — worst offender
- Bare column floating on empty bg: no card, no logo mark, no visual boundary. `state-screen` = `35rem` left-aligned column at `14vh` — looks unfinished rather than minimal.
- Wrong product name ("CX Productivity").
- No error-state design, no forgot-password affordance, no footer context.
- Dark mode is the same barren column on dark bg.

### Home / Overview (`/`, `/overview`)
- Best page family: has "Needs you today" + cards. Issues: skeleton walls in shot, stat cards have no delta/trend context, no greeting/date anchor, insight toast collides with rail.

### My day (`/my-day`)
- Redirected to Home for admin (gate), so the page itself is rare. No visual agenda structure visible — prose + lists only.

### Queue health (`/queue`) — strongest page
- Real data: KPI cards, age-mix stacked bar, per-queue table with inline mix + age chips.
- Issues: KPI cards excessively tall and sparse; "Ours to work / Not assigned" odd 2-col split; table row subtitles make rows very tall; "Refresh now" far-right alignment is fine but the read-timestamp text is easy to miss.

### Aging cases (`/aging`)
- Strong: age ramp + queue×age matrix.
- Issues: the matrix is a wall of identical white boxes — the "redder = older" story doesn't reach the cells themselves (all cells look the same); legend only at top.

### Audit Desk (`/audit-queue`)
- 3-line documentation paragraph as the page description; then one big skeleton panel. No visible work-queue structure, no quota/progress indicator.

### Status validation (`/status-validation`)
- Skeleton wall; flag list/detail pattern not visually expressed.

### Agents (`/agents`)
- Mid-page paragraph of KPI math (4 lines, dense); workbook admin table embedded in the scoring page; "No data in this period" empty state is a bare table row.
- No leaderboard affordances (rank, trend, band chips) — the most-scanned page has the least hierarchy.

### TPH and caps (`/tph`)
- Decent structure (tabs, KPI strip, hourly chart) but: date controls stacked vertically top-right look broken; "Team % of cap" yellow banner card duplicates the KPI card below it; "not yet"/"—" states unclear.

### My status (`/my-status`, agent)
- Skeleton wall only; before/after productivity story isn't visualized.

### Admin (`/admin`)
- Ships "Not built yet." inline; "Connected apps" is a grid of read-only retired Apps Script URLs — dead UI taking prime space.

## Recommended direction (applied in mockups)

1. **Shell**: kill bullets; grouped nav with section labels + badge counts; stable "CX Helm" brand; ⌘K search; user card in rail footer; toasts bottom-right of content.
2. **Login**: centered card + brand mark + correct name + designed error/footer.
3. **Purpose text**: one line max; detail moved to `?` affordances / notes.
4. **Data density**: keep it — it's an ops console — but add hierarchy: KPI numerals, delta chips, status pills, inline bars, sparklines, master–detail on workflow pages.
5. **States**: designed empty states (icon + one line + action), proper loading skeletons shaped like the final content, "not built" hidden behind admin-only flags.
6. **Tokens**: keep the pine accent + age ramp (already good, already tokenized); add elevation and a slightly warmer neutral background so surfaces read as cards.
