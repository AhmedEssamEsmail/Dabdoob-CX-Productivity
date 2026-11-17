# DECISION: qa-live-sheets-freeze

Context: Literal Sheets-read freeze; only allowed reads = `quality/qa_audits` (1sOF…m3w), `hct/Sheet1` in manual syncRosterNow, FD `Activities` workbook. Ported engines consume sheets through the SheetBookLike seam (jobs/sheets.ts, env.ts prefetch); mirrors `fd_activities`/`maqsam_calls`/`freshchat` are ALREADY API-fed (mirrors.ts SPECS fetch vendor APIs, not sheets); `tickets` synced; `aux_spans`/`tracker_records`(aux_exceptions, wa_parcels, operational_loss=native) hold migrated tab data; `qa_audits` DB live. cx-quality/** + /api/qa/[action] user-owned — hand-backs only.

Options:
 A) dbbook seam — new `shared/jobs/dbbook.ts` synthesizes identical tab grids from DB; env.ts prefetch fills `books` from it. Engines/tests (SheetBookLike fakes) untouched. Cost: per-tab cell mappers. Low risk.
 B) Rewrite engine seams to typed DB readers — cleaner end-state but edits verbatim ports, breaks fakes, more leaves + regression surface.
 C) Widen allowlist — rejected: violates freeze.

Decision: A. Zero engine diffs; mirror-cells.ts already emits the exact legacy cell layouts; tlqueue:697 proves the fd_activities fallback equivalence.

Design — per-reader cut map (i=DB repoint, ii=extend API, iii=compute, iv=BLOCKED):
- env.ts:449/463/467/486 (PROD_MONTH_TABS, Freshchat, Activities, Headcount): dbbook cells ← `maqsam_calls` (D..J mirror + derived K data_tz date, L handling-min) (i); `freshchat` A..G via freshchatCells_ (i); `fd_activities` A..J via fdActivityCells_ — replaces even the allowed workbook read (i); `qa_audits`→Quality A..C (email,audit_date,score_final||score) (i); `roster`→Headcount A..H (i); config `prod_assumptions` {mq,text,wa}→Assumptions B4:B6 + one-time seed (iii); `aux_spans.cols`→FD_AUX A..G (i, history only — **BLOCKED live feed**: no upstream API exists; needs user source); `tracker_records('aux_exceptions')`→AUXes Exceptions A..D (i; entry via trackers UI).
- scorecard-server.ts:478/592 + scNightly_/refreshScorecard: sc_daily computed from `prod_daily_layers`+`roster`+`qa_audits` (iii); FCR tab **BLOCKED** (manual verdicts, no DB source — preserve prior-month fcr on rebuild); 'Business Behavior' → small admin entry writing `sc_behaviour` (ii-lite, table exists); drop scInspect_/saveScorecardSource sheet ops.
- heatmap.ts:568/588 (admin ops only): buildHeatmapFromSource repoints to maqsam_calls/freshchat/tickets/`tracker_records('wa_parcels')`+config `heatmap_excluded_groups` (i; country cols absent in mirrors → '*' via aliases — accepted); retire runPriorHeatmapRegression (one-off done); upload ops untouched.
- tlqueue.ts:631/672/695/756: delete fc_messages book read → Freshdesk path always (accepted degradation; optional `freshchat_messages` extension later — iv); delete ol_sheet_id fallback (native-only); 'Activities' via dbbook.
- cx-quality migrate.ts (qaImportHistory_/qaFirstSheetRows_) + server.ts:383 'Queue Log' fetch: USER-OWNED hand-back (disable; qa_engine_live=TRUE makes :383 dead). Our route swaps qaHistoryStep_→`qaReconcileQueueLog_` (read-only import).
- roster.ts: dqReadHct_ stays (exc b); dqSyncRoster_ gains dq_hct full-snapshot upsert; jobRosterSync manual-gated; recreate `public.dq_hct` (dropped by 20261116171029): 15 cols = DQ_HCT_COLUMNS (name,email,position,department,section,manager,status,lwd,hiringDate,fdId,fdName,maqsamName,code,gender,contactNumber) + synced_at — **contract to cx-quality**: qaActiveEmails_ repoints here, empty→null.
- admin/migrate+engine.ts: KEEP via allowlist — readSheetRaw asserts; only (quality,qa_audits)+(hct,Sheet1) pass; all other mappings throw loudly. list-sheets →410; mirrors peek → allowlisted tabs only; source-health sheet probes → DB mirror/table checks.
- Enforcement: `shared/lib/sheets-freeze.ts` `assertSheetReadAllowed_(id,tab,{extraIds})` — static allowlist + caller-resolved fd_activity_ss_id; throws SheetsFreezeError always + `console.error('[SHEETS_FREEZE_VIOLATION]')` for prod log drains. Wired into fetchWorkbookTabs + readSheetRaw; vitest repo-scan (no googleapis/spreadsheets outside allowlisted files).
- Scheduling (pg_cron, amendment supersedes PLAN crit.5 vercel.json): scoped migration schedules ONLY routes missing BOTH vercel.json AND cron.job — verify remote `SELECT jobname,schedule,active FROM cron.job` first (cxh-job-data-tick reportedly present). Candidates: cxh-job-qa-engine `30 7`, cxh-job-nightly-aggregates `30 6`, cxh-job-tl-queue `15 *`, cxh-scorecard-nightly `30 6`, cxh-mail-desk `*/15` POST (WP-F18 Bearer gate confirmed route.ts:6-15; verify deployed build). Skip all vercel-covered paths. {{APP_URL}}=prod domain + {{CRON_SECRET}} from Vercel env.

Shards (mini-leaves): S01 freeze guard+test · S02 dbbook synthesizers+tests · S03 env.ts rewire · S04a scorecard DB refresh / S04b behaviour form · S05 heatmap DB build+route ops · S06 tlqueue cuts · S07 dq_hct migration+snapshot+gate · S08 qa-engine route swap · S09 pg_cron migration+remote verify · S10 admin readers. Serial: S02→S03; S07↔hand-back contract first.

Risks: FD_AUX feed gap degrades prod AUX/idle metrics (BLOCKED, needs user source — Freshdesk agent-status export?); FCR stalls (preserve-semantics); WA/country '*' fallback; guard can't reach inline googleapis in cx-quality (hand-back + grep test).

Rollback: dbbook additive — revert env wiring; `cron.unschedule(name)`; dq_hct additive.

Impacts: crit.5→pg_cron; +data risk flag; new gate: freeze grep-test.

Open questions: non-blocking BLOCKEDs — FD_AUX upstream; FCR verdict source; freshchat message-level pairs (extend mirror later?).
