# Spec index: S03 — server-only boundary
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S03-01 | mini | S03/01-foundation.md | dev | none | #3 decl + stub + vitest alias | 3/3/15/10 |
| S03-02 | mini | S03/02-platform-a.md | dev | S03-01 | #3 platform calendar/health/holidays | 3/3/6/5 |
| S03-03 | mini | S03/03-platform-b.md | dev | S03-01 | #3 platform identity/index/mail | 3/3/6/5 |
| S03-04 | mini | S03/04-platform-c.md | dev | S03-01 | #3 platform notify/options/popups | 3/3/6/5 |
| S03-05 | mini | S03/05-platform-d.md | dev | S03-01 | #3 platform repo/settings/stores | 3/3/6/5 |
| S03-06 | mini | S03/06-platform-vendor-a.md | dev | S03-01 | #3 platform time/viewas + vendor/freshchat | 3/3/6/5 |
| S03-07 | mini | S03/07-jobs-a.md | dev | S03-01 | #3 jobs csv/env(+note)/freshdesk | 3/3/9/8 |
| S03-08 | mini | S03/08-jobs-b.md | dev | S03-01 | #3 jobs mirrors(+note)/sheets/steps | 3/3/9/8 |
| S03-09 | mini | S03/09-jobs-vendor-b.md | dev | S03-01 | #3 jobs/vendor-apis + vendor http/maqsam | 3/3/6/5 |
| S03-10 | mini | S03/10-migration-a.md | dev | S03-01 | #3 migration engine + 2 mappings | 3/3/6/5 |
| S03-11 | mini | S03/11-migration-b.md | dev | S03-01 | #3 2 mappings + lib/admin-auth | 3/3/6/5 |
| S03-12 | mini | S03/12-shared-lib.md | dev | S03-01 | #3 lib api-error/auth/supabase | 3/3/6/5 |
| S03-13 | mini | S03/13-quality-a.md | dev | S03-01 | #3 quality analytics/core/engine-live | 3/3/6/5 |
| S03-14 | mini | S03/14-quality-b.md | dev | S03-01 | #3 quality engine/index/migrate | 3/3/6/5 |
| S03-15 | mini | S03/15-quality-queue.md | dev | S03-01 | #3 quality pure/server + queue/heatmap | 3/3/6/5 |
| S03-16 | mini | S03/16-queue-a.md | dev | S03-01 | #3 queue index/jobs/pages | 3/3/6/5 |
| S03-17 | mini | S03/17-queue-b.md | dev | S03-01 | #3 queue scheduler/server/tlqueue | 3/3/6/5 |
| S03-18 | mini | S03/18-people-a.md | dev | S03-01 | #3 people actions/agents-page/coaching | 3/3/6/5 |
| S03-19 | mini | S03/19-people-b.md | dev | S03-01 | #3 people kpi(index,server)/meetings | 3/3/6/5 |
| S03-20 | mini | S03/20-people-c.md | dev | S03-01 | #3 people notes/1on1-rem/1on1-delete | 3/3/6/5 |
| S03-21 | mini | S03/21-people-d.md | dev | S03-01 | #3 people 1on1-page/1on1/reminders | 3/3/6/5 |
| S03-22 | mini | S03/22-people-e.md | dev | S03-01 | #3 people scorecard trio | 3/3/6/5 |
| S03-23 | mini | S03/23-people-hub.md | dev | S03-01 | #3 people tasks/work-core + hub/admin | 3/3/6/5 |
| S03-24 | mini | S03/24-hub-a.md | dev | S03-01 | #3 hub aggregates/home-cards/myday-google | 3/3/6/5 |
| S03-25 | mini | S03/25-hub-desk.md | dev | S03-01 | #3 hub myday/roster + desk/jobshared | 3/3/6/5 |
| S03-26 | mini | S03/26-desk.md | dev | S03-01 | #3 desk kpilogs/maildesk/tlperformance | 3/3/6/5 |
| S03-27 | mini | S03/27-ops-prod.md | dev | S03-01 | #3 ops trackers + prod-access/prod-analytics | 3/3/6/5 |
| S03-28 | mini | S03/28-prod-a.md | dev | S03-01 | #3 prod engine/validation + tph/index | 3/3/6/5 |
| S03-29 | mini | S03/29-prod-b.md | dev | S03-01 | #3 tph page/run/write | 3/3/6/5 |
| S03-30 | mini | S03/30-prod-c.md | dev | S03-01, S02-01 | #3 tph/grid-slots + jobs backfill/productivity | 3/3/6/5 |
| S03-31 | mini | S03/31-prod-jobs.md | dev | S03-01 | #3 jobs quarterly/tph | 2/2/4/5 |
| S03-32 | mini | S03/32-probe-tsx-shim.md | dev | S03-01 | #3 tsconfig paths shim | 1/2/15/8 |
| S03-33 | mini | S03/33-client-probe.md | dev | S01-05, S02-02, S03-02..31, S04, S05-01..06 | #3 throwaway client probe | 1/3/15/10 |
Ready: S03-01; then S03-02..29,31,32 parallel (S03-30 after S02-01); S03-33 last. Size gate: one atomic edit/file; exclusions per PACKAGE.md.
