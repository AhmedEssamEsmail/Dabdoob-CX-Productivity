# ux report - home-quality-cards - round 1 (FULL)
Verdict: FAIL
Open: 0/0/1/2
States checked: loading (LoTiles skeleton before `e`), empty/null scores ('–' renders), error (`sh` retry panel, quality row hidden when `e` null), disabled (n/a — no controls), long text (labels fixed; `stat-v` large single value can't overflow), mobile (`.page-stats` `auto-fit minmax(11rem,1fr)` → 1 col at 320/375, no h-scroll), dark (all token colors, no hardcoded values), keyboard (no new interactive elements; removed `If` button reduces tab stops intentionally), focus (n/a — nothing focusable in the row)

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | MED | `src/features/cx-hub/components/overview-page.tsx`:496,501,506 (`.stat-v` values) | QA score is 0–100 (`qaFinalScore_` = `(earned/possible)*100`); every sibling renders it with a unit: Team pulse same page `{r.v}%` (line 610), `ScoreChip` `{score}%` (qa-shared.tsx:249), scores page `{f.score}<small>%</small>` and delta `'+N points'` (quality-scores-page.tsx:576). New cards render bare `87.4` / `+2.3` — ambiguous scale beside the pulse `87%` on the same screen | Render `{q.month == null ? '–' : `${q.month}%`}` (same for `q.week`); for the delta append ` pts`/`%` unit, e.g. `{Ql(q.monthDelta ?? null)}%` or match scores-page `'+N points'` phrasing | dev |
| ux-2 | LOW | `overview-page.tsx`:511 (`Open CTLs` value) | When `out.quality = null` (catch path per PLAN), `q.openCtls ?? 0` renders `0` while the three score cards correctly show `–` — a false "zero open CTLs" on an unknown metric | `e.quality ? Hi(q.openCtls ?? 0) : '–'` | dev |
| ux-3 | LOW | `overview-page.tsx`:502,507 (`.stat-d` copy) | `signed change` describes the formatting, not the meaning; `quota week` is internal jargon vs sibling hints that explain plainly (`nothing in the oldest band`, `agents and leads asking for help`) | Reword, e.g. `score points vs last month` and `since <weekday> (this week)` or `current week` | dev |

Notes / passes:
- `role="group" aria-label="Quality"` satisfies PLAN #5 — the row is distinguishable from the header `.page-stats` ticket row (which has no name).
- Contrast measured from tokens: `.stat-l` `--cx-ink-2` #4f5d6b on `--cx-surface` #fff ≈ 6.7:1; `.stat-d` `--cx-ink-3` (ink-2 92% + surface 8%) ≈ 6.2:1; `.stat-v` ink #1d2632 ≈ 14:1. Dark theme ink-2 #9aa9b4 / ink-3 on #1a232b ≈ 8–9:1. All pass 1.4.3.
- Delta sign is text (`+`/`−` from `Ql`), not color-only — 1.4.1 pass.
- `.page-stats--quality` margin-block-end duplicates `.page-stats`'s own `margin-bottom` — harmless redundancy, not logged.
- Removal of `.upnext`/`If` per PLAN verified in diff; exports retained for my-day (out of scope).
- web-design-guidelines: fetch URL unreachable from this environment (no WebFetch tool); applied standard rules — semantic grouping, accessible name, no placeholder, no color-only meaning — all covered above.

Not verified / assumptions: rendered output (no Playwright run — layout judged from CSS/JSX), 200% text resize, live SR announcement of the group, actual `weekStartsOn` copy needs. Agent/specialist gating correct per code (`!e.specialist && e.role !== 'agent'`).
