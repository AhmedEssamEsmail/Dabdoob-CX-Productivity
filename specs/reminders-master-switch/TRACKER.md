# TRACKER: reminders-master-switch
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree (not ours, do not revert): specs/redesign/*,
src/app/cx-kit.css, src/app/styles/{desk,hub,people,queue}.css,
src/app/theme.css, specs/maint-src-boundaries/.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| RMS-01 | mini/reminders-master-switch | dev | none | 2/2/30/8 | PASS | done | results/RMS-01.md; 2 files, +10 lines; vitest 10/10 |
| RMS-02 | mini/reminders-master-switch | dev | RMS-01 | 2/3/90/12 | PASS | done | results/RMS-02.md; vitest 2/2; tsc clean |
| RMS-03 | mini/reminders-master-switch | dev | RMS-01 | 2/2/75/10 | PASS | done | results/RMS-03.md; vitest 2/2; tsc clean |
| RMS-04 | mini/reminders-master-switch | dev | RMS-01 | 2/2/70/10 | PASS | done | results/RMS-04.md; vitest 2/2; tsc clean |
| RMS-05 | mini/reminders-master-switch | dev | RMS-02, RMS-04 | 2/2/120/15 | PASS | done | results/RMS-05.md; vitest 1/1; tsc clean |
| RMS-06 | mini/reminders-master-switch | dev | RMS-01 | 2/2/80/12 | PASS | done | results/RMS-06.md; vitest 1/1 |
| RMS-07 | mini/reminders-master-switch | dev | RMS-01 | 2/2/85/12 | PASS | done | results/RMS-07.md; vitest 1/1; tsc clean |
| RMS-08 | mini/reminders-master-switch | dev | RMS-01 | 1/2/60/10 | PASS | done | results/RMS-08.md; tsc clean |
| RMS-F01 | mini-fix/reminders-master-switch | test-engineer | RMS-01 | 1/2/40/10 | PASS | done | results/RMS-F01.md; hub-admin.test.ts 8/8 |
| RMS-F02 | mini-fix/reminders-master-switch | dev | none | 2/2/60/10 | PASS | done | results/RMS-F02.md; popups test 3/3; tsc clean |
| RMS-F03 | mini-fix/reminders-master-switch | dev | RMS-F02 | 2/2/60/10 | PASS | done | results/RMS-F03.md; dq test 1/1; tsc clean |
| RMS-F04 | mini-fix/reminders-master-switch | dev | none | 2/3/60/10 | PASS | done | results/RMS-F04.md; qa test 2/2; tsc clean |
| RMS-F05 | mini-fix/reminders-master-switch | dev | none | 1/2/30/8 | PASS | done | results/RMS-F05.md; ~7 lines in Dm+call site; tsc clean |
| RMS-F06 | mini-fix/reminders-master-switch | dev | none | 1/2/12/5 | PASS | done | results/RMS-F06.md; ~3 lines in Rb; tsc clean |
| RMS-F07 | mini-fix/reminders-master-switch | dev | RMS-F06 | 1/1/10/5 | PASS | done | results/RMS-F07.md; +2 attrs on Rb button; tsc clean |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | `npx tsc --noEmit` | PASS (exit 0) |
| 1 | unit | `npx vitest run` | FAIL: 3 oracle-parity tests in tests/golden/hub-admin.test.ts (port map has extra `reminders_enabled` key; expected superset, no parity target) -> RMS-F01 |
| 2 | unit | `npx vitest run` | PASS 1150/1150 (53 files) |
| 2 | typecheck | `npx tsc --noEmit` | PASS (already run round 1; no source changes since) |
| 2 | lint (scoped) | `npx eslint <16 leaf files>` | PASS: 0 errors, 8 pre-existing warnings outside leaf regions |
| 2 | e2e | `npx playwright test` | FAIL 27/85 — ALL in auth/my-status/status-validation/responsive specs (`#nav`, `.cxp`, login selectors); zero failures touch leaf files. Attributed to concurrent in-flight redesign edits in the tree (src/app stylesheets, route.ts, qa-shared.tsx, fetch-json.ts, src/types/). Re-run after redesign integrates. |
| 3 (FIX) | typecheck | `npx tsc --noEmit` | PASS (exit 0) |
| 3 (FIX) | unit | `npx vitest run` | PASS 1152/1152 (53 files) |
| 3 (FIX) | lint (scoped) | `npx eslint <6 fix files>` | PASS: 0 errors, 3 pre-existing warnings in server.ts (outside leaf diffs) |
| 3 (FIX) | e2e | `npx playwright test` | NOT RUN — unchanged since round 2; still red for foreign redesign reasons, no fix-leaf file implicated |
| 4 (FIX-ux) | typecheck | `npx tsc --noEmit` | PASS (exit 0) |
| 4 (FIX-ux) | unit | `npx vitest run` | PASS 1152/1152 (53 files) |
| 4 (FIX-ux) | lint (scoped) | `npx eslint admin-page.tsx` | PASS: 0 errors, 5 pre-existing warnings in Tm (untouched region) |
| 4 (FIX-ux) | e2e | `npx playwright test` | NOT RUN — still red for foreign in-flight redesign work; admin-page.tsx not implicated |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 MED jobs.ts/server.ts whole-job gates leave no dedupe -> retro fire | reports/qa-1.md | RMS-F03 + RMS-F04 | done | dedupe popups unconditional + sendMail gated (jobs.ts); reminded_date marked while off (server.ts); tests updated |
| qa-2 MED raisePopup drops event popups while off | reports/qa-1.md | RMS-F02 | done | REMINDER_POPUP_KINDS={missed_1on1,qa_ctl_due} gate; event kinds + queue_checkin_missed append while off; reads still hidden |
| qa-3 LOW admin Rb flashes "on" before rows load | reports/qa-1.md | - | deferred | LOW -> deferred per FIX rules |
| qa-4 LOW no automated evidence for criterion 2 block | reports/qa-1.md | - | deferred | LOW -> deferred; pending UX/UI gate may cover |
| ux-1 MED Dm/Rb two sources of truth for config rows | reports/ux-1.md | RMS-F05 | done | Dm takes {rows, onSaved}; AdminPage `r` is single owner |
| ux-2 MED Rb renders "on" + enabled toggle while rows null | reports/ux-1.md | RMS-F06 | done | "Loading…" while rows null; disabled={busy \|\| !row} |
| ux-3 MED Rb toggle accessible name ambiguous, no aria state | reports/ux-1.md | RMS-F07 | done | aria-label "Turn reminders off/on" + aria-pressed |

## Blocked / needs user
- Post-leaf PM step (not a shard): after all leaves + `npx tsc --noEmit` +
  `npx vitest run` pass, PM performs ONE `git commit` of exactly the leaf
  Files lists (user asked for a single commit; no push). TL does not commit.
