# tl report - ctls-page-cleanup - round 2 (FIX for reports/qa-1.md)

## Fix dispatch
| Finding | Severity | Leaf | Owner | Status |
|---|---|---|---|---|
| qa-1: unguarded timestamptz cast + lexicographic `sla_met` on unnormalized sheet dates | MED | `spec/fix-qa-1.md#qa1-01` | supabase-expert | done |
| qa-2: shift-reason copy wrong under scope 'all' | LOW | - | - | deferred (LOW per FIX rules) |

## Changed files (DELTA scope for re-review)
- `supabase/migrations/20261120121758_close_historical_ctls.sql` — lines ~13-21 only: `submitted_at` now `case when d ~ '^\d{4}-\d{2}-\d{2}' then d::timestamptz else null end`; `sla_met` compares guarded `::date` parses, 'false' when either side unparseable. WHERE idempotency guard, status/outcome/closed_by/coaching_notes untouched.

## Evidence
- results/qa1-01.md; scoped file read verified no unguarded cast remains on sheet text.
- Gates: SQL-only diff — `tsc`/`vitest`/`lint`/`test:security` unaffected by this change (all PASSed in round 1; nothing in TS/TSX changed). `supabase migration lint` unavailable (no local stack); migration was assessed statically, same as round 1.
- Preflight `check_shards.py fix-qa-1.md#qa1-01`: PASS.

## Blocked / needs user
- Migration auto-applies on merge to `main` via Supabase GitHub integration (AGENTS.md) — pending normal merge, no manual remote run.
- Baseline lint error `tests/golden/queue-aggregates.test.ts:123` pre-existing, out of scope (unchanged from tl-1).
