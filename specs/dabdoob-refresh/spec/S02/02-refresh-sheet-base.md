# S02-02: Create refresh.css — shell/page chrome, utilities, states, palette styles
Kind: mini
ID: S02-02
Parent: S02
Owner: dev
Depends: S01-01
Criteria: PLAN #3 #4
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md
Budget: files=2; actions=8; changed_lines=280; minutes=10

## Goal
New stylesheet `src/app/refresh.css` exists, loads after `cx-kit.css`, and
carries the mockup's chrome/utility/state rule families the shell and page
leaves need: page-head, utilities, note/empty, rail-search, brand-sub,
avatar, command-palette (`cpk-*`).

## Files
- Create: `src/app/refresh.css` | new shared refresh sheet
- Edit: `src/app/layout.tsx` | add `import "./refresh.css";` AFTER the cx-kit import (L3)

## Context
- `mockups/assets/mock.css:79-149` | rail-brand/brand-sub/rail-search/avatar source rules
- `mockups/assets/mock.css:151-173` | topbar/page-head/kicker source rules
- `mockups/assets/mock.css:383-419` | note/empty/hr/muted/flex/spacing utilities
- `src/app/cx-kit.css:1-10` | `:root .cls` (0,2,0) convention + token-only rule
- `mockups/pages/02-home.html:14-22,61-65` | rail-search `<kbd>⌘K</kbd>`, avatar usage

## Contract
Port these families as `:root .cls` rules, token-ized (use `--cx-*`/`--*`
tokens; mock hex values only via the tokens added in S02-01):
`.page-head` (flex-end layout), `.page-sub`, `.page-actions`, `.kicker`,
`.topbar` + `.topbar-right`; utilities `.muted .faint .small .num .mono
.flex .between .wrap .hr .mt-1 .mt-2 .mt-3 .mb-2 .mb-3`; `.note` +
`.note.warn`; `.empty` (+ `.empty .t .empty .s`); `.rail-search` (+ `kbd`);
`.brand-sub`; `.avatar`; command palette `.cpk-backdrop .cpk .cpk-input
.cpk-list .cpk-item(.on) .cpk-group .cpk-kbd .cpk-empty` (fixed overlay,
surface card ~34rem wide, radius-l, shadow-3, item hover/on = accent-soft +
accent text). Include `dir=rtl`-safe logical properties throughout.
Out of scope: cards/stats/pills/tables (S02-03), viz/lists/md/agenda/login
(S02-04), reskins of existing classes (S02-05/06), tokens (S02-01).

## Actions
1. Create refresh.css with the file-header comment (purpose, `:root .cls`, loads-last note).
2. Page-head block: `.page-head`, `.page-sub`, `.page-actions`, `.kicker`, `.topbar`, `.topbar-right`.
3. Utility block: text/layout/margin helpers listed above.
4. `.note` + `.note.warn` + `.empty` family.
5. `.rail-search` (+ its `kbd`) styled as a button-like input row.
6. `.brand-sub` + `.avatar`.
7. `.cpk-*` palette family (backdrop + dialog + list + item + kbd + empty).
8. layout.tsx: add the `import "./refresh.css";` line after L3.

## Done when
- refresh.css contains every listed family; no literal hex outside token aliases.
- `import "./refresh.css"` sits after `import "./cx-kit.css";` in layout.tsx.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
`.rail-search`, `.brand-sub`, `.avatar` used by S03-02; `.cpk-*` by S03-03;
`.page-head/.page-sub/.empty/.note` by all S04/S05 leaves; S02-03/04 append
to this file serially.
Write results/S02-02.md (<=10 lines); TL alone updates TRACKER.md.
