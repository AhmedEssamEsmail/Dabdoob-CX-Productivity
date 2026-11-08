# S02-05: cx-kit.css shell reskin — nav bullets off, mock rail look, toasts off the rail
Kind: mini
ID: S02-05
Parent: S02
Owner: dev
Depends: S02-02
Criteria: PLAN #3
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md
Budget: files=1; actions=5; changed_lines=180; minutes=10

## Goal
`cx-kit.css` reskins the shell chrome to the mockup rail: zero list bullets
in `.nav`, cleaner `.nav-link` (rounded, accent-soft active), tighter
`.nav-group-label`, rail-foot arranged for the avatar card, and the
`.toasts` layer pinned bottom-right clear of the rail.

## Files
- Edit: `src/app/cx-kit.css` | shell/nav region (~L900-1130), toasts region (L1244-1280)

## Context
- `mockups/assets/mock.css:108-149` | target .nav/.nav-group-label/.nav-link/.rail-foot look
- `src/app/cx-kit.css:968-998` | current .nav-icon/.nav-text/.nav-ext rules
- `src/app/cx-kit.css:1031-1051` | current .rail-foot/.rail-who/.who/.who-meta
- `src/app/cx-kit.css:1244-1254` | current .toasts fixed position
- `src/features/shared/components/shell/AppShell.tsx:377-462` | `.nav ul/li` markup that renders bullets today

## Contract
- Add `:root .nav ul { list-style: none; margin: 0; padding: 0 }` (the
  missing reset that produces rail bullets) and `:root .nav li { margin:0 }`.
- `.nav-link`: match mock — `border-radius: 8px`, `border-inline-start: 2px
  solid transparent` (inactive) — keep the sliding `.nav-ind` mechanism
  (S03 markup keeps it); `aria-current="page"` link gets
  `background: var(--cx-accent-soft); color: var(--cx-accent-text);
  font-weight: 600`.
- `.nav-group-label`: mock size/tracking (.6563rem-ish -> use
  `--text-xs` minus ~5% or a literal .68rem, uppercase, `--cx-ink-3`).
- `.rail-foot`: arrange `.avatar` + `.rail-who` + `.rail-collapse` like the
  mock (avatar left, who block flex:1, icon-btn right); keep `.rail-off`
  collapsed-rail behavior working (avatar may stay visible).
- `.toasts`: stays `inset-inline-end` bottom-right; add
  `inset-inline-start: auto; inset-block-start: auto;` pin and a
  `margin-inline-start: calc(var(--rail-w) + var(--cx-space-4))` guard so it
  can never paint over the rail in LTR (mirror with the rtl rule already at
  L1280); on ≤820px remove the rail guard (nav-open rail is top-sticky).
- No selector renames — markup classes unchanged (additive only).

## Actions
1. `.nav ul/li` bullet reset + `.nav-link`/active restyle + `.nav-group-label` tune.
2. `.rail-foot` flex order/spacing for the avatar card; `.rail-off` still collapses correctly.
3. `.toasts` bottom-right pin + rail-clearance guard + mobile exception.
4. `.brand`/`.rail-head` spacing so `.brand-sub` (new in refresh.css) sits right.
5. Sweep: `:root .rail-search` margin harmony with `.rail-head`/`.nav` (it is inserted between them by S03-02).

## Done when
- `grep -n "list-style" src/app/cx-kit.css` shows the `.nav ul` reset.
- Active nav link = accent-soft bg + accent text; no bullets.
- `.toasts` cannot overlap `.rail` at any viewport.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S03-02 markup lands on these styles; `.toast` keep their class names (e2e
status-validation.spec asserts `.toast` text).
Write results/S02-05.md (<=10 lines); TL alone updates TRACKER.md.
