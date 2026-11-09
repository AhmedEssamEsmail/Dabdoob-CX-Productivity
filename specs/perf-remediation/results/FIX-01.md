# FIX-01 result
- Status: BLOCKED (implementation done; verify gate fails on out-of-scope file)
- Files: `src/app/layout.tsx` — added `export const instant = false` + 2-line comment.
- Check: `next build` -> exit 1, but error is a pre-existing syntax error in `src/app/api/cron/job-data-tick/route.ts:2` (unterminated comment containing `*/15`), NOT the prerender error FIX-01 targets.
- That file is uncommitted-modified by another shard (FIX-02b); not in my Files list.
- Evidence: `specs/perf-remediation/logs/fix01-build.log`.
- Handoff: TL needs syntax fix in cron route, then re-run `next build` to confirm instant opt-out works.
