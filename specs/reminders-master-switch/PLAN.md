# PLAN: reminders-master-switch
Type: feature   Status: draft
Date: 2026-11-08   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
A master switch in the Hub Admin page turns OFF every type of reminder for ALL
users at once: the login pop-up modal ("N REMINDERS"), the in-app 1:1 alerts,
and every scheduled reminder email (missed-1:1, daily digest, meeting
action/pre-read, 15-min 1:1, queue check-in missed, CTL due/overdue).
Backed by one new boolean config key `reminders_enabled` (default true),
editable like any other setting and mirrored by a dedicated toggle block on the
Admin page so it is findable.

## Success criteria
1. `reminders_enabled` appears in Hub Admin > Settings (kind boolean, default
   true) and saving false persists via the existing saveConfigSetting path.
2. Admin page shows a Reminders block with the current state and a one-click
   on/off toggle wired to the same config key.
3. While false: periodic-nag popups (kinds `missed_1on1`, `qa_ctl_due`) are not
   raised; `pendingPopupsFor`/`popupsPoll` return nothing (ALL pending pop-ups
   hidden, including event ones); `oneOnOneAlerts` returns `alerts: []`.
   Event popups (someone pinged you: escalations, swap/help requests, CTL
   confirm/denied, mail_sla_due, coaching_signal) still get created while off
   and resurface on re-enable — they are notifications, not reminders.
   `queue_checkin_missed` popup rows keep writing while off (mail-only dedupe,
   never displayed).
4. While false: `pwSendOnce_` sends no mail, writes the dedupe row with status
   `skipped_off` and returns 'skipped'; the missed-escalation block logs its
   `missed-esc:*` dedupe rows as `skipped_off` without calling sendMail;
   `dqRemindMissedCheckins_` still writes its dedupe popup rows but sends no
   mail; `qaCtlReminders` skips the popup backfill + emails but still marks
   `reminded_date` on due CTLs.
5. While false `runMissedOneOnOneCheck_` still marks schedules missed/excused
   (state marking is not a reminder).
6. Back on true: popups raise/show and reminder emails send again. Nothing
   that fell due while off fires retroactively — every skipped send left a
   dedupe mark (`skipped_off` rows, check-in dedupe popups, `reminded_date`).
   Still-outstanding items remind on the next normal run; event popups queued
   while off resurface.
7. `npx tsc --noEmit` clean; new vitest coverage passes; `npx vitest run` green.

## Scope / Non-goals
In: config default+helper, platform popup/alert gates, reminder-email gates in
cx-people, missed-check-in and CTL-reminder job gates, admin toggle block,
vitest regression test, then `git commit` of these changes only (user asked).
Out: event-driven one-shot emails (escalation_1on1, qa_ctl_not_confirmed,
qa_ctl_denied, qa_dispute*, meeting_summary, assistant_digest, task/mail
notifications) — those are notifications, not reminders; per-kind switches;
resolving/deleting already-pending popup rows; the legacy GAS oracle (new
feature, no parity target).

## Risk flags (y/n)
arch n · db n (reuses `config` table, no migration) · data n · auth n (write
path already `requireRole(['admin'])`, no new endpoint) · external-api n ·
ui y (new Admin block) · perf n · deps n · tests y · docs n · deploy n
Review gates: QA (always) · Security: skip (no new auth surface; admin-only
existing path reused) · Data: skip · Performance: skip · UX/UI: run

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`
e2e: `npm run test:e2e`  security: `npm run test:security`

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Forbidden: package.json/lockfile, .env*, cx-kpis-*.json. One commit only
  because the user asked; no push/deploy (push triggers a Vercel build).
- Verbatim-port style: legacy pw*/dq*/qa* names stay; platform helpers are
  plain camelCase; early-skip returns `{ skipped: 'off' }` shape.
- Next.js 16 differs from training: check node_modules/next/dist/docs/ if
  touching routing/API code (not expected here).
- Config is cached 5 min process-side; tests must bustConfigCache/cacheClear
  between flips. Boolean config rows auto-render an on/off button in Admin >
  Settings via configRows()/configKind().
- `skipped_off` is the established pw_reminder_log status for suppressed sends
  (one-on-one-reminders.ts:107) — reuse it so nothing re-fires on re-enable.

## Research notes
- Reminder surface = 3 delivery paths: (a) `raisePopup` rows shown by
  Popups.tsx via /api/popups + /api/bootstrap pendingPopupsFor +
  home-cards escalation card; (b) in-app soon/start alerts via
  /api/alerts/one-on-one -> oneOnOneAlerts (notify.ts:229); (c) reminder emails
  via pwSendOnce_ (all digest/missed/meeting/oo15 sends) + direct sendMail at
  reminders.ts:147 (missed-esc), jobs.ts:278 (queue_checkin_missed) and
  server.ts:2131 (qa_ctl_reminder via notify()).
- queue_checkin_missed popup rows double as the send dedupe for
  dqRemindMissedCheckins_ — gate the whole job, not just the mail.
- qaEnsureCtlPopups_ backfills qa_ctl_due popups each run — gate inside
  qaCtlReminders so the backfill stops while off and resumes after.
- Admin page (admin-page.tsx): AdminPage already fetches getConfigRows into
  `r`; Dm renders each row — boolean kind gets an instant toggle button.
  Dedicated block should reuse block/block-title/block-text + btn classes.

## Key pointers
- src/features/shared/platform/settings.ts:22-34 — CONFIG_DEFAULTS; add
  `reminders_enabled` + `remindersOn()` helper (pattern: pwOoOn_ at
  cx-people/lib/one-on-one-reminders.ts:34-37).
- src/features/shared/platform/popups.ts:30,61,115 — pendingPopupsFor,
  raisePopup, popupsPoll gates.
- src/features/shared/platform/notify.ts:229-258 — oneOnOneAlerts gate.
- src/features/cx-people/lib/one-on-one-reminders.ts:49-65 — pwSendOnce_ gate.
- src/features/cx-people/lib/reminders.ts:140-171 — missed-esc sendMail wrap.
- src/features/cx-queue/lib/jobs.ts:246-285 — dqRemindMissedCheckins_ early return.
- src/features/cx-quality/lib/server.ts:2121-2156 — qaCtlReminders early return.
- src/features/cx-hub/components/admin-page.tsx:373-422 — AdminPage blocks;
  add Reminders block (uses `r` rows + Ln.saveConfigSetting).
- tests/golden/hub-fakes.ts + tests/platform/settings.test.ts — vitest harness:
  vi.mock supabase+auth modules, hubSetTables({config:[...]}).
