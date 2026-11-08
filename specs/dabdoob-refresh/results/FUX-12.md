# FUX-12 — agents rank table parity
Status: done
Files: src/features/cx-people/components/agents-page.tsx (only)
Changed: TrendCell spark td + `Trend · 8w` th (colSpan 15), avatar initials in Agent cell,
Behaviour `.pill` precedence (op-loss/N cases/no log/clean) via ScoreCells `trendTd` slot,
Team-KPI `.stat-d` `.delta` chip vs `data.prevTeam` + `D('vs prior period')`.
Checks: `npx eslint` clean; `npx tsc --noEmit` clean; grep hits spark/Trend confirmed.
Handoff: FUX-13 finishes 4-tab chrome; AR key for 'vs prior period' lands via FUX-15.
