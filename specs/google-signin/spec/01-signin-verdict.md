# S01: shared sign-in verdict `roleForEmail(email)`
Kind: mini
ID: S01
Parent: google-signin
Owner: dev
Depends: none
Criteria: PLAN #3 (deny unless domain + authorised), #5 (reuse the existing domain+roster rules)
Skills: none
Budget: files=2; actions=4; changed_lines=180; minutes=10

## Goal
Extract the domain -> admin_emails -> active-roster verdict that currently lives
inside `currentUser()` into an exported `roleForEmail(email)` so the OAuth
callback can reuse the exact same decision for an email it already holds.
Zero behaviour change for existing callers.

## Files
- Edit: `src/features/shared/platform/identity.ts` | extract verdict into new export; `currentUser` delegates
- Create: `tests/platform/signin-verdict.test.ts` | verdict matrix for `roleForEmail`

## Context
- `src/features/shared/platform/identity.ts:77-111` | `currentUser`: the exact rule order to move (domain check -> admin_emails -> active roster row -> role mapping; else `role:'unknown'`)
- `tests/platform/repo.test.ts:28-60` | hoisted `supa.from` fake builder pattern to reuse for the roster query
- `src/features/shared/platform/settings.ts:175` | `getConfig(key, fallback)` signature (mock it)

## Contract
```ts
export async function roleForEmail(email: string): Promise<PlatformUser>
```
- Semantics identical to current `currentUser()` post-email logic: `allowed_domain` mismatch -> `unknown`; `admin_emails` member -> `admin`; active roster `admin|tl|agent` -> that role; `specialist` -> `agent` (+`specialist:true`, `tlEmail`); missing/inactive/unrecognised roster -> `unknown`.
- `currentUser` becomes `cache(async () => roleForEmail(await currentEmail()))` — same observable output, still view-as aware via `currentEmail`.
Out of scope: any rule change, view-as behaviour, `requireRole`, `pwDirectory`, other files.

## Actions
1. In `identity.ts`, move lines ~79-110 (everything after `const email = await currentEmail()`) into `export async function roleForEmail(email: string)`; `currentUser` delegates.
2. Create the test: `vi.mock('@/features/shared/lib/supabase')` (fake `from` queue per repo.test.ts) and `vi.mock('@/features/shared/platform/settings')` (`getConfig` returning configured `allowed_domain`/`admin_emails`).
3. Cover the verdict matrix in one describe: off-domain (even with roster row) -> unknown; admin_emails -> admin; active roster tl -> tl with tlEmail; active agent -> agent; specialist -> agent w/ flag; inactive row -> unknown; no row + not admin -> unknown.
4. Confirm existing identity consumers still pass (`tests/platform/settings.test.ts` imports `normEmail`, `pwIsManagerOf`).

## Done when
- `roleForEmail` exported; `currentUser` delegates; no duplicated rule block.
- All 7 verdict cases pass; `tests/platform` suite green; `npx tsc --noEmit` clean.

## Verify
- Run: `npx vitest run tests/platform` -> all pass, including the new file.
- Run: `npx tsc --noEmit` -> clean.

## Handoff
`roleForEmail(email)` is the callback's gate input; denial verdict is `role === 'unknown'`. Write results/S01.md (<=10 lines); TL alone updates TRACKER.md.
