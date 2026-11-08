# S01-04: People email templates -> "Dabdoob CX"
Kind: mini
ID: S01-04
Parent: S01
Owner: dev
Depends: none
Criteria: PLAN #1
Skills: none
Budget: files=5; actions=5; changed_lines=15; minutes=8

## Goal
The five cx-people templates whose mail footers/signatures read "CX Helm"
are switched to "Dabdoob CX".

## Files
- Edit: `src/features/cx-people/lib/reminders.ts` | footers L133, L157, L255, L295, L317
- Edit: `src/features/cx-people/lib/tasks.ts` | footers L327, L635
- Edit: `src/features/cx-people/lib/meetings.ts` | footer L497
- Edit: `src/features/cx-people/lib/one-on-ones-page.ts` | body copy L1104
- Edit: `src/features/cx-people/lib/one-on-one-reminders.ts` | body copy L136

## Context
- PLAN.md Research notes | canonical line list (rebrand hits ~25 files)

## Contract
`<p>CX Helm</p>` -> `<p>Dabdoob CX</p>`; `Open CX Helm:` ->
`Open Dabdoob CX:`; `in the CX Helm` -> `in Dabdoob CX`. String content
only — no template/logic changes.
Out of scope: every other statement in these files.

## Actions
1. reminders.ts: replace all 5 `CX Helm` display strings.
2. tasks.ts: replace both `CX Helm` footers.
3. meetings.ts: replace the L497 footer.
4. one-on-ones-page.ts: replace `the CX Helm` at L1104.
5. one-on-one-reminders.ts: replace `CX Helm` at L136.

## Done when
- `grep -n "CX Helm\|CX Productivity"` on the five files returns 0 hits.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S01-04.md (<=10 lines); TL alone updates TRACKER.md.
