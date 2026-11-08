# S01-03: Mail/notify templates -> "Dabdoob CX" (platform, desk, hub, queue) + test strings
Kind: mini
ID: S01-03
Parent: S01
Owner: dev
Depends: none
Criteria: PLAN #1
Skills: none
Budget: files=7; actions=7; changed_lines=25; minutes=10
Superseded: source edits applied (results/S01-03.md); oracle-parity remainder -> S01-05

## Goal
Every outbound mail/notification template and signature that names the
product reads "Dabdoob CX"; the two vitest assertions that pin the old
name are updated to match.

## Files
- Edit: `src/features/shared/platform/mail.ts` | sender `name:` (L206)
- Edit: `src/features/shared/platform/notify.ts` | `Open CX Helm` copy (L107)
- Edit: `src/features/cx-desk/lib/maildesk.ts` | `(via CX Helm)` signature (L267)
- Edit: `src/features/cx-hub/lib/myday.ts` | calendar event description (L752)
- Edit: `src/features/cx-queue/lib/jobs.ts` | check-in reminder body (L283)
- Edit: `tests/golden/desk.test.ts` | expected `(via CX Helm)` (L426)
- Edit: `tests/platform/notify.test.ts` | expected `Open CX Helm` (L27)

## Context
- `src/features/shared/platform/notify.ts:32` | jsdoc mention — comments may keep the old name; edit L107 only

## Contract
`CX Helm` -> `Dabdoob CX` inside emitted user-facing strings only
(`name: 'Dabdoob CX'`, `Open Dabdoob CX …`, `(via Dabdoob CX)`,
`Blocked from Dabdoob CX, My day.`). No logic, escaping or template-shape
changes. Mirror the same swap in the two test expectations.
Out of scope: other lib code, other tests.

## Actions
1. mail.ts L206: sender name -> `'Dabdoob CX'`.
2. notify.ts L107: `Open CX Helm` -> `Open Dabdoob CX`.
3. maildesk.ts L267: signature -> `(via Dabdoob CX)`.
4. myday.ts L752: `Blocked from CX Helm` -> `Blocked from Dabdoob CX`.
5. jobs.ts L283: `Open CX Helm, Check-ins` -> `Open Dabdoob CX, Check-ins`.
6. desk.test.ts L426: expected body -> `(via Dabdoob CX)`.
7. notify.test.ts L27: expected html -> `Open Dabdoob CX (…)`.

## Done when
- `grep -n "CX Helm\|CX Productivity"` on the five source files returns 0 hits (comments exempt).
- The two updated tests pass.

## Verify
- Run: `npx vitest run tests/golden/desk.test.ts tests/platform/notify.test.ts` -> green

## Handoff
none
Write results/S01-03.md (<=10 lines); TL alone updates TRACKER.md.
