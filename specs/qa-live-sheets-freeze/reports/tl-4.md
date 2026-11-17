# tl-4 — FIX round for reports/sec-1.md (qa-live-sheets-freeze)

Source: `reports/sec-1.md` — Verdict FAIL, open 0B/0H/1M/3L. One leaf
(`spec/fix-sec-1.md#sec1-01`, preflight PASS) dispatched to dev; LOWs deferred
per FIX rules / owner notes.

## Per-finding resolution

| Finding | Severity | Owner | Resolution |
|---|---|---|---|
| sec-1 manualHct baked in dqReadHct_ | MED | dev | FIXED — `dqReadHct_(opts?: SheetReadGateOpts)` no longer self-grants; emits `console.error('[SHEETS_FREEZE_VIOLATION] …')` when `!opts?.manualHct` then forwards `opts` to `readSheet` (real engine throws SheetsFreezeError before any Google call). `dqSyncRoster_` is the sole `{manualHct:true}` grant in src/ (grep-verified); it stays reachable only via admin-gated `syncRosterNow`/`jobRosterSync`. `qaActiveEmails_` (user-owned server.ts:1810-1829 — NOT edited) wraps the call in try/catch -> null, so a throw cannot 500 the page: **fail-open per their contract, no grandfather entry added** (PM decision implemented as specified). The approved exempt seed script (seed-prod-assumptions.ts, `{deferred:true}`) untouched. +3 spy-verified regression cases in dq-hct-snapshot.test.ts. |
| sec-2 mirrors peek oracle / unbounded slice | LOW | dev | DEFERRED — wave-2 per owner note (grandfathered wave-1, logs violations). |
| sec-3 list-sheets / qaFirstSheetRows_ googleapis seams | LOW | dev | DEFERRED — wave-2 de-sheeting per owner note; both pinned in freeze-scan EXPECTED. |
| sec-4 dq_hct upsert NULL/empty-email dup rows | LOW | data-engineer | DEFERRED — **flag to PM**: owner fix says "before remote apply" and remote `supabase db push` is still pending; cheap code fix (blank-email filter before upsert) if PM wants it ahead of apply. |

Side effect noted for PM: `scripts/ops/verify-hct-parity.mts` still calls
`dqReadHct_()` — now logs violation + throws (pre-merge baseline already
consumed; frozen by design, not exempted). `qaActiveEmails_` repoint to
`dq_hct` remains the standing user hand-back.

## Changed files (this round)
- `src/features/cx-hub/lib/roster.ts` (dqReadHct_ signature + violation log; dqSyncRoster_ grant)
- `tests/platform/dq-hct-snapshot.test.ts` (+3 regression cases)
- `results/sec1-01.md` (owner evidence — repo-root results/, same convention as qa1-xx)

## Gates (round 5, from project root)
- typecheck `npx tsc --noEmit` -> PASS, 0 errors (logs/gate5-tsc.log)
- lint `npx eslint .` -> PASS, 0 errors, same 5 pre-existing warnings in untouched files (logs/gate5-eslint.log)
- unit `npx vitest run` -> 1447/1448; sole FAIL `tests/quality/qe-fd-cache.test.ts` — known-external (cx-quality engine-live parallel workstream, no leaf file in import graph) (logs/gate5-vitest.log)

## DELTA scope for reviewer
roster.ts diff since sec-1 scan + dq-hct-snapshot.test.ts; TRACKER gate log
round 5. No new deps, no .env, no user-owned files touched.
