# data1-01 — DONE

- Fix: `jobs.ts` `dqCheckinTick_` `have` load now `.in('snapshot_key', cps.map(c => c.key))` (was `.eq('year', today-year)`); `todays` load untouched.
- Test: `queue-checkin-auto.test.ts` +1 regression (seed gained `slot` override): frozen `2025-12-31|23:00` year-2025 rows on a Jan-1 tick -> captured 0, rows unchanged, submission uses frozen data_as_of.
- Checks: `npx vitest run tests/golden/queue-checkin-auto.test.ts` -> 6/6 pass. New test fails on pre-fix code (captured=1), passes after.
- Handoff: ready for data1-02 (same file, serialised by TL).
