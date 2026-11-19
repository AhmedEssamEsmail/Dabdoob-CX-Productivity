# debug report - qa-build-no-touches - 1

Verdict: ROOT_CAUSE_FOUND

## Repro
SELECT-only probes against production (service role, aggregates only) + a new
failing unit test.

- `roster`: 50 rows, **0 with `freshdesk_id`, 0 with `freshdesk_name`**, all
  `source='manual'`, `synced_at` empty.
- `fd_activities` (last 3 days, 1000 rows scanned): **1000/1000
  `performer_name = 'User <12-digit fd id>'`** — the writer's fallback shape
  (vendor-apis.ts:189). Top 8 by volume (89..33 touches) are all CX agents.
- `dq_hct` (the HCT snapshot the roster sync writes): 51 rows, **51 with
  `fdId`, 50 with `fdName`**, synced 2026-11-18 16:33Z. 44/50 roster emails
  match a dq_hct row **with** fdId — the data exists; it never reaches
  `roster`.
- `config.dq_last_roster_sync` (2026-11-18): `{"synced":44,"added":0,"changed":0}`
  — the sync saw all 44 in-scope people and patched nothing.
- `qeBuildQueue` on the fixture (vitest): 'Noha Hassan' (a real prod
  `freshdesk_name`) -> throws "No agent touches ... 3 performers unresolved,
  roster 1 users" at engine-live.ts:403 — identical signature to the toast.

## Root cause
Two chained defects; **both** must be fixed:

1. `dqSyncRoster_` never patches manual roster rows — so `freshdesk_id` /
   `freshdesk_name` are permanently empty -> the mirror's roster directory is
   empty -> every fd_activities row is stored as `User <id>` -> the reader's
   byId is empty -> 100% unresolved.
2. Even once (1) is fixed, `qeReadAgentRoster_` never indexes
   `freshdesk_name`, but the writer stores it — and it differs from HR `name`
   for **30/43 prod agents** (e.g. fdName 'Noha Hassan' vs name 'Noha Hassan
   Foaad Qandil'). Freshly-written rows would still fail byName lookup.

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| dbg-1 | HIGH | src/features/cx-hub/lib/roster.ts:367 | `if (cur.source && cur.source !== 'hct') return` skips every existing row — all 50 prod rows are `source='manual'` (initial sheet migration `migration/migrate.ts:42-49` upserts email/name/role only, no `source` -> column default 'manual'). Evidence: dq_hct has fdId for all 44 in-scope roster emails; roster has 0; last sync `added:0, changed:0`. | In the `res.rows.forEach` loop, before the manual-source early-return, still patch the HCT-owned identity fields (`freshdesk_id`, `freshdesk_name`; consider `maqsam_name`) onto `cur` when they differ — do NOT flip `source` to 'hct' (see Siblings) and keep role/tl_email/overrides manual. | dev |
| dbg-2 | HIGH | src/features/cx-quality/lib/engine-live.ts:124 | `byName` is keyed only on `r.fd_name \|\| r.name`; the `fd_name` column doesn't exist (schema has `freshdesk_id`/`freshdesk_name`, migration 20261105171948_hub.sql:26-27) and `freshdesk_name` is never indexed, while `fdActivityRosterNames_` (mirrors.ts:79-89) -> `fdActivityToCells_` (vendor-apis.ts:189) stores exactly that value. Fails for 30/43 agents. | Index the same `rec` under the FD display name too: after `byName[name] = rec`, add `const fdName = String(r.freshdesk_name \|\| r.fd_name \|\| '').trim(); if (fdName && !byName[fdName]) byName[fdName] = rec`. Keep `rec.name` = roster `name` so resolved agents join downstream on the canonical name. | dev |

## Regression test
`tests/quality/qe-performer-resolution.test.ts` — NEW, committed with this
report. Run: `npx vitest run tests/quality/qe-performer-resolution.test.ts`.
Status: **failing now for the right reason** —
`resolves freshdesk_name ...` -> "No agent touches found in the 3-day window
... 3 performers unresolved, roster 1 users" (engine-live.ts:403). The
`'User <fd_id>'` and unresolvable-id cases pass, locking the byId contract.

## Data / rollout notes (no code change needed for these)
- After dbg-1 ships, the fd columns populate on the next admin "Sync roster"
  click (roster sync is manual-only by design, roster.ts:445-451). A one-off
  `UPDATE roster SET freshdesk_id=..., freshdesk_name=... FROM dq_hct ON
  email` backfill would unblock the build without waiting — needs user
  approval; not required for correctness.
- Existing `User <id>` fd_activities rows resolve via byId once dbg-1 lands;
  incremental mirror syncs re-resolve the newest day automatically. ~165 of
  174 distinct performer ids are non-CX agents (correctly skipped).

## Siblings (same pattern elsewhere)
- `dqRosterPeople_` (adapters.ts:354) filters `r.source === 'hct'` — returns
  null today, so prod/aging fall back to sheet headcount. If dbg-1's fix
  flips `source` to 'hct' instead of only patching identity fields, that
  path activates and changes productivity/aging behaviour — regression risk;
  patch-in-place is the safer fix.
- `qeReadAgentRoster_` byId (engine-live.ts:126) already reads
  `r.fd_id || r.freshdesk_id` — correct once dbg-1 lands; no change needed.
- Writer `fdActivityToCells_` `User <id>` fallback is correct behaviour for a
  missing roster directory — leave it.
- adapters.ts:319 maps `'unknown agent - raw id <fdId>'` for the email
  directory; `qeIsRealAgentName_` rejects that shape anyway — out of scope.
