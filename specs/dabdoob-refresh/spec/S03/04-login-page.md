# S03-04: /auth/login — mockup card design + Dabdoob CX rebrand
Kind: mini
ID: S03-04
Parent: S03
Owner: dev
Depends: S02-04
Criteria: PLAN #1 #2
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md
Budget: files=1; actions=4; changed_lines=120; minutes=8

## Goal
`src/app/auth/login/page.tsx` renders the mockup `.login-wrap >
.login-card` design — brand row (bars mark + "Dabdoob CX" + "dabdoob
operations console"), Sign-in title/sub, forgot-password row, error banner,
primary button with arrow, footer strip — while the POST/redirect logic
stays identical.

## Files
- Edit: `src/app/auth/login/page.tsx` | JSX markup only

## Context
- `mockups/pages/01-login.html:12-57` | exact markup/class contract
- `src/app/auth/login/page.tsx:45-84` | current JSX + working submit logic (keep)
- `e2e/auth.spec.ts:11-20` | hooks: `form`, `input[type=email]`, `button[type=submit]`, `getByRole('alert')`
- `e2e/responsive.spec.ts:5-27` | `form` + email input + submit visible at 375/768/1280

## Contract
- Replace `<main className="state-screen">` shell with
  `<main className="login-wrap"><div className="login-card">…</div></main>`.
- `.brand-row`: `.brand-mark` with the bars svg (mock L15-17), then
  `.brand-name` `Dabdoob CX` + `.brand-sub` `dabdoob operations console`.
- `h1.login-title` `Sign in`, `p.login-sub` `Use your dabdoob.com work
  account to continue.`
- Password field gets the `.between` label row (`Password` +
  `a.small` `Forgot password?` — `href="#"` placeholder is fine, or omit if
  no real flow exists; keep it non-functional but rendered).
- Error renders as `.login-error` with `role="alert"` (keeps e2e hook) +
  the circle-alert svg.
- Keep `Field`/`Input`/`Button` components, `id`/`name`/`autoComplete`,
  `type="submit"` primary button (add the arrow svg, text `Sign in`,
  `Signing in…` while loading).
- `.login-foot`: lock svg + `Restricted to Dabdoob CX team members`.
- `D()` is NOT used on this page today — match mock copy verbatim (English).
  No logic changes: same fetch, same `router.push('/')` + `router.refresh()`.

## Actions
1. Replace the outer markup with `.login-wrap`/`.login-card` + brand row.
2. Rebuild the form block: fields (email; password w/ forgot row), `.login-error` alert, submit w/ arrow.
3. Add `.login-foot` strip.
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Page matches mock 01 structure (brand, title/sub, fields, forgot row, foot) in light and dark.
- e2e hooks intact: `form`, `input[type=email]`, `button[type=submit]`, `role="alert"` on error.
- No `CX Helm`/`CX Productivity` strings remain in the file.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S06-01 confirms `e2e/auth.spec.ts` + `responsive.spec.ts` still pass unchanged.
Write results/S03-04.md (<=10 lines); TL alone updates TRACKER.md.
