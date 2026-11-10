# sec report - migration-remaining - round 1 (FULL)

Verdict: FAIL
Open: 0B/0H/1M/3L

| ID | Sev | file:line | Attack/loss scenario (1-2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| sec-1 | MED | `src/features/shared/migration/mappings/queue-quality.ts:557,562`; `mappings/v1-ops-sched.ts:138`; backfills `supabase/migrations/20261109130633:105-111`, `20261109130415:98-106` | `dedupe_key='mig-'+ctx.index` (and `v1-mig-`) is positional while the DDL backfill numbers by `id` order. If a source sheet gains/loses/reorders rows before a re-run, `mig-N` maps to a different source row and the flipped `upsertOn` silently UPDATEs the wrong live row in `sched_plan`/`qa_access_log` — cross-row data corruption, no error. | Mint `dedupe_key` as a content hash of the row's natural cells (sha1, the `aux_spans` transform precedent at ops-tabs.ts:142), or run re-imports as per-table rewrite (delete-by-source then insert) instead of positional upsert. | dev |
| sec-2 | LOW | `supabase/migrations/20261109130415:80-88,115-122`; `mappings/people-core.ts:247,273` | `mail_log (sent_at,"to",subject)` and `follow_up_done (thread_id,done_at)` keep natural keys with NULLABLE parts: NULL-key rows never conflict, so they re-duplicate on every re-run; and two legitimately distinct mail sends sharing second-precision `sent_at`+`to`+`subject` now hit 23505 on the live app table. | Apply the same DO-block NULL probe / `dedupe_key` fallback used for the agg tables; confirm `sent_at` precision cannot collide for same-second sends before keeping the composite unique. | dev |
| sec-3 | LOW | `src/features/shared/migration/mappings/ops-tabs.ts:159` | `aux_exceptions` `record_id = am|d|ax` uses a raw `|` separator — a cell containing `|` collides keys (`('a|b','c')` vs `('a','b|c')`), so a later sheet row upsert-overwrites an earlier one. | sha1 the joined cells like the sibling Transcript/FD_AUX transforms. | dev |
| sec-4 | LOW | `src/features/shared/migration/mappings/v1-ops-people.ts:69` | Hardcoded real employee email stamps `manager_email` on 9 `one_on_one_logs` rows pending PM confirmation (tl-2 flag); personal address committed to source. | Confirm with PM before apply; move the constant to config/decisions only. | dev |

## Verified clean (focus areas)

- **Dedupe DELETEs**: guarded self-joins keep highest `id` (last-write-wins, documented); `IS NOT DISTINCT FROM` collapses NULL groups before index builds; all 14 NULL-key probes returned 0 (tl-4 `logs/null-key-probes.md`) so every DO block takes the natural-key branch; `CREATE ... IF NOT EXISTS` + NULL-only backfills make re-apply a no-op. No unbounded/destructive DELETE.
- **New-table DDL/RLS**: `fc_messages`, `dq_hct`, `aux_spans`, `call_transcripts`, `v1_task_occurrences` all `ENABLE ROW LEVEL SECURITY` with **no policies** = deny-all for anon/authenticated, consistent with the S08-04 service-role-only lockdown; no `SECURITY DEFINER`, no views, no public grants added. Tracker seed rows use `ON CONFLICT DO NOTHING` and match 009 column lists.
- **SA creds**: every Google auth path (engine.ts:101-106, sheets.ts:86, cx-quality migrate.ts:294, all `migration/` CLIs) uses `spreadsheets.readonly` scope and env-only credentials (`GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY`/`GOOGLE_APPLICATION_CREDENTIALS`); `SUPABASE_SERVICE_ROLE_KEY` is server/CLI-only, never `NEXT_PUBLIC_*`; `.env*`, `cx-kpis-*.json`, `/migration/` all gitignore-verified (`git check-ignore` pass). No secrets in code or specs — sheet IDs only.
- **Read-only sources**: 0 `values.update|append|clear|batchUpdate|spreadsheets.create` in `src/` and `migration/`; only `values.get` (engine.ts:126). Scope + Viewer shares enforce at Google level regardless.
- **Route surface**: `/api/admin/migrate` stays fail-closed on `MIGRATION_SECRET_KEY` + `assertWritable` view-as block; `tables` filter can only name configured mappings (no arbitrary table reach).
- **Good catch kept**: `v1-ops-misc.ts:65` correctly REJECTS the IdentityPins credential tab — no secret material lands in DB.
- `conflictTarget()` double-quoting + unit test; all 23 `upsertOn` flips verified against their DDL conflict targets.

## Not verified / assumptions

- First live upsert still proves PostgREST accepts the quoted `onConflict` (qa-2 same caveat) — approval-gated.
- Remote data could drift between the 2026-11-09 probes and the approved apply; re-run the 14 NULL probes pre-apply (cheap).
- Dedupe "keep highest id" = last-write-wins assumes migrated rows hold the newest data where keys collide with app rows; acceptable per plan but irreversible once applied — snapshot/backup before apply assumed.
- `trackers` seeds grant `editor_roles 'admin,tl,agent'` while `viewer_roles 'admin,tl'` — matches the native-tracker default (trackers.ts:966-968); enforcement direction not re-audited.
- 8-row `dq_hct` dup-email collapse and `aux_spans` 38-collapse are recorded approval caveats (qa-7), expected under keyed-upsert semantics.
