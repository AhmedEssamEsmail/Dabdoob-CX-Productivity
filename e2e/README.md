# E2E tests (Playwright)

Every page is behind real Supabase Auth — `src/proxy.ts` redirects sessionless
requests to `/auth/login`, `POST /api/auth/login` calls
`signInWithPassword`, and `platform/identity.ts` resolves roles from the
`roster` table restricted to `allowed_domain` (`dabdoob.com`). Specs therefore
sign in through the real form as seeded fixture users — there is no stub/dev
login (`FALLBACK_BOOT` is only the shell's dev bootstrap fallback; it never
creates a session).

## Fixture users

Created by `e2e/seed-users.mjs` against the project `.env.local` points at
(service role key — never commit it):

| User                    | Roster role | Used by                          |
|-------------------------|-------------|----------------------------------|
| `e2e.admin@dabdoob.com` | admin       | auth.spec.ts, responsive.spec.ts |
| `e2e.tl@dabdoob.com`    | tl          | status-validation.spec.ts        |
| `e2e.agent@dabdoob.com` | agent       | my-status.spec.ts                |

Shared password: `E2E_USER_PASSWORD` env var, default `E2E-cx-local-2026!`
(defined once in `e2e/seed-users.mjs` and `e2e/users.ts` — keep in sync).

## Run

```bash
npm run test:e2e:seed   # idempotent — creates/updates the 3 users + roster rows
npx playwright test     # starts `npm run dev` automatically
```

The seeder verifies each account can `signInWithPassword` before it exits.
`*@example.com` creds cannot work — they fail the `allowed_domain` check and
resolve to role `unknown`.
