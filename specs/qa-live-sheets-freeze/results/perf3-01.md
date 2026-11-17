# perf3-01 — scIo_ range-bound prefetch (attempt 2)
Status: DONE (attempt 1 had landed scIo_ body; this attempt finished call sites + tests)
Files: scorecard-server.ts (scIo_(cfg,range) + 2 call sites pass range), tlqueue.ts:629 (pwPrevMonth window + import), one-on-ones-page.ts:457 (same window + import), tests/perf/scorecard-range.test.ts (scIo_ bound/parity cases)
Checks: vitest scorecard-range + golden scorecard + golden queue-tlqueue = 66/66 pass; npx tsc --noEmit = 0 errors
Handoff: scIo_(cfg, range) signature final; perf3-02 edits scorecard-server.ts next (serial).
