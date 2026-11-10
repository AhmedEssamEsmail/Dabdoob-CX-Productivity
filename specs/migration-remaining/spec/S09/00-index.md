# S09: sec-1 findings fix package (FIX mode)
Kind: package
Parent: root
Depends: S02..S08 complete; findings reports/sec-1.md

## Findings -> leaves
| Finding | Sev | Leaf | Owner | Outcome |
|---|---|---|---|---|
| sec-1 | MED | S09-01 | dev | positional 'mig-'/'v1-mig-'+ctx.index mints -> content-hash dedupe_key (sha1 of natural-identity cells) in queue-quality.ts + v1-ops-sched.ts; same root cause covered: refresh_log log_id mint |
| sec-1 | MED | S09-02 | supabase-expert | DDL backfills in the two pending dedupe migrations emit the identical hash scheme (pgcrypto sha1) so applied rows match re-run keys |
| sec-2 | LOW | deferred | - | mail_log/follow_up_done NULL-part natural keys; needs live-data confirm before fix — deferred per LOW rule |
| sec-3 | LOW | deferred | - | aux_exceptions record_id raw '|' separator collision — deferred per LOW rule |
| sec-4 | LOW | deferred | - | hardcoded employee email constant; ALSO pending PM confirmation (S06-01 flag) — deferred per LOW rule |

S09-02 depends on S09-01 (it pins the canonical cell order/format in
results/S09-01.md). Serial by design.
