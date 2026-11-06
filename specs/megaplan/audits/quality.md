# WP-11 — cx-quality audit (Quality & Coaching)

Run 2026-11-06 against HEAD (post-`b051bb8`; the earlier gap review predates `84ba588`→`b051bb8`, so every finding below was re-verified on current code). Legacy source: `Quality_deprecated` — `Quality.js` (3,621 lines), `QaEngine.js` (2,166), `QaMigrate.js` (628). Page extracts: `.devin/work/extract/quality/pages/*.closure.js` (10 pages). Golden oracle: `tests/golden/quality.test.ts` (64 tests).

**Verdict:** all 10 pages are verbatim re-ports at parity (classes, copy, call-wiring). 52 legacy public functions: 36 PORTED, 4 PORTED-AS, 10 DIAG (documented skip), 2 real misses → WP-F11, WP-F12. Three defects found and fixed inline this audit:

1. **`boot.quality` never wired** — `/api/bootstrap` returned `quality: undefined`, so the shell's auditor/`kbEditor` gates silently degraded to role-only (`groupEntryAllowed` fallback in `shell/gates.ts`): agents saw `audit-queue`, `my-auditor-kpis`, `calibration`, `kb-gaps` entries their flags should hide, and `qaIsAuditor_`-level checks never ran client-side. Fixed: `qaBootFlags(user)` now in the bootstrap `Promise.all`.
2. **Jobs ran step bodies with no `dqStep_`/`hbBeat_`/`hbFlush_`** — same defect class WP-12 fixed in cx-queue: the three quality health rows (`qa_queue_import`, `qa_history_import`, `qa_ctl_reminders`) were never written, `qaLastRun_` (Audit Desk "imported at") stayed `''`, the unmatched-roster warn beat was missing, and `importQaQueueNow` lost its ok-beat/flush. Fixed: `qaDqStep_` (verbatim `dqStep_` + flush) wraps `qaQueueStep_`/`qaHistoryStep_`, `hbRun` wraps `qaCtlReminders`/`qaReconcileQueueLog`, `qaImportQueue_` beats warn on unmatched, `importQaQueueNow` beats+flushes verbatim.
3. **`qaReconcileQueueLog` was admin-gated, not `requireJobCaller_`** — the sessionless cron call always threw `Unauthorized`, so the reconcile inside `jobQualityHistory` silently never ran. Fixed: `requireJobCaller()` (cron/admin, view-as still refused) + `hbRun('qa_history_import')`. The cron now calls `qaHistoryStep_`, which runs the legacy step verbatim: Forms history import (when `GOOGLE_SERVICE_ACCOUNT_*` creds exist — else skipped, G5) then reconcile under one `qa_history_import` step.

## 1. Legacy public-function matrix

Public = no trailing underscore. Verified by `grep "^function [a-zA-Z]*[^_]("` across the three files: **52 public functions** (Quality.js 40, QaEngine.js 5, QaMigrate.js 7). All page-facing functions dispatch through `POST /api/qa/[action]` (legacy `google.script.run[fn]` equivalent) unless a Route column says otherwise.

### Quality.js (40)

| Legacy fn | File:line | Port | Route | Status |
|---|---|---|---|---|
| `getQaMyAuditorKpis` | Quality.js:414 | `server.ts:1640` | `/api/qa/getQaMyAuditorKpis` | PORTED |
| `getQaAccess` | Quality.js:669 | `server.ts:470` | `/api/qa/getQaAccess` | PORTED |
| `setQaAuditorGrant` | Quality.js:688 | `server.ts:496` | `/api/qa/setQaAuditorGrant` | PORTED |
| `getQaQueuePage` | Quality.js:788 | `server.ts:632` | `/api/qa/getQaQueuePage` | PORTED |
| `requestQaAudit` | Quality.js:991 | `server.ts:894` | `/api/qa/requestQaAudit` | PORTED |
| `createQaOffQueueAudit` | Quality.js:1063 | `server.ts:911` | `/api/qa/createQaOffQueueAudit` | PORTED |
| `waiveQaAuditRequest` | Quality.js:1082 | `server.ts:930` | `/api/qa/waiveQaAuditRequest` | PORTED |
| `createQaNonTicketAudit` | Quality.js:1132 | `server.ts:950` | `/api/qa/createQaNonTicketAudit` | PORTED |
| `passQaQueueItem` | Quality.js:1192 | `server.ts:807` | `/api/qa/passQaQueueItem` | PORTED |
| `startQaAudit` | Quality.js:1291 | `server.ts:674` | `/api/qa/startQaAudit` | PORTED |
| `submitQaAudit` | Quality.js:1349 | `server.ts:696` | `/api/qa/submitQaAudit` | PORTED |
| `resendQaAuditEmail` | Quality.js:1459 | `server.ts:786` | `/api/qa/resendQaAuditEmail` | PORTED |
| `getQaMyAuditsPage` | Quality.js:1513 | `server.ts:983` | `/api/qa/getQaMyAuditsPage` | PORTED |
| `confirmQaCtl` | Quality.js:1543 | `server.ts:1015` | `/api/qa/confirmQaCtl` | PORTED |
| `getQaCtlPage` | Quality.js:1608 | `server.ts:1088` | `/api/qa/getQaCtlPage` | PORTED |
| `submitQaCtl` | Quality.js:1650 | `server.ts:1132` | `/api/qa/submitQaCtl` | PORTED |
| `getQaDisputesPage` | Quality.js:1761 | `server.ts:1262` | `/api/qa/getQaDisputesPage` | PORTED |
| `decideQaDispute` | Quality.js:1799 | `server.ts:1306` | `/api/qa/decideQaDispute` | PORTED |
| `getQaCalibrationPage` | Quality.js:1886 | `server.ts:1407` | `/api/qa/getQaCalibrationPage` | PORTED |
| `createQaCalibration` | Quality.js:1935 | `server.ts:1470` | `/api/qa/createQaCalibration` | PORTED |
| `submitQaCalibrationAudit` | Quality.js:1964 | `server.ts:1510` | `/api/qa/submitQaCalibrationAudit` | PORTED |
| `getQaKbGapsPage` | Quality.js:2005 | `server.ts:1554` | `/api/qa/getQaKbGapsPage` | PORTED |
| `addQaKbGap` | Quality.js:2030 | `server.ts:1580` | `/api/qa/addQaKbGap` | PORTED |
| `markQaKbGapAdded` | Quality.js:2060 | `server.ts:1619` | `/api/qa/markQaKbGapAdded` | PORTED |
| `backfillQaSampleBasis` | Quality.js:2255 | `server.ts:2195` | `/api/qa/backfillQaSampleBasis` | PORTED |
| `backfillQaInteractionDates` | Quality.js:2274 | `server.ts:2213` | `/api/qa/backfillQaInteractionDates` | PORTED |
| `exportQaAuditsFlat` | Quality.js:2338 | `qaFlattenAudits_` ported (`analytics.ts:244`); **the `qa_audits_flat` sheet-tab sink has no port** | none | **MISS → WP-F12** |
| `getQaAnalyticsPage` | Quality.js:2855 | `server.ts:1732` | `/api/qa/getQaAnalyticsPage` | PORTED |
| `getQaAnalyticsAudits` | Quality.js:2886 | `server.ts:1781` | `/api/qa/getQaAnalyticsAudits` | PORTED |
| `getQaScoresPage` | Quality.js:3031 | `server.ts:1702` | `/api/qa/getQaScoresPage` | PORTED |
| `getQaFormsPage` | Quality.js:3223 | `server.ts:1862` | `/api/qa/getQaFormsPage` | PORTED |
| `saveQaForm` | Quality.js:3232 | `server.ts:1874` | `/api/qa/saveQaForm` | PORTED |
| `jobQualityDaily` | Quality.js:3465 | `job-qa-engine/route.ts` → `qaQueueStep_` (`server.ts:2106`) + `qaCtlReminders` (`server.ts:2121`), each `dqStep_`-wrapped | `GET/POST /api/cron/job-qa-engine` | PORTED-AS — one cron route runs both legacy daily triggers' steps under verbatim heartbeat names |
| `jobQualityBuildRetry` | Quality.js:3475 | none — `qaEngineBuildStep_` retry wrapper (Quality.js:3335–65: config counter, one-off trigger ~3h, max 3, then `qa_build_failed` owner notify) not ported; ported `qaQueueStep_` calls `qeBuildQueue` directly | none | **MISS → WP-F11** |
| `jobQualityHistory` | Quality.js:3487 | `qaHistoryStep_` (`server.ts:2264`) — verbatim step body: `qaImportHistory_` (env-gated) + `qaReconcileQueueLog_` + budget-warn beat | same cron route | PORTED-AS — G5: Forms-sheet read needs `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY`; reconcile half runs unconditionally |
| `importQaQueueNow` | Quality.js:3502 | `server.ts:2088` | `/api/qa/importQaQueueNow` | PORTED (heartbeats restored this audit) |
| `getQaSamplingPage` | Quality.js:3522 | `server.ts:1910` | `/api/qa/getQaSamplingPage` | PORTED |
| `saveQaSampling` | Quality.js:3559 | `server.ts:1966` | `/api/qa/saveQaSampling` | PORTED |
| `setupQuality` | Quality.js:3575 | none | none | DIAG — installer (creates tabs/counters/`qa_seed_forms`); superseded by SQL migrations + seeded `qa_forms` rows |
| `installQualityTriggers` | Quality.js:3611 | none | none | DIAG — installer (GAS time-driven triggers); superseded by `vercel.json` cron + `HB_PLAN` |

### QaEngine.js (5)

| Legacy fn | File:line | Port | Route | Status |
|---|---|---|---|---|
| `qaFreshdeskSetupHelp` | QaEngine.js:1957 | none | none | DIAG — vendor setup helper (Freshdesk field/API keys walkthrough) |
| `verifyQaFreshdesk` | QaEngine.js:1978 | none | none | DIAG — vendor probe; Freshdesk creds env-gated (B3-adjacent) |
| `checkQaEngineSettings` | QaEngine.js:1991 | `server.ts:2289` | `/api/qa/checkQaEngineSettings` | PORTED **(this audit)** — gap-review claimed it ported; only `qeSettings_` internals existed. Now admin-reachable verbatim |
| `diagnoseQaQueue` | QaEngine.js:2007 | none | none | DIAG — editor diagnostic that reads the live Queue Log sheet; porting = rewrite against `qe_queue_log` (decision → WP-F13) |
| `diagnoseQaQueueRows` | QaEngine.js:2109 | none | none | DIAG — same (row-level dump) |

### QaMigrate.js (7)

| Legacy fn | File:line | Port | Route | Status |
|---|---|---|---|---|
| `migrateQualityQueueHistory` | QaMigrate.js:82 | `qeMigrationDone_` flag + `qaImportHistory_`/`qaReconcileQueueLog_` in `migrate.ts`; the sheet→pg copy itself runs through the WP-30/WP-32 migration pipeline | none | PORTED-AS — the legacy progress/resume runner is not needed: the data path is the migration WP; flag respected by `qaHistoryStep_` |
| `restartQualityQueueMigration` | QaMigrate.js:134 | none | none | DIAG — one-shot cursor reset for the queue-migration runner (no runner exists → WP-30 pipeline is re-runnable) |
| `addCallControlToTextForms` | QaMigrate.js:294 | none | none | DIAG — one-shot form patch; call-control sections now live in migrated `qa_forms` defs |
| `seedQaNonTicketAudits` | QaMigrate.js:370 | none | none | DIAG — one-shot; non-ticket form defs seeded directly |
| `useVoiceFormForInboundCalls` | QaMigrate.js:407 | none | none | DIAG — one-shot; channel→form mapping seeded |
| `importQualityAuditHistory` | QaMigrate.js:543 | `qaImportHistory` (`server.ts:2238`) → `qaImportHistory_` (`migrate.ts`) | `/api/qa/qaImportHistory` | PORTED-AS — renamed to module prefix; gate corrected to `requireJobCaller` this audit (legacy used `requireJobCaller_`, not admin) |
| `restartQualityAuditHistory` | QaMigrate.js:594 | `server.ts:2281` → `restartQualityAuditHistory_` (`migrate.ts`) | `/api/qa/restartQualityAuditHistory` | PORTED **(this audit)** — lib existed but was unreachable; now in `HANDLERS` |

**Totals: 36 PORTED, 4 PORTED-AS, 10 DIAG, 2 MISS (→ WP-F11, WP-F12).** Internal helpers ported but not public-facing: `qaBootFlags_` → `qaBootFlags` (server.ts:518, now consumed by `/api/bootstrap`), `qaEnsureCtlPopups_` → `qaEnsureCtlPopups` (dispatcher-exposed admin utility; port-added), `getQaCoveragePage` (port-added admin endpoint whose data the analytics page already renders).

## 2. Page parity checklist

All 10 page components are thin-route + verbatim-closure ports. Verified against the `.closure.js` extracts: class vocabulary (`qa-*`, `cx-*` legacy names — no invented Tailwind classes), section/DOM order, copy strings incl. empty states, `P`/`api` call coverage → `/api/qa/[action]`, and route gate metadata (`specs/legacy-parity/data/legacy-route-registry.json`). Copy was re-verified string-by-string (`scripts/qa_copy_check.py` + manual JSX-split/escaping review): every flagged string resolved to a present string — JSX line-wrapping, `qa-shared.tsx` strings, smart quotes, or template concatenation, **zero real copy divergences**.

| Page | Closure | Component | Registry gate | Verdict |
|---|---|---|---|---|
| `/quality-scores` | `quality-scores.closure.js` | `quality-scores-page.tsx` | admin, tl | parity |
| `/audit-queue` | `audit-queue.closure.js` | `audit-queue-page.tsx` | admin, tl, agent + auditor-only | parity |
| `/my-audits` | `my-audits.closure.js` | `my-audits-page.tsx` | agent + not-specialist | parity |
| `/ctls` | `ctls.closure.js` | `ctls-page.tsx` | admin, tl | parity |
| `/disputes` | `disputes.closure.js` | `disputes-page.tsx` | admin, tl (+ dispute-owner server-side) | parity |
| `/calibration` | `calibration.closure.js` | `calibration-page.tsx` | admin, tl, agent-if-auditor | parity |
| `/kb-gaps` | `kb-gaps.closure.js` | `kb-gaps-page.tsx` | admin, tl, agent-if-auditor-or-kbEditor | parity |
| `/my-auditor-kpis` | `my-auditor-kpis.closure.js` | `my-auditor-kpis-page.tsx` | admin, tl, agent + auditor-only | parity |
| `/quality-analytics` | `quality-analytics.closure.js` | `quality-analytics-page.tsx` | admin, tl | parity |
| `/qa-forms` | `qa-forms.closure.js` | `qa-forms-page.tsx` | admin | parity |

Verified detail (sample): `qa-head`/`page-title`/`page-purpose` header shape, `qa-stats`/`qa-stat` tiles, `qa-card`/`qa-table`/`qa-chip`/`qa-pill`/`qa-badge` vocabulary, `qa-skel` loading states, `qa-note`/`qa-hint`/`qa-err`/`qa-empty`, confirm strings (`'Leave this audit? Your answers are not saved and will be lost.'` — `qa-shared.tsx:798`), basis tooltips (`'Counted by the day each audit was done.'` — `qa-shared.tsx:319`), CTL lookup flow ("Enter a ticket number or audit ID: the audit opens here with only the questions that lost marks.", "No open CTL of yours matches", "Reopened: the agent said the last session did not happen"), the engine-live banner ("This queue is still drawn by the old Quality Queue app…"), placeholder-form copy, coverage section ("All agents: audits per day against the quota"), dispute copy verbatim incl. "Denying one tells Mohamed and the team leads." — 0 real divergences.

## 3. Gate matrix

Legacy `requireRole_`/`viewAsGuard_`/`requireJobCaller_` → `requireRole`/`assertWritable`/`requireJobCaller` (data layer — `server.ts:73`, so thin dispatcher routes stay safe). `viewAsSystem_` has no equivalent needed: a sessionless call simply has no session → `requireJobCaller` accepts, `qaRequireRole_` throws. `assertWritable()` on every interactive write (23 call sites). Dispute access via `qaDisputeAccess_` (`server.ts:1253`) = owner-or-admin, verbatim.

| Entry | Legacy gate | Port gate | Match |
|---|---|---|---|
| `getQaQueuePage` / `startQaAudit` / `submitQaAudit` / `passQaQueueItem` / `resendQaAuditEmail` | auditor (`qaIsAuditor_`: admin+tl always; agent iff `qa_auditor_emails` grant or position keyword) | `server.ts:223` + `assertWritable` on writes | ✓ |
| `getQaMyAuditsPage` / `confirmQaCtl` | agent (self) | role + own-email scoping | ✓ |
| `getQaCtlPage` / `submitQaCtl` | admin, tl; close-gate `qaCanCloseCtl_` = owning TL **on shift** (`tlsOnShift_` against yesterday→tomorrow shifts) | `server.ts:1161` verbatim incl. "you can close it only while you are on shift" | ✓ |
| `getQaDisputesPage` / `decideQaDispute` | admin or `qa_dispute_owner` email | `qaDisputeAccess_` (`server.ts:1253`) | ✓ |
| `getQaCalibrationPage` / `create`/`submit` | admin, tl; agent iff auditor | role + `qaIsAuditor_` | ✓ |
| `getQaKbGapsPage` / `add`/`markAdded` | admin, tl; agent iff auditor or `kbEditor` (`qa_kb_notify_emails`) | `qaIsKbEditor_` (`server.ts:230`) | ✓ |
| `getQaMyAuditorKpis` | auditor-only | `qaIsAuditor_` | ✓ |
| scores / analytics / coverage / forms / sampling / access / backfills | admin (+tl for scores/analytics per registry) | `qaRequireRole_` per fn | ✓ |
| `importQaQueueNow` | admin + `viewAsGuard_` | `server.ts:2088` | ✓ |
| `qaImportHistory` / `qaReconcileQueueLog` / jobs | `requireJobCaller_` (sessionless trigger or admin) | `requireJobCaller` **(fixed this audit — reconcile was admin-only → sessionless cron unauthorized)** | ✓ |
| `qaCtlReminders` / `qaEnsureCtlPopups` | `requireJobCaller_` via `jobQualityDaily` (private fns in legacy) | `requireJobCaller` on both **(fixed this audit — resolves pending WP-F10: the dispatcher exposed both with no internal gate; anonymous calls could send reminder emails / write `qa_ctls` / raise popups)** | ✓ |
| view-as writes | `viewAsGuard_` on every write | `assertWritable` in data layer on all 23 write paths | ✓ |
| specialist | excluded from `my-audits` (registry `not specialist`); specialist = agent+flag in identity | registry + `pageAllowed`/`groupEntryAllowed` | ✓ |
| `boot.quality` flags | `qaBootFlags_` → `auditor`/`kbEditor`/`disputeOwner` consumed by shell gates | `/api/bootstrap` now returns `qaBootFlags(user)` **(fixed this audit)** | ✓ |

## 4. Jobs matrix

`HB_PLAN` (`shared/platform/health.ts:66-68`) has exactly the three quality rows; heartbeat names match the step names verbatim after this audit's fixes.

| Legacy job | Legacy chain | Port | Heartbeat | Cadence | Status |
|---|---|---|---|---|---|
| `jobQualityDaily` (~10:30) | `dqStep_('qa_queue_import', qaQueueStep_)` + `dqStep_('qa_ctl_reminders', qaCtlReminders_)` + `hbFlush_` | `/api/cron/job-qa-engine` → `qaQueueStep_` (`qaDqStep_`-wrapped) + `qaCtlReminders` (`hbRun`-wrapped) | `qa_queue_import`, `qa_ctl_reminders` | daily (vercel.json) | ✓ (beats restored this audit) |
| `jobQualityHistory` (~11:30) | `dqStep_('qa_history_import', qaImportHistory_ + qaReconcileQueueLog_ + budget-warn)` + `hbFlush_` | same cron → `qaHistoryStep_` (`server.ts:2264`) | `qa_history_import` | daily | ✓ — Forms half env-gated (G5); reconcile runs. Legacy ran two separate trigger times; the port consolidates into one route (scheduling = WP-24's call, same as other modules) |
| `jobQualityBuildRetry` (one-off, +3h) | `qaClearBuildRetries_` + `dqStep_('qa_queue_import', qaQueueStep_('retry trigger'))` | none | `qa_queue_import` (would reuse) | one-off per failure | **MISS → WP-F11** |
| `importQaQueueNow` (admin hand-run) | live: `hbBeat_('qa_queue_import','ok')`; else `dqStep_`; `hbFlush_` in `finally` | `server.ts:2088` verbatim | `qa_queue_import` | manual | ✓ (beats restored this audit) |

## 5. Residual gaps

| # | Gap | Classification | Action |
|---|---|---|---|
| 1 | `qaEngineBuildStep_` retry wrapper (`jobQualityBuildRetry`): config-backed retry counter + one-off trigger re-schedule ~3h, max 3, then `qa_build_failed` notify to `assistantOwnerEmail_`. `QA_BUILD_RETRIES`-era constants exist in `core.ts` unused. Needs a scheduling seam (vercel.json is PM-owned; pg_cron B5) | MISS | **WP-F11** |
| 2 | `exportQaAuditsFlat`: `qaFlattenAudits_` ported (`analytics.ts:244`) but the `qa_audits_flat` sheet-tab sink (formula-escape `'` prefix, frozen header) has no port — needs a `qa_audits_flat` table (new migration, DB-owned) or a CSV-download route decision | MISS | **WP-F12** |
| 3 | 10 DIAG fns documented-skip: `setupQuality`, `installQualityTriggers`, `qaFreshdeskSetupHelp`, `verifyQaFreshdesk`, `diagnoseQaQueue`, `diagnoseQaQueueRows`, `restartQualityQueueMigration`, `addCallControlToTextForms`, `seedQaNonTicketAudits`, `useVoiceFormForInboundCalls`. The two `diagnoseQaQueue*` would need rewriting against `qe_queue_log`/Postgres rather than the live sheet — port-as-admin-route vs confirm-skip is an owner call | DIAG | **WP-F13** (decision) |
| 4 | `qa_history_import` Forms half gated on `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY` | GATED | G5 (shard-90) — `qaHistoryStep_` skips cleanly with a note until then |
| 5 | `verifyQaFreshdesk`/`qaFreshdeskSetupHelp` need Freshdesk creds | GATED+DIAG | covered by WP-F13 + B3 |
| 6 | `getQaCoveragePage` dispatcher action is port-added (no legacy equivalent); harmless extra | note | none |

## Fixes made this audit

All in `src/features/cx-quality/lib/server.ts` + barrel unless noted (≤30-line rule held per edit; the three route edits are thin dispatcher/wiring lines):

- `server.ts`: imports `requireJobCaller`, `actorEmail`, `hbBeat`, `hbFlush`, `hbRun`; new `qaDqStep_` (verbatim `dqStep_`+flush); `qaImportQueue_` unmatched-warn beat; `importQaQueueNow` verbatim beats+flush (`'Import failed; see the Health tab.'` fallback restored); `qaQueueStep_` wrapped in `qaDqStep_('qa_queue_import')`; `qaCtlReminders` wrapped in `hbRun('qa_ctl_reminders')`; `qaReconcileQueueLog` → `requireJobCaller` + `hbRun('qa_history_import')`; `qaImportHistory` → `requireJobCaller` + `actorEmail`; new `qaHistoryStep_` (verbatim `jobQualityHistory` step); new `restartQualityAuditHistory` + `checkQaEngineSettings` (both admin, verbatim); `requireJobCaller` added to `qaCtlReminders` + `qaEnsureCtlPopups` (verbatim `jobQualityDaily` gate — resolves pending WP-F10's anonymous-write finding); `assertWritable` added to both backfills (port convention — every write refuses view-as).
- `lib/index.ts`: barrel exports for the new fns + `qaBootFlags`/`importQaQueueNow`/`qaQueueStep_`/`qaHistoryStep_`.
- `api/cron/job-qa-engine/route.ts` (outside feature dir — flagged): calls `qaHistoryStep_` instead of the bare reconcile; response key `reconcile`→`history`; doc header updated.
- `api/qa/[action]/route.ts` (outside feature dir — flagged): `HANDLERS` gains `restartQualityAuditHistory` + `checkQaEngineSettings`.
- `api/bootstrap/route.ts` (outside feature dir — flagged): `quality: qaBootFlags(user)` wired into the roster-user payload (explicitly-listed WP-11 residual).

## Gates run

`npx tsc --noEmit` — 0 errors. `npx vitest run` — 41 files / 817 tests green (incl. `tests/golden/quality.test.ts` 64 tests). No commits made.
