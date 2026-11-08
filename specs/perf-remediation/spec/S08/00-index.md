# Spec index: S08 service role + RLS
Kind: index

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S08-01 | mini | S08/01-service-role-client.md | dev | S04-01 | #8 supabase.ts lazy service client + repo db() | 2/4/60/6 |
| S08-02 | mini | S08/02-tph-lib-service-db.md | dev | S08-01 | #8 tph write.ts/run.ts .from() -> db() | 2/4/50/6 |
| S08-03 | mini | S08/03-routes-service-db.md | dev | S08-01 | #8 8 API routes .from() -> db() | 8/8/60/8 |
| S08-04 | mini | S08/04-rls-lockdown.md | supabase-expert | S08-02, S08-03, S03-01, S10-01 | #8 drop app_all policies project-wide | 1/2/80/6 |

repo.ts: S04-01 then S08-01 (serial). Migration catalog: S08-04 also waits
on S10-01 (serialization chain S07-03 -> S10-01 -> S08-04).
