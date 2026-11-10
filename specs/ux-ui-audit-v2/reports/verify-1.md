# verify-1 — AUDIT-REPORT.md "Not verified" closure pass

Method: `capture-verify.mjs` + `probe-verify-extra.mjs` (Playwright, e2e admin login,
dev server :3000). In-browser WCAG ratios via getComputedStyle + oklab/color(srgb)
parser (Chrome serializes color-mix tokens as `oklab(...)`). Shots + raw data in
`shots/verify/` (`measurements.json`, `measurements-extra.json`).

## Contrast (all measured, WCAG 2.x ratio vs effective background)

| Item | Result | Numbers |
|---|---|---|
| `--cx-ink-3` real text | **VERIFIED — PASS** | light: worst **5.14:1** across /overview (n=58), /audit-queue (n=346), /my-day, /status-validation, /auth/login; `th` worst 5.63:1; login `.brand-sub` etc. 5.63:1. Dark (`data-theme=dark`): worst **5.10:1**, body ink 14.89:1. Audit est. ~4.2–4.5 **refuted** — actual ≥5.1. |
| `.md-status-blocked` pill | **PARTIAL → token VERIFIED** | Element not rendered today (/my-day shows `md-empty`, no agenda items). Token pair measured: `--cx-status-bad-fg` rgb(179,38,30) on `--cx-status-bad-bg` rgb(251,233,231) = **5.58:1 PASS**. Audit est. ≈4.25 refuted at token level; rendered-element check needs seeded data. |
| `.va-banner-error` on amber | **VERIFIED — PASS** | View-as activated (POST /api/view-as → agent, shot `viewas-banner.png`, restored via DELETE). Banner bg rgb(233,164,18); `.va-banner-text` **6.47:1**. Error span renders inline `color:var(--signal-ink)` rgb(58,42,0) → **6.47:1** (the `.va-banner-error` CSS `bad-fg` is overridden; bad-fg on amber would be 3.05:1 but is not what renders). Audit est. ~4.0 refuted. |

## States & modes

| Item | Result |
|---|---|
| Dark mode | **VERIFIED** — `cx.appearance {theme:'dark'}` → `data-theme="dark"`; shot `overview-dark.png`; ink-3 worst 5.10:1. |
| RTL (ar) | **VERIFIED** — `lang:'ar'` → `html lang=ar dir=rtl`, D() strings swap; no h-scroll at 1440 (docScrollW=1440); shot `overview-rtl-ar.png`. |
| Command palette | **VERIFIED** — Ctrl+K opens `.cpk` dialog with page list; shot `palette-open.png`. |
| View-as banner | **VERIFIED** — see contrast row; banner + picker render; exit restored. |
| AuditForm `.qa-q` | **NOT VERIFIED** — /audit-queue shows "Nothing to do in today's queue" (0 `.qa-workitem`, no Start/Continue buttons in Requested/NonTicket/OffQueue tables); /calibration has no open `myPart` calibrations for admin. Opening the form requires a write (start audit / assign calibration). `.qa-q` alignment remains code-only. |
| 320px reflow | **VERIFIED — /overview FAILS**: `documentElement.scrollWidth=474` vs 320 viewport → page-level h-scroll; `.cx-ladder__seg` children reach right≈379 inside `.cc-chart` (grid min-width blowout — `overflow-x:auto` on `.cc-chart:has(.cx-ladder)` never engages because the box itself is ~474px). `/tph` clean (320=320). Shots `reflow-320-*.png`. |
| /admin @390 height | **VERIFIED — cause found**: scrollHeight **209,051px**. `.kv-row` heights sum 206,796px; top row `qa_engine_settings` = **75,709px** — its `.setting-value` is a 4,204-char JSON blob wrapped by `overflow-wrap:anywhere` into thousands of lines (dd/dt both 75,692px via grid stretch). Not horizontal overflow — vertical wrap explosion on JSON settings values. Shot `admin-390-full.png`, `admin-390-kv.png`. |
| login brand `<img>` | **VERIFIED — REFUTED absence**: `.brand-logo` `/assets/dabdoob-logo.png` loads fine — `complete=true, naturalWidth=640` at first measure AND after 1.5s; earlier absence was capture timing. Shot `login-brand.png`. |
| CHANNEL_LABELS.wa | **VERIFIED (code)**: `pv-shared.tsx:56` → `'waiting address'`, matches `prod_channel_status` setting description. |

## Still open
- `.qa-q` header/cell alignment — needs seeded queue/calibration data or a write; recommend TL seed or accept code-review verdict.
- Rendered `.md-status-blocked` — needs a `blocked` agenda item; token math already passes.

Files: `capture-verify.mjs`, `probe-verify-extra.mjs`, `shots/verify/*` (10 PNGs + 2 JSON).
