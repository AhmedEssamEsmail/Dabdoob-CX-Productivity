# S06: e2e — Google button presence, denial banner, OAuth kickoff
Kind: mini
ID: S06
Parent: google-signin
Owner: test-engineer
Depends: S04 (login page UI + `?error` banner)
Criteria: PLAN #1 (button starts the flow), #3 (denial message), #4 (password path regression — existing tests untouched)
Skills: C:\Users\AHMED\.agents\skills\webapp-testing\SKILL.md
Budget: files=1; actions=3; changed_lines=60; minutes=8

## Goal
Extend the existing Playwright auth spec so the new Google path is covered as far
as real e2e can go (no real Google consent): button presence, `?error=denied`
banner, and that clicking it fires `POST /api/auth/google`. Existing
email/password tests must keep passing unchanged.

## Files
- Edit: `e2e/auth.spec.ts` | append ONE `test.describe` block for Google sign-in

## Context
- `e2e/auth.spec.ts:1-62` | spec style + imports; do NOT modify existing tests
- `e2e/users.ts:23-33` | `fillSticky` hydration-safe helper (use if interacting)
- `src/app/auth/login/page.tsx` (post-S04) | button text `Continue with Google`; `role="alert"` banner; `?error=denied`/`?error=auth` params
- `playwright.config.ts` | baseURL/testDir configuration

## Contract
- New tests assert only observable behaviour: visible button, alert text, outgoing request. No Google account, no session assertions — the OAuth leg is mocked out.
- Zero edits to existing tests or `e2e/users.ts`.
Out of scope: new spec files, seeding, real OAuth, unit tests, page edits.

## Actions
1. Append `test.describe('Google sign-in', ...)` to `e2e/auth.spec.ts`.
2. Test A: goto `/auth/login` -> `Continue with Google` button visible. Test B: goto `/auth/login?error=denied` -> `role="alert"` shows the roster/denial message.
3. Test C: `page.route('**/api/auth/google', fulfill json { url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' })`; click the button; `page.waitForRequest('**/api/auth/google')` fires (proves kickoff) — do not follow the external navigation.

## Done when
- Three new tests pass locally; all pre-existing auth tests still pass unmodified.
- No other file touched.

## Verify
- Run: `npx playwright test e2e/auth.spec.ts` -> all tests pass (needs dev server + seeded e2e users per PLAN; heavy output -> log file + bounded tail).

## Handoff
E2E evidence for criteria #1/#3 UX and #4 regression. Write results/S06.md (<=10 lines); TL alone updates TRACKER.md.
