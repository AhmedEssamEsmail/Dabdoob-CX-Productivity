# tl-5 — FIX round for reports/data-1.md (qa-live-sheets-freeze)

Source report: `reports/data-1.md` (FAIL, 0B/1H/1M/2L). PM routed data-1,
data-2, data-3 to `dev` (overrides the report's data-engineer owner column);
data-4 (LOW docstring) not routed -> deferred.

## Leaves (spec/fix-data-1.md — all preflight PASS)

| Leaf | Finding | Owner | Status | Changed files | Evidence |
|---|---|---|---|---|---|
| data1-01 | data-1 HIGH | dev | done | `src/features/shared/jobs/dbbook.ts`, `tests/jobs/dbbook.test.ts`, `tests/jobs/env-dbbook.test.ts` | L = `handling*1440` (fractional days -> decimal min per prod engine contract) + private `hmsToSec_` 'H:MM:SS' fallback un-deaded; fixtures now `String(90/86400)`; vitest 19/19 |
| data1-02 | data-2 MED | dev | done | `src/features/shared/jobs/env.ts`, `tests/jobs/env-dbbook.test.ts` | ANY real tab error -> `books[key]` = that Error -> openSpreadsheet throws (sheet-era fail-the-book parity); write-only `tabErrors` persistence removed; missing-store still header-only via missingOk_; +1 partial-fail regression; vitest 20/20 |
| data1-03 | data-3 LOW (== sec-5) | dev | done | `src/features/cx-hub/lib/roster.ts`, `tests/platform/dq-hct-snapshot.test.ts` | snapshot dedupes last-wins on `dqCleanEmail_` before 500-slice upsert — same-batch clean-equal collision ("ON CONFLICT ... second time") impossible; +1 collision case; vitest 7/7 |

data1-01 + data1-03 ran parallel (disjoint files); data1-02 serial after
data1-01 (shared `tests/jobs/env-dbbook.test.ts`). One fix closes both
data-3 and sec-5. No reviewer shards requested or spawned.

## Integration gates (round 6 — logs/gate6-*)

- `npx tsc --noEmit`: PASS, 0 errors.
- `npx eslint .`: PASS, 0 errors; same 5 pre-existing warnings (untouched files).
- `npx vitest run`: 1449/1450; sole FAIL `tests/quality/qe-fd-cache.test.ts` — known-external (cx-quality engine-live domain, no leaf file in import graph), unchanged since round 1.

## Deferred / handoffs

- data-4 LOW (stale mirrors.ts docstring naming sheet sources): deferred — not routed by PM; doc-only.
- sec-2/sec-3 LOW remain deferred (wave-2); sec-4 LOW dq_hct dup cleanup still tied to pending remote `supabase db push` (PM/deploy).
- Blocked-needs-user items unchanged: remote apply of 4 pending migrations, `app.settings.app_url`/`cron_secret` provisioning, prod_assumptions seed run.
