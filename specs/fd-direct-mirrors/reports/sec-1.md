# sec report - fd-direct-mirrors - round 1 (FULL)
Verdict: PASS        (FAIL if any BLOCKER/HIGH/MED open)
Open: 0B/0H/0M/3L

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| sec-1 | LOW | src/features/shared/jobs/freshdesk.ts:205-221 | `fdDownloadRes_` fetches the FD-supplied absolute `downloadUrl` with no host allowlist; if `freshdesk_domain` config or the FD response is ever attacker-steered, the server fetches an arbitrary internal URL and ingests attacker JSON as activity rows. Requires prior admin/config compromise (config is admin-gated post-lockdown) — trust-inheritance hardening only. | Validate `downloadUrl` against an allowlist (`*.freshdesk.com`, FD export CDN domains) + `https:` scheme before fetch; keep the Authorization header off it (already is). | data-engineer |
| sec-2 | LOW | migration/backfill-mirror-columns.ts:133 | Dry-run prints `JSON.stringify(t).slice(0,240)` of live row content (performer names, agent emails) to stdout; output was captured into `results/`/logs — employee PII in scratch artifacts. | Log `id` + skip/update verdict only, or mask PII fields in the sample line. | data-engineer |
| sec-3 | LOW | migration/apply-pending-ddl.mjs:20 | `ssl:{rejectUnauthorized:false}` on a direct prod pg connection — MITM-able credential/DDL channel if the helper is re-run on an untrusted network (pre-existing scratch; this round's remote apply used `db query -f` instead). | Enable verification (`ssl:true` or proper CA) or delete the stale helper. | data-engineer |

## Verified clean (diff scope)

- **Cron/integration endpoints**: `/api/admin/mirrors` POST keeps `requireAdminCaller` + `assertWritable` (route.ts:22,50); `GET` admin-gated (:72). Cron callers use unchanged `CRON_SECRET` bearer (fail-closed in prod). `fdActivityExport_`/`fdGet_` send the API key only to the config domain over TLS; key never logged. Sync writes are idempotent (`dedupe_key` upsert) and windowed (`windowMs`, per-window watermark) so a kill resumes safely.
- **RLS on touched tables**: new migrations are ALTERs on tables whose RLS posture is deny-all for public roles since `20261108205852_rls_lockdown_drop_app_all_policies.sql`; `qe_fd_cache` (20261106202513:194) covered by the same lockdown. Server `db()` is the service-role singleton (`src/features/shared/lib/supabase.ts:8,34`) — `server-only`, key never `NEXT_PUBLIC_*`.
- **Migration safety**: all five files idempotent (`ADD COLUMN IF NOT EXISTS`, `DROP ... IF EXISTS`), timestamped, additive-then-drop sequenced; `drop_mirror_cols` header documents the deploy-order gate (qa-4, deferred LOW in TRACKER).
- **Ops scripts** (`migration/`, gitignored at `.gitignore:47`): `--dry` default, `--write` gated, `--dry` overrides `--write` (reset/purge); static table/column names, parameterized filters, `refresh_log` audit rows, service key from `.env.local`, never printed.
- **Input handling**: `api/tph/touches` — `requireRole(['admin','tl'])` + date regex + `normEmail_` (:20-27); all PostgREST calls use static column lists and parameterized `.in/.gte/.lt` — no filter-string injection. `fdActivityToCells_`/`parseFdActivityDate_` treat vendor payloads as untyped and log only unmapped key *names*, never values.
- **Secrets**: none in diff; `docs/Reference_Code.gs` reads keys from Script Properties; `migration/.env.db` is inside the gitignored dir.

## Not verified / assumptions

- Lockdown migration `20261108205852` assumed applied on prod (predates the 4 applied feature migrations in `results/remote-migrations.md`); if not applied, `app_all` on `tickets`/`config`/`qe_fd_cache` would re-open the anon-read/write posture this review treated as closed.
- PLAN D3 (`tickets.subject`/`order_id` PII-adjacent) is an approved product decision; safe under service-role-only access — re-flag if any table is ever re-exposed to anon.
- `freshdesk_domain` → `fdGet_` URL construction (freshdesk.ts:53-55) means a config-write bug anywhere is a credential-exfil primitive; config writes are admin-route-gated — unchanged by this diff.
- `tests/perf/audit-queue-memo.test.tsx` +1 line is a foreign in-flight repair (TRACKER baseline), attributed, not reverted.
