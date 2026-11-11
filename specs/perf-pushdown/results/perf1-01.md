# perf1-01 result — DONE (analytics PASS; hub/home BREACH recorded)

- Files: `docs/PERF_BASELINE.md` (`## After` intro/rows/verdicts + perf-4 payload note); `specs/perf-pushdown/logs/perf1-timings.log` (raw build+server+curl).
- Final build: `npm run build` exit 0 @12:04, `.next` BUILD_ID `RQxQ00OoPfT22Fj8nO3wI`; stale :3100 server (PID 6984) killed, fresh `next start -p 3100` left running.
- `GET /api/prod/analytics`: **500 -> 200** x3 (3.771 cold / 0.105 / 0.121 -> median 0.121 s, 3,448 B) — **PASS** vs T0 0.487; pm2-01 `eval('from')` fix verified served (perf-1 closed); payload measurable for the first time.
- `GET /api/hub/home`: 200 x3 (3.157 / 2.189 / 1.751 -> median 2.189 s, ~7,305 B) — **BREACH** vs T0 1.459 (+50%), all 3 runs > baseline = reproducible per perf-5; recorded, no fix attempted (contract).
- Payload (perf-4): >=50% target not met — tph/page -24.4%, hub/home +3.4%, analytics 3,448 B; note added: pushed tables are a minor payload share; `size <= baseline` holds except hub/home.
- Verify: analytics curl = 200; perf1-03's `### prod_window_hist` note preserved last; `git diff --stat` empty because PERF_BASELINE.md is untracked (`??`), edits confirmed in file.
- Handoff: perf-1/perf-5 closed (perf-5 as recorded BREACH for PM/TL); perf-4 documented. No blockers.
