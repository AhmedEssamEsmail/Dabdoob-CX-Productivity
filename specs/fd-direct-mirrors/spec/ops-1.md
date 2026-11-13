# ops-1: approved production ops — fd_activities rebuild + D3 cursor + resume-gap close
Kind: package
Maps: APPROVALS.md grants #4 (b,c), #5 and #6. One-shot approvals; anything
beyond the named commands/keys is a fresh NEEDS_APPROVAL. Remote writes to
production uugeyulccyytvgcabzzx are APPROVED for exactly these actions only.

## Children
| ID | Kind | Owner | Depends | Budget (f/a/lines/min) |
|---|---|---|---|---|
| ops1-01 | mini | data-engineer | FRESHDESK_API_KEY in .env.local (NEEDS_USER — absent, Vercel-Sensitive) | 1/5/15/10 |
| ops1-02 | mini | data-engineer | none | 1/4/15/5 |
| ops1-03 | mini | data-engineer | ops1-01 partial (Oct-2 watermark re-seeded); FRESHDESK_API_KEY in .env.local | 2/5/35/10 |

## ops1-01: wipe + API-direct rebuild of prod fd_activities
Kind: mini
ID: ops1-01
Parent: ops-1
Owner: data-engineer
Depends: .env.local must contain a real FRESHDESK_API_KEY (BLOCKED — absent;
Vercel-Sensitive redaction blocks `vercel env pull`). Do NOT run step 1 (the
wipe) until the rebuild can follow in the same session.
Criteria: APPROVALS.md #4b/#4c; data-1 BLOCKER (274,882 corrupt rows)
Skills: none
Budget: files=1; actions=5; changed_lines=15; minutes=10

### Goal
Production `fd_activities` contains zero pre-rebuild rows, one
`refresh_log` audit row exists, and the table is rebuilt API-direct with the
DD/MM fix + Sep-1 retention floor — verified by zero rows with
`performed_at > now() + interval '1 day'`.

### Files
- Create: `specs/fd-direct-mirrors/results/ops1-01.md` | status/counts/log tails (<=10 lines)

### Context
- `migration/reset-fd-activities.ts` | existing approved script — paged delete-all + deletes `config.mirror_state_fd_activities` + refresh_log row
- `migration/run-fd-mirror.ts:94-111` | `--write` = `syncMirror(cfg,'fd_activities',{full:true})`; `partial:true` means rerun to resume
- `src/features/shared/jobs/mirrors.ts:46,279,305` | RETENTION_FLOOR_MS + clamps already in the local tree the script imports
- `specs/fd-direct-mirrors/results/remote-migrations.md` | proven remote pattern; verify `Target:` = uugeyulccyytvgcabzzx
- `specs/fd-direct-mirrors/APPROVALS.md` | one-shot grant #4 — no other remote write is approved

### Contract
Run from project root `C:\Users\AHMED\KPIs\CX-Hub`. Commands exactly as
approved — no flags added, no other tables touched, no source edits.
Out of scope: any other config key, tickets table, code changes, git ops,
`--check` parity (data-5 deferred, known-misleading).

### Actions
1. Preflight: confirm `.env.local` sets FRESHDESK_API_KEY + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (names only, never print values). If the FD key is absent STOP — do not wipe — write results file with `NEEDS_USER: FRESHDESK_API_KEY`.
2. `npx tsx migration/reset-fd-activities.ts --write > specs/fd-direct-mirrors/logs/ops1-01-reset.log 2>&1` — expect `remaining=0 watermark_present=false` + refresh_log line; quote exit + `tail -c 3000`.
3. `npx tsx migration/run-fd-mirror.ts --write > specs/fd-direct-mirrors/logs/ops1-01-rebuild.log 2>&1` — if `partial=true` rerun the same command once more (max 2 extra runs), same log file appended.
4. Verify on prod via `npx supabase db query --remote --yes` (check `Target:` line): `select count(*) from fd_activities where performed_at > now() + interval '1 day'` (expect 0); `select count(*), max(ts_ms) from fd_activities`; `select count(*) from config where key='mirror_state_fd_activities'` (expect 1 — watermark re-seeded by rebuild).
5. Write results/ops1-01.md: exit codes, before/deleted/remaining, fetched/written/skipped/partial, verify-query outputs.

### Done when
- reset exits 0; remaining=0; watermark deleted; refresh_log `fd_activities_reset` row written
- rebuild exits 0; `written>0`, `partial=false`
- zero rows with `performed_at > now() + interval '1 day'`; count sane (hundreds of thousands, Sep-1→today only)
- results/ops1-01.md written (<=10 lines)

### Verify
- Run: `npx supabase db query --remote --yes "select count(*) as future_dated from fd_activities where performed_at > now() + interval '1 day'"` -> `future_dated=0` (plus count>0 and watermark key re-seeded per Action 4)

### Handoff
Watermark `mirror_state_fd_activities` re-seeded -> deployed crons resume
incremental, not full. Write results/ops1-01.md; TL alone updates TRACKER.md.

## ops1-02: set prod config v2_fd_inc_cursor = 2026-09-01T00:00:00Z
Kind: mini
ID: ops1-02
Parent: ops-1
Owner: data-engineer
Depends: none
Criteria: APPROVALS.md #5; data-3 HIGH (D3 corrected target)
Skills: none
Budget: files=1; actions=4; changed_lines=15; minutes=5

### Goal
Production `config` row `v2_fd_inc_cursor` has value exactly
`2026-09-01T00:00:00Z` — so the next `fdSyncIncremental_` (job-data-tick,
~15 min pg_cron) re-fetches ticket updates Sep-1-forward and repopulates
`tickets.subject`/`order_id` on the retained rows.

### Files
- Create: `specs/fd-direct-mirrors/results/ops1-02.md` | status + read-back evidence (<=10 lines)

### Context
- `src/features/shared/platform/settings.ts:200-238` | config columns: `key` PK, `value` text, `description`, `updated_by`, `updated_at`; value stored as plain string
- `src/features/shared/jobs/freshdesk.ts:30,342` | `v2_fd_inc_cursor` written via setConfig as ISO string
- `specs/fd-direct-mirrors/results/remote-migrations.md` | proven `npx supabase db query --remote --yes` pattern; verify `Target:` = uugeyulccyytvgcabzzx
- `specs/fd-direct-mirrors/APPROVALS.md` | one-shot grant #5 — the ONLY approved config write

### Contract
One remote upsert + one read-back. No other keys, no other tables, no source
edits, no git ops. SQL upsert (insert on conflict update value/updated_by/
updated_at) or service-role client upsert — worker's choice; do NOT use
`freshdesk_full_sync_start` or any other value.
Out of scope: `v2_fd_full_cursor`, `v2_fd_sync_running`, tickets rows.

### Actions
1. Preflight read: `select key, value from config where key = 'v2_fd_inc_cursor'` — record current value in results.
2. Upsert `v2_fd_inc_cursor` = `'2026-09-01T00:00:00Z'`, `updated_by='system:ops'`, `updated_at=now()` via `npx supabase db query --remote --yes` (verify `Target:` = production before executing).
3. Read-back: same select — value must equal `2026-09-01T00:00:00Z` exactly.
4. Write results/ops1-02.md: old value, new value, Target line, exit code.

### Done when
- prod `config.v2_fd_inc_cursor` = `2026-09-01T00:00:00Z` (read-back verified)
- results/ops1-02.md written (<=10 lines)

### Verify
- Run: `npx supabase db query --remote --yes "select value from config where key='v2_fd_inc_cursor'"` -> `2026-09-01T00:00:00Z`

### Handoff
Deployed `job-data-tick` picks the cursor up on its next ~15-min run;
`fdFloorCursor_` makes the write safe even if read before the floor deploy.
Write results/ops1-02.md; TL alone updates TRACKER.md.

## ops1-03: resume-mode run-fd-mirror — close the Oct-2→now gap
Kind: mini
ID: ops1-03
Parent: ops-1
Owner: data-engineer
Depends: ops1-01 PARTIAL outcome (prod watermark `mirror_state_fd_activities`
re-seeded at `last_ts_ms=1790899200000` = 2026-10-02); .env.local carries a
real FRESHDESK_API_KEY (present per PM/TL preflight).
Criteria: APPROVALS.md #6 (supersedes the #4c `--write` treadmill);
reports/tl-6.md Path B.
Skills: none
Budget: files=2; actions=5; changed_lines=35; minutes=10

### Goal
Prod `fd_activities` covers Sep-1→today: a non-full (incremental) `syncMirror`
run resumes from the Oct-2 watermark and day-walks the Oct-2→now gap
(~90k rows). Table ≈156k total (66,212 + ~90k), zero future-dated rows,
watermark ≈ now.

### Files
- Edit: `migration/run-fd-mirror.ts` | add a `--resume` flag → `syncMirror(cfg, TABLE, {})` (non-full path; local gitignored script, minimal diff)
- Create: `specs/fd-direct-mirrors/results/ops1-03.md` | status/counts/log tails (<=10 lines)

### Context
- `src/features/shared/jobs/mirrors.ts:242-244,300-316` | non-full → `cut = last_ts_ms − 24h OVERLAP`; day-window walk + per-window `saveState` → a `partial` run resumes exactly; SYNC_BUDGET=240s caps each invocation
- `specs/fd-direct-mirrors/reports/tl-6.md` | watermark re-seeded Oct-2; `--write` forces `full:true` → `cut=-Infinity` → treadmill restart at Sep-1 — NEVER use it
- `specs/fd-direct-mirrors/results/ops1-01.md` | run pattern incl. `NODE_OPTIONS=--conditions=react-server` needed for the `server-only` import under tsx
- `specs/fd-direct-mirrors/APPROVALS.md` | one-shot grant #6 — resume-mode invocation only

### Contract
Run from project root `C:\Users\AHMED\KPIs\CX-Hub`. The ONLY approved remote
write is the resume-mode run-fd-mirror invocation on fd_activities; bounded
reruns of the IDENTICAL `--resume` command to reach `partial=false` are the
same approved action. NEVER pass `--write`. No other tables/config keys, no
source edits outside `migration/run-fd-mirror.ts`, no git ops, never print
secret values. `migration/` is local-only — the edit needs no test/gate run.

### Actions
1. Preflight (names only, never values): `.env.local` has FRESHDESK_API_KEY, SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_SUPABASE_URL containing `uugeyulccyytvgcabzzx`. Any missing/mismatch → STOP; write results file with `NEEDS_USER`.
2. Edit `migration/run-fd-mirror.ts` (~25 lines): `const RESUME = process.argv.includes('--resume')`; add `resume()` mirroring `write()` but calling `syncMirror(cfg, TABLE, {})` and printing `fd-resume fetched=… written=… skipped=… watermark=… full=… partial=…`; dispatch `RESUME ? resume() : WRITE ? write() : check()`; update the header usage comment.
3. `NODE_OPTIONS=--conditions=react-server npx tsx migration/run-fd-mirror.ts --resume >> specs/fd-direct-mirrors/logs/ops1-03-resume.log 2>&1` — while the summary line prints `partial=true`, rerun the identical command (max 4 invocations total); STOP early when partial is absent/false. If any run prints `full=true` → wrong code path → STOP and report. Still partial after 4 runs → stop, report remaining gap.
4. Verify on prod via `npx supabase db query --remote --yes` (confirm `Target:` = uugeyulccyytvgcabzzx each call):
   a. `select count(*) as n, max(performed_at) as max_pa from fd_activities` — n ≈156k, max_pa ≈ now
   b. `select count(*) as future_dated from fd_activities where performed_at > now() + interval '1 day'` — expect 0
   c. `select count(*) as ts_mismatch from fd_activities where performed_at is distinct from to_timestamp(ts_ms::double precision/1000)` — expect 0
   d. `select value from config where key='mirror_state_fd_activities'` — last_ts_ms ≈ now
5. Write results/ops1-03.md: invocations, per-run fetched/written/partial, exit codes, verify outputs, final count vs ~156k expected.

### Done when
- every run prints `full=false`; final run exits 0 with partial absent/false (or remaining gap documented after 4 runs)
- prod: n ≈156k (sane ~140k–175k); max(performed_at) within ~2d of now; future_dated=0; ts_mismatch=0
- results/ops1-03.md written (<=10 lines)

### Verify
- Run: `npx supabase db query --remote --yes "select count(*) as n, max(performed_at) as max_pa from fd_activities"` → n≈156k, max_pa≈now

### Handoff
Watermark ≈ now → deployed incremental crons keep parity. Write
results/ops1-03.md; TL alone updates TRACKER.md and re-verifies the prod
queries independently.
