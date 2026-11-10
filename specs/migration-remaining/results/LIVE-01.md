# LIVE-01 result — apply 6 pending migration files to live
Status: BLOCKED at file 1/6 — zero applied, zero side effects. No improvised fixes.
Verbatim error (MCP apply_migration, 20261109130415_dedupe_uniques_logs_ops):
`MCP error -32600: You do not have permission to perform this action`
Scoped PAT (SUPABASE_ACCESS_TOKEN) permits get_project_url but denies
apply_migration, execute_sql, list_migrations; Management API 403. No
DB password/DATABASE_URL exists; service_role can't run DDL; `db push`
out of scope. Evidence: logs/live-01-apply.log.
NEEDS_USER: PAT needs Supabase MCP database scope (re-issue scoped token
with database write / unscoped PAT in env), then re-dispatch LIVE-01.
Note for re-run: apply_migration records server-generated versions
(upstream #241) — schema_migrations won't hold file timestamps; verify
via name column or PostgREST probes instead.
Branch reconcile (null-key-probes ELSE): not reached — pending applies.
