# TPH Zero-Backfill — Implementation Tracker

Rule (carried from `../legacy-parity/IMPLEMENTATION-TRACKER.md`): each shard commits separately after its gates pass.

| Shard | Task | Status | Notes |
|---|---|---|---|
| 00 | Source-health audit endpoint | not started | Decides whether 04 runs |
| 01 | Mirror tables + sync | not started | Migration 004 + `src/lib/jobs/mirrors.ts` + `/api/admin/mirrors` + cron wiring decision |
| 02 | Error layer | not started | `describeDbError`, envelope, fail-loud reads, `storeErrors` banner — land early |
| 03 | Backfill runner | not started | `POST /api/admin/backfill`, 240s chunks, cursor-resumable |
| 04 | Legacy migration | conditional | Skipped if 00 finds no legacy `prod_*` history |
| 05 | Cron health | not started | `CRON_SECRET` + Hobby-plan cadence reality check |
| 06 | Tests & verification | not started | vitest + manual script + static gates |

## Log

- 2026-10-31: shards written from plan `C:\Users\AHMED\.devin\plans\plan-5de9543b0a10e4a5.md`. Root causes recorded in README. Owner decisions: mirror tables (not Sheets rewiring); legacy audit-first; backfill scope = everything incl. flags.
