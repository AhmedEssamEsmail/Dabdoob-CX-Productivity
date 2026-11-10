# PLAN — Adopt Supabase GitHub-integration migration deploys

## Goal
Make the Supabase GitHub integration ("Deploy to production", production branch `main`,
working dir `.`, repo `AhmedEssamEsmail/Dabdoob-CX-Productivity`) the single, correct
path for applying schema migrations — replacing the manual "paste SQL into the dashboard
editor" workflow — and record that convention in `.devin/workflow.md`.

## Success criteria
1. Every file in `supabase/migrations/` matches the CLI format `<14-digit-version>_<name>.sql`
   and the original `001`→`014` apply order is preserved via monotonic version numbers
   (versions derived from each file's first git commit date, nudged where needed so order
   follows the numeric prefix, NOT raw commit chronology).
2. `.devin/workflow.md` DB rule updated: new schema changes land as new timestamped
   migration files (`npx supabase migration new <name>`); merge to `main` auto-applies via
   the GitHub integration; manual SQL-editor applies are prohibited; remote DB access
   (repair/history inspection) still requires user approval.
3. Remote `supabase_migrations.schema_migrations` contains exactly one row per local
   version (verified via Supabase MCP `list_migrations` or `supabase migration list`) —
   i.e. the integration will see zero pending migrations on the next merge to `main`.
   **Requires remote auth + explicit user approval before any remote write.**
4. `supabase/APPLY_PENDING_MIGRATIONS.sql` removed (obsolete manual-apply artifact;
   dangerous if re-pasted under the new regime). File is untracked/generated — confirm in
   shard.
5. No app-code changes; `npx tsc --noEmit` still clean.

## Non-goals
- No linking the local CLI project (`supabase link`) unless the user chooses that auth path.
- No Vercel-integration changes (already correct — env-var sync only).
- No touching the in-flight LIVE-02 data-migration runbook (note below).
- No git commit/push unless the user asks.

## Risk flags
`db` (migration history repair on the live remote), `docs` (workflow.md).
Security gate: triggered by `db` flag — scope is file renames + history rows only.

## Gates
- typecheck: `npx tsc --noEmit`
- lint: `npx eslint .` (unchanged files only — renames should be no-op; run anyway)
- verification: filename regex check + remote `migration list` diff vs local

## Conventions (from .devin/workflow.md + lessons)
- Remote DB changes need explicit user approval — history repair is approval-gated.
- Supabase MCP targets live remote project `uugeyulccyytvgcabzzx`; currently failing to
  list tools — may need user re-auth; CLI is v3.0.0, NOT linked, `projects list` empty.
- Task text must not dictate generated filenames — versions assigned from git dates.
- Bound command output; log heavy output to files.

## Research notes
- Current files: `001_..014_*.sql` (non-standard) + 14 already-timestamped files
  (20261108…20261109). Rename map uses first-commit dates (collected): e.g.
  `001`→`20261030163812`, `014`→`20261106202413`; where commit order violates the numeric
  prefix order (003 vs 002, 005 vs 007…), bump the version by +1 minute over the previous
  file's version so apply order stays 001→014.
- GitHub integration deploy semantics = `supabase db push`: applies files whose version is
  absent from `supabase_migrations.schema_migrations`. Untracked history → mass re-apply
  → failures on non-idempotent DDL. Repair must mark all 28 versions `applied`.
- LIVE-02 interplay: its pending option (i) "new ALTER migration" — under the new regime
  that ALTER ships as a normal timestamped file that auto-applies on merge to `main`;
  flag this to the user when they make that decision.
- `supabase/APPLY_PENDING_MIGRATIONS.sql` header says generated 2026-11-05, contents
  = migrations 005–010 already applied manually.
