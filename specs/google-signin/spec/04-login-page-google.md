# S04: login page — "Continue with Google" + `?error=` denial banner
Kind: mini
ID: S04
Parent: google-signin
Owner: dev
Depends: S02 (`POST /api/auth/google` -> `{ url }` contract)
Criteria: PLAN #1 (button starts the flow), #3 (denial message shown), #4 (password form untouched)
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\react-best-practices\SKILL.md
Budget: files=2; actions=5; changed_lines=100; minutes=10

## Goal
Add the Google sign-in button and a `?error` URL banner to the existing client
login page, without changing the email/password form or its selectors
(`input[type="email"]`, `button[type="submit"]` — e2e depends on them).

## Files
- Edit: `src/app/auth/login/page.tsx` | add `UrlErrorNotice` (Suspense-wrapped `useSearchParams`), `handleGoogle`, divider + quiet button under the form
- Edit: `src/app/refresh.css` | LOGIN region only — append `.login-divider` + `.login-google` rules after line 548

## Context
- `src/app/auth/login/page.tsx:1-164` | whole component: `'use client'`, `setError` state, `.login-error` alert markup to reuse
- `src/features/shared/components/ui/Button.tsx:6-32` | variants are only `primary | quiet | danger` — use `quiet` + custom class
- `src/app/refresh.css:491-548` | LOGIN block styling tokens (`--cx-line`, `--cx-ink-2`, etc.)
- S03 handoff | error params: `denied` (not authorised) and `auth` (flow failed)

## Contract
- New inner component `UrlErrorNotice({ onError })`: calls `useSearchParams()`, maps `error=denied` -> "That Google account isn't authorised for the CX Hub. Ask the CX admin to add you to the roster." and any other `error` value -> "Google sign-in failed. Try again or use email and password."; invokes `onError` once in `useEffect`. Rendered as `<Suspense fallback={null}>` inside `.login-card` (Next 16 requires a Suspense boundary for `useSearchParams`).
- `handleGoogle`: `POST /api/auth/google`; on `{ url }` -> `window.location.href = url`; on failure -> `setError(...)`; toggle `loading` so both buttons disable together.
- Markup after `</form>`: `<div className="login-divider"><span>or</span></div>` then `<Button type="button" variant="quiet" className="login-google" onClick={handleGoogle} disabled={loading}>Continue with Google</Button>`.
Out of scope: form fields/submit handler, other pages, new deps, e2e (S06).

## Actions
1. Page: add `Suspense`/`useEffect` imports (`react`) and `useSearchParams` (`next/navigation`); implement `UrlErrorNotice` + wire it in `<Suspense>`.
2. Add `handleGoogle` per Contract.
3. Add the divider + `Continue with Google` quiet button after the form.
4. CSS: append `.login-divider` (flex row, 1px `--cx-line` rules, `or` in `--cx-ink-3`, margin `1.2rem 0`) and `.login-google` (`width:100%; justify-content:center; gap:.5rem; height:2.5rem`) in the LOGIN region.
5. Self-check: password form, selectors and `login()` e2e helper path unchanged.

## Done when
- Button renders, POSTs to `/api/auth/google`, and navigates to the returned `url`.
- `/auth/login?error=denied` shows the denial text in `role="alert"`.
- `npx tsc --noEmit` clean; `npx eslint src/app/auth/login/page.tsx` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/app/auth/login/page.tsx` -> clean (e2e coverage is S06).

## Handoff
UI surface for S06 e2e: button text `Continue with Google`, `?error=` banner.
Write results/S04.md (<=10 lines); TL alone updates TRACKER.md.
