# tl-3 — BUILD residual round (reshard leaves + pending dependents)

Scope: dispatch the 5 reshard leaves (S03-17, S06-16, S06-17, S09-16, S09-17 from
spec/leaves.md) plus their 8 pending dependents (S09-04/06/08/11/13, S13-04,
S13-07, S14-01), then re-run full PLAN gates.

## Completed leaves (10/13)

| Leaf | Evidence |
|---|---|
| S06-16 | QueueCore block → `shared/lib/queue-core.ts` verbatim; cx-queue/lib/index.ts re-exports; people libs re-pointed. tsc clean; people+queue 34/34; zero `cx-queue` in cx-people/lib. |
| S06-17 | people shared.tsx local defs (kwTime/kwDay/hm/dayAt/fmt/AsOfHint), Head retired; my-actions → PageShell. `grep cx-queue src/features/cx-people/` = 0 hits — **PP-H1 decouple complete**. people 24/24. |
| S09-16 | PaintGrid +`columnHeaders`/`cornerLabel`/`rowClassName`/`rowHeadClassName`/`style`; stroke-end onCommit (pointerleave commits active stroke — documented divergence); `.cx-paintgrid*` base CSS in cx-kit.css. tsc clean, 10/10. |
| S09-17 | tph `Es` → `<PaintGrid>` with all `.tph-*` hooks; painting ref + window listener deleted; productivity.css head/readonly retargets. One tab stop/grid; readOnly cells focusable. 48/48. |
| S09-04 | `As` cases input → `<AutoSaveInput>` (commit on blur/Enter + isSaving). tsc clean, 16/16. |
| S09-06 | `.cv-auto` on agent-day card `<dl>`s (grid-of-cards shape per contract). tsc clean. |
| S09-08 | `?date`/`?tab`/`?flag`/`?agent`/`?view`/`?week` via useSearchParamState; setTimeout ordering hack removed. tsc clean, 16/16. |
| S09-11 | status-validation `.md` empty pane → `Empty` "Pick a flag"; analytics error → toUserText (admin-aware). refresh.css untouched (rules already cover). tsc clean. |
| S09-13 | agents-by-hour bounds/labels/hint data-derived (09:30 hardcode gone). `wa` label verified against `prod_channel_status`/`prod_wa_groups` = "waiting address" is CORRECT — audit said verify-then-rename, no rename needed. |
| S13-04 | tph-grid-page 2026→242 lines; views→tph-grid-views.tsx, matrix→tph-grid-matrix.tsx, helpers→tph-grid-shared.ts. tsc clean, 16/16. |

Packages completed this round: **S06** (16/16 incl reshard), **S09** (17/17 incl reshard).

## RESHARD_NEEDED → PM (3)

1. **S03-17** (spec/leaves.md#S03-17) — SCOPE_REQUEST, zero edits. S13-06 split moved `xn`+`<Chip status>` to `quality-analytics-charts.tsx` (NOT in Files); CONF_T/qaVerdictStatus/ATTN/qaCountBand also relocated; qa-shared has 2 extra sites (QA_FLAG_LABELS:1200, qaCovTone:1315). Remaining: re-map ChipStatus narrowing to post-split files + shell/ui.tsx Chip re-export. Non-blocking.
2. **S13-07** (spec/S13.md#S13-07) — SCOPE_REQUEST, zero edits. Hot components moved by S13-03/04/05 splits → memo targets now in one-on-ones-views.tsx, tph-grid-matrix.tsx/tph-grid-views.tsx, audit-queue-detail.tsx/audit-queue-coverage.tsx. kpi-logs/queue-page dropped (not in perf-3).
3. **S14-01 residual** (spec/S14.md#S14-01) — spec written + playwright.config.ts updated; 2/3 journeys pass on 4 projects. BLOCKED: `/tph` self-redirect loop — `src/app/tph/page.tsx` re-exports `../tph-grid/page`, whose working-tree version is `redirect('/tph')` (pre-existing dirty-tree edit, mtime pre-session, NOT produced by this build; committed version renders TphGridPage). Did NOT revert — belongs to user/earlier agent. Needs one fix leaf: `src/app/tph/page.tsx` renders `TphGridPage` directly (keep tph-grid→/tph redirect), then re-run `tests/e2e/a11y-keyboard.spec.ts`; also harden the Tabs spec's aria-busy wait (mobile-project flake).

## Gates (final integration, all re-run — logs in specs/ux-ui-audit-v2/logs/tl3-*.log)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS exit 0 |
| `npx eslint .` | PASS 0 errors / 956 warnings |
| `npx vitest run` | PASS 1196/1196 (67 files) |
| `npm run build` | PASS compiled 3.1s, 156/156 pages |
| `npm run test:security` | PASS 4/4 |
| `npm run test:performance` | PASS 14/14 — vacuous stub, unenforced per S14-04/PLAN note |
| `npm run test:e2e` | 118 pass / 7 fail / 10 skip — 5 = PaintGrid spec on known /tph loop (RESHARD item 3); 1 = Tabs mobile aria-busy flake (same item); 1 = tablet auth log-out env flake (same class as r2). **Zero regressions in pre-existing specs.** |

## Notes for PM
- No shard asked for a reviewer/forbidden role this round.
- Worker result files for S09-04/08/11/13 + S14-01 were written to repo-root `results/`; TL copied them into `specs/ux-ui-audit-v2/results/` (old S06-05/S06-10/S07-05 root copies left in place — pre-existing).
- tph-grid-page.tsx is now split (242 lines) — future tph leaves should target the siblings.
- S14 package: S14-01 blocked pending the route fix leaf; S14-02..05 done.
