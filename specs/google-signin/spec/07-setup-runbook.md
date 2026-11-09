# S07: runbook — Google Cloud + Supabase dashboard setup
Kind: mini
ID: S07
Parent: google-signin
Owner: tech-writer
Depends: S02 (trigger route), S03 (callback + error params), S05 (hook function name)
Criteria: PLAN #6 (setup steps documented)
Skills: none
Budget: files=2; actions=2; changed_lines=140; minutes=8

## Goal
Document every manual prerequisite for Google sign-in so an operator can wire
the Google Workspace OAuth client and Supabase provider without reading code.
Last shard of the feature.

## Files
- Create: `docs/GOOGLE_SIGNIN_SETUP.md` | the runbook
- Edit: `docs/ARCHITECTURE.md` | append ONE line in the auth/session area pointing to the runbook

## Context
- `../PLAN.md` lines 1-89 | authoritative prerequisites + decisions (Internal consent screen, `hd` hint is UX-only, first sign-in auto-provisions `auth.users`, roster is the gate)
- `specs/google-signin/results/S05.md` | hook function name chosen by supabase-expert (wait for it)
- `docs/DATABASE_SETUP.md`, `docs/ARCHITECTURE.md` | existing doc voice/format

## Contract
Runbook sections (keep terse, step-form):
1. Google Cloud: OAuth consent screen = Internal (dabdoob.com Workspace); create OAuth client ID/secret; authorised redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Supabase dashboard: Auth -> Providers -> Google on; paste client ID/secret; add redirect allow-list entries `<site-url>/auth/callback` for prod AND `http://localhost:3000/auth/callback` for dev.
3. Optional hardening: Auth -> Hooks -> `before_user_created` -> point at the S05 function name; note the app-side gate enforces roster even without it.
4. Smoke check + denial UX (`?error=denied` / `?error=auth` meanings); where the flow lives (`/api/auth/google`, `/auth/callback`).
- No secrets in the doc; refer to dashboard fields by name only.
- `ARCHITECTURE.md`: one line under its auth notes — "Google OAuth setup: see `docs/GOOGLE_SIGNIN_SETUP.md`".
Out of scope: applying migrations, dashboard changes, other docs.

## Actions
1. Write `docs/GOOGLE_SIGNIN_SETUP.md` per Contract.
2. Append the single pointer line in `docs/ARCHITECTURE.md`.

## Done when
- Runbook covers all four sections; matches PLAN decisions and S02/S03/S05 contracts.
- `ARCHITECTURE.md` points to it; no secrets or invented config values.

## Verify
- Run: `npx eslint docs/GOOGLE_SIGNIN_SETUP.md docs/ARCHITECTURE.md` (markdown lint if configured; else visual check) -> clean.

## Handoff
Criterion #6 satisfied. Write results/S07.md (<=10 lines); TL alone updates TRACKER.md.
