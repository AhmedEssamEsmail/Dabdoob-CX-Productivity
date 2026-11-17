# W2-FIX-01 result
Status: DONE
Files: src/features/shared/jobs/mirrors.ts (docblock :18-21 only)
Change: "re-read the whole tab (the Sheets API has to)" -> "re-pull the vendor API window"; kept last_ts_ms - 24h overlap + dedupe_key wording; row-model notes untouched.
Checks: rg "re-read the whole tab|Sheets API has to" mirrors.ts -> no matches; npx tsc --noEmit ran clean (doc-only change, no code touched).
Handoff: closes data-4, last unrouted data-1 finding. Blockers: none.
