# sec report - qa-live-sheets-freeze - round 2 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/3L

## Prior-finding verification

| ID | Sev | Status | Evidence |
|---|---|---|---|
| sec-1 manualHct baked in dqReadHct_ | MED | FIXED | `dqReadHct_(opts?: SheetReadGateOpts)` no longer self-grants (roster.ts:276-284): emits `console.error('[SHEETS_FREEZE_VIOLATION] …')` when `!opts?.manualHct`, forwards `opts` to `readSheet`; guard `assertSheetReadAllowed_` (sheets-freeze.ts:27) throws `SheetsFreezeError` before any Google call — loud log + throw, no silent pass. Sole `{manualHct:true}` grant in src/ = roster.ts:314 inside `dqSyncRoster_` (grep-verified), reachable only via `syncRosterNow` (:436-440) / `jobRosterSync` (:449-451), both `requireRole(['admin'])` + `assertWritable`; only route caller is `/api/hub/roster` -> `syncRosterNow` (admin session). `jobRosterSync` has no cron/route caller in src. `qaActiveEmails_` (server.ts:1810-1829, user-owned, unedited) wraps the bare call in try/catch -> null: violation logged every cold-instance attempt, page never 500s — fails open per their contract. Tests: dq-hct-snapshot.test.ts:125-161 spy-verify log/no-log + sessionless deny before `dqReadHct_`. |
| sec-4 dq_hct upsert NULL/empty-email dups | LOW | FIXED | roster.ts:321-323: snapshot maps `email: dqCleanEmail_(rec.email)` (lowercase + zero-width/space/BOM strip) then `.filter((rec) => rec.email)` before `upsert(…, {onConflict:'email'})` — blank/NULL dropped, variants normalized onto the unique key. |
| sec-2 mirrors peek oracle / unbounded slice | LOW | DEFERRED-ACCEPTED | Wave-2 per PLAN Amendment 2; grandfather logs `[SHEETS_FREEZE_VIOLATION]`, admin/key-gated. |
| sec-3 list-sheets / qaFirstSheetRows_ seams | LOW | DEFERRED-ACCEPTED | Wave-2 per plan; pinned in freeze-scan EXPECTED; not reachable from job-qa-engine. |

## New findings (this delta)

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| sec-5 | LOW | src/features/cx-hub/lib/roster.ts:296,321-327 | `dqReadHct_` dedupes on RAW `String(rec.email)` but the upsert conflicts on the CLEANED email; two raw-distinct emails that clean to one value (e.g. 'A@x.com ' vs 'a@x.com') in the same batch -> PG "ON CONFLICT cannot affect row a second time" -> sync throws. Fail-closed, admin-only, logged — no exploit, availability-only edge. | Dedupe snapshot on the cleaned email (e.g. `Map` keyed on `dqCleanEmail_`) before upsert. | data-engineer |

## No new attack surface (touched files)

- `roster.ts` delta = signature + violation log + email normalize/filter only; `opts` is a code literal, never request-derived; no new route/dep/env.
- `verify-hct-parity.mts` still calls bare `dqReadHct_()` -> now logs + throws: intentionally frozen (CLI ops script, baseline consumed), not a request path. Acceptable.
- Tests (`dq-hct-snapshot.test.ts`) mock console/engine; no secrets.

## Not verified / assumptions

- Remote `dq_hct` cleanup of pre-existing NULL-email dup rows + `supabase db push` still pending user apply (per fix-sec-4 handoff).
- Gate evidence read from `logs/gate5-*` per tl-4 (tsc PASS, eslint PASS, vitest 1447/1448 — sole fail unrelated known-external); not re-run.
