# FIX-04 — pollTick returns server now
Status: done
Files: src/features/shared/shell/context.ts (pollTick body)
Change: widened getJson generic to include `now?: string`; returns `data.now ?? new Date().toISOString()`.
Checks: `npx tsc --noEmit` -> 0; `npx vitest run tests/golden` -> 27 files / 875 tests green.
Blockers: none.
