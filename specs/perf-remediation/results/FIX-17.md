# FIX-17 result
Status: DONE
Files: src/app/api/prod/intervals/route.ts, src/app/api/prod/daily-layers/route.ts
Changes: absent `date` param -> gte('date', today-31d); .limit(5000) appended to both queries; auth/params/order unchanged.
Checks: npx tsc --noEmit 0 errors; npx eslint both files 0 errors.
Blockers: none. Handoff: none.
