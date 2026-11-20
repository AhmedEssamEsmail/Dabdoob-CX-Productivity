# Deferred defect — qa-2: duplicate /api/prod/analytics 500 under StrictMode double-mount

## Defect
In dev StrictMode, components double-mount and fire TWO concurrent identical
`GET /api/prod/analytics` requests. The anonymous loader path makes each call
uncached via `usePageData`, so two parallel requests hit
`src/app/api/prod/analytics/route.ts` at once; under full-suite load the route
returns 500 (`Failed to load resource ... 500`, two per viewport).
Source: `specs/next-security-upgrade/results/S01-12.md:3-5`,
`reports/qa-1.md` finding qa-2.

## Evidence — load-correlated env-class, not a deterministic client bug
- `results/S01-12.md` — serial repro `--project=chromium --workers=1` PASSED
  both widths (`logs/e2e-chromium-rerun.log`, `logs/e2e-fix-console.log`);
  serial firefox (S01-08) also passed. 500 only appears under full-suite load.
- `results/S01-14.md` — the escalated analytics 500 did NOT recur in final
  serial verification (chromium 97p/1f-infra-flake, firefox 98p/0f).
- `reports/qa-1.md` — qa-2 disposition routed here: "document as deferred
  env-class with evidence"; out of this PLAN's scope.

## Proposed future fix location (not implemented here)
- `src/features/cx-hub/lib/use-page-data.ts` — dedupe concurrent identical
  requests / stable-loader guard, OR harden
  `src/app/api/prod/analytics/route.ts` for concurrent duplicate GETs.
  Per S01-12, this belongs to a new leaf; no source edits in qa1-02.

## Disposition
DEFERRED — pending PM scheduling of a dedicated leaf. Not a release blocker:
serial verification is green and the failure is env-saturation-class.
