# qa report - maint-src-boundaries - round 1 (FULL)
Verdict: PASS
Open: 0B/0H/0M/0L

Checks run (all re-run by QA on the integrated tree, project root):
- `npx tsc --noEmit` -> PASS exit 0
- `npx eslint .` -> PASS 0 errors, 368 warnings (pre-existing; matches TL)
- `npx vitest run` -> PASS 53 files / 1111 tests
- `npm run test:security` -> PASS 4/4 (real authz spec)
- `npm run test:integration` -> PASS 11/11 (real dispatcher spec)
- `npx next build` -> PASS exit 0; /tph, /tph-grid, /status-validation,
  /my-status, /productivity-analytics, /admin/config, /admin/roster all
  emitted; no svonly-probe route (revert confirmed)
- `npm run test:e2e` -> NOT RUN (needs seeded live env; per PLAN report only)

## Criteria -> evidence
1. fetchJson: `src/features/shared/lib/fetch-json.ts` is byte-identical to the
   removed pv-shared block (`cache:'no-store'`, `{error}` envelope). All 5
   cross-feature consumers import `@/features/shared/lib/fetch-json`
   (cx-desk kb-tracker/kpi-logs/mail-desk/tl-performance + cx-operations
   trackers). pv-shared.tsx no longer exports fetchJson; the other three
   fetchJson variants untouched (intentional non-goal). PASS
2. grid-slots: moved to `cx-productivity/lib/tph/grid-slots.ts`
   (exports unchanged, now `import 'server-only'`); backfill.ts:26 and
   tests/jobs/grid-slots.test.ts updated; env.ts/mirrors.ts stay in
   shared/jobs with documented composition-layer headers. PASS
3. server-only: `grep -rln "import 'server-only'" src/` = 89 files (matches
   PLAN marked set). Client-reachable exclusions verified unmarked:
   prod/validation.ts, shared/lib/{adapters,errors}.ts, cx-queue
   heatmap-engine.ts, fetch-json.ts. Support files present:
   src/types/server-only.d.ts, tests/stubs/server-only.ts, vitest alias,
   scripts/tsconfig.json shim (documented in TESTING.md). Root tsconfig
   does NOT map server-only. Client-side enforcement proven by TL probe
   (build failed with the expected error, probe reverted); clean build
   re-verified by QA. PASS
4. QA dispatcher: zero `as never` in `src/app/api/qa/[action]/route.ts`;
   object params `Record<string, unknown>`, qaImportHistory uses
   `Parameters<>`. Parsing/authz diff is cast-only. qa-shared.tsx `P`
   object params typed `Record<string, unknown>`; tsc proves call-site
   compatibility. PASS
5. Thin routes: all six page.tsx are 6-7 lines, delegate to
   `cx-productivity/components/*-page.tsx` / `cx-hub/components/admin-*-page.tsx`
   (all `'use client'` at line 1); CSS imports remain in route files;
   `src/app/tph/page.tsx` re-export unchanged. PASS
6. Real tests: auth.test.ts imports real `./auth` (createAuthClient/getUser/
   requireAuth/getViewAsUser) with only @supabase/ssr, next/headers,
   ./supabase, platform/identity mocked. integration.test.ts exercises the
   real GET/POST route: positional args, bare-array body, unknown->404,
   malformed->args=[], apiError map 401/403/500, GET ?args=/?argN=.
   security.spec.ts exercises real requireRole + apiError + assertWritable:
   no-session 401, denial 403, view-as write refusal 403, allowed role
   resolves. `npm run test:integration` runs (11/11). PASS
7. docs+guard: ARCHITECTURE.md gained "Module boundaries" (directions,
   ownership, composition exceptions); eslint.config.mjs adds
   no-restricted-imports on `src/features/shared/**` blocking `@/features/cx-*`
   with the two sanctioned files exempted; lints clean (0 errors). PASS

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
(none)

Not verified / assumptions:
- e2e not run (approval-gated). Behavior parity for moved pages rests on
  cut-paste diffs (git diff shows pure moves + 'use client' + CSS-in-route),
  tsc/eslint/build/vitest, and the TL-proven server-only probe.
- `src/features/shared/platform/options.ts` contains pre-existing NUL bytes
  (already "binary" at HEAD, 95 NUL-lines); diff verified byte-level: only
  `import 'server-only'` + blank line added. Pre-existing quirk, not
  introduced here.
- Stray 0-byte `nul` file found in repo root (shell `2>nul` redirect
  artifact, outside all shard Files lists); removed.
- Dirty-tree items outside this spec (specs/redesign/*, src/app/*.css) are
  the TRACKER-documented baseline from the parallel redesign spec — not
  this task's edits. Forbidden files (package.json, root tsconfig,
  registry.ts, globals.css) untouched.
