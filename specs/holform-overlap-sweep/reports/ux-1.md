# ux report - holform-overlap-sweep - round 1 (FULL)

Verdict: PASS
Open: 0B/0H/0M/0L

Scope reviewed: the 13 guarded rows via `git diff` (8 CSS files, +13/−1 — logged at `logs/ux-diff.txt`), each read in file context; QA's live probe (qa-1.md) supplies rendered evidence for `.dq-holform`/`.dq-editor` @375/899/1024/1440 (0 control↔button rect intersections, no h-scroll @375, button at inline-end).

## Consistency / design system
- Every new rule is the canonical `.qa-pass` guard verbatim (`box-sizing:border-box;min-inline-size:0;max-inline-size:100%` on `:is(input,select,textarea)`), scoped per file convention (`:root` vs `[data-app="…"]`) — same pattern as pre-existing `.qa-grid` guard (quality.css:89). No ad-hoc colors, sizes, or selectors; `dq-*` names kept; logical properties throughout. desk.css:79 extends the existing combined rule in place — clean.
- Checkbox/radio correctly excluded from the shrink guard (fixed-size controls must not compress).
- No markup, track, breakpoint, or color changes → dark mode, focus rings (`:focus-visible`, cx-kit.css:120), error markup (`.cx-error` still `grid-column:1/-1`), tab order, and labels all unchanged.

## States & layout — controls stay usable when tracks shrink
Every guarded row has a floor that stops controls shrinking below ~7.5–11rem before wrap/collapse:
- Collapse breakpoint: `.dq-holform`/`.dq-editor` @≤900px (refresh.css:43), `.pw-new-action`/`.pw-inline` @≤720px, `.qa-bq` @≤40rem→`1fr 5rem` (quality.css:98), `.aging-page-head .page-actions` @≤40rem→`minmax(0,1fr) 11rem`.
- Bounded minmax minimums: `.cx-queuerow` (9/7.5/11/12rem), `.oo-proj-grid`/`minmax(9rem,…)`, `.dk-otd__grid` (110px), `.dk-kb-form` (`min(100%,200px)`), `.trk-dep-row` (`7.5rem` + `minmax(0,1fr)`).
- Flex-wrap + wrapper minimums: `.pw-inline .field` (min 8rem), `.tph-taskform .cx-field` (min 9rem), `.cx-filters .cx-filter` (11/16rem), `.sch-edit-row` → `.sch-grow` on `label.field` (14rem basis, scheduler-page.tsx:441).

## 8-question contract @375/1024
1 Header stability — n/a, no toolbar changes. 2 Shared/labeled/focusable controls — unchanged DOM. 3 No raw controls — unchanged. 4 No overflow/overlap/h-scroll — **the fix**; probed 0 overlaps, `docScroll==vw` @375 (qa-1). 5 States — `.cx-error` preserved; no state markup touched. 6 `--cx-*` tokens — guards add no new values. 7 Headings/landmarks — unchanged. 8 Interactive states — unchanged; overlap removal restores WCAG 2.4.11 (focus no longer obscured by the painted-over button).

## Findings
| ID | Sev | file:line | Evidence | Exact fix | Owner |
|----|-----|-----------|----------|-----------|-------|
| — | — | — | none | — | — |

## Not verified / assumptions
- Sites dbg-3..dbg-13 verified statically (diff + context read + unit test 22/22 green/red-on-HEAD per qa-1); only `.dq-holform`/`.dq-editor` got live probes — same mechanism throughout, and each site has a collapse/wrap/track floor, so no further probe needed.
- 200% text resize, loading/empty visuals: not exercised (CSS-only diff touches no state paths).
- web-interface-guidelines fresh fetch unavailable in this env; applied its consistency/token/focus rules from code instead.
- `.cx-queuerow` tracks already bounded — guard is hardening, harmless (PLAN criterion 2 mandates the sweep).
