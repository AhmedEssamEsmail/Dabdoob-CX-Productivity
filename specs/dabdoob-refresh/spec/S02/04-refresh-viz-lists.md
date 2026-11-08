# S02-04: refresh.css — viz (mixbar/bar/spark/heat), worklist, agenda, master-detail, login
Kind: mini
ID: S02-04
Parent: S02
Owner: dev
Depends: S02-03
Criteria: PLAN #2 #4
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md
Budget: files=1; actions=5; changed_lines=280; minutes=10

## Goal
`refresh.css` gains the remaining mockup families: data viz, worklist
items, agenda timeline, `.md` master-detail split, and the `.login-*`
screen.

## Files
- Edit: `src/app/refresh.css` | append "VIZ", "LISTS", "LAYOUT", "LOGIN" blocks

## Context
- `mockups/assets/mock.css:336-356` | .mixbar(.legend)/.bar/.spark/.hbar-row/.heat
- `mockups/assets/mock.css:358-382` | .worklist/.workitem/.wi-* anatomy
- `mockups/assets/mock.css:420-472` | .login-* + .md + .agenda/.ag-*
- `mockups/pages/01-login.html:12-57` | login markup these styles must render in both themes

## Contract
Append `:root .cls` rules (tokens only): `.mixbar` + `.mixbar > div` +
`.mixbar-legend` (+ `i` swatch); `.bar` + `.bar > i` (+ `.blue .warn .bad`
tones); `.spark` (+ `.gray`); `.hbar-row`; `.heat` cell; `.worklist` +
`.workitem` (+ `a.workitem` hover, `.wi-ico` + tone variants, `.wi-main
.wi-t .wi-s`, `.wi-side .t .s`); `.agenda` rail line `::before`, `.ag-row`,
`.ag-t`, `.ag-item` (+ `::before` dot, `.ag-item.now` accent-soft bg);
`.md` master-detail grid (collapse to 1-col ≤900px); `.login-wrap`
(token-derived radial gradients via `--cx-accent-soft`/`--paper`, works in
dark), `.login-card`, `.brand-row`, `.login-title`, `.login-sub`,
`.login-error`, `.login-foot`.
Out of scope: anything already written by S02-02/03; existing class reskins.

## Actions
1. Viz block: mixbar+legend, bar+tones, spark, hbar-row, heat.
2. Worklist block: worklist + workitem + wi-* parts.
3. Agenda block: line, rows, item + dot + `.now`.
4. `.md` grid + its ≤900px collapse.
5. Login block: wrap gradients, card, brand-row, title/sub, error, foot.

## Done when
- `.md` splits ≥901px and stacks ≤900px.
- `.agenda` shows the rail line + item dots.
- `.login-wrap/.login-card` resolve entirely from tokens (readable in dark).
- `grep -c "^:root \.\(mixbar\|bar\|spark\|hbar\|heat\|worklist\|workitem\|wi-\|agenda\|ag-\|md\|login-\)" src/app/refresh.css` -> >= 40.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S03-04 (login page), S04-02..19 (page restructures) consume these classes;
`.md`/`.agenda` contract is fixed here.
Write results/S02-04.md (<=10 lines); TL alone updates TRACKER.md.
