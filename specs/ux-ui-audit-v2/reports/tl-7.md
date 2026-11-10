# tl report - ux-ui-audit-v2 - round 7 (FIX mode: reports/ux-1.md)

Input: `reports/ux-1.md` (ux gate round 1 — verdict FAIL). PM declared **every row
blocking**, including carried LOWs ux-2/ux-3 (previously deferred — re-activated).
Fix leaves: `spec/fix-ux-1.md` (ux1-02..ux1-07, preflight PASS — one root cause per
leaf). All 6 findings assigned to `dev`, all done.

## Changed files (DELTA scope for reviewer re-check)

| Leaf | Finding | Files changed | Fix |
|---|---|---|---|
| ux1-02 | ux-4 HIGH /queue h-scroll (857px@390) | `src/features/cx-queue/components/queue-page.tsx` | `table.cx-table` wrapped in `<TableScroll label="By queue" minWidth="52rem" fade>` inside `.cc-chart` (:279-380); `ref={h}` kept for useSweep; TableScroll added to ui barrel import :8 |
| ux1-03 | ux-5 MED /overview phantom scroll (474px@390) | `src/app/cx-kit.css` | `inset-inline-start: 0` on `:root .cx-sr, :root .sr-only` (:655) + `position: relative` on `:root .cx-ladder__seg` (:689) — sr-only clip boxes anchor to containing block |
| ux1-04 | ux-6 MED NotConnected zero consumers | `src/features/shared/components/ui/index.ts`, `src/features/shared/components/ui/NotConnected.tsx` | DECISION "delete zero-value wrappers": export + type export removed (:77-78), component file deleted. Adoption path rejected: named sites are a toast string (ecosystem:128) + inline field-hint (admin:257) — not the `.cx-empty` panel shape; `.cx-not-connected*` had zero CSS rules |
| ux1-05 | ux-7 LOW aria-orientation on tabpanel | `src/features/shared/components/ui/Tabs.tsx` | `aria-orientation` dropped on `role="tabpanel"` (:106); kept on `role="tablist"` (:79) |
| ux1-06 | ux-2 LOW cx-empty box-in-box (carried, blocking) | `src/app/cx-kit.css` | `:root .cx-empty p { margin:0; max-width:34ch }` + `:root .cx-panel > .cx-empty { border:0; background:transparent }` after :819 |
| ux1-07 | ux-3 LOW trk-outside chip dot (carried, blocking) | `src/app/styles/operations.css` | `[data-app="operations"] .cx-chip.trk-outside::before { background: currentColor }` (:27) — compound selector (0,3,0) beats `:root .cx-chip::before` order-independently |

Results: `results/ux1-02.md` … `results/ux1-07.md`. No blocked/needs-split leaves.

## Integration gates (round tl7, logs under `logs/tl7-*.log`)

| Gate | Command | Result |
|---|---|---|
| typecheck | `npx tsc --noEmit` | PASS exit 0 |
| eslint | `npx eslint .` | PASS 0 errors / 428 warnings (was 429 at tl6) |
| vitest | `npx vitest run` | PASS 1196/1196 tests, 67 files |
| build | `npm run build` | PASS compiled 2.5s, 156/156 static pages |
| security | `npm run test:security` | PASS 4/4 |
| performance | `npm run test:performance` | PASS 14/14 (vacuous stub — unenforced per S14-04/PLAN note) |
| e2e | `npm run test:e2e` | PASS 125 pass / 0 fail / 10 skip (2.8m) — first fully clean e2e round; even the recurring auth seed flake didn't trigger |

## Notes for ux re-review

- ux-4/ux-5 need rendered re-verification @390 (probe-hscroll2/3 scripts) — code
  fixes are in place per the report's prescribed exact fixes.
- ux-6 resolved via the report's "drop the export" option, not adoption.
- No new deps, no commits/pushes; no review gates run (PM owns ux re-review).
