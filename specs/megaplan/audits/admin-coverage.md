# WP-41 — Admin coverage sweep: mail log · options · popups

> Scope: confirm the admin coverage of three surfaces vs the legacy `Nm` closure
> (`.devin/work/extract/hub/pages/admin.closure.js`, `admin.js`) and record a
> per-item verdict: **parity | missing-in-legacy | missing-in-port**.
> Companion to `audits/admin-ui.md` (WP-40); written as its own file to avoid a
> write conflict.

## §0 — What the legacy admin (`Nm`) actually was

`Nm` (`admin.closure.js:4899-4957`, `admin.js:1-60`) renders **only**:

1. `Pf` pending shell — "Not built yet." (route `admin`, narrow).
2. "Dropdown choices" block — two `oo` dropdown editors: `one_on_one.topic`
   ("1:1 topic") and `queue.channel` ("Channel").
3. `Im` — Connected apps (per-app `/exec` URL editors).
4. "Appearance" — `Tm` (browser-local `cx.appearance` controls).
5. "Settings" — `Dm`/`Pm` editor fed by `getConfigRows`/`saveConfigSetting`.

The `Nm` server-fn map (`admin.closure.js:25-38`) is exactly
`getBootstrap, getDropdownOptions, addDropdownOption, getConfig, setConfig,
getConfigRows, saveConfigSetting, setAppUrl, getViewAsPeople, startViewAs,
stopViewAs, getViewAsState` — **no mail-log reader and no popup-management
function**. Sweeping every `*.closure.js` + `app.pretty.js` in `.devin/work/extract/`
for server calls touching mail/popup/options finds only `addDropdownOption`,
`getDropdownOptions`, `popupsPoll`, `searchMyMail` — nothing else. The registry
purpose string ("Roster, settings, dropdown choices, email log and scheduled
jobs.", `admin.closure.js` registry / `registry.json:40`) is aspirational: the
unbuilt blocks stayed behind `Pf` in production.

The port's `AdminPage` (`src/features/cx-hub/components/admin-page.tsx`,
mounted at `src/app/admin/page.tsx`) is a verbatim `Nm` port — same `Pf` shell +
same 4 blocks (WP-10 verified 5/5 hub pages parity).

## §1 — Verdicts

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| (a) | Email-log admin view reads `mail_log` | **missing-in-legacy** (view); port data path verified | §2 |
| (b) | Options editor edits `options` service lists | **parity** | §3 |
| (c) | Popups management (iff legacy had it) | **missing-in-legacy** — correctly absent in port | §4 |

No missing-in-port items → **no WP-F rows filed**.

## §2 — (a) Email log: `missing-in-legacy` view, dormant-but-correct route

**Legacy:** no mail-log UI anywhere. `Nm` has no mail-log block and no
`getMailLog`-type server fn; "MailLog" occurs in the whole extract only as a
copy string in `ctls.closure.js:831` ("The email failed. See MailLog for the
error.") referring admins to the raw Google-Sheets tab. Verdict basis: the
email-log viewer is a feature the legacy admin lacked → the port must not
invent one.

**Port:** `GET /api/mail-log` (`src/app/api/mail-log/route.ts`) exists —
`requireRole(['admin'])` then `readRows('mail_log', { orderBy: 'id',
ascending: false, limit: 200 })` (`repo.ts:127` honours order/limit server-side;
`id` BIGSERIAL desc ≈ `sent_at` desc). It was added by the shell-port commit
`d9b1706` and is **orphaned: nothing in `src/`, `e2e/` or `tests/` fetches it**
(grep-verified). Kept — it is admin-gated, read-only, and reads the right
table; it is the endpoint the unbuilt `Nm` block would have wanted.

**Real-rows check (live DB, service-role read this run):** `mail_log` = **1,580
rows** — matches `migration/counts-post.txt:28` (pre 0 → post 1,580) and
`audits/migration-run.md:111`. Sample of what the route returns (id desc):
id 1580 `2026-11-06T18:11:43Z` to ahmedmohamed@dabdoob.com —
"The 18:30 queue check-in was not submitted", kind `queue_checkin_missed`,
status `blocked`; id 1579 same kind/recipient menna.mekkawy `blocked`; id 1578
ahmed.ismail `sent`. The query returns real, correctly-ordered migrated rows;
only the absent view keeps it from rendering.

**Fix landed inline:** route docstring corrected — it claimed a "MailLog tab
for Admin" that does not exist; now states the route is dormant until a view
exists.

## §3 — (b) Options editor: `parity`

Chain verified end-to-end:

- `Oo` (`hub-shared.tsx:703`+) = verbatim `oo` — select of active choices +
  "Other…" free-text add (`admin.closure.js:4770-4897`).
- `Ln.getDropdownOptions` → `GET /api/options/[listKey]` → `optionsFor(listKey)`
  → `allOptions()` → `readRows('options')` (`options.ts:12` `OPTIONS_TABLE =
  'options'`; active-row filter, sort-then-insertion order, case-insensitive
  dedupe — verbatim `getDropdownOptions_`/`optionsFor_`).
- `Ln.addDropdownOption` → `POST /api/options/[listKey]` → `addOption` →
  `appendRow('options', { list_key, value, sort: null, active: true })`
  (`options.ts:92`) with `assertWritable()` (view-as refusal), `LIST_KEY_RE`,
  120-char cap, "Other" rejection, duplicate-spelling reuse — verbatim
  `addOption_`.
- Admin "Dropdown choices" block edits the same two lists as `Nm`:
  `one_on_one.topic`, `queue.channel` (`admin-page.tsx:409-419` vs
  `admin.closure.js:4921-4933`).

Live DB: `options` = 26 rows across 9 `list_key`s (`person.country`,
`queue.status`, `meeting.cadence`, `qa.channel`, `qa.ctl_action`, `qa.kb_topic`,
`qa.kb_gap_type`, `tracker.customer_strikes.strike_reason`, `qa.audit_type`).
The two demo lists are currently empty — identical to legacy behaviour on an
un-seeded list (dropdown shows placeholder + "Other…"; first typed value seeds
it for everyone). Not a gap.

## §4 — (c) Popups management: `missing-in-legacy` — correctly absent

**Legacy:** no popups-management UI exists. The only popup surface in any
closure is `popupsPoll` (`admin.closure.js:4307` and siblings) — the signed-in
user's *own* pending-popup poll, rendered by the shell as dismissable
notifications. Popups are raised server-side (`popupRaise_`, Popups.js) by
jobs/flows; admins never managed them from a UI.

**Port:** matches — `Popups.tsx` (shell) polls `GET /api/popups` every 60 s →
`popupsPoll(email)`/`pendingPopupsFor` reading the `popups` table
(`popups.ts:115,30`), chime + dismiss, verbatim. No management UI invented.
Live DB: `popups` = 773 rows (job-raised notifications). Per the do-not-invent
rule the port ships nothing more. Verdict **missing-in-legacy**.

## §5 — Observations outside WP-41 verdicts (for WP-40/43)

- `src/app/admin/config/page.tsx` + `src/app/admin/roster/page.tsx` are
  scaffold-era CRUD pages (commit `3f718c3`) with no `Nm`/registry counterpart —
  extra surface, not linked from the ported admin page; routing/parity call
  belongs to WP-40/WP-43.
- `/api/admin/{backfill,list-sheets,migrate,mirrors,source-health}` —
  migration-ops routes, no legacy `Nm` counterpart either (noted for WP-42's
  mutating-route sweep).

## §6 — Gates

- `npx tsc --noEmit` → **0 errors**
- `npx vitest run` → **green** (see tracker evidence)
- `npx eslint src/app/api/mail-log/route.ts` → **clean** (only file touched)

No commit made per WP instructions.
