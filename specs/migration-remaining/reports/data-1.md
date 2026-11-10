# data report - migration-remaining - round 1 (FULL)

Verdict: FAIL        (FAIL if any BLOCKER/HIGH/MED open)
Open: 0/1/3/3

Reconciliation (independent recompute vs cited evidence, tolerance 0):
- fcmsg-dry.log: 73,536 + 9,269 = 82,805 read = 82,805 unique → 0 cross-tab `message_id` collisions (plausible but noteworthy — manual tab fully disjoint from auto export).
- fdhist-dry.log: read 595,516 = 430,055+165,461; in_gap 500,973 = 380,451+120,522; unique 495,825 ⇒ 5,148 dupes (95 in-tab + 5,053 cross-tab) — matches run-2 §7b.
- fc-dry.log: 1,742−140 = 1,602 ✓ · qa-probe.log: 9,230=4,076+5,154 / 4,038=1,709+2,329, unmatched=0 both ✓ · fd-check.log: 208,684−207,811=873 ✓ (count-diff lower bound, not set-diff).
- tl5-validate.log dq_hct: 60 src − 7 req[email,name] − 8 dup(email) = 45 would-migrate; reconciles inventory "53 data rows" (60 raw − 7 noise) ✓.
- Mapping ledger: 94→96 (dry-run-2) →+13=109 (tl-2) →+1=110 (tl-3/4/5); 101/110 read, 9 READ FAILEDs ✓.

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-1 | HIGH | queue-quality.ts:522-528 vs 20261109130415…:19-31 | S09-01 changed refresh_log `log_id` mint to `'mig-'+sha1(event tuple)` but remote holds 8,197 WP-51 rows keyed `'mig-'+ctx.index` (migration-run.md:69) and the DDL only uniques `log_id` — no backfill. A gated re-run mints keys that match nothing → ~9,046 dup inserts (src count, tl5-validate.log:84), violating PLAN #5 "0 new rows" on a listed table. | Revert the refresh_log mint to positional `'mig-'+ctx.index` (append-only sheet ⇒ positional is stable) OR add a `log_id` backfill emitting the identical sha1 expression (note `started_at/finished_at` timestamptz `::text` caveat); then prove with the targeted re-run. | data-engineer |
| data-2 | MED | migration/validate.ts:680-719,963-992 | Inventory merges mappings by TABLE (`byTable`, last-wins) so dual-source tables validate only one mapping: `qa_ctls` shows quality src=87 while daily_report 'CTL & Quality' (1,788 src, tl5-dry) + its `ctl_id` drops are invisible; same shadowing for AgentOneOnOnes(36), AUXes Exceptions(58), and the core-side sched_*/actions mappings (e.g. sched_overrides Δ+37 mixes v1 src=126 vs db=163 of core origin). PLAN #6 "covers the new mappings" is partial; ~5 mappings emit no ledger row/skips. | Report one row per mapping (key the ledger on `table←store/sheet`), or aggregate all mappings' src/skips per table and mark multi-source Δ as combined. | data-engineer |
| data-3 | MED | source-inventory.md:103 | Text QA 'Form Responses 1' recorded as "3,037 data rows" but its own probe (probe-tabs.log:118 `grid=4039`) and qa-probe.log (`rows=4038`) both say 4,038 — 1,001-row error in the canonical inventory (write math itself is consistent). | Correct §5 to 4,038 data rows (grid 4,039). | data-engineer |
| data-4 | MED | backfill-fd-history.ts:72-74 + fdhist-dry.log | `in_gap` lumps both uncovered tails; the right tail writes rows with `Performed At` up to 2028-07-10 (decisions-coverage.md:18-27) — post-snapshot/future dates are likely corrupt source values, and no per-tail count exists in the evidence, so the future-dated volume landing in fd_activities (pushing its max-ts to 2028) is unquantified. | Split `in_gap` into left/right-tail counters in the dry log and flag/count rows with ts > FD_MAX+margin before `--write`. | data-engineer |
| data-5 | LOW | migration-run-2.md:16 · migration-report.md:379-386 | Headline "96/96 mappings read clean" contradicts the 9 READ FAILEDs in dry-run-2.log (87/96 read); migration-report run-2 section is stale: validator "121 tables" vs current 124 and still says "17 non-task tabs reshard:-flagged" though S06-12 closed them. | Reword headline to "87/96 read + 9 pre-existing absent-tab failures"; refresh report section (124 tables, S06/07 final states). | data-engineer |
| data-6 | LOW | engine.ts:251-257 | Write-time `skipped` counts require-drops only; upsertOn dup-collapses shrink `migrated` silently (validator counts them, run ledger won't reconcile read=migrated+skipped). Also `String(r[k])` on NULL key cells → NULL-key rows dedupe then never conflict remotely (residual dup-per-run; probes show 0 NULLs today). | Add a dup-skip counter to TableResult; document NULL-key upsert residual in run-2 §4. | data-engineer |
| data-7 | LOW | source-inventory.md:52,113 vs fc-dry.log/sc-probe.log | Freshchat "1,741 data rows" vs backfill `read=1742` (colA vs raw-extent, unreconciled ±1); inventory header calls the workbook "Productivity (Oct-2026)" and says "Title says Oct" but sc-probe.log shows `title="Productivity (Sep-2026)"` — label drift only, month resolution correct. | Note the colA-vs-read metric difference; fix the title claim to Sep-2026. | data-engineer |

Not verified / assumptions:
- Remote reads beyond validator counts (no MCP configured; PostgREST HEAD-count probes only — no row-content re-diff of the 23 dedupe tables).
- qa_access_log `submitted_at` ::text vs sheet-display format parity (tl-5 residual; affects ≤1 row — dup-insert, safe direction). mail_log NULL-`sent_at` rows would dup per re-run (0 NULLs probed today).
- fc_messages: zero dedupe collapse between auto/manual tabs assumed disjoint ranges, not verified against content.
- All writes remain PENDING-APPROVAL; every count above is dry/probe evidence — no row was written or mutated by this review.
