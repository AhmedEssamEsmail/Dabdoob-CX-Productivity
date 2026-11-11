# page-contract baseline (P3-C1-03) — chromium, dev server, live WIP tree

Final: `results/page-contract-run.log` — **68 passed / 14 failed** (82 tests = 41 routes x [375,1024]).
Run1 = 0/82 (unfiltered dev noise); run2 = 39/82. Uncommitted perf WIP was live-edited mid-runs
(rotating parse errors; dev server bounced once) — ENV rows await a stable-tree re-run.

## Per-route verdict (375px | 1024px)
| Routes | 375 | 1024 |
|---|---|---|
| /admin/config /aging /analytics /audit-queue /calibration /coaching /ctls /disputes /ecosystem /heatmap /kb-gaps /kpi-logs /mail-desk /meetings /my-actions /my-auditor-kpis /my-audits /my-day* /people-holidays /qa-forms /queue /status-validation /tl-performance /tl-tasks /tph /tph-grid /trackers | PASS | PASS |
| /* | PASS | PASS |
| /admin | FAIL h-scroll | PASS |
| /admin/roster | PASS | FAIL toolbar-x |
| /agents | FAIL toolbar-y | PASS |
| /checkins | FAIL h-scroll | PASS |
| /kb-tracker | PASS quirk | PASS quirk |
| /notes | ENV load-timeout | ENV wip-parse |
| /one-on-ones | ENV wip-parse | ENV wip-parse |
| /overview | PASS | FAIL toolbar-x |
| /productivity-analytics | FAIL h-scroll | PASS |
| /quality-analytics | FAIL h-scroll* | PASS |
| /quality-scores | ENV load-timeout | ENV load-timeout |
| /scheduler | PASS | ENV load-timeout |

`*` / & /my-day @1024: toolbar-x moved in earlier runs, green in final (intermittent).
/quality-analytics@375: h-scroll in run1, env-timeout in run4 — re-confirm.

## FINDINGs (real defects — pending Phase-1/2; assertions stay failing)
- FINDING: /admin, /checkins, /productivity-analytics, /quality-analytics @375 — h-scroll (scrollWidth > innerWidth)
- FINDING: /admin/roster @1024, /overview @1024 — .page-actions x moved >1px on primary click (3/3 runs)
- FINDING: /agents @375 — .page-actions y moved >1px on primary click (3/3 runs)
- FINDING (intermittent): / @1024, /my-day @1024 — toolbar-x moved in earlier runs
- FINDING (filtered root cause): dev prerender crash `unstable value `Date.now()` while prerendering`
  at RootLayout on every route + coupled 500s — allowlisted (dev-diagnostic class); fix the
  render-path Date.now, then re-tighten the exact-text 500 entry so real 500s surface.

## Env quirks
- QUIRKS['/kb-tracker'].skipToolbar — "Add a KB update" unmounts .page-actions by design (inline form); PASS both widths after edit.
- WIP `Parsing ecmascript` console noise + login/load timeouts = env only; NOT allowlisted (would mask real breakage).
