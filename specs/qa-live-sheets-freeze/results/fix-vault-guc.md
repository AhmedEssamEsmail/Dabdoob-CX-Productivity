# fix-vault-guc — DONE

- File amended (only): supabase/migrations/20261116202809_pg_cron_scoped_wave1.sql
- GUC design -> Supabase Vault: 20x `current_setting('app.settings.*')` replaced by
  `(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_app_url'|'cxh_cron_secret')`.
- Header + footer comments and all 5 RAISE EXCEPTION messages updated; provisioning
  documented as `SELECT vault.create_secret('<value>','cxh_app_url'|'cxh_cron_secret')`.
- NULL-guard semantics preserved (missing secret name -> scalar subquery -> NULL -> guard fires);
  vault.secrets.name is UNIQUE so the subselect is single-row safe. Subselect verified valid
  inside jsonb_build_object/`||` concat — same shape as Supabase docs pg_cron+Vault example;
  jobs run as postgres which holds vault grants.
- Checks: grep confirms zero `current_setting`/`app.settings`/executable `ALTER DATABASE|ROLE`
  remain (only prose mention explaining the switch). No DDL run; no MCP server configured.
- NEEDS_APPROVAL: apply 20261116202809_pg_cron_scoped_wave1.sql (schedules 5 pg_cron jobs; destructive? n)
  — provision the two vault secrets BEFORE/WITH apply per header.
