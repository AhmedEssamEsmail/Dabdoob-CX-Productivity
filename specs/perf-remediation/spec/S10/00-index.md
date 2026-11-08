# Spec index: S10 shared my-day cache
Kind: index

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S10-01 | mini | S10/01-app-cache-table.md | supabase-expert | S07-03 | #10 app_cache kv table | 1/2/40/5 |
| S10-02 | mini | S10/02-myday-shared-cache.md | dev | S10-01, S08-01 | #10 shared-cache.ts + myday swap | 2/5/150/9 |

Migration catalog serial: S07-03 -> S10-01 -> S08-04.
S10-02 needs the service-role db() so app_cache works after S08-04 applies.
