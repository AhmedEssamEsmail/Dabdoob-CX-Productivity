# after-timing-01 result — DONE

- Files: `docs/PERF_BASELINE.md` (`## After` filled + verdicts); `specs/perf-pushdown/logs/after-timings.log` (raw).
- Method: reused `.next` build `XmwNC6nOQaYMaeSTp-xcn` (0 src files newer than BUILD_ID); `next start -p 3100`; login `POST /api/auth/login` e2e.admin@dabdoob.com -> 200, cookie jar; curl `time_total/size_download/http_code` x3 per endpoint.
- After medians: prod/analytics 0.674 **500** (error now `column prod_daily_layers.productiveMinResolution does not exist` — schema drift, recorded); tph/page 0.374 (-9%); tph/slots 0.329 (expected 500); hub/home 1.296 (-11%); queue/aging 0.193 (-55%); queue/analytics 0.187 (-49%); qa/getQaScoresPage 0.125 **500->200** (pk-override confirmed; run1 4.82s cold).
- getQaScoresPage args documented in doc+log: `["2026-11-04","2026-11-11","interaction"]` (T0 args unrecorded).
- Handoff: prod_daily_layers missing column = residual 500 root cause for PM/TL (not pk-fixable in app code).
