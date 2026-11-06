# WP-17 — shared/platform + shell parity audit

Wave-1 audit of the all-core legacy libraries and the application shell, per
`specs/megaplan/w1-audits.md` §WP-17 and `specs/cx-hub/PORTING-GUIDE.md`.
Verified against current HEAD (`84ba588` merged: `requireRole` unified into
`platform/identity`, `auth.ts` re-exports it — confirmed at
`src/features/shared/lib/auth.ts` / `platform/identity.ts`).

Gates (run post-change, this audit): `npx tsc --noEmit` → 0 errors;
`npx vitest run` → 41 files / 817 tests green.

Legend: OK = verbatim semantics · PORTED-AS = same contract, adapted mechanism ·
DROPPED = intentionally absent, documented · MISS = absent, needs a follow-up.

---

## 1. Library map (all-core legacy files → port location)

| Legacy lib (identical ×8 apps) | Port | Status |
|---|---|---|
| `Auth.js` | `platform/identity.ts` (`currentUser_`→`currentUser` :76, `currentEmail_`→:57, `realEmail`, `actorEmail` :47 — `"system:trigger"` fallback verbatim, `requireRole`) + `lib/auth.ts` re-export | OK |
| `Config.js` | `platform/settings.ts` (`getConfig`, `setConfig`, `configAll`, `CONFIG_DEFAULTS`) | OK |
| `Options.js` | `platform/options.ts` (`allOptions`/`groupOptions` :36 — sort-order ''-last + case-insensitive dedupe verbatim, `isActiveOption` :35, `assertWritable` on append) | OK |
| `Popups.js` | `platform/popups.ts` (`pendingPopupsFor`, popups poll) | OK |
| `Notify.js` | `platform/notify.ts` (`notify` :44, `notifyHtml` :92 escaped fact-table, `pwOo*` 1:1 scheduling + seen) | OK |
| `Mailer.js` | `platform/mail.ts` — §6 | OK |
| `Repo.js` | `platform/repo.ts` (`db`, `readRows`, `appendRow`/`appendRows` with `submitted_*` stamps, `updateRows` key-locked + `updated_*` stamps, `cacheGet`/`cachePut`/`cacheRemove` = CacheService stand-in :37-58, `sanitizeInput` :70) | OK |
| `Stores.js` | `platform/stores.ts` seam + `jobs/env.ts` + feature libs — §2 | PORTED-AS (distributed) |
| `Health.js` | `platform/health.ts` — §7 | OK (1 fix shipped) |
| `ViewAs.js` | `platform/viewas.ts` (`viewAsState` :63 — owner by *real* address :71, `viewAsRead`, `viewAsRequireOwner`, `viewAsStart/Stop`, `viewAsPeople`, `viewAsGuard_`→`assertWritable` :87; used by 20+ feature files) | OK |
| `WorkCore.js` | `jobs/env.ts` (job env: memo, upsert/upsertIn, flushWrites, hbBeat) + `jobs/steps.ts` (`dqStep_` :8) | PORTED-AS |
| `WorkCalendar.js` | `platform/calendar.ts` + `platform/holidays.ts` | OK |
| `Apps.js` | `components/shell/registry.ts` (`APPS`) + `shell/gates.ts` (`appForGroup`/`Me` :86, `appTitle`/`Te` :98, `resolveLink`/`we` :113, `groupEntryLink`/`ra` :130) | OK |
| `Code.js` | `src/app/api/bootstrap/route.ts` (`getAppBootstrap_`) + view-as/popups/options/alerts routes | PORTED-AS — §3 (1 MISS → WP-F8; `quality` fixed in-tree) |
| `PeopleCore / ProdCore / QueueCore / KpiPayout / TlSnapshots / OneOnOneAlerts.js` | module libs (`cx-people`, `cx-productivity`, `cx-queue`, `cx-desk`) — covered by WP-11/12/15/16 audits | module scope |

`OneOnOneAlerts.js`'s client half → `components/shell/OneOnOneAlerts.tsx` (§4).

---

## 2. Stores.js function matrix (`platform/stores.ts` + distributed ports)

`platform/stores.ts` is a deliberately thin seam: sheet reads became direct
Postgres reads (no cache layer ⇒ `cache_stamps` versioning unneeded — the
docblock at `stores.ts:1-14` records this). The named helpers live where the
ports that need them live.

| Legacy fn | Port | Where | Status |
|---|---|---|---|
| `dqReadObjects_(..,{missingOk})` | `readStore` — `{rows, exists}`; `exists:false` on error, never invents data | `platform/stores.ts:26` | OK |
| `dqCachedLive_` | `dqCachedLive` — `[]` when store absent | `stores.ts:37` | OK |
| `dqReadTail_` | `dqReadTail` — last n rows, oldest-first | `stores.ts:42` | OK |
| `dqReadLean_` | selective-column reads inside job envs / feature engines (`cx-productivity/lib/prod/engine.ts`, `cx-people/lib/scorecard-server.ts`) | distributed | PORTED-AS |
| `dqRewrite_` | live-aggregate delete+rewrite (`cx-queue/lib/jobs.ts`; `jobs/env.ts` rewrite path) | distributed | PORTED-AS |
| `dqAppend_/dqAppendIn_` | `appendRow`(s) + `env.appendIn` | `repo.ts`, `jobs/env.ts` | OK |
| `dqUpsert_/dqUpsertIn_` | key-column upsert — memo path `:292`, PG upsert `:589` ("the sheet replace semantic dqUpsert_ had") | `jobs/env.ts`, `jobs/freshdesk.ts`, `cx-productivity/lib/tph/write.ts`, `cx-people/lib/scorecard-server.ts` | PORTED-AS |
| `dqMarkRun_` | `dqMarkRun_` — **queue** stamps `cachePut('dq_last_run_'+job)` (`cx-queue/lib/jobs.ts:63`); **desk** stamps `setConfig('dq_last_'+job)` (`cx-desk/lib/jobshared.ts:10`) | distributed | PORTED-AS (+ read-side fix, §8) |
| `dqLastRun_` | `dqLastRun` — config `DQ_LAST_*` (case-insensitive) → **`cacheGet('dq_last_run_'+job)`** → health `last_ok_at` | `stores.ts:97-116` | OK (fixed §8) |
| `dqLastOkElsewhere_` | `dqLastOkElsewhere` — health row, 60 s cache | `stores.ts:63` | OK |
| `dqBumpCacheVersion_` / `ccStamp_` | — none — | — | **DROPPED** (by design: no script cache ⇒ no staleness window; 0 callers; `stores.ts:1-14`) |
| `dqStep_/dqStepIn_` | `dqStep_` — run fn → `env.flushWrites()` → `env.hbBeat(job,'ok'|'error',…)`; failed flush still beats error; skipped → healthy | `jobs/steps.ts:8-22` | OK (verbatim) |
| `headersOf_/ensureColumns_/toCellValue_/tableForget_` | — Postgres schema/migrations own column shape — | n/a | DROPPED |
| `dqWallToUtc_/dqTzOffsetMin_/dqDateKey_/dqAddDays_` | `lib/adapters.ts` — golden-tested (150 vectors) | `shared/lib` | OK |

**Year-store semantics** — the legacy per-year tab layout carries over as a
`year` column, matching the queue precedent: `agg_inflow_hourly` upserts keyed
`date,hour,channel,country,year` (`cx-queue/lib/jobs.ts:197-200`),
`queue_snapshots` filtered `.eq('year', …)` (`:297-321`); `year_rollover`
job in `HB_PLAN` (`health.ts:42`) + `jobNightlyAggregates` step (`jobs.ts:382`).
OK.

---

## 3. `/api/bootstrap` payload vs `Code.js#getBootstrap`

`src/app/api/bootstrap/route.ts` (WP-B owns `/api/*`; findings → WP-F8).

| Field | Legacy | Port | Status |
|---|---|---|---|
| `user` | `currentUser_()` effective user | `currentUser()` — identical incl. view-as target + `specialist`→agent | OK |
| `popups` | `pendingPopupsFor_(user.email)` | `pendingPopupsFor(email)` (same effective address) | OK |
| `options` | `allOptions_()` | `allOptions()` | OK |
| `serverTime` | `new Date().toISOString()` | `pwKwTime(now)` (HH:MM Kuwait) + added `serverDate` + `serverAt` (ISO) | OBSERVED — same key, new semantic; ISO preserved in `serverAt`; no in-port consumer found |
| `timeZone` | `Session.getScriptTimeZone()` | `KUWAIT_TZ` constant | OK |
| `isOwner` | `user.email === assistantOwnerEmail_()` — **false while viewing-as** (hides my-day/notes via `Um`) | `st.owner` — **real** address ⇒ stays `true` while viewing-as (`route.ts:46`) | **MISS → WP-F8** |
| `app` | `ccApp_()` | `'hub'` literal — unified single deployment; rail context comes from the route's group, not `boot.app` | PORTED-AS |
| `appUrls` | `appUrls_()` | `appUrls()` | OK |
| `quality` | `boot.quality = qaBootFlags_(user)` → `{auditor, disputeOwner, kbEditor}` | `quality: undefined` at HEAD — **fixed in working tree during this audit** (uncommitted WP-18 edit wires `qaBootFlags(user)`, verbatim port at `cx-quality/lib/server.ts:517`) | OK (in-tree) |
| `viewAs` | emitted only for the owner `{canUse:true, target}` (fresh `viewAsState_(true)`) | always `{canUse: st.owner, target: st.target||null}` (`route.ts:52`), cached state | OBSERVED — `canUse:false` ≡ absent for all gating; minor freshness delta |
| unknown-role early return | limited shape, `isOwner:false` | identical (`route.ts:20-32`) | OK |

Shell-side contract `Bootstrap` (`shell/context.ts:50-57`) already models
`quality`/`viewAs` — only the route withholds `quality`.

---

## 4. Shell parity checklist (vs `03-ui-ux-parity.md` + bundle)

All previously-flagged divergences re-checked against HEAD — every one is now
resolved in the port:

| Item | Evidence | Status |
|---|---|---|
| Rail indicator | `.nav-ind` slider parked on the active link every render (`pn()`), tone read from `[data-tone]` (`AppShell.tsx:125-138, 377`) | OK |
| Icons ×40 | `NAV_ICONS` = 40 entries; SVG path union diff vs bundle `gs`/`jb` map: **0 mismatches** (earlier `queue`/`fcr`/`quality-scores` diffs were extract-shape artifacts); `NavIcon` verbatim + circle fallback | OK |
| Tones / group contexts | `GROUP_LABELS`, `GROUP_DEFAULT_PAGE`, `GROUP_TONE`, `GROUP_ORDER`, `APPS` — byte-equal vs `legacy-parity/data/legacy-route-registry.json` (eval-compared) | OK |
| `BUILT_ROUTES` vs route-audit | `PAGES` ×40 = `route-audit.json.pages` exactly; 36 real + 4 legacy-unbuilt placeholders (`hard-cases`, `kpi-close`, `escalation-matrix`, `fcr`); hidden `ecosystem` at `app/ecosystem/page.tsx` | OK |
| Collapse | `rail-off` class + `cx.rail-off` persistence (`AppShell.tsx:58,348`) | OK |
| Mobile | `nav-open` toggle, Menu/Close (`:348,373`), media rules in `legacy-apps.css` (48 nav-ind/data-tone/rail/nav-open/rtl hits) | OK |
| State screens | `.state-screen` ×4 verbatim copy: could-not-start + Reload, no-access, not-set-up, nothing-in-app + Open-the-Hub (`AppShell.tsx:241-333`) | OK |
| Boot splash | `BootSplash` — verbatim `index.html:15-52` CSS+markup, 3 bear scenes, `#app:not(:empty)+.boot-splash` self-hide, AR boot-text swap, reduce-motion + dark variants; PNGs in `public/assets/boot/`; mounted in `layout.tsx` | OK |
| Error boundary | `wa` — legacy retry screen, `.field-error` + "Try again" (`ErrorBoundary.tsx:24-40`) | OK |
| Toasts | `ee` emitter + `.toasts` `role=status` region, 4 s expiry (`Toasts.tsx`) | OK |
| HashShim | `#/path[?q]` **and** `?page=` rewrite → `/<path>?q`; `mock`/`role` dropped, `tab` etc. preserved; `hashchange` listener (`HashShim.tsx`) | OK |
| Appearance | `cx.appearance` pre-paint boot script (`layout.tsx:APPEARANCE_BOOT`, verbatim index.html:14 + `data-entry="first"`); `applyAppearance` sets `data-theme` (auto⇒removed), `data-accent` (pine⇒removed), `data-reduce-transparency`, `data-reduce-motion`, `lang`+`dir=rtl` (`shell/i18n.ts:51-62`) | OK |
| i18n 80-string dict | `legacy-i18n-ar.json` = exactly 80 keys; **80/80 keys+values verbatim in hub bundle** (programmatic diff); `D()` `{key}` interpolation; `useLang()` | OK |
| View-as banner + picker | `Vt` banner verbatim ("Viewing as **X** (role) — read-only", Switch person, Exit+error path); `kn` picker — search haystack name/email/role/position/TL/auditor, Enter-picks-sole-match, `va-role--*` chips; `switchViewAs` POST/DELETE `/api/view-as` + reload (`ViewAs.tsx`) | OK |
| View-as **data-layer** guard | `assertWritable`/`viewAsGuard` (`viewas.ts:87`) wired on 20+ feature write paths incl. `sendMail`/`sendGmailReply`/options append — enforced server-side, not just routes | OK |
| Popups + chime | `ya` — 60 s visible-only poll, `<dialog.popup>` verbatim copy ("1 of N reminders — raised …", "comes back each time…"), `qa_*`→"Open" else "Log it now" button, new-popup chime else title-flash `New:` (`Popups.tsx`) | OK |
| 1:1 alerts + chime | `ga` — 2.5 s→60 s visible poll, soon→start promotion timer (`fa()`/`startKey`), `cx.oo-alerts-seen` 24 h memory + API seen-sync, two-tone chime 1318.5→987.8 Hz after first interaction, `1:1 now` title-flash while blocked, sound-state hint verbatim (`OneOnOneAlerts.tsx`) | OK |
| Gates | `rh`→`pageAllowed` and `ec`→`groupEntryAllowed` **byte-identical** to bundle `:4892-4916` (all 8 per-path cases); `Um` owner gate; `Ft/ba/fs` role labels; `we/ra/jt` link resolution | OK |
| Primitives | `Wt/Mn/Sn/Y/Pa/xt/ot/Ca/vsPrev/Qn/va`, fold memory `cx.sections-open`, `cc-tip` tooltip (`components/shell/ui.tsx`) | OK |
| Unbuilt pages | `[...slug]` → registry hit = `hs()` placeholder verbatim ("Not built yet. Covers requirement(s)…"), else redirect `/` like the hash router | OK |
| `FALLBACK_BOOT` | dev-only; production `loadBootstrap` propagates → fail-closed (`context.ts:122-132`) | OK |
| `window.__CC_BOOT__` | honoured then deleted before `/api/bootstrap` (`context.ts:123-127`) | OK |

---

## 5. Gates verification

- `requireRole` unified in `platform/identity` (`84ba588`); `lib/auth.ts` re-export confirmed; `FALLBACK_BOOT` dev-gated.
- `viewAsGuard_`→`assertWritable`: mail send, options append, 20+ feature write paths — the data layer refuses writes during view-as, per the porting guide.
- `viewAsStart/Stop`/`viewAsPeople` all route through `viewAsRequireOwner` (`viewas.ts:140,160,175`); `target===owner` refused like legacy.
- Alerts/popups/view-as routes exist: `api/popups/route.ts`, `api/alerts/one-on-one/route.ts`, `api/view-as/route.ts`, `api/view-as/people/`.

## 6. Mail engine vs `Mailer.js`/`Notify.js`

| Item | Status |
|---|---|
| `sendMail_` → `sendMail` (`mail.ts:175`) — identical throw, `assertWritable` at `:177` = legacy `viewAsGuard_()` at Mailer.js:24 (verbatim position), `normEmail` to/cc join | VERBATIM |
| `mail_dry_run` default `true` (`:190` = Mailer.js:27) | VERBATIM |
| `mailAllowed_` → `mailAllowed` (`:160-168`): `qa_*` kinds pass; else every recipient ∈ `admin_emails` — byte-equal to Mailer.js:55-58; policy-refused → `blocked` (dry_run logged) | VERBATIM |
| No SMTP creds ⇒ adapter `null` ⇒ `dry_run` (`:199-201`) — "nothing ever leaves the building" | PORTED-AS (MailApp→adapter seam, documented) |
| `name:'CX Helm'`, `mail_reply_to`→`replyTo`, quota pass-through (`:204-210`) | VERBATIM |
| `MailLog` → `mail_log` append, same headers, best-effort like `dqLogRun_` (`:219-237`) | VERBATIM |
| `sendGmailReply_` → `sendGmailReply` (`:247+`): `assertWritable` (:253 = Mailer.js:68), adapter + `GMAIL_SEND_ENABLED` gate, logs `dry_run` while stubbed, throws on adapter failure | PORTED-AS (stubbed seam — flagged, not hidden) |
| `Notify.js` → `notify` (`notify.ts:44`): mail via `sendMail` (policy/dry-run/log inheritance verbatim), popup fallback best-effort, `viewAsGuard` refuses before logging (Notify.js:23 comment honoured), `notifyHtml` escaped fact-table (:92), `escapeHtml` | VERBATIM |
| `pwOo*` 1:1 email/alert scheduling (`notify.ts:146-261`) | OK |

## 7. Heartbeat vs `Health.js`

| Item | Status |
|---|---|
| `HB_PLAN` 23 rows verbatim (`health.ts:39-69`); `HB_SYSTEMS/HB_BUILT/HB_NO_JOBS/HB_IDLE_NOTE/HB_RANK` (:32,72-76) | VERBATIM |
| `hbBeat_` → `hbBeat` (:114): worst-status-wins + note-join per request, never throws | VERBATIM |
| `hbRun_` → `hbRun` (:146): beat ok/error, skipped→healthy note, flush in `finally`, rethrow | VERBATIM |
| `hbFlush_` → `hbFlush` (:206): `HB_MIN_GAP_MIN=10` throttle via `hb_last_*`→`HB_LAST_WRITE` map, plan windows (`expect_every_min`/`grace_min`) never overwritten, update-in-place + atomic appends, cache `eco_health_v2` invalidate | VERBATIM — **append-beat drop fixed** (§8) |
| `hbEnsureTab_`/`hbRowFromPlan_`/`hbWithPlan_`/`hbRowState_`/`hbCombine_`/`hbComputeHealth_`/`hbStatus_`/`hbTime_`/`hbHuman_` | VERBATIM |
| `hbEvidence_` → `hbEvidence` (:452+): config `DQ_LAST_*` + `refresh_log` tail + `agg_snapshots_today`; `queue_aggregates` ⇒ `checkin_tick` evidence (:503) | VERBATIM |
| Script lock → per-job upsert; CacheService → in-memory TTL map (docblock :21-22) | PORTED-AS (documented) |

Job-name cross-check: `dqStep_` beats by the job key (`jobs/steps.ts:8`);
`hbRun` callers + `jobNightlyAggregates` steps all use HB_PLAN names —
queue beats fixed by WP-12 already instrument.

## 8. Fixes shipped inline (≤30-line rule, shared/ only)

1. **`health.ts` — appended heartbeat rows dropped the beat.** Legacy
   `hbFlush_` writes `last_run_at/last_status/last_note(+ok/error stamps)`
   onto appended rows too (`Health.js:196-203`); the port `continue`d after
   `hbRowFromPlan`, so the first-ever beat for a missing row was lost
   (reported "awaiting first run" until the next beat). Now applies the same
   fields before `appends.push` (:236-252). 11 lines.
2. **`stores.ts` — `dqLastRun` missed the queue run-stamp.** Queue
   `dqMarkRun_` stamps the script-cache stand-in key `dq_last_run_<job>`
   (`cx-queue/lib/jobs.ts:63`) while `dqLastRun` only read config `DQ_LAST_*`
   (desk's stamp) → queue stamps invisible. Now `cacheGet('dq_last_run_'+job)`
   is consulted before the health fallback (:104-108). 5 lines.

## 9. Residual gaps

| # | Gap | Disposition |
|---|---|---|
| 1 | `/api/bootstrap` `quality: undefined` — **resolved in working tree during this audit** (uncommitted WP-18 edit wires `qaBootFlags(user)` at `route.ts:36`); verify on next HEAD | Resolved in-tree (uncommitted) |
| 2 | `/api/bootstrap` `isOwner: st.owner` uses the *real* address — while viewing-as, legacy's `user.email === assistantOwnerEmail_()` is `false` so owner-only `my-day`/`notes` wrongly stay visible. Fix: `isOwner: user.email === (await assistantOwnerEmail())` | **WP-F8** (route file is WP-B/WP-18-owned, outside shared/) |
| 3 | `serverTime` semantic changed ISO→`HH:MM` (ISO still in `serverAt`); `viewAs` always-emitted vs owner-only; `viewAsState` non-fresh read | Observed, no action — noted for WP-18's surface matrix |
| 4 | `dqBumpCacheVersion_`/`ccStamp_` absent | Dropped-by-design (`stores.ts:1-14`); 0 callers; no staleness window exists |
| 5 | `dqReadObjects_`/`dqRewrite_`/`dqUpsert_`/`dqReadLean_`/`dqMarkRun_` are distributed ports, not `stores.ts` exports | Structural PORTED-AS — names preserved where callers live (`jobs/env.ts`, `cx-queue`, `cx-desk`); centralizing them in `stores.ts` would be misleading (they need a JobEnv) |
| 6 | Sheet-shape helpers (`ensureColumns_`, `headersOf_`, `tableForget_`, `toCellValue_`) | n/a — Postgres schema is fixed by migrations |

## 10. Questions

- `boot.app` is hardcoded `'hub'` — is any cross-app context actually needed
  post-unification, or should the field be dropped from the contract (WP-18)?
- Queue-side `dqMarkRun_` stamping an in-process cache means run-stamps die
  with the instance (unlike desk's config row). Acceptable, or unify on
  `dq_last_*` config writes (one-line change in `cx-queue/lib/jobs.ts:64`)?
  Left in place: reader fix covers parity either way.
