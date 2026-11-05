# Shard 60 — TL Desk module (`features/cx-desk`)

> Priority 7. Scope XL. Legacy dir: `Desk_deprecated/` (`CC_APP="desk"`).
> Depends on: 02 extraction, shared platform, cx-people scorecard (KPI logs feed it), TL snapshots, queue data; **mail sync deferred to shard 90** (Gmail).

## Pages (registry: group `desk`, tone `team`, default `tl-performance`)

| Route | Title | Roles |
|---|---|---|
| `tl-performance` | TL performance | admin, tl |
| `kb-tracker` | KB tracker | admin, tl |
| `kpi-logs` | KPI logs | admin, tl |
| `mail-desk` | Mail desk | admin, tl |

## Public server API (verbatim)

- `TlPerformance.js`: `tlPerformancePage`, `tlpRateArea`, `tlpRateProject`, `kbTrackerPage`, `kbTrackerSave`, `otdSave`, `setupDesk`, `installDeskTriggers`
- `KpiLogs.js`: `kpiLogsPage`, `kpiLogSave`, `kpiLogRemove`
- `MailDesk.js`: `mailDeskPage`, `mailDeskRefresh`, `mailApprovalDecide`, `mailApprovalReset`, `jobMailDesk` (Gmail read — shard 90)
- Shared: `TlSnapshots.js` (`tlp_shifts`, `tlp_queue_daily`, `tlp_team`, `tlp_area_metrics`), `KpiPayout.js` (`kpi_behaviour_log`, `kpi_leave_log`, `kpi_ol_cases`, `KPI_LEAVE_TYPES`), `Mailer.js` `sendGmailReply_`.

## Tables (`010_desk.sql`)

- `TLP_HEADERS` (TlPerformance.js:17): `tlp_resp_ratings`, `tlp_kb`, `tlp_otd`, `tlp_ticket_exclusions`
- `TLS_HEADERS` (TlSnapshots.js:18): `tlp_shifts`, `tlp_queue_daily`, `tlp_team`, `tlp_area_metrics` — shared with queue/hub; single-owner migration in `005`/`007`, desk reads.
- `KPI_LOG_HEADERS`: `kpi_behaviour_log`, `kpi_leave_log`, `kpi_ol_cases` (exists in 003? reconcile)
- `MD_HEADERS` (MailDesk.js:34): `mail_sla`, `mail_approvals`, `mail_approval_log`

## Jobs

| Job | Cadence | Runner |
|---|---|---|
| `mail_desk` | **15 min** (was 10 min, D-SCHED floor) | pg_cron → shard 90 (Gmail read) |
| `tl_queue_metrics` input consumer | hourly | shard 30 produces; desk reads `tlp_*` |

## Business rules to port verbatim

- TL performance week view: team scores, responsibilities (`TLP_AREAS_SEED` areas + targets + measuredBy), projects vs expectation (`expectation`/`outcome_rating` on action_task_details), queue hours (`tlp_queue_daily`), mails to answer.
- `tlp_rating_zones` slider 0–100 → Below/Meets/Exceeds.
- KPI logs: behaviour cases (HR-confirmed), unplanned leaves (types Sick/Emergency/Absent without notice/Other; one entry = one leave on first day), OL cases (tickets excluded from area SLA); the scorecard reads all three.
- KB tracker: requested_at / done_at / accurate; built in-tool (no sheet).
- OTD monthly per-warehouse entry.
- Mail desk (UI + rules now; live sync in shard 90): response-tracked threads (MyFatoorah refund updates, chargebacks) — who was on queue, who replied, `mail_sla` breach flags; approval mails (refund/operational loss) — `mail_approver_emails` decide, reply in thread, `mail_approval_dry_run` default true, `mail_approval_log` trail; `sendGmailReply_` via mail adapter.

## Feature map

```
features/cx-desk/lib/{tlperformance,kplogs,kbtracker,maildesk}.ts
app/{tl-performance,kb-tracker,kpi-logs,mail-desk}/page.tsx
app/api/desk/{tl-performance,kb-tracker,kpi-logs,mail-desk}/route.ts  # replaces /api/tl/performance stub
```
