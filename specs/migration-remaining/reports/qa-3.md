# qa report - migration-remaining - round 3 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/3L

## Checks run (re-run by QA this round)
- `npx tsc --noEmit` -> exit=0 (0-byte log)
- `npx vitest run` -> exit=0, 60 files / 1161 tests pass (incl. migration-dedupe-key 13/13, migration-conflict-target 3/3)
- `npx eslint` on engine.ts, queue-quality.ts, v1-ops-sched.ts, migration-dedupe-key.test.ts -> exit=0, zero warnings
- read-only proof `git grep -nE "values\.(update|append)|batchUpdate" -- migration/ src/features/shared/migration/` -> 0 matches
- `migrate-all --dry` / `validate.ts --md`: not re-run (remote sweeps; tl-5/tl-6 ran both PASS this window — 101/110 read + 9 pre-existing absent-tab fails, 124 tables / 0 db-failed)

## Round-2 findings verification
| ID | Sev | Status | Evidence |
|---|---|---|---|
| qa-2-1 | LOW | OPEN (deferred) | root `results/` still holds S06-05/S06-10/S07-05.md (`?? results/` in git status); S09/S10 results correctly landed under `specs/migration-remaining/results/`. Housekeeping only. |

## Post-QA FIX-round regression audit (tl-5 S09 + tl-6 S10)

- `dedupeKey_` (queue-quality.ts:47-50, v1-ops-sched.ts:34-37): `String(v ?? '')` + `'|'`-join + sha1 — byte-parity with DDL `coalesce(col::text,'')` + `encode(extensions.digest(...,'sha1'),'hex')` (20261109130415:110-124 qa_access_log; 20261109130633:115-131 sched_plan). All-empty fallback `prefix+index` vs DDL `'mig-'+id` — divergence is documented safe-direction (dup-insert; see qa-3-2 for the narrow exception).
- sched_plan mint (queue-quality.ts:577-580) hashes raw `month|tl_email|date|shift|variant`; `tl_email`/`variant` are NOT sheetToDb-remapped (line 272 maps only from/to), so raw keys = db cols — matches §7 group verbatim. `require:['tl_email','date']` drops all-empty rows before upsert.
- QaAccessLog mint (586-590) hashes `email|action|submitted_by|submitted_at` — matches §6 group; no `require` on the mapping (284-287).
- refresh_log (queue-quality.ts:524-527) correctly REVERTED to `'mig-'+ctx.index`: 8,197 live WP-51 rows carry positional ids and §1 `refresh_log_log_id_uidx` has no hash backfill — the sha1 mint would have dup-inserted ~9k rows (data-1). Append-only source keeps position stable.
- v1-ops-sched ShiftPlan (154-157): `'v1-mig-'+sha1(month|tl|date|shift|variant)` on raw `tl` key (transforms run pre-mapRow, engine.ts:246; `tl`->`tl_email` post-map) — prefix stays disjoint from `'mig-'` (qa-1 preserved). v1 run is PENDING-APPROVAL so no positional `v1-mig-N` orphans exist for §7's NULL-guarded backfill to miss.
- engine.ts `dupSkipped` (256-261, 278): seen-map collapse counted; `skipped = requireDropped + dupSkipped` keeps `read = migrated + skipped`; migrate-all prints `dup=`.
- validate.ts S10-02 (976-1035): each contributing mapping resolves its own store, reads its own tab, applies the sheet-keyed transform with correct `ctx.spreadsheet`, accumulates skip/dup/wouldMigrate (was last-wins); `combined` ledger lines emitted.
- backfill-fd-history.ts `gapSide` (72-76): left `[from-M, FD_MIN+M]`, right `[FD_MAX-M, to+M]`; `future` rows (ts > FD_MAX+M) counted but still written — matches tl-6 numbers (500,973 = 213,888+287,085; future=281,986 flagged for runbook).
- SQL §6/§7: `WHERE dedupe_key IS NULL` guards, `CREATE EXTENSION pgcrypto WITH SCHEMA extensions`, `IF NOT EXISTS` throughout, dedupe DELETEs precede uniques — idempotent, re-runnable. `node:crypto` is builtin — no new deps, no debug leftovers.
- Tests are behaviour-asserting (fixed sha1 vectors incl. the `'AM|'` trailing-empty-variant vector, index-stability, non-overwrite, fallback, v1 guard, refresh_log positional) — would fail without the change.
- Doc edits verified: source-inventory §3 Sep-2026 title, §5 4,038 rows, §6 colA(1,741)-vs-read(1,742) ±1 note; run-2 headline 87/96+9, §4 dupSkipped/NULL-key residual note; migration-report 124 tables + 9 mapped/8 rejected v1 tabs.

## Open findings
| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| qa-2-1 | LOW | `results/` (repo root) | Carry-over: 3 stray root-level result files outside spec tree. | Move into `specs/migration-remaining/results/` during housekeeping. | dev |
| qa-3-1 | LOW | `specs/megaplan/audits/migration-run-2.md:80`; `decisions-v1-ops.md:15` | Post-S09 doc drift: audit ledger still records ShiftPlan staged mint as `` `mig-<index>` ``; code mints `'v1-mig-'+sha1(...)`. | Update the two lines to the hash mint (`'v1-mig-'+sha1(month\|tl\|date\|shift\|variant)`). | tech-writer |
| qa-3-2 | LOW | `queue-quality.ts:48` + `20261109130415:116` | Fallback namespaces overlap: JS all-empty fallback mints `'mig-'+ctx.index`, SQL backfill mints `'mig-'+id` — same `'mig-N'` space. QaAccessLog has no `require`, so a backfilled `'mig-'+id` row could take a wrong-row UPDATE from an all-empty row at index=id. Near-zero today (table created empty by 014; sched_plan's require covers its side). | Disjoint SQL fallback prefix (e.g. `'mig-id-'+id`) or skip/`require` on all-empty QaAccessLog rows. | dev |

## Not verified / assumptions
- JS<->SQL hash parity on live data asserted by tl-5 (`supabase db query` vs Node `createHash`); code paths inspected are byte-symmetric. First gated re-run of sched_plan/qa_access_log is the true proof.
- `submitted_at::text` / `date::text` canonical casts vs sheet display strings — documented residual; mismatch yields dup-insert, never wrong-row update.
- Live writes/applies remain NEEDS_APPROVAL; S06-11 workbook share NEEDS_USER — unchanged, correctly still gated.
