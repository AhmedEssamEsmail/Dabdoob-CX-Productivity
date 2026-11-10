# Remote migration history repair — project uugeyulccyytvgcabzzx (production)

Gate: user ran `supabase link` (ahmed.ismail@dabdoob.com) and APPROVED remote
history repair on 2026-11-10. All commands run as
`env -u SUPABASE_ACCESS_TOKEN npx supabase ...` (stale scoped PAT unset).
CLI v3.1.0. Remote writes: `migration repair --remote` ONLY. No `db push`,
no SQL/schema changes, no repo edits.

## Before state (migration list --remote, captured to migration-list-before.txt)
- 60 history rows total.
- Both local file + applied remotely: 13 (the pre-existing 20261108*/20261109* set).
- Remote-only rows (no local file): 32 (PM estimate said 31; live capture showed 32 — same repair applied to all).
- Local-only (no remote row): 15 = 14 renamed 001-014 files + 20261109123839.

## Set A — local versions marked `applied` (14)
20261030163812, 20261031193119, 20261031193219, 20261101175759,
20261105171948, 20261105172048, 20261105172148, 20261105172248,
20261105172348, 20261105172448, 20261106151132, 20261106201210,
20261106202413, 20261106202513
Result: all 14 confirmed `=> applied` (see repair.log; 0 failures).

## Set B — remote-only versions marked `reverted` (32)
20261030160403, 20261030160406, 20261030160410, 20261030160941,
20261030160944, 20261030160955, 20261030160958, 20261030161006,
20261030161012, 20261030161018, 20261030161025, 20261031135657,
20261031135702, 20261031135745, 20261106130507, 20261106130528,
20261106130557, 20261106130716, 20261106130722, 20261106130812,
20261106130831, 20261106130842, 20261106130915, 20261106130944,
20261106131001, 20261106131009, 20261106131030, 20261106134818,
20261106190239, 20261106190259, 20261109093321, 20261109093328
Result: all 32 confirmed `=> reverted` (see repair.log; 0 failures).

## Left pending by design (1)
20261109123839_before_user_created_domain_gate — intentionally NOT marked
applied; its DDL has not run on prod, so the GitHub integration must apply
it on next merge to `main`.

## After state (migration list --remote, migration-list-after.txt)
- TOTAL rows: 28 — exactly one applied row per local version.
- Both local file + applied remotely: 27.
- Remote-only rows: 0 (all 32 strays reverted).
- Pending (local-only): exactly 1 — 20261109123839 (by design, see above).
- `db push --remote --dry-run` reports exactly one file to apply:
  `supabase/migrations/20261109123839_before_user_created_domain_gate.sql`.
  CLI notes its version precedes the last applied remote version
  (20261109134359), so a real push needs `--include-all` — flag to PM for
  the GitHub-integration deploy path.

## Post-repair access note (resolved)
Immediately after the 46th repair, every remote CLI call began failing with
`DbConfigLoginRoleStatusError: unexpected login role status 403` (Supabase
temporarily restricts the CLI login role after bursts of remote calls; known
CLI behaviour — documented in supabase/cli#4419 and community reports; reset
took ~7 min here). All 46 repairs returned explicit per-version success
BEFORE the restriction began. Both verification commands succeeded once it
lifted; evidence in migration-list-after.txt and db-push-dryrun.txt.
