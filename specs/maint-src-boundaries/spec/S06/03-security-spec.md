# S06-03: security.spec.ts -> real authz (401 + role denial)
Kind: mini
ID: S06-03
Parent: S06
Owner: test-engineer
Depends: S03-01
Criteria: PLAN #6 (Unauthorized->401, requireRole denial->403)
Skills: none
Budget: files=1; actions=2; changed_lines=100; minutes=10

## Goal
Rewrite `tests/security/security.spec.ts` (literal-only assertions) to exercise
the real `requireRole`/`currentUser` chain plus `apiError`'s mapping: no session
-> 401, wrong role -> 403. View-as refusal + happy path append in S06-05 (same
file, serial).

## Files
- Edit: `tests/security/security.spec.ts` | rewrite in place; authz half

## Context
- `src/features/shared/platform/identity.ts:76-125` | currentUser (domain, admin_emails, roster join, active flag) + requireRole's legacy denial message
- `src/features/shared/lib/api-error.ts:23-42` | 'Unauthorized' -> 401; 'do not have access' -> 403
- `tests/jobs/routes.test.ts:8-17` | vi.hoisted + vi.mock seam pattern
- `src/features/shared/platform/viewas.ts:188-191` | exported `viewAsResetCaches()` — call in beforeEach (module-level memo)

## Contract
Mock (vi.mock + vi.hoisted): `@/features/shared/lib/auth` -> createAuthClient
returns `{ auth: { getUser: async () => ({ data: { user: h.user } }) } }`;
`@/features/shared/platform/repo` -> `db()` returns per-table stubs from
`h.tables` (roster, view_as) plus `cacheGet:()=>null, cachePut:()=>{},
cacheRemove:()=>{}, appendRow:vi.fn()`; `@/features/shared/platform/settings`
-> `getConfig: h.getConfig` (allowed_domain 'dabdoob.com', admin_emails).
Real imports under test: `requireRole` from `@/features/shared/platform/identity`,
`apiError` from `@/features/shared/lib/api-error`.
Cases: no session -> requireRole throws 'Unauthorized' -> apiError 401; domain
agent roster row + requireRole(['admin']) -> legacy denial message -> apiError 403.
Out of scope: view-as + happy-path cases (S06-05), platform code edits.

## Actions
1. Rewrite the file with the mocked-seam authz suite above.
2. Run it green.

## Done when
- File imports real platform/lib modules; 401 and 403 cases pass.

## Verify
- Run: `npm run test:security` -> all tests pass

## Handoff
S06-05 appends view-as write refusal + happy-path cases to this file.
Write results/S06-03.md (<=10 lines); TL alone updates TRACKER.md.
