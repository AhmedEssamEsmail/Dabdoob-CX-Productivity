# Testing

All commands run from the repo root (`CX-Hub/`).

## Unit + golden oracle tests — `npx vitest run`

`vitest` is the single runner for unit tests and the golden-oracle suite.
`tests/golden/` proves ported legacy logic is equivalent to the original
Apps Script: `scripts/parity/oracle.mjs` loads the legacy GAS files verbatim
inside a `node:vm` context with Google services faked and every data seam
injected (`__FIXTURES__`/`__WRITES__`), then the tests assert the TS ports
produce identical results. Legacy source dirs resolve via `LEGACY_DIR`
(or sibling `*_deprecated` dirs).

Vitest aliases `server-only` to `tests/stubs/server-only.ts`, so unit tests
can import marked server modules. Standalone `tsx` scripts need the same
shim: run them with `npx tsx --tsconfig scripts/tsconfig.json <script>` —
`scripts/tsconfig.json` maps `server-only` to the stub.

Golden coverage includes: desk, hub (admin, my-day, overview, people/holidays),
kpi, operations, people (+jobs), productivity, prod-validation, quality,
queue (aggregates, check-in, heatmap, scheduler, TL queue), scorecard, tph,
view-as sweep.

## Integration tests — `npm run test:integration`

`vitest run src/app/api/__tests__` — API route tests against mocked Supabase.

## Performance tests — `npm run test:performance`

`vitest run tests/performance`.

## Security tests — `npm run test:security`

`vitest run tests/security`.

## E2E tests (Playwright)

Every page sits behind real Supabase Auth — `src/proxy.ts` redirects
sessionless requests to `/auth/login`, and roles resolve from the `roster`
table restricted to `allowed_domain` (`dabdoob.com`). Specs sign in through
the real form as seeded fixture users (`e2e/seed-users.mjs`,
`e2e/users.ts`); the shared password comes from `E2E_USER_PASSWORD`.

```bash
npm run test:e2e:seed   # idempotent — creates/updates the 3 users + roster rows
npx playwright test     # starts `npm run dev` automatically
```

Fixture users: `e2e.admin@dabdoob.com` (admin), `e2e.tl@dabdoob.com` (tl),
`e2e.agent@dabdoob.com` (agent). `*@example.com` creds cannot work — they
fail the `allowed_domain` check. See `e2e/README.md` for details.
`npm run test:e2e:ui` opens the Playwright UI mode.
