# TL report 1: google-signin (BUILD)

## Outcome
All 7 mini-leaves DONE. Google OAuth sign-in implemented beside email/password:
shared `roleForEmail` verdict (S01), `POST /api/auth/google` trigger (S02),
`GET /auth/callback` exchange + domain/roster gate with session revocation (S03),
login-page button + `?error` banner (S04), `before_user_created` hook migration
file (S05), e2e coverage (S06), setup runbook (S07).

## Changed files (feature scope; verified vs leaf Files lists)
- M `src/features/shared/platform/identity.ts`; `src/app/auth/login/page.tsx`;
  `src/app/refresh.css`; `docs/ARCHITECTURE.md`; `e2e/auth.spec.ts`
- New `src/app/api/auth/google/route.ts`; `src/app/auth/callback/route.ts`;
  `supabase/migrations/20261109123839_before_user_created_domain_gate.sql`;
  `tests/auth/{google-route,callback-route}.test.ts`;
  `tests/platform/signin-verdict.test.ts`; `docs/GOOGLE_SIGNIN_SETUP.md`
- Foreign concurrent-session files present in tree (`src/app/styles/quality.css`,
  `tests/ui/qa-strip-overflow.pw.ts` — ctl-strip-overflow work); not ours, left untouched.

## Integration gates (round 1, all PASS; logs in `../logs/`)
tsc clean · eslint 0 errors (367 pre-existing warnings) · vitest 1144/1144 ·
security 4/4 · next build ok · playwright 110 passed / 10 data-dependent skips /
0 failed.

## Deviations / notes
- S01/S03 workers wrote `results/*.md` at repo root; TL relocated them to
  `specs/google-signin/results/`.
- No leaf asked for forbidden owner types; no review gates run (PM's job).

## Blocked / needs user
- NEEDS_APPROVAL: applying migration `20261109123839_before_user_created_domain_gate.sql`
  to the live remote DB, plus manual dashboard setup per `docs/GOOGLE_SIGNIN_SETUP.md`.

## Status
Leaves: 7 done / 0 blocked / 0 needs-split. Feature integration green.
