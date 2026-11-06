# WP-15 — cx-desk module audit

Auditor: wave1-agent `61bb7e80` · HEAD `2ca871a` (verified ancestors: `4374940` desk golden tests ×130, `aecd3ca` caller-guard/stamp fixes) · Legacy: `../Desk_deprecated/` — `TlPerformance.js` (410), `KpiLogs.js` (121), `MailDesk.js` (458); shared readers `TlSnapshots.js` (106) · Extract: `.devin/work/extract/desk/` (4/4 pages).

**Verdict: shipped, verbatim.** 16/16 public fns mapped and ported; 4/4 pages structurally identical to their closures (classes, copy, order, attrs, call coverage). Golden oracle exists at HEAD (`desk.test.ts`, 130 tests) — WP-21's job is residual vectors, not authoring. Six ≤30-line defects fixed in this pass (4 missing page toasts, 4 wrong `page-head` copy literals, missing `hbRun` on `jobMailDesk`, false-`sent` when Gmail send is unconfigured, `mdThreads_` 51-thread off-by-one, stale 10-min cadence note). Two residual gaps → WP-F18/F19; golden-vector list in §6 feeds WP-21.

## 1. Function matrix

### `TlPerformance.js` → `src/features/cx-desk/lib/tlperformance.ts` (642 lines)

Public surface (`^function [a-zA-Z0-9]+[^_]\(` — all 8; grepped the file, nothing else):

| Legacy fn (:line) | Port (:line) | API route | Class |
|---|---|---|---|
| `tlPerformancePage` (183) | `tlPerformancePage` (263) | `GET /api/tl/page?tl=` | PORTED — verbatim (`part()` soft-fail wrapper, `tls` list narrowed for TLs, kb/otd conditional blocks, `mdForTl_` mail block, `dqLastRun('tl_queue_metrics')` asOf) |
| `tlpRateArea` (256) | `tlpRateArea` (427) | `POST /api/tl/rate {action:'area'}` | PORTED — verbatim; `withLock_`→single `upsert(onConflict:'rating_id')` |
| `tlpRateProject` (278) | `tlpRateProject` (463) | `POST /api/tl/rate {action:'project'}` | PORTED — verbatim; `updateRow_`→`.update` incl. `updated_by/updated_at` stamps (aecd3ca); `appendRows_`→`action_updates` insert with `submitted_*` stamps; `ensureColumns_`→schema (migration carries the cols) |
| `kbTrackerPage` (312) | `kbTrackerPage` (518) | `GET /api/tl/kb` | PORTED — verbatim |
| `kbTrackerSave` (324) | `kbTrackerSave` (535) | `POST /api/tl/kb` | PORTED — verbatim; `done_at:''`→`null` (documented seam, tested) |
| `otdSave` (347) | `otdSave` (568) | `POST /api/tl/otd` | PORTED — verbatim minus the legacy self-bug: legacy wrote `month:"'2026-10"` cells its own `tlpOtd_` could not read; port stores plain month and `tlpOtd_` strips a leading `'` when reading legacy-shaped rows (documented + tested, desk.test.ts:1240) |
| `setupDesk` (373) | `setupDesk` (596) | `POST /api/desk/setup` | PORTED — verbatim; tab creation → `010_desk.sql`; `setConfig` actor stamp = acting admin (aecd3ca); `KPI_LOG_HEADERS` tables are 003-domain-owned |
| `installDeskTriggers` (405) | `installDeskTriggers` (639) | `POST /api/desk/setup?triggers=1` | PORTED-AS — no scriptable triggers; returns the schedule note. **Fixed this pass**: note now says `every 15 minutes (pg_cron per D-SCHED)` (was the stale legacy 10-min figure) |

Private helpers: `tlpSetting_` (65→90), `tlpWeek_` (75→100), `tlpOverall_` (85→110), `tlpMean_` (98→129), `tlpLabel_` (104→135), `tlpCheckValue_` (111→143), `tlpByName_` (118→157), `tlpKbMetrics_` (126→165), `tlpCanView_` (140→183), `tlpAreasFor_` (142→187), `tlpProjects_` (151→206), `tlpOtd_` (169→242), `tlpKbEditor_` (302→500), `tlpKbOut_` (306→504) — all verbatim. `TLP_HEADERS` (17→34), `TLP_AREAS_SEED` (29→42), `TLP_OWNERS_BY_NAME` (46→58), `TLP_SETTINGS` (53→65), `TLP_MANAGER_EMAIL` (366→`TLP_MANAGER_EMAIL` in-file const), `TLP_TASK_COLS`/`TLP_RATINGS` → schema/schema-types.

### `KpiLogs.js` → `src/features/cx-desk/lib/kpilogs.ts` (174 lines)

| Legacy fn (:line) | Port (:line) | API route | Class |
|---|---|---|---|
| `kpiLogsPage` (43) | `kpiLogsPage` (61) | `GET /api/kpi/logs` | PORTED — verbatim (180-day cut, agent+specialist picker, `canExclude` per-area) |
| `kpiLogSave` (69) | `kpiLogSave` (102) | `POST /api/kpi/logs {kind,input}` | PORTED — verbatim validation order/messages; `removed_at:''`→`null` on exclusion rows (documented seam) |
| `kpiLogRemove` (108) | `kpiLogRemove` (158) | `DELETE /api/kpi/logs?kind=&id=` | PORTED — verbatim; soft-delete `removed_by/removed_at` stamp |

Private helpers: `KL_TABLES` (14→22), `KL_DAYS` (15→27), `klDate_` (17→29), `klAreas_` (24→36), `klCanExclude_` (29→41), `klOut_` (33→45) — verbatim. `KPI_LEAVE_TYPES`/`kpiLogRows_` (`KpiPayout.js:32/110`) → `cx-people/lib/kpi` (shared, not re-ported). `kpi_ol_cases` is KpiPayout-owned — desk never reads or writes it (grep: zero hits in cx-desk; the shard doc's lumping is a doc simplification).

### `MailDesk.js` → `src/features/cx-desk/lib/maildesk.ts` (772 lines)

| Legacy fn (:line) | Port (:line) | API route | Class |
|---|---|---|---|
| `mailDeskPage` (340) | `mailDeskPage` (584) | `GET /api/mail-desk` | PORTED — verbatim (7-day sla window, approver-only approvals block, 14-day decided cut, pending-first sort, `dryRun` expression identical, `dqLastRun('mail_desk')` asOf). No Gmail call — stored tables only |
| `mailDeskRefresh` (359) | `mailDeskRefresh` (612) | `POST /api/mail-desk {action:'refresh'}` | PORTED — verbatim incl. the `'Gmail is checked every 10 minutes; ask Mohamed…'` copy and the admin-or-approver gate inside `jobMailDesk` (non-admin approver fails at `requireJobCaller` — same as legacy) |
| `mailApprovalDecide` (371) | `mailApprovalDecide` (625) | `POST /api/mail-desk {action:'decide'}` | PORTED — verbatim: `['admin','tl','agent']` then approver check, token idempotency (same token → first result), claim `pending→sending` (legacy `withLock_`→optimistic `.eq('status','pending')` conditional update + re-read), send outside claim, failed send restores `pending` + `send_failed` log, `sent_status: 'dry_run'|'sent'`, every attempt logged to `mail_approval_log`. **Fixed this pass**: unconfigured Gmail send now fails closed (§5 #4) |
| `mailApprovalReset` (443) | `mailApprovalReset` (744) | `POST /api/mail-desk {action:'reset'}` | PORTED — verbatim: approvers only, `status==='sending'` + `updated_at` older than `MD_STUCK_MS` (5 min), back to `pending`, `reset` row logged |
| `jobMailDesk` (280) | `jobMailDesk` (482) | `POST /api/desk/job/mail` | PORTED — verbatim: `requireJobCaller` (=`requireJobCaller_`; `viewAsSystem_(e)` is GAS-only — "no session" IS the cron case), `mdSyncSla_`+`mdSyncApprovals_` halves → warn note, `dqMarkRun_`. **Fixed this pass**: wrapped in `hbRun('mail_desk',…)` so ok/error beats + flush happen like legacy `hbRun_` (§5 #1) |

Private helpers (all verbatim unless noted): `MD_HEADERS` (34→31), `MD_SETTINGS` (42→43 — defaults verbatim incl. `mail_approval_dry_run:true`, `mail_approver_emails` = mohamed.nabil + k.elnaggar, both query strings), `MD_MAX_THREADS`/`MD_STUCK_MS` (177/337→64/65), `mdSetting_` (51→67), `mdAddr_` (61→150), `mdAddrList_` (68→157), `mdKind_` (73→162), `mdSlaFlags_` (83→172), `mdSlaRecords_` (98→204), `mdMergeSla_` (123→242), `mdParseApprovalSubject_` (133→252), `mdDecisionBody_` (143→262), `mdHeaderValue_` (150→269 — `Buffer` for `Utilities.base64Encode`), `mdReplyMime_` (156→275), `mdReplyAddresses_` (167→289), `mdBool_` (307→298), `mdThreads_` (187→313 — PORTED-AS adapter seam, see §5 #3), `mdHeader_` (180 → inlined header lookup inside `mdThreads_`), `mdOurs_` (200→351 — minus `me`, see §5 #5), `mdSyncSla_` (208→364 — `withLock_`→bare read+upsert, §5 #6), `mdApprovers_` (277→413), `mdSyncApprovals_` (242→418 — same), `mdSlaOut_` (297→513), `mdForTl_` (310→540 — consumed by `tlPerformancePage` mail block), `mdApprovalOut_` (327→560).

### `TlSnapshots.js` (shared readers; 106 lines, no public fns)

| Legacy (:line) | Port (:line) | Note |
|---|---|---|
| `TLS_HEADERS` (18) | — | schema → 003/007 migrations (queue-owned) |
| `tlsShifts_` (28) / `tlsShiftOf_` (34) | `maildesk.ts` 106/89 | verbatim; desk-local copy (cx-queue has the same verbatim pair for its own pages — dedupe note §5 #7) |
| `tlsOnShift_` (42) | `cx-queue/lib/index.ts:439` | not needed by desk (Quality CTL uses it) |
| `tlsOnQueue_` (49) / `tlsMailDue_` (64) | `maildesk.ts` 113/127 | verbatim (duplicated verbatim in `cx-queue/lib/index.ts:448/461`) |
| `TLQ_SETTINGS` / `tlqSetting_` / `tlqCol_` (79/95/101) | `cx-queue/lib/index.ts:485/504/510` | producer side — `tlqBuild_` territory (WP-F2) |

### Cross-file helpers

`pwDirectory_`/`pwIsManagerOf_`/`pwRows_`/`pwIso_`/`pwTxt_`/`pwMs_`/`pwToday_`/`pwKwDate_`/`pwKwTime_`/`pwAddDays_`/`dqAddDays_` (PeopleCore/WorkCalendar/Stores) → `platform/identity` + `platform/time`. `dqReadObjects_`/`dqUpsertIn_`/`dqSheet_` (Stores/Repo) → `readStore` + `db().upsert`; `dqLastRun_`→`dqLastRun` (stores.ts:97 — config `dq_last_*` + queue's `dq_last_run_*` cache + health fallback); `dqMarkRun_`→`jobshared.ts:11` (config stand-in). `requireRole_`/`requireJobCaller_`/`viewAsGuard_`/`actorEmail_`/`normEmail_`/`newId_`/`getConfig_`/`setConfig_`/`configAll_` → `platform/identity`/`viewas`/`settings`/`repo`. `hbRun_`/`hbBeat_`/`hbFlush_` → `platform/health`. `raisePopup_`/`resolvePopups_` → `platform/popups` (dedupe + `assertWritable` inside, like legacy `Popups.js`). `sendGmailReply_` (Mailer.js) → `sendGmailReply` (platform/mail:247 — adds a dry-run stub the legacy never had; see §5 #4). `withLock_` (Repo.js:220) → no port equivalent (low exposure here — upserts are per-statement atomic; decide uses a conditional claim). `installDeskTriggers` GAS APIs (`ScriptApp`/`newTrigger_`/`deleteTrigger_`) → N/A.

## 2. Page checklist

Extract closures render `route.title`/`route.purpose` from the Desk app's registry row (`W`/`Shell` helpers in each closure). The port hardcodes a `ROUTE` literal per component — so the literal must equal the registry text. **It didn't — fixed this pass (§7).**

### `tl-performance` — `src/app/tl-performance/page.tsx` → `components/tl-performance-page.tsx` (737 lines) vs `tl-performance.closure.js` (`yr`, 733-line ref)

- **Classes:** `dk-*` vocabulary identical — `page dk`, `page-head/page-title/page-purpose`, `dk-pick`, `dk-skel`/`skeleton`, `dk-failed`, `dk-error`, `dk-rate`, `dk-slider` (`--p` var, `data-label`), `dk-slider__out`, `dk-note`, `dk-fine`, `dk-stats`/`dk-card`, `dk-table`, `dk-scroll`, `dk-none`, `dk-list`, `dk-sm`, `btn btn-primary/quiet`, `md-*` badges. `aria-*` (`aria-labelledby`, `aria-valuetext`, `sr-only`, `role=alert`) present.
- **Copy:** verbatim — zone fine-print `(Admin, tlp_rating_zones)`, OTD fine-print `(Admin, otd_sheet_id)`/`otd_warehouses`, 'Not rated: move the slider', 'Save rating', empty states. **Fixed**: `h1` was 'Team lead performance' → registry 'TL performance'; purpose restored verbatim.
- **Order/attrs:** page-head (pick) → error/skeleton → overall → areas → OTD → projects → queue → mail; `?tl=` hash read `xt`↔`hashTl` identical; hashchange listener identical; select sets state without touching the hash — identical.
- **`D()` coverage:** 4/4 used — `tlPerformancePage`→`GET /api/tl/page`, `tlpRateArea`/`tlpRateProject`→`POST /api/tl/rate`, `otdSave`→`POST /api/tl/otd`.
- **Fixed:** `Slider.save` now `toast(\`Rated ${LABEL[g]} ${v}.\`)` and OTD save `toast('OTD saved.')` — both `ne()` calls were dropped in the port.
- **Verdict:** parity (after fix). Count-up animation + reduced-motion/hidden guards verified identical.

### `kb-tracker` — `components/kb-tracker-page.tsx` (362 lines) vs `kb-tracker.closure.js` (`wr`)

- **Classes/copy/order:** `dk-kb-form`, metric cards, `dk-table` rows, `dk-none`, `Not checked`/Yes/No accuracy select, datetime-local pickers, `md-actions` button row — verbatim. **Fixed:** purpose literal → registry 'Knowledge-base updates: when each was asked for, when it was done, and whether it was accurate.'
- **`D()` coverage:** 2/2 — `kbTrackerPage`→`GET /api/tl/kb`, `kbTrackerSave`→`POST /api/tl/kb`.
- **Fixed:** `ne("Saved.")` → `toast('Saved.')` after `onSaved` (legacy order).
- **Verdict:** parity (after fix).

### `kpi-logs` — `components/kpi-logs-page.tsx` (395 lines) vs `kpi-logs.closure.js` (`Ar`)

- **Classes/copy/order:** three `dk-kb-form` sections (behaviour / leave / exclusion), `AgentPick` select, leave-type select from `KPI_LEAVE_TYPES`, areas select limited to `canExclude`, soft-remove buttons — verbatim. **Fixed:** purpose literal → registry 'What no system records: HR-confirmed behaviour cases, unplanned leaves, and tickets left out of an area's SLA. The scorecard reads them.'
- **`D()` coverage:** 3/3 — `kpiLogsPage`→`GET`, `kpiLogSave`→`POST {kind,input}`, `kpiLogRemove`→`DELETE ?kind=&id=`.
- **Fixed:** `ne("Logged.")` → `toast('Logged.')` (save → reset → toast → onSaved, legacy order); `ne("Removed.")` → `toast('Removed.')` (remove → toast → onDone).
- **Verdict:** parity (after fix).

### `mail-desk` — `components/mail-desk-page.tsx` (511 lines) vs `mail-desk.closure.js` (`dr`)

- **Classes/copy/order:** `md-aside`, `md-asof` ('Gmail checked every 10 minutes, last …' — legacy copy kept verbatim), `md-section`/`md-h`, `md-cards`/`md-card`, `md-order`/`md-mobile`/`md-meta`/`md-excerpt`/`md-label`, `md-confirm` (role=alertdialog) + dry-run notice verbatim, `md-decided` details ('Decided in the last 14 days, N' + `(not sent, dry run)` + decision text), `md-filter` 3-button group ('Last 7 days, N' / 'Open, N' / 'Late or covered by another TL'), `dk-table md-table` (Received / Mail / On queue / Reply / sr-only Flags), `dk-none` empties ('No approval mails waiting.' / 'Nothing here for this filter.'), Gmail deep links `mail.google.com/mail/u/0/#all/<thread>`, `window.confirm` verbatim for reset. `isApprover` gates the aside + approvals section — identical.
- **`D()` coverage:** 4/4 — `mailDeskPage`→GET, `mailDeskRefresh`/`mailApprovalDecide`/`mailApprovalReset`→`POST /api/mail-desk {action:…}` incl. `clientToken` (`Ie` base36 token ported).
- **Fixed:** dead local `toastFn=null` stub removed — decide/reset now reach the real shell toast (`toast` from `shell/Toasts`), verbatim texts (`{Status}: sent in the thread.` / `…: recorded, not sent (dry run).` / 'Back to waiting.'). Purpose literal → registry verbatim.
- **Verdict:** parity (after fix).

## 3. Gate matrix

Registry (`data/legacy-route-registry.json` == extract `registry.json`): all 4 routes `group: desk`, `roles: [admin, tl]`, `reqs: []` — verified byte-identical to the port's shell registry.

| Route | Registry roles | Page gate | API gate (inside the fn) | View-as write refusal |
|---|---|---|---|---|
| `/tl-performance` `/kb-tracker` `/kpi-logs` `/mail-desk` | admin, tl | `pageAllowed` default→roles (AppShell) | — | — |
| `GET /api/tl/page` | — | — | `requireRole([admin,tl])` + `tlpCanView_` (own TL / manager / admin) | n/a |
| `POST /api/tl/rate` | — | — | `requireRole` + `pwIsManagerOf` (≠self) / `pwIsManagerOf(owner)` | `assertWritable()` tlperformance.ts:432, :468 |
| `GET/POST /api/tl/kb` | — | — | `requireRole` + `tlpKbEditor_` (admin or KB-area owner) | `assertWritable()` :538 |
| `POST /api/tl/otd` | — | — | `requireRole` + admin-or-OTD-owner | `assertWritable()` :573 |
| `GET/POST/DELETE /api/kpi/logs` | — | — | `requireRole`; exclusion save + `klCanExclude_`; remove = logger-or-admin | `assertWritable()` kpilogs.ts:108, :162 |
| `GET/POST /api/mail-desk` | — | — | `requireRole([admin,tl])` page/refresh; decide/reset `requireRole([admin,tl,agent])` + `mdApprovers_` membership | route-level `assertWritable()` before all POST actions + fns :629, :741 |
| `POST /api/desk/setup[?triggers]` | — | — | `requireRole([admin])` | `assertWritable()` tlperformance.ts:598 |
| `POST /api/desk/job/mail` | — | — | `requireJobCaller()` route + inside `jobMailDesk` (no-session=cron, admin hand-run, non-admin refused, view-as refused) | via `assertWritable()` in `requireJobCaller` |
| `GET /api/tl/performance` | — | — | `requireRole([admin,tl])` + TLs-own-only 403 (`api/tl/performance/route.ts`) — reads `tlp_*` snapshots via `getTlPerformance` (cx-queue) | n/a |

Extra gates verbatim: approver list `mail_approver_emails` for decide/reset/refresh; manager-only rating (not self); `isApprover` hides Check-Gmail + approvals UI identically (non-approver admin sees neither — legacy identical). **Residual:** `/api/desk/job/mail` lacks the `cronOk` Bearer check the sibling cron routes carry → WP-F18.

## 4. Jobs

| Job | Legacy | Port | Cadence | Heartbeats |
|---|---|---|---|---|
| `mail_desk` | `jobMailDesk` (MailDesk.js:280), 10-min `ScriptApp` trigger (`installDeskTriggers`) | `jobMailDesk` (maildesk.ts:482) via `POST /api/desk/job/mail` | **15 min, pg_cron** (D-SCHED floor; `60-desk.md:33`) — **unscheduled** (B5 → WP-50; pg_cron SQL is WP-24) | `hbRun('mail_desk')` ok/error + flush — **fixed this pass** (was warn-only); warn beat on a failed half; `dqMarkRun_`→config `dq_last_mail_desk` (read by `mailDeskPage.asOf` and health evidence); `HB_PLAN` row `every:10, grace:20` (health.ts:64) — 15-min beats still land inside the 30-min window; label keeps the legacy 10-min copy |
| `tl_queue_metrics` (producer→consumer link) | Hub `jobTlQueueMetrics` hourly → `tlp_shifts/tlp_queue_daily/tlp_team/tlp_area_metrics` (+ `DQ_LAST_tl_queue_metrics`) | `jobTlQueueMetrics` (cx-queue `jobs.ts`) via `POST /api/cron/job-tl-queue`, hourly | 60 min | desk **reads only**: `tlp_*` rows + `dqLastRun('tl_queue_metrics')` (stores.ts:97 reads the queue-side `dq_last_run_*` cache stamp); desk code has zero writes to `tlp_shifts/tlp_queue_daily/tlp_team/tlp_area_metrics` (grep-verified) |

`jobMailDesk` is the only desk job; `TlPerformance.js`/`KpiLogs.js` have none. `mail_desk`'s Gmail read is G2-gated: no adapter → `mdThreads_` throws `'Gmail is not configured for Mail desk (B2/G2)…'`; the job reports `Response tracking failed: …`/warn honestly; the page reads stored rows regardless.

## 5. Residual gaps

| # | Gap | Class | Evidence | Disposition |
|---|---|---|---|---|
| 1 | **`jobMailDesk` never wrote ok/error heartbeats** — only warn-on-partial; the Health row stayed empty while `dqLastRun` stamped (same class of bug WP-12 fixed queue-side). | FIXED | maildesk.ts:482 now `hbRun`-wrapped; desk.test.ts:626 asserts the `ok` row | **fixed this pass** |
| 2 | **Page toasts dropped** — `ne()` → nothing on all 4 pages (`Rated …`, `OTD saved.`, `Saved.`, `Logged.`, `Removed.`, decide/reset toasts; mail-desk had a dead `toastFn=null` stub). | FIXED | §7 | **fixed this pass** |
| 3 | **`mdThreads_` is message-level, legacy is thread-level** — `Gmail.Users.Threads.list+get` returns *every* message of matched threads; `listMessages(q)` returns only q-matching messages grouped after the fact. A reply whose subject drifts (or any in-thread message not matching the query) is invisible → false `open`/`breached`, missed `answered_in_gmail`. Also fixed off-by-one: a 51st distinct thread could slip past the cap. | GAP → WP-F19 | maildesk.ts:313 vs MailDesk.js:187; cap fix landed (maildesk.ts:339) | **WP-F19** (adapter contract — `listThreads`/`getThread`, WP-52/G2-adjacent) |
| 4 | **`sendGmailReply` unconfigured = silent `'sent'`** — platform stub returns `''` + dry_run mail_log row without throwing; with `mail_approval_dry_run=false` the approval recorded `sent_status:'sent'` for a reply that never left. Legacy `sendGmailReply_` always attempted the real send and threw. | FIXED | maildesk.ts:683 — decide now refuses early on `!getGmailAdapter()` → `send_failed` log + back to `pending` | **fixed this pass** |
| 5 | **Mailbox identity `me` lost** — legacy `Session.getEffectiveUser()` fed `mdOurs_` (the CX mailbox's own replies count as ours) and `mdReplyAddresses_` (strips us from Cc). Port hardcodes `me=''` (comment notes D-GOOGLE). Replies from the connected mailbox won't count as ours unless also roster/admin/our_senders; the mailbox may get Cc'd on its own replies. | GAP → WP-F19 | maildesk.ts:351, :639 vs MailDesk.js:202, :380 | **WP-F19** (adapter should expose `accountEmail`) |
| 6 | **`withLock_` absent** — `mdSyncSla_`/`mdSyncApprovals_`/`kbTrackerSave`/`otdSave`/`tlpRateArea`/`kpiLog*` read-modify-write unlocked. Exposure is smaller than ops (single-writer jobs; upserts atomic; decide has the conditional claim). | documented | same class as WP-F5 | recorded; folds into **WP-F5**'s platform decision |
| 7 | **`tls*` readers duplicated** — `tlsShifts_/tlsShiftOf_/tlsOnQueue_/tlsMailDue_` verbatim in BOTH `maildesk.ts:89-142` and `cx-queue/lib/index.ts:420-482`. Identical logic, no drift today; desk re-ported its own copy per file ownership (TlSnapshots.js is desk-consumed and queue-produced). | documented divergence | grep | recorded — a future dedupe could import cx-queue's, but verbatim-per-file is defensible |
| 8 | **`assertWritable` ordering** — port refuses before validation; legacy refused on the first sheet write (after validation). Same refusal surface, same message. | cosmetic | all write fns | recorded (same as WP-14 #11) |
| 9 | **`installDeskTriggers` 10-min note** — report text carried the legacy cadence while the real target is 15-min D-SCHED. | FIXED | tlperformance.ts:639 | **fixed this pass** |
| 10 | **`/api/desk/job/mail` has no `cronOk` Bearer check** — `requireJobCaller` alone lets any *anonymous* POST through ("no session = cron"). Every sibling cron route gates `Bearer CRON_SECRET` first. Unscheduled today (B5) so exposure is hand-trigger only, but the route is an open POST that writes. | GAP | `api/desk/job/mail/route.ts` vs `api/cron/job-tl-queue/route.ts:10-18` | **WP-F18** (route file outside cx-desk scope) |
| 11 | **`mail_approval_log` insert result unchecked** — a failed log insert is swallowed (legacy `dqUpsertIn_` threw, erroring the call after the decide landed). Decide itself is unaffected. | cosmetic | maildesk.ts:641-654, :753-767 | recorded |
| 12 | **`mdSyncSla_` popup resolves keyed on `status==='replied'` only** — matches legacy verbatim; a `mail_sla` row whose thread continues past 7d-query aging stays `open` forever (same in legacy — the row just drops out of the query window). | parity note | maildesk.ts:384-404 vs MailDesk.js:225-241 | recorded — verbatim |
| 13 | **`api/tl/performance` route shape differs from shard sketch** — `60-desk.md` sketched `api/desk/{tl-performance,…}`; the implementation split into `api/tl/*` + `api/kpi/*` + `api/mail-desk` + `api/desk/{setup,job/mail}` (the pre-existing `/api/tl/performance` snapshot reader also stays). Function names/behavior are the contract; route paths differ from the doc. | doc divergence | §3 | recorded — shard doc is a sketch; routes are internal |

## 6. Golden vectors needed for WP-21

Covered at HEAD (130 tests): every pure helper, `mdKind_`/`mdSlaFlags_`/`mdSlaRecords_`/`mdMergeSla_`/`mdParseApprovalSubject_`/mime+address helpers/bool, `tls*` readers, `mdSyncSla_` incl. merge+popups, `mdSyncApprovals_` incl. `answered_in_gmail`, `jobMailDesk` (note + dq stamp + caller/view-as refusals + fail-closed adapter), `mailDeskRefresh`, `mailDeskPage` all roles, `mailApprovalDecide` claim/idempotency/validation/refusals, `mailApprovalReset` all branches, all of TlPerformance + KpiLogs incl. setupDesk + the otd asymmetry.

Missing / thin — feed to WP-21:

1. **`mailApprovalDecide` with `mail_approval_dry_run: false`** — no vector exercises the send path at all. With the WP-15 fix, unconfigured → `send_failed` + pending rollback (testable now); a stub `GmailAdapter` fixture would cover the real send (`sent`, `sent_message_id`, mail_log row, Cc stripping).
2. **`mailDeskRefresh` non-approver refusal** (`'Gmail is checked every 10 minutes; ask Mohamed for a check now.'`) and non-admin-approver hitting `requireJobCaller` inside the refresh.
3. **`installDeskTriggers`** — admin → schedule note; non-admin refusal. (Also pins the D-SCHED cadence string.)
4. **`mdThreads_` seam internals** — multi-message thread grouping order, `MD_MAX_THREADS` cap (50 threads, not 51 — the WP-15 fix), `rfcId`/Reply-To header extraction, adapter `getMessage` failure propagation.
5. **`mdSyncSla_` popup edges** — no popup when the mail is >6h old at first sight; no popup when the row already existed; `resolvePopups` on transition to `replied` (partially covered).
6. **`mdOurs_` `our_senders` list + roster/admin/extra precedence** — currently only roster+admins are exercised.
7. **`mailDeskPage` `dryRun` variants** — config `'false'` string vs boolean vs missing (default-true); approvals sorting when pending+sending+decided mix.
8. **`mailApprovalReset` exact 5-min boundary** — `updated_at` at precisely `now-5min` (`<=` refuses).
9. **`tlPerformancePage` `part()` partial-failure** — a dead `tlp_team` read → `notes` entry + `null` section while the rest renders.
10. **`tlpRateArea` below-threshold note requirement + unknown-area refusal ordering** vs `assertWritable` position (WP-14-style ordering pin).
11. **`kpiLogRemove` the already-removed race** — `removed_at` set between read and update (low, documents the no-lock seam).
12. **`mail_desk` beat-merge** — a half-failed run ends `warn` with the joined note (ok-beat must not downgrade the warn).

## 7. Fixes shipped this WP (all inside `src/features/cx-desk/` except the pinned test assertion)

| File | Change |
|---|---|
| `lib/maildesk.ts:24-25` | imports `getGmailAdapter`, `hbBeat`, `hbRun`; dropped unused `pwIso` |
| `lib/maildesk.ts:339-346` | `mdThreads_` cap: a 51st distinct thread can no longer enter the map (Threads.list `maxResults:50` parity) |
| `lib/maildesk.ts:481-505` | `jobMailDesk` wrapped in `hbRun('mail_desk', …, r=>r.note)`; deleted the warn-only `hbBeatWarn_` helper — legacy `hbRun_` ok/error/flush semantics restored |
| `lib/maildesk.ts:683-696` | `mailApprovalDecide`: `!getGmailAdapter()` → `err` → `send_failed` log + `pending` restore + throw (fail-closed, no false `'sent'`) |
| `lib/tlperformance.ts:634-641` | `installDeskTriggers` note: `every 15 minutes (pg_cron per D-SCHED; not installable from the app)` + header comment |
| `components/mail-desk-page.tsx` | dead `toastFn=null` stub removed → `import { toast }` (real shell emitter); `ROUTE.purpose` → registry verbatim |
| `components/tl-performance-page.tsx` | `import { toast }`; `Rated ${LABEL[g]} ${v}.` after slider save; `OTD saved.` after OTD save; `ROUTE` title+purpose → registry verbatim |
| `components/kb-tracker-page.tsx` | `import { toast }`; `Saved.` after save; `ROUTE.purpose` → registry verbatim |
| `components/kpi-logs-page.tsx` | `import { toast }`; `Logged.` / `Removed.`; `ROUTE.purpose` → registry verbatim |
| `tests/golden/desk.test.ts:18-19, 626-633` | pinned assertion flipped: port now writes the `mail_desk` `ok` health row like legacy (the documented-gap assert `toBe(0)` → `toBe(1)` + `last_status==='ok'`) |

## 8. Gates (post-fix)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx vitest run` | **817/817 across 41 files** (desk.test.ts 130/130 incl.) |
| `npx eslint src/features/cx-desk` | **0 errors, 5 warnings** (all pre-existing unused imports in tlperformance.ts — left; not mine) |

## 9. Questions for the orchestrator

1. **WP-F18 (route auth):** `/api/desk/job/mail` is the only cron route without a `cronOk` Bearer gate — want the 6-line `cronOk` pattern copied from `api/cron/job-tl-queue` as part of WP-24/50 wiring, or fix now? (It's outside cx-desk so I logged rather than changed it.)
2. **WP-F19 (adapter contract):** when the Gmail read adapter lands (WP-52/G2), it should (a) fetch at thread level (or document that query-matching message lists are the contract), and (b) expose `accountEmail` so `mdOurs_`/`mdReplyAddresses_` get the `me` legacy had. Confirm these go on the WP-52 acceptance list.
3. **HB_PLAN `mail_desk` `every:10/grace:20`:** the plan row still says "every 10 min" (legacy verbatim); at the 15-min D-SCHED cadence beats land within the window, so the board stays green — keep the verbatim label or set `every:15` when WP-24 writes the pg_cron SQL? I'd keep `every:15, grace:20` for honesty — needs an owner call only if they want the legacy label preserved.

## 10. WP-21 wave-2 golden pass (residual vectors)

**Result: 130 → 160 tests, all green.** Every §6 missing/thin vector landed as a `// wave-2 extension` describe — all 12 items covered:

| §6 vector | Describe |
|---|---|
| `mailApprovalDecide` `dry_run:false` — unconfigured → `send_failed`+rollback; stub adapter → real `sent`/`sent_message_id`/mail_log/Cc strip | `mailApprovalDecide real-send path` |
| `mailDeskRefresh` non-approver refusal + non-admin-approver hitting `requireJobCaller` | `mailDeskRefresh` |
| `installDeskTriggers` admin note + non-admin refusal (pins D-SCHED cadence string) | `installDeskTriggers` |
| `mdThreads_` grouping order, `MD_MAX_THREADS` cap, `rfcId`/Reply-To extraction, `getMessage` failure propagation | `mdThreads_` |
| `mdSyncSla_` popup edges — none when >6h old at first sight, none on pre-existing row, `resolvePopups` on `→replied` | `mdSyncSla_ popup edges` |
| `mdOurs_` `our_senders` + roster/admin/extra precedence | `mdOurs_ precedence` |
| `mailDeskPage` `dryRun` `'false'`/bool/missing + approvals pending/sending/decided sort | `mailDeskPage dryRun + approvals ordering` |
| `mailApprovalReset` exact `now-5min` boundary (`<=` refuses) | `mailApprovalReset 5-minute boundary` |
| `tlPerformancePage` `part()` — dead `tlp_team` → note + `null` section, rest renders | `tlPerformancePage partial failure` |
| `tlpRateArea` below-threshold note + unknown-area refusal vs `assertWritable` position | `tlpRateArea ordering under view-as` |
| `kpiLogRemove` already-removed race (no-lock seam documented) | `kpiLogRemove claim ordering` |
| `mail_desk` beat-merge — half-failed run → `warn` + joined note | `jobMailDesk half-failure` |

### Divergences found → fixed

| File | Change |
|---|---|
| `lib/maildesk.ts` (`mdSyncSla_`) | `old` map held references to the same fake-DB row objects the upsert later mutated → `was.status` read as `replied` before the transition check → `resolvePopups('mail_sla_due')` never fired. Old rows now snapshotted `{ ...r }` before upsert — restores legacy value-copy semantics. |
| `lib/tlperformance.ts` | area literal emitted `kb: null` on every area; legacy only assigns `kb` on the `Knowledge base` area → `kb` made optional, set only by the KB post-processing (key-presence parity, not just value parity). |
| `lib/tlperformance.ts` (`rowsOf`) | `readStore` swallowed mid-scan store failures into `exists:false` → `part()` saw a quiet empty section. Legacy `dqReadObjects_` missingOk only forgives an unconfigured store; a read that *fails* propagates. `rowsOf` now rethrows via `readRows` when `!exists` → `tlPerformancePage` notes land identically. |
| `src/features/shared/platform/health.ts` (`hbReset`) | docstring promised "drop the queue and the last-write stamps" but `HB_LAST_WRITE` (module-map stand-in for the `hb_last_<job>` script-cache stamps) survived → a second same-status beat inside `HB_MIN_GAP_MIN` was filtered out, so the approvals-half-failure test found no `mail_desk` health row. Legacy's script cache resets per oracle call; `hbReset` now clears the map too. |

### Fixture/infra additions + lessons (test-only)

- `desk-fakes.ts`: `Threads.list` honours `maxResults`, `gmailThrow` list/get failure hooks, `Messages.send` stub for the real-send path, `base64EncodeWebSafe` for MIME vectors.
- `jobMailDesk` warn-note join is a space join (`'A. B'`), not the `'; '` a first draft expected — pinned expectations updated to the legacy strings.
- `kpiLogRemove` double-remove: the oracle `__reset__` re-seeds stores per call, so the second call gets the store cells the first call stamped (fed back via `deskSheetCells` into `fixture.spreadsheets`); the port reads its own updated `hubDb` either way.
- Half-failure vectors: `hubDb.missing.add('<table>')` exercises the legacy fail path on both sides now that `rowsOf` propagates instead of swallowing.

### Gates (post-wave-2)

| Gate | Result |
|---|---|
| `npx vitest run tests/golden/desk.test.ts` | **160/160** |
| `npx tsc --noEmit` | **0 errors** |
| `npx vitest run` | **1098/1098 across 47 files** |

No new WP-F rows — WP-F18/F19 remain the standing follow-ups; every wave-2 divergence was within small-fix scope.
