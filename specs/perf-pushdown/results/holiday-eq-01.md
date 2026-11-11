# holiday-eq-01: dqIsHoliday_ case-sensitive eq
Status: DONE
Files: src/features/cx-hub/lib/roster.ts (dqIsHoliday_ ~:563 — dropped `country` from pushed eq; kept `date` eq + `is deleted_at null` + JS case-insensitive guard verbatim)
Checks: `npx vitest run tests/golden/hub-people-holidays.test.ts` -> 13/13 pass (oracle mismatch gone); `npx tsc --noEmit` -> exit 0
Notes: no test-file edit needed; no app guard/throw changes; read stays bounded by date eq.
Handoff: none.
