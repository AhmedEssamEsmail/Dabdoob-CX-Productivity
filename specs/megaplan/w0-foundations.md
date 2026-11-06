# Wave 0 — Foundations: make the gates trustworthy

> Sequential. Everything else is blocked until these pass. Scope S. Read `../cx-hub/PORTING-GUIDE.md` first.

## WP-00 — Fix the golden-test auth-mock regression

**Symptom:** `npx vitest run` → 24 failures in `tests/golden/hub-admin.test.ts`, `hub-overview.test.ts`, `hub-people-holidays.test.ts`; all errors are `requireRole is not a function`.

**Root cause:** `requireRole` moved to `src/features/shared/lib/auth.ts:46` (re-exported by `platform/identity.ts:116`). Tests mock `@/features/shared/lib/auth` via `tests/golden/hub-fakes.ts:216` `authModule()` — the factory replaces the *whole* module, so `requireRole` is `undefined`.

**Do:**
1. Extend `authModule()` in `hub-fakes.ts` to also export `requireRole`, `requireAuth`, `getUser`, `getViewAsUser` — behaviour backed by `hubDb.userEmail` + roster tables already in the fake (mirror `lib/auth.ts` semantics: roster lookup → role → throw the legacy refusal message when not allowed; keep the exact error strings — the oracle asserts them verbatim).
2. Audit the other fakes for the same pattern: `tests/golden/desk-fakes.ts`, `tests/golden/ops-fakes.ts`, `tests/golden/fixtures-people.js`, and any `vi.mock('@/features/shared/lib/auth'...)` across `tests/` — fix all.
3. While in `ops-fakes.ts`, fix its two tsc errors: `normHeader` import (`cx-operations/lib/trackers` doesn't export it — export it there if it's a genuine legacy helper, else inline it in the fakes) and the `delete` operand at line 185.
4. Re-run `npx vitest run` — must be green (528+ tests). If any golden mismatch remains that is *not* the mock (i.e. a real port/legacy divergence), report it — do NOT patch the port to match the mock; the oracle is always right.

**Files:** `tests/golden/hub-fakes.ts`, `tests/golden/ops-fakes.ts`, `tests/golden/desk-fakes.ts`, `tests/golden/fixtures-people.js`, possibly `src/features/cx-operations/lib/trackers.ts` (export `normHeader`).
**Gates:** `vitest run` green; `tsc --noEmit` for touched files clean.
**Depends on:** none.

## WP-01 — tsc: heatmap null-safety

**Symptom:** `src/features/cx-queue/lib/heatmap.ts:230` — `sh.getLastColumn` possibly undefined (TS2722 + TS18048).

**Do:** this code was ported from `Queue_deprecated/Heatmap.js` where sheet objects always exist. Find the legacy call site, port its guard semantics verbatim (legacy treats a missing tab as `[]` — check how neighbouring ported reads handle `undefined`), apply minimal fix. Do not redesign.

**Files:** `src/features/cx-queue/lib/heatmap.ts`.
**Gates:** `tsc --noEmit` clean.
**Depends on:** none (parallel with WP-00).

## WP-02 — eslint: prefer-const + error budget

**Symptom:** `npx eslint .` → 1 error `prefer-const` at `src/features/cx-queue/lib/heatmap-engine.ts:262` (`ue`), 295 warnings.

**Do:** fix the `let`→`const`. Leave the 295 warnings alone (gate = 0 errors) — do NOT mass-fix warnings in this WP.

**Files:** `src/features/cx-queue/lib/heatmap-engine.ts`.
**Gates:** `npx eslint .` → 0 errors.
**Depends on:** none.

## WP-03 — Build + smoke baseline

**Do:**
1. `npx next build` — record outcome; fix only build-breaking issues (missing env vars are not build errors — document any required env and use `.env.production`/`process.env` fallbacks per existing patterns; if build needs env, note exactly which).
2. `npm run dev` → boot check: `/`, `/overview`, `/queue`, `/audit-queue`, `/one-on-ones`, `/admin` return non-500 (auth redirect is fine). Record HTTP statuses.
3. `npx playwright test` — run existing 4 specs; record pass/fail baseline (failures → append to tracker notes, do not fix in this WP).
4. Write results to `specs/megaplan/audits/w0-baseline.md`.

**Gates:** build exits 0 OR a documented env-blocker in `audits/w0-baseline.md`; smoke results recorded.
**Depends on:** WP-00, WP-01, WP-02 (all gates green first).

## Wave-0 exit criteria

`tsc --noEmit` clean · `vitest run` green · `eslint` 0 errors · `next build` done · baseline doc committed. Only then does the tracker open wave-1 rows.
