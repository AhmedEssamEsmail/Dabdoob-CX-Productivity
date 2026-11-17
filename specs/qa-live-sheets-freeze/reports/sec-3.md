# sec report - qa-live-sheets-freeze - round 3 (FULL, wave-2 scope)

Verdict: PASS
Open: 0B/0H/0M/2L

## Prior-finding verification

| ID | Sev | Status | Evidence |
|---|---|---|---|
| sec-2 mirrors peek oracle / unbounded slice | LOW | FIXED | `src/app/api/admin/mirrors/route.ts:14-18,36-72` — `requireAdminCaller` first; `peek.ssId` ignored; tab allowlisted to `PEEK_SOURCES` (400 otherwise); head<=50, tail<=50, `slice` capped `s0+500`; reads DB mirror tables only, zero sheet calls. Heatmap half also closed: `buildHeatmapFromSource(_spreadsheetId)` ignores the id (heatmap.ts:627) and the UI id input + regression path are deleted (heatmap-page.tsx). |
| sec-3 list-sheets seam | LOW | FIXED | `src/app/api/admin/list-sheets/route.ts:3-18` — fail-closed `MIGRATION_SECRET_KEY` check kept (401), then unconditional 410; all `googleapis` code deleted. freeze-scan EXPECTED entry removed. |
| sec-3 `qaFirstSheetRows_` seam | LOW | DEFERRED-ACCEPTED | `src/features/cx-quality/lib/migrate.ts:289,329` still present — user-owned file, `qa_history_secret`-gated via the user-owned `/api/qa/[action]` route, explicitly out of scope (Amendment 4 non-goals). Unguarded `googleapis` bypass of `assertSheetReadAllowed_` remains until user de-sheets it. |
| sec-5 dq_hct dedupe raw vs cleaned email | LOW | FIXED | `src/features/cx-hub/lib/roster.ts:321-326` — snapshot dedupes via `Map` keyed on `dqCleanEmail_(rec.email)` (cleaned value = the upsert conflict key), then filters blanks; raw-variant collapse can no longer double-hit the ON CONFLICT row. |

## New findings (wave-2 diff)

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| sec-6 | LOW | src/features/cx-people/lib/scorecard-server.ts:91-92,657-668 | `addBehaviourCase` gates `date` on `scDateOk_` = regex `^\d{4}-\d\d-\d\d$` only and `sc_behaviour.date` is TEXT — an admin typo like `2026-13-99` inserts a permanently corrupt case row (month `2026-13`, never matches any range). Admin-only, parameterized, dup-index safe — integrity nit, no injection. | Validate a real calendar date (round-trip `new Date(date)` -> ISO slice equals input) before insert. | dev |

## Verified clean (wave-2 attack surface)

- **Strict freeze flip**: `sheets-freeze.ts:24-28` logs `[SHEETS_FREEZE_VIOLATION]` then throws `SheetsFreezeError` for every non-allowlisted read — log-then-deny, no silent pass. `deferred` removed from `SheetReadGateOpts`; zero `deferred:` gate call sites in src/ (grep-verified; remaining `deferred` hits are unrelated erlang/UI code). Tests updated to expect log+throw; scan test pins EXPECTED to the two guarded seams (`jobs/sheets.ts:93`, `migration/engine.ts:127`) + roster `manualHct` + user-owned cx-quality + NON-SHEETS gmail literals.
- **engine.ts:238,300** — `deferred` flags removed from `migrateTable`/`backfillTrackerRecords`; non-allowlisted mappings now throw -> caught -> per-mapping `errors[]` (fail-closed, no silent skip). `/api/admin/migrate` still `x-migration-key`-gated and fail-closed on unset env.
- **`addBehaviourCase`** (scorecard-server.ts:657-679): `requireRole(['admin'])` + `assertWritable()` server-side; email must contain `@`; note 1-500 chars; `submitted_by` = `user.email` (server identity, never client-supplied); parameterized insert; 23505 -> `{saved:false,duplicate:true}` matching the real `sc_behaviour_month_date_email_note_uidx` (migration 20261109130415:152). UI is controlled inputs, React-escaped, `maxLength=500` (agents-page.tsx:438-484) — no `dangerouslySetInnerHTML`.
- **source-health** (route.ts:78+): admin-only; sheet probes replaced by `probeTable`/`prod_daily_layers`/`dq_hct` DB checks — bounded (`head:true` counts, `limit(1)`, `limit(head)`); env checks print only `set`/`not set`; config detail truncates to 120 chars (pre-existing pattern, admin-only).
- **heatmap.ts `hmSourceCells_`** (572-624): all four mirror reads parameterized via `readAllPaged` static column lists + literal `tracker_id 'wa_parcels'`; window-bounded `ts_ms`/`created_at` filters; admin-only path (`requireRole(['admin'])` + `assertWritable` at :628-629); `opts.from/to` garbage -> NaN -> PostgREST error -> fail-closed.
- **tlqueue.ts**: `book()` seam deleted from `TlqIo`; fc_messages + `ol_sheet_id` sheet fallbacks deleted — non-native tracker now throws (`tlqReadOlDb_`); texting reads `fd_activities` mirror only.
- **migrate.ts reconcile** (user-owned, spec-approved LOW fixes): `.catch(()=>[])` removed — read errors now propagate (fail-closed); `.in('key',…)` chunked to 100 — static-string `.or()` filters, parameterized.
- **Cron auth**: `scorecard-nightly` retains Bearer `CRON_SECRET` fail-closed-in-prod + `requireJobCaller` (route.ts:17-28); sheetCreds gate correctly removed (job is DB-only now).
- **RLS posture**: `sc_behaviour` covered by project-wide lockdown (20261108205852 — RLS everywhere, no permissive policies); insert path is service-role anyway. `prod_assumptions` detail in source-health = numeric targets, non-secret.
- **Secrets**: no literals in diff; list-sheets/migrate key checks fail-closed on unset env; `seed-prod-assumptions.ts` re-run now throws by design (Amendment-3 exemption consumed — documented in-file).

## Not verified / assumptions

- Remote verification (`sc_behaviour` writes, cron `cxh-scorecard-nightly` first live run) is deploy-side, outside the diff.
- `hmSourceCells_` `freshchat` read is lower-bounded only (`.gte ts_ms fromMs-7d`); an admin-supplied ancient `from` pages the whole table — bounded by table size, admin-only; flagged to perf, not a sec item.
- `readAllPaged('qa_audits', month)` pulls full-width rows for aggregation — server-side only, no client exposure.
- Stray `nul` file in repo root (accidental Windows redirect artifact) — hygiene, not security.
