# sec report - migration-remaining - round 2 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/4L

Delta scope per tl-5 FIX round: `mappings/queue-quality.ts` (dedupeKey_ helper
+ sched_plan/QaAccessLog/refresh_log mints), `mappings/v1-ops-sched.ts`
(ShiftPlan mint), `tests/lib/migration-dedupe-key.test.ts` (new),
`supabase/migrations/20261109130415` §6, `20261109130633` §7.

| ID | Sev | file:line | Attack/loss scenario (1-2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| sec-1 | MED -> CLOSED | queue-quality.ts:47-49,579,589; v1-ops-sched.ts:34-36,155; 20261109130415 §6:110-127; 20261109130633 §7:115-134 | Positional `mig-N` keys replaced by `'mig-'+sha1(identity cells)` both sides; a reordered/edited source now conflicts on the correct row, not a wrong positional row. Verified: cell order, `|` join, `?? ''`/`coalesce(...,'')` null handling, `mig-` prefix, and `encode(extensions.digest(...,'sha1'),'hex')` = Node `createHash('sha1').digest('hex')` are byte-identical; sched_plan hashed cols are TEXT verbatim (007:137-139), `variant int` lands NULL -> `''` both sides; all-empty fallback (`mig-`+index vs `mig-`+id) and `submitted_at` canonical-cast gap both degrade to dup-insert, never wrong-row UPDATE. Conflict targets confirmed: `sched_plan_dedupe_key_uidx`, `qa_access_log_dedupe_key_uidx`, `refresh_log_log_id_uidx` all exist. | — | — |
| sec-2 | LOW (carried, deferred) | 20261109130415:80-88,133-140; mappings/people-core.ts:247,273 | Unchanged this round: mail_log / follow_up_done composite uniques keep NULL-key parts -> NULL rows re-duplicate per re-run; same-second mail sends can hit 23505. | Deferred per tl-5 pending live-data probes (sent_at precision, NULL-key counts). | dev |
| sec-3 | LOW (carried, deferred) | mappings/ops-tabs.ts:159 | Unchanged: `aux_exceptions` record_id `am|d|ax` raw `|` join collides on cells containing `|`. | Deferred; sha1 the joined cells (aux_spans precedent). | dev |
| sec-4 | LOW (carried, deferred) | mappings/v1-ops-people.ts:69 | Unchanged: real employee email hardcoded as `manager_email` on 9 one_on_one_logs rows. | Deferred pending PM confirmation. | dev |
| sec-5 | LOW (new) | queue-quality.ts:49 (`join('|')`), 524-527 refresh_log mint; v1-ops-sched.ts:36 | The new hash pre-image joins raw cells with `|` — same ambiguity class as sec-3, now inside the sec-1 fix. refresh_log hashes free-text `error`/`note` where `|` is plausible: (error='e', note='n\|m') vs (error='e\|n', note='m') mint identical log_id -> a later re-run upsert-overwrites a distinct event row. sched_plan/qa_access_log cells are structured (email/date/shift names) so exposure is mainly refresh_log; impact bounded to silent log-row loss. | Make the encoding unambiguous on BOTH sides: JS `cells.join('\x1f')` with DDL `chr(31)` separator (or a matching JSON encode) — must stay byte-parity with the §6/§7 backfills. | dev |

## Verified this delta

- **Parity**: transform mints equal DDL backfills byte-for-byte (fixed test
  vectors in migration-dedupe-key.test.ts confirm the JS side; SQL mirrors the
  same cell order/coalesce/join). v1 hashes raw `tl` = the value sheetToDb
  stores as `tl_email` — same bytes; `v1-mig-` namespacing means a v1 row
  identical to a core row coexists (dup-insert direction, by design).
- **No new attack surface**: no new routes/RLS/grants/`SECURITY DEFINER`;
  `CREATE EXTENSION pgcrypto WITH SCHEMA extensions` is the Supabase-standard
  schema; `import 'server-only'` + `node:crypto` stays server-side.
- **Fail-closed**: a unique-index build failure on content-dup remote rows
  aborts the apply atomically; no partial state.

## Not verified / assumptions

- tl-5 reports live `supabase db query` parity proof; I verified structural
  parity only (did not re-query the live DB).
- qa_access_log.submitted_at (timestamptz) canonical-cast vs sheet-string hash
  gap = documented tl-5 residual; bounded to one dup-insert per pre-existing
  row on first approved re-run, then idempotent. sched_plan has no non-TEXT
  hashed col except variant (lands NULL) -> exact parity.
- qa_access_log unique index assumes no two pre-existing rows share the full
  identity tuple; table was absent pre-014 (dry-run B3) so expected empty —
  if it isn't, the apply fails closed and needs a manual dedupe first.
- Remote drift between the 2026-11-09 probes and apply still assumed
  re-probed; all pending applies remain NEEDS_APPROVAL.
