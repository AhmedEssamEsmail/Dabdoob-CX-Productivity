# sec report - qa-build-no-touches - round 1 (FULL)

Verdict: PASS
Open: 0/0/0/2

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| sec-1 | LOW | src/features/cx-hub/lib/roster.ts:367-377 | Manual-roster rows now accept `freshdesk_id`/`freshdesk_name`/`maqsam_name` from the HCT sheet, but unlike the hct branch (:381-403) the patch is applied with no `changes` entry — identity remaps are invisible in `dq_last_roster_sync`, so a bad/malicious sheet row silently re-points an agent's Freshdesk identity and QA touches get misattributed. | Push a `changes` entry (fields `freshdesk_id`/`freshdesk_name`/`maqsam_name`, old -> new) when the manual-branch patch is non-empty, mirroring :395-400. | dev |
| sec-2 | LOW | src/features/cx-hub/lib/roster.ts:369-371 | Patch condition has no keep-manual guard: when the HCT row's fd columns are blank (`''`), a previously populated `freshdesk_id`/`freshdesk_name` on a manual row is overwritten with `''`, re-introducing unresolved performers / identity loss on the next sync. | Skip `patch[f] = row[f]` when `String(row[f] || '') === ''` (same pattern as `DQ_SYNC_KEEP_MANUAL` at :384-387). | dev |

## Verified clean
- **AuthN/Z**: `qeBuildPool_` reachable only via `importQaQueueNow` → `qaRequireRole_(['admin'])` (server.ts:2297) and the cron path; `dqSyncRoster_` reachable via `syncRosterNow`/`jobRosterSync`, both `requireRole(['admin'])` + `assertWritable()` (roster.ts:450-452, 463-464). `/api/qa/[action]` delegates auth to each handler — `importQaQueueNow` is gated.
- **Injection**: patch objects are key/value maps passed to `updateRows` (parameterized store write); no string-built filters/SQL added.
- **Lookup collisions** (engine-live.ts:135-137): canonical `byName[name]` is unconditional and always wins over the `freshdesk_name` alias (first-writer-wins guard at :137), so an alias cannot hijack another agent's real name regardless of row order. Alias-vs-alias collisions are deterministic.
- **Secrets/deps**: none in diff; no manifest change (`deps n`); test fixture uses fake values only.
- `dqRosterFromHct_` always sets the three fd keys (:241-243), so no `String(undefined)` artifact in patches.

## Not verified / assumptions
- HCT sheet content is admin/HR-controlled; trust boundary is the existing sync design, unchanged in kind by this diff (sheet already appended/updated rows wholesale).
- `readRows`/`updateRows`/`appendRows` internals (platform repo) not re-audited; assumed parameterized per existing usage.
- Pre-existing pattern: `byName` is a plain object, so performer names like `constructor`/`__proto__` can hit inherited members (engine-live.ts:93). Out of diff scope; noted for future hardening (use `Object.create(null)` or `hasOwnProperty`).
