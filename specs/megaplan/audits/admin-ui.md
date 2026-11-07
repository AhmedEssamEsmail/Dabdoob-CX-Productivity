# WP-40 — Admin health/jobs UI parity

> Scope: verify the `admin` page tabs cover everything legacy admin had — roster
> editor, settings editor (typed validation incl. `updated_by/at` stamps),
> dropdown choices editor, email log viewer, scheduled jobs/health view
> (`hbRowState_` ok/warn/down/idle + last-15-events + "Awaiting first run"),
> connected apps (read-only per D1), appearance. Oracle: the `Nm` closure +
> deps (`Dm`/`Im`/`Ln`/`Pf`/`Tm`) in `.devin/work/extract/hub/pages/
> admin.closure.js` (pretty) + `admin.js` (isolated entry). Every tab's
> DOM/copy/class vocabulary must match. Companion: `audits/admin-coverage.md`
> (WP-41 — mail log / options / popups sweep).

## §0 — What the legacy `Nm` page actually renders

`Nm` (`admin.closure.js:4899-4957`, `admin.js:1-60`; pages.json deps:
`Dm, Im, Ln, Pf, Ti, Tm, f, he, ht, oo`) mounts inside **`Pf` — the pending
shell** ("Not built yet."), i.e. legacy itself flagged the page as partially
unbuilt. Inside the shell there are exactly **four built blocks**:

| Order | Block | Dep | Legacy source |
|---|---|---|---|
| 1 | "Dropdown choices" — two `oo` editors (`one_on_one.topic` "1:1 topic", `queue.channel` "Channel") | `oo` | `admin.closure.js:4911-4934`, `oo` at `:4777-4897` |
| 2 | "Connected apps" — `Im`, per-app `/exec` URL editor | `Im` | `:4386-4470` |
| 3 | "Appearance" — `Tm`, browser-local `cx.appearance` controls | `Tm` | `:4626-4728` (+ `bm/wm/Em/Mf/iu/Sf/am/bf/ft` `:4500-4624`) |
| 4 | "Settings" — `Dm`/`Pm` editor fed by `getConfigRows`/`saveConfigSetting` | `Dm`/`Pm`/`Am`/`Cm`/`Rm` | `:4208-4283`, `:4127-4206`, `:1-3` |

`Ln` (`:25-38`) = `getBootstrap, getDropdownOptions, addDropdownOption,
getConfig, setConfig, getConfigRows, saveConfigSetting, setAppUrl,
getViewAsPeople, startViewAs, stopViewAs, getViewAsState` — 12 calls, **no
roster, mail-log or health reader**. The registry purpose
("Roster, settings, dropdown choices, email log and scheduled jobs.",
`registry.json:40`) is aspirational: those three surfaces stayed behind `Pf`
in production and were never UI anywhere in the hub bundle (grep-verified —
see §1).

## §1 — Scope verdicts (per enumerated item)

| # | Item (per WP-40 scope) | Verdict | Where it actually lives |
|---|---|---|---|
| 1 | Roster editor | **missing-in-legacy on `Nm`** — coverage verified elsewhere | Legacy roster admin UI is the **people-holidays** page `Ig` (`Vi.rosterAdmin` + "Sync roster from HCT now", `app.pretty.js:4553,4595`); ported verbatim (`people-holidays-page.tsx:209,258,300-381` → `/api/hub/roster`). Scaffold-era `/admin/roster` page exists as a kept-extra (§4). |
| 2 | Settings editor (typed validation, `updated_by/at`) | **parity** | `Dm`/`Pm` verbatim (§2); `saveConfigValue` → `validateConfigValue` typed checks + `updated_by/at` stamps (`settings.ts:335-414,423-431`); `setting-meta` "Changed by X on Y UTC" row identical. Golden: `tests/golden/hub-admin.test.ts` oracle-diffs all config calls incl. every validation error. |
| 3 | Dropdown choices editor | **parity** | `Oo` = verbatim `oo` (`hub-shared.tsx:703-849` vs `:4777-4897`) — select + "Other…" free-text add; the two `Nm` lists unchanged (`admin-page.tsx:385-393`). Chain to `options` table verified in WP-41 §3. |
| 4 | Email log viewer | **missing-in-legacy** — correctly absent | No mail-log UI or `getMailLog`-type fn anywhere in the extract (WP-41 §2). `GET /api/mail-log` kept dormant (admin-gated, `mail_log` id-desc 200). |
| 5 | Scheduled jobs/health view (`hbRowState_` states, last-15 events, "Awaiting first run") | **missing-in-legacy on `Nm`** — health view = the **ecosystem** page, ported | `hbRowState`/`hbCombine`/`hbComputeHealth` verbatim in `health.ts:308-334,357-375,392-459` (idle `awaiting` + ": awaiting first run" `:317-320`; combine note `'Awaiting first run'` `:366-368`; `events.slice(0,15)` `:459`); served by `/api/hub/ecosystem` (admin+tl) → `ecosystem-page.tsx` renders `eco3-s-{ok,warn,down,idle}` tags, "Last run", "Health as of" verbatim. `refresh_log` is read as evidence by `hbEvidence` (`health.ts:466-505`). |
| 6 | Connected apps — **read-only per D1** | **was missing-in-port → FIXED** (§3-A) | Port had the legacy URL editor verbatim; D1 (one deployment) records "Connected apps admin section retained read-only" (`IMPLEMENTATION-TRACKER.md`, `10-hub.md:26`, `70-utilities.md:9`). Now read-only. |
| 7 | Appearance section | **parity** | `Tm` verbatim (§2). |

Plus one in-page copy gap found by the DOM diff and fixed: the `Pf`
`page-purpose` line (§3-B).

## §2 — Per-dep DOM/copy/class parity matrix

`→` = closure line(s) → port line(s). Verdict column: identical DOM structure,
element order, class names and copy unless noted.

| Dep | Legacy | Port | Verdict |
|---|---|---|---|
| `Pf` pending shell | `:4472-4498` — `section.page.page-narrow` > `header.page-head` > `h1#page-title.page-title` + `p.page-purpose`; `div.pending` > `p.pending-line` "Not built yet." + reqs suffix | `admin-page.tsx:260-280` | **match** — port adds `n.reqs &&` guard before `.length` (legacy dereferences bare `n.reqs.length`; identical output for registry `reqs: []`) |
| `Nm` block order + copy | `:4899-4957` | `admin-page.tsx:367-415` | **match** — Pf > Dropdown choices > Im > Appearance > Settings; headings and `block`/`block-title`/`block-text`/`form-grid` vocabulary identical; "Loading settings…" / "Settings did not load: " + `field-error[role=alert]` states identical |
| `oo` dropdown | `:4777-4897` — `field` > `label.field-label` (+`span.req " *"`) > `select.select` ("" placeholder/"Loading choices…", list, `__other__` "Other…") > hint `.field-hint` > `.other-row` (`.input` maxLength 120, "Type the new choice", "Add choice"/"Adding…", "Cancel" `.btn.btn-quiet`) > `.field-error` "Choices did not load: …" | `hub-shared.tsx:703-849` | **match** — incl. focus-on-other, Enter/Esc keys, `addDropdownOption` → `nu()` store broadcast |
| `Im` connected apps | `:4386-4470` — editable `input[type=url]` + "Save link" per app | `admin-page.tsx:213-256` | **intentional divergence (D1)** — same `.block`/`.block-title`/`.form-grid`/`.field`/`.field-label`/`.input` skeleton, inputs `readOnly`, "Not connected yet: links to this app are switched off." hint + ` (this app)` marker kept; Save button, per-app error `<p>` and draft state dropped; block-text rewritten (old copy instructed the /exec edit flow). `setAppUrl` API surface unchanged (§3-A). `Ei.apps` order+titles identical to `APPS` (hub…fcr, `:4313-4359` vs `:201-210`) |
| `Tm` appearance | `:4626-4728` — `.appearance` > fieldset/legend Theme (`.ap-themes` > `.ap-theme` radio + `.ap-swatch[data-t]` + hint), Accent (`.ap-dots` > `.ap-dot` title + colored span), `.ap-check` Reduce transparency/Reduce motion, Language fieldset (`.ap-check[lang]`), hint "Saved in this browser only." | `admin-page.tsx:282-364` (`bm/wm/Em/Mf/iu/Sf/am` `:282-305`) | **match** — same pairs `light/dark/auto`, accents `pine/blue/plum/rust` w/ same hexes, `en`/`ar العربية`, storage key `cx.appearance`, same defaults object |
| `bf`→`applyAppearance` | `:4526-4529` — data-theme (auto→remove), data-accent (pine→remove), `data-reduce-transparency`, `data-reduce-motion`, `lang`, `dir` rtl/ltr, `queueMicrotask` listeners | `shell/i18n.ts` `applyAppearance` | **match** verbatim |
| `ft`→`D` | `:4621-4624` — `documentElement.lang==='ar' && Mm[n]` + `{key}` interpolation | `shell/i18n.ts` `D` (+ `specs/legacy-parity/data/legacy-i18n-ar.json`) | **match** — `Mm` dict shipped as the ar.json the i18n module loads |
| `Dm` settings editor | `:4208-4283` — `Ft` > `.field.setting-find` (`label.field-label` "Find a setting" for `cfg-find`, `input[type=search]` placeholder "e.g. qa_ or quality") > `.field-hint` "N of M. A change applies here at once and in the other apps within 5 minutes." > `dl.kv` > `.kv-row` > `dt` (`.setting-key` + `.setting-desc?`) + `dd` (`Pm` when editing else `.setting-view` `.setting-value` + boolean→"Set to X"/"Saving…" else "Edit" `.btn.btn-quiet.btn-small` aria-labels) + `.setting-meta` "Changed by U on ISO16 UTC" | `admin-page.tsx:110-198` | **match** — incl. the un-lowercased `key.includes(h)` vs `description.toLowerCase().includes(h)` asymmetry (verbatim quirk) and `Mo`→inline-computed filter |
| `Pm` setting edit form | `:4127-4206` — `form.setting-edit`: boolean→`select.select` (true/false); list/json→`textarea.input.setting-json` (spellCheck off, rows=min(14, lines+1)); else `input.input` (type number/text, step any); JSON `.field-hint` ("A list: [\"a\", \"b\"]." / "An object: {\"key\": \"value\"}."); `.field-error[role=alert]`; `.setting-actions` Save/"Saving…" `.btn.btn-primary.btn-small` + Cancel `.btn.btn-quiet.btn-small` | `admin-page.tsx:38-109` | **match** — incl. `cfg-${key}` ids, `aria-label=key`, `aria-invalid` on error, submit-order `a(!0)`/`c('')`/`Rm` coercion/number NaN guard "${key} is a number." |
| `Am`/`Cm`/`Rm` value fns | `:1-3` — "(empty list)", "(blank)", JSON.stringify(v,null,2) drafts, boolean `e==='true'`, number `trim()===''?NaN:Number` | `admin-page.tsx:21-37` | **match** verbatim |
| `Ln` server surface | `:25-38` — 12 `google.script.run` calls | `hub-shared.tsx:97-115` | **match** — 12/12, mapped to `/api/bootstrap`, `/api/options/[k]` GET+POST, `/api/hub/admin` GET+`{action: setConfig|saveConfig|setAppUrl}`, `/api/view-as{,/people}` DELETE; `GET /api/hub/admin?fn=config` for `getConfig` (`api/hub/admin/route.ts:17-43`, `cx-hub/lib/admin.ts`) |
| `Ti` toast | `:4045-4051` — `Ti(text, tone='ok')` | `Toasts.tsx:22` (`Ti` alias `hub-shared.tsx:676`) | **match** — same call sites: "Topic set to X", "${key} saved", "${key} is now X", app-link toasts (latter removed w/ editor), `Ti(msg,'error')` paths |
| `Ft` | `:5-7` — `n.children` passthrough | `hub-shared.tsx:28` `Fragment` | **match** |
| `Pr`/`_f` boot | `:4370-4383` — module-scoped `mf` | `hub-shared.tsx:674-675` `getBoot`/`setBoot` | **match** — `_f` no longer imported by admin-page (only `Im`'s save used it) |

## §3 — Fixes landed inline

- **A. Connected apps → read-only (D1).** `admin-page.tsx` `Im`
  (`:213-256`): removed draft state, `onInput`, per-app `.field-error` slot,
  "Saving…"/"Save link" button and the `Ln.setAppUrl`/`_f`/`Ti` save path;
  inputs render `readOnly` with the saved URL; block-text now states the
  retired-addresses-are-read-only fact. `setAppUrl` (`admin.ts:59`,
  `POST action=setAppUrl`) and its golden tests stay verbatim — API surface
  parity is kept; only the edit affordance is gone, per the recorded decision.
  Rationale: under one deployment a saved GAS `/exec` URL would repoint
  `appLink`'s dormant cross-app links at the legacy apps — the exact
  misconfiguration D1 read-only exists to prevent.
- **B. `page-purpose` restored.** `/admin/page.tsx` passed
  `route={{title:'Admin'}}` so `Pf`'s `p.page-purpose` rendered empty vs
  legacy's "Roster, settings, dropdown choices, email log and scheduled jobs."
  Now passed verbatim (registry `:52-59`); same fix on the `/` fallback branch
  (`src/app/page.tsx`, `purpose: fallback.purpose`).
- **C. Scaffold pages' dead reads.** `/admin/roster` + `/admin/config`
  (kept-extras per `00-gap-review.md:42`) read `data.roster`/`data.config`
  envelopes that `/api/roster` & `/api/config` never send (they return bare
  arrays) → always-empty tables. Both now accept `Array.isArray(data) ? data
  : envelope`. (`admin/roster/page.tsx:43`, `admin/config/page.tsx:24`)
- **D. `/api/config` PUT → `saveConfigValue`.** Was a raw
  `supabase.from('config').update(...)` — no typed validation, no
  `updated_by/at` stamps, and it could overwrite `admin_emails` without the
  self-lock check. Now routes through `saveConfigValue(key, value, user.email)`
  (`api/config/route.ts:40-54`) — same validation the real settings editor
  uses.

## §4 — Observations (not gaps vs `Nm`; recorded, no WP-F filed)

- **`/admin/{roster,config}` scaffold pages** are documented kept-extras
  (`00-gap-review.md:42`, `route-audit.json:56-57`, WP-41 §5) with no `Nm`
  counterpart — unlinked from the ported page, `cx-*` vocabulary (not
  `block`/`field`). Their route-registry fate is WP-43's sweep; removing or
  nav-linking them is outside `Nm` parity. `/api/roster` writes accept any
  roster column (vs `roster.ts`'s field whitelist) and `/api/config` POST
  inserts arbitrary keys (nothing calls it) — both admin-gated +
  `viewAsGuard`'d; WP-42's write-sweep owns the verdict on their breadth.
- **`EcosystemHealth.events` (last 15)** is computed and shipped identically
  on both sides; neither legacy nor port renders an events list in the DOM —
  no divergence.
- **"Not connected" links** (`appLink` `missing` on blank `app_url_*`,
  `pw.tsx:530-539`) stay dormant as decided (`70-utilities.md` note 7); the
  read-only `Im` keeps them dormant by construction.
- **`Pf` `n.reqs` guard** — port guards `undefined` where legacy would throw;
  output identical for the admin route (`reqs: []`).

## §5 — Gates

- `npx tsc --noEmit` → **0 errors in pre-existing + touched files.** The only
  diagnostics tree-wide are 4 in `tests/golden/viewas-sweep.test.ts` — an
  untracked file created mid-run by parallel WP-42 (`e502e0a5`), not in scope.
  Clean run before that file existed: verified.
- `npx vitest run` → **1061/1061 tests green, 45/45 pre-existing files.** One
  *additional* file (same WP-42 `viewas-sweep.test.ts`) fails at import on
  WP-42's own env/mocks — does not touch the 1061-test suite.
- `npx eslint` on touched files → **clean**:
  `src/features/cx-hub/components/admin-page.tsx`, `src/app/admin/page.tsx`,
  `src/app/page.tsx`, `src/app/admin/roster/page.tsx`,
  `src/app/admin/config/page.tsx`, `src/app/api/config/route.ts`.

Not committed, per WP instructions.
