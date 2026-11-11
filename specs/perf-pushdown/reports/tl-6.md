# tl-6 — FIX round for reports/perf-1.md (all 5 rows blocking)

## Dispatched (spec/fix-perf-1.md; all preflight PASS struct+sem)
| Leaf | Finding(s) | Owner | Status |
|---|---|---|---|
| perf1-02 | perf-2 | dev | DONE |
| perf1-03 | perf-3 | supabase-expert | DONE |
| perf1-01 | perf-1 + perf-4 + perf-5 | data-engineer | DONE |

Bundling rationale: perf-1/perf-4/perf-5 share one root action (fresh build +
restart + re-time) and one PERF_BASELINE.md update; perf-4's analytics payload
was only measurable after the 500->200 fix. Serialized: perf1-01 ran after
perf1-02 (final src in build) and perf1-03 (same doc file).

## Changed files
- `src/features/cx-queue/lib/tlqueue.ts` — `maqsamRows`/`fdActivityRows` page
  via `readAllPaged` (+3/-14, TL-verified diff; `id` PK default, `idx_*_ts`
  serves predicates).
- `supabase/migrations/20261111083859_add_prod_window_hist_date_index.sql` —
  DELETED (perf-3 path A): `(date,class)` UNIQUE provably covers all `date`
  predicates (leftmost-prefix; only predicated read is route.ts gte/lte;
  upsert key uses same index; table 126 rows). Evidence recorded in
  `docs/PERF_BASELINE.md` `### prod_window_hist index decision (perf-3)`;
  pm1-02 approval superseded per user note.
- `docs/PERF_BASELINE.md` — `## After` re-timed on final build + verdicts,
  perf-4 payload note, perf-3 index decision.
- `specs/perf-pushdown/logs/perf1-timings.log` — raw build/server/curl output.

## Measurements (final build `RQxQ00OoPfT22Fj8nO3wI`, `next start -p 3100`)
- `GET /api/prod/analytics`: **500 -> 200**, median 0.121 s <= T0 0.487,
  3,448 B — perf-1 CLOSED (pm2-01 fix verified served).
- `GET /api/hub/home`: median 2.189 s vs T0 1.459 (+50%), all 3 runs over —
  **BREACH, reproducible on final build** (perf-5). Recorded, no fix attempted.
- perf-4: `>=50%` payload drop not met (tph/page -24.4%, hub/home +3.4%,
  analytics first measurable at 3,448 B) — BREACH restated/documented; hard
  `size <= baseline` holds except hub/home.

## Gates (round 10)
- `npx vitest run` — PASS 1298/1298 (logs/perf1-gate-vitest.log).
- `npx tsc --noEmit` — 0 errors (worker-run, perf1-02).
- `npm run build` — exit 0; fresh build serving :3100 (left running).

## Residual for PM
- perf-5 breach is real (not stale-build/cross-session variance): hub/home
  reproducibly +50% over T0 on the final build. PM triage: accept+record or
  open a new profiling finding. Tracked in TRACKER "Blocked / needs user".
- No review-gate shards requested; no spawned reviewers.
