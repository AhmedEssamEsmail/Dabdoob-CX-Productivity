# S06-05: security.spec.ts -> view-as write refusal + happy path
Kind: mini
ID: S06-05
Parent: S06
Owner: test-engineer
Depends: S06-03
Criteria: PLAN #6 (view-as refusal; role pass-through)
Skills: none
Budget: files=1; actions=2; changed_lines=70; minutes=10

## Goal
Extend `tests/security/security.spec.ts` (rewritten by S06-03) with the view-as
write refusal (real `assertWritable`/`viewAsState` -> VIEW_AS_READONLY -> 403)
and the happy-path role pass.

## Files
- Edit: `tests/security/security.spec.ts` | append the view-as + happy-path cases

## Context
- `src/features/shared/platform/viewas.ts:63-89` | viewAsState: owner = admin_emails[0]; target from the owner's last 'start' view_as row; assertWritable throws VIEW_AS_READONLY
- `src/features/shared/lib/api-error.ts:27` | VIEW_AS_READONLY maps to 403
- `src/features/shared/platform/identity.ts:99-107` | roster role resolution (agent/tl pass)
- `src/features/shared/platform/viewas.ts:188-191` | `viewAsResetCaches()` already called in beforeEach (S06-03)

## Contract
Reuse S06-03's hoisted seams: `h.user` = the owner (`admin_emails` first entry),
`h.tables['view_as']` = one `{action:'start', target_email:'agent@dabdoob.com'}`
row. Real imports added: `assertWritable` from
`@/features/shared/platform/viewas` (identity already imported).
Cases: owner with active view-as -> `assertWritable()` rejects VIEW_AS_READONLY
-> apiError 403; agent user + `requireRole(['agent','tl'])` -> resolves with the
PlatformUser (role 'agent'); `viewAsResetCaches()` keeps cases isolated.
Out of scope: S06-03's 401/403 cases, platform code edits.

## Actions
1. Append the view-as + happy-path cases to the file.
2. Run it green.

## Done when
- View-as refusal -> 403 and happy-path role resolution pass.

## Verify
- Run: `npm run test:security` -> all tests pass

## Handoff
PLAN #6 security coverage complete (401, role 403, view-as 403, pass).
Write results/S06-05.md (<=10 lines); TL alone updates TRACKER.md.
