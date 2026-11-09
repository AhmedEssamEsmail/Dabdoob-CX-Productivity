# FIX-23 results — done
- Files: tests/jobs/routes.test.ts (2 lines changed in tests at ~89, ~97)
- Change: `delete process.env.CRON_SECRET` -> `vi.stubEnv('CRON_SECRET', '')` in both fail-closed tests; `vi.unstubAllEnvs()` now restores env.
- Assertions/request shapes unchanged; empty string keeps `!secret` fail-closed path.
- Check: `npx vitest run tests/jobs/routes.test.ts` -> 10/10 pass (log: vitest-fix23.log).
- Grep: no `delete process.env.CRON_SECRET` remains in file.
- Blockers: none.
