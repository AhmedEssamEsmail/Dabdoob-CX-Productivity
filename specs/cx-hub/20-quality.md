# Shard 20 — Quality module (`features/cx-quality`)

> Priority 2. Scope XL. Legacy dir: `Quality_deprecated/` (`CC_APP="quality"`).
> Depends on: 02 extraction, shared platform (popups, mail, notify, work calendar, TL snapshots).

## Pages (registry: group `quality`, tone `quality`, default `audit-queue`)

| Route | Title | Roles | Extra gate |
|---|---|---|---|
| `quality-scores` | Team scores | admin, tl | — |
| `audit-queue` | Audit Desk | admin, tl, agent | auditor only |
| `my-audits` | My audits | agent | not specialist |
| `ctls` | CTLs | admin, tl | — |
| `disputes` | Disputes | admin, tl | always |
| `calibration` | Calibration | admin, tl, agent | agent only if auditor |
| `kb-gaps` | KB gaps | admin, tl, agent | agent only if auditor or `kbEditor` |
| `my-auditor-kpis` | My auditor work | admin, tl, agent | auditor only |
| `quality-analytics` | Quality analytics | admin, tl | — |
| `qa-forms` | Audit forms | admin | — |

`boot.quality = { auditor, kbEditor }` must now be populated in `/api/bootstrap` for all users (port `qaBootFlags_`).

## Public server API (verbatim, `Quality.js` unless noted)

- Access/bootstrap: `getQaAccess`, `setQaAuditorGrant`
- Audit queue: `getQaQueuePage`, `requestQaAudit`, `createQaOffQueueAudit`, `waiveQaAuditRequest`, `createQaNonTicketAudit`, `passQaQueueItem`, `startQaAudit`, `submitQaAudit`, `resendQaAuditEmail`
- Agent: `getQaMyAuditsPage`, `confirmQaCtl`
- CTL: `getQaCtlPage`, `submitQaCtl`
- Disputes: `getQaDisputesPage`, `decideQaDispute`
- Calibration: `getQaCalibrationPage`, `createQaCalibration`, `submitQaCalibrationAudit`
- KB gaps: `getQaKbGapsPage`, `addQaKbGap`, `markQaKbGapAdded`
- Auditor KPIs: `getQaMyAuditorKpis`
- Analytics/scores/forms: `getQaAnalyticsPage`, `getQaAnalyticsAudits`, `getQaScoresPage`, `getQaFormsPage`, `saveQaForm`, `getQaSamplingPage`, `saveQaSampling`
- Jobs/admin: `jobQualityDaily`, `jobQualityBuildRetry`, `jobQualityHistory`, `importQaQueueNow`, `exportQaAuditsFlat`, `backfillQaSampleBasis`, `backfillQaInteractionDates`, `setupQuality`, `installQualityTriggers`
- `QaEngine.js` (queue build engine): `qaFreshdeskSetupHelp`, `verifyQaFreshdesk`, `checkQaEngineSettings`, `diagnoseQaQueue`, `diagnoseQaQueueRows` — plus engine internals (`QE_*` tables, candidates, outcomes, catalogue)
- `QaMigrate.js`: `migrateQualityQueueHistory`, `restartQualityQueueMigration`, `addCallControlToTextForms`, `seedQaNonTicketAudits`, `useVoiceFormForInboundCalls`, `importQualityAuditHistory`, `restartQualityAuditHistory`

## Tables (`006_quality.sql`)

- `QA_HEADERS` (Quality.js:34): `qa_forms`, `qa_queue` (32 cols incl. pass/request/waive/non-ticket), `qa_audits` (incl. `answers_json`, `fail_reasons_json`, `sample_basis`, interaction dates)
- `QE_*` engine tables (QaEngine.js:61-102): `qe_log`, `qe_candidates`, `qe_outcome`, `qe_catalogue`, `qe_build`, `qe_fd_cache`
- `qa_access_log`; CTL/dispute/calibration/kb-gap tables — enumerate from Quality.js body (`ensureTable_`/read calls) during port
- Settings: `qa_engine_live`, `qa_*` config keys — seed into config defaults per `checkQaEngineSettings`

## Jobs

| Job | Cadence | Runner |
|---|---|---|
| `qa_queue_import` | daily 10:30 | vercel cron (own build when `qa_engine_live`) |
| `qa_history_import` | daily 11:30 | vercel cron — **Google Forms sources → shard 90** |
| `qa_ctl_reminders` | daily | vercel cron (popup + mail engine, `qa_*` mail policy) |
| `jobQualityDaily`/`jobQualityBuildRetry` | per Quality.js | vercel cron |

## Business rules to port verbatim (from file, must extract section by section)

- 4 audits/agent/day quota; live scoring form; result emailed (the only `qa_*` mail allowed out of dry-run policy)
- CTL deadline: 2 working days (3 over a day off) — uses `getWorkingCalendar_`; outcome acknowledged|dispute; TL on shift may close any open CTL (`tlsOnShift_`)
- Dispute: weekly-meeting outcome or escalate to Mohamed
- Calibration: auditor vs TL reference on same tickets; auditor trend
- KB gaps flagged on audit day; `kbEditor` marks added
- Critical questions zero the audit; `fail_reasons` per question; `sample_basis` — only `random` feeds headline scores (`qaDeriveBasis_`)
- `qa_*` popup kinds; `resendQaAuditEmail`

## Feature map

```
features/cx-quality/lib/{access,queue,audit,ctl,disputes,calibration,kbgaps,analytics,forms,engine,migrate}.ts
app/{quality-scores,audit-queue,my-audits,ctls,disputes,calibration,kb-gaps,my-auditor-kpis,quality-analytics,qa-forms}/page.tsx
app/api/quality/{...}/route.ts  # replace today's pass-through /api/quality/audits
```
