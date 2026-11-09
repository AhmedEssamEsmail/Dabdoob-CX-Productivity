# FIX-15b result
Status: done
Files: src/features/cx-quality/lib/server.ts (4 sites: ~641, ~1131, ~1190, ~1308)
Changes: quota read -> gte audit_date today-90; getQaCtlPage auditsBy -> in mine audit_ids (reordered after mine); submitQaCtl auditsBy -> in open-ctl ids + ctlId row audit_id; getQaDisputesPage auditsBy -> in filtered-dispute audit_ids.
Note: site 7 `audits` also fed qaDisputeStats_ (all month audits); added bounded `gte audit_date = month+'-01'` read (monthAudits) so stats output is identical — no unfiltered qa_audits read remains at the site.
Checks: `npx tsc --noEmit` 0 errors; `npx vitest run tests/golden/quality.test.ts` 64/64 pass.
Handoff: none. TL updates TRACKER.
