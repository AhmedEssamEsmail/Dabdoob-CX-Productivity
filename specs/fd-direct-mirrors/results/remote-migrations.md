# remote-migrations — fd-direct-mirrors
Status: DONE — all 4 approved migrations applied to remote production.
Method: `db push --remote` blocked (DbPushMissingLocalError: remote-only versions
20261112162628/20261112165502, pre-existing). Fallback used per approvals/lessons:
`npx supabase db query --remote --yes -f <file>` per migration, then one batched
`npx supabase migration repair 20261112150304 20261112150305 20261112150724 20261112150725 --status applied --remote --yes`.
Target verified on every call: dabdoob-cx-productivity (uugeyulccyytvgcabzzx) · production.
Verify `migration list --remote`: 20261112150304, ...150305, ...150724, ...150725 all local=remote.
No other migration applied (20261112165047 was already applied; remote-only versions untouched).
No 403s — SUPABASE_ACCESS_TOKEN worked as-is; no env -u needed.
