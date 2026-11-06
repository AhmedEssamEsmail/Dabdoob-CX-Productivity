# Credentials audit — WP-34 (2026-11-06)

> Env-var sync `.env.production` → `.env.local` + non-destructive vendor probes + service-account scope record.
> **No secret values appear in this doc** — every value is masked as `***` + length, or omitted.

## 0. Headline finding — `.env.production` is value-redacted

`.env.production` and `.env.pulled` are Vercel CLI pulls. **Every Google/vendor value in them is the literal placeholder `[SENSITIVE]` (len 11)** — Vercel marks these env vars *Sensitive*, so `vercel env pull` writes the name but redacts the value. The B2 env-audit line "real keys exist in the repo's production env" is therefore only half true: **key names exist; real values do not exist anywhere in the repo** (except the gitignored SA JSON key file, below).

Consequence: the vendor keys could **not** be copied — writing `[SENSITIVE]` into `.env.local` would be worse than absent: code checks `!!process.env.X_KEY` and would fire real API calls with garbage credentials (401 storms) instead of the designed honest `skipped: not configured` runs. Placeholder values were deliberately **not** copied; the gap is recorded per-var below.

The one real credential in the repo is the gitignored SA key file `cx-kpis-513312-62811753ea9c.json` (real PEM, `client_email` = `migration-reader@cx-kpis-513312.iam.gserviceaccount.com`) — used to populate `.env.local`'s Google vars with working values.

## 1. `.env.local` after sync (keys only — all appended, nothing overwritten)

Before: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_OIDC_TOKEN` (untouched).

Appended (6 keys + comments):

| Key | Value source | Secret? |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | SA JSON `client_email` (`migration-reader@…`) — already public in `sheet-access.md` | no |
| `GOOGLE_PROJECT_ID` | SA JSON `project_id` (`cx-kpis-513312`) | no |
| `GOOGLE_SHEET_ID` | CC2 Core id `1PdDr3J5JECemwPAcf5sCy8b8ivZ5C6hBxBsso1bZVGs` — already published in `sheet-access.md` | no |
| `GOOGLE_APPLICATION_CREDENTIALS` | relative path `cx-kpis-513312-62811753ea9c.json` (script/tooling convenience) | no |
| `GOOGLE_PRIVATE_KEY` | real PEM extracted from the SA JSON key file (`***` len 1704), `\n`-escaped, double-quoted — verified `BEGIN/END PRIVATE KEY` round-trip through dotenv | **yes — gitignored** |
| `FRESHDESK_DOMAIN` | `dabdoobapp.freshdesk.com` — non-secret; matches code default (`settings.ts:64`) and WP-34 probe URL | no |

Deliberately **not** appended (real values unobtainable — Vercel-Sensitive redacted; a placeholder would corrupt honest degradation): `FRESHDESK_API_KEY`, `FRESHCHAT_API_KEY`, `FRESHCHAT_DOMAIN`, `MAQSAM_API_KEY`, `MAQSAM_API_SECRET`, `MAQSAM_DOMAIN`, `MIGRATION_SECRET_KEY`.

Env-var auth path verified live: `spreadsheets.get(GOOGLE_SHEET_ID)` via `GOOGLE_SERVICE_ACCOUNT_EMAIL`+`GOOGLE_PRIVATE_KEY` → **"CC2 Core", 34 tabs**. This is the exact cred path `migration/migrate-lib.ts`, `migration/validate.ts`, `shared/jobs/sheets.ts` (`sheetCreds`) and `app/api/admin/migrate` use — WP-35 dry-run is credentialed end-to-end.

## 2. Credential matrix — status / probe / what it unblocks

| Credential | In `.env.production` | In `.env.local` now | Probe result | Unblocks |
|---|---|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | name only (`[SENSITIVE]`) | ✅ real | SA auth OK — see §3 | WP-35, WP-51, WP-52 (G1/G5/G6/G8), local sheet reads |
| `GOOGLE_PRIVATE_KEY` | name only | ✅ real (from SA JSON) | `spreadsheets.get` → CC2 Core OK | same |
| `GOOGLE_PROJECT_ID` | name only | ✅ `cx-kpis-513312` | — | tooling/docs |
| `GOOGLE_SHEET_ID` | name only | ✅ CC2 Core | metadata GET OK | migrate route + CLI |
| `GOOGLE_APPLICATION_CREDENTIALS` | absent | ✅ path → SA JSON | `check-sheet-access.mts` used it | scripts |
| `FRESHDESK_API_KEY` | name only | ❌ absent | `GET /api/v2/tickets?per_page=1` → **401** (host up, auth wall; key unverifiable) | still needed for local `freshdesk_sync`, `qeFdFillMissingDetail_`, esc_sightings → B3 |
| `FRESHDESK_DOMAIN` | name only | ✅ `dabdoobapp.freshdesk.com` | host resolves + 401 auth wall | cosmetic (code reads `config.freshdesk_domain`) |
| `FRESHCHAT_API_KEY` | name only | ❌ absent | `GET dabdoob.freshchat.com/v2/conversations` → **401** (expected fail — key absent per WP spec; tenant host responds, plausible correct) | WP-53, WP-F2 (texting pairs), `fc_messages` → B3 |
| `FRESHCHAT_DOMAIN` | name only | ❌ absent | `dabdoob.freshchat.com` reached 401 — likely tenant, unconfirmed vs `dabdoobapp.*` | WP-53 |
| `MAQSAM_API_KEY` / `MAQSAM_API_SECRET` | names only | ❌ absent | — (no creds to test) | `maqsam_calls` mirror, `tlp_*`, `jobTlQueueMetrics` → B3 |
| `MAQSAM_DOMAIN` | name only | ❌ absent | guess `api.dabdoob.maqsam.com` → **DNS NXDOMAIN**; `api.mq.maqsam.com` → **401** (Maqsam API infra reachable — real `base_url` needed) | same |
| `MIGRATION_SECRET_KEY` | `.env.pulled` name only | ❌ absent | route `checkAdminAuth` fail-closes without it — correct | needed **only** for HTTP `/api/admin/migrate`; CLI `migration/*` reads `.env.local` and is unaffected |
| `CRON_SECRET` | absent everywhere | ❌ absent | — | WP-50 / B5 (unchanged) |

## 3. Service-account scope probe — what the SA can actually do

SA: `migration-reader@cx-kpis-513312.iam.gserviceaccount.com` (project `cx-kpis-513312`, GCP project № 465961358586). Probe: `npx tsx scripts/check-sheet-access.mts` (metadata `spreadsheets.get` per id) + one-off API-list calls.

| Surface | Scope tried | Result | Meaning |
|---|---|---|---|
| Sheets metadata ×22 | `spreadsheets.readonly` | **22/22 readable, 0 fail** (was 19/22 — owner's final 3 shares landed: CC2 Tickets, CC2 Live, CC2 Data 2026) | G6 fully unblocked — every sheet the migration needs is shared |
| `drive.files.list` | `drive.readonly` | **OK — 3 files visible** | Drive API enabled in project; SA sees only files shared to it (G7 needs legacy-attachment shares) |
| `calendar.calendarList` | `calendar.readonly` | **403 — Calendar API disabled in project** | G3 calendar/focus blocks blocked until GCP enables API + share/DwD |
| `gmail.getProfile` | `gmail.readonly` | **403 — Gmail API disabled in project** | G2/G4 (+G3 mail) blocked until API enabled + mailbox share or domain-wide delegation |

Sheet-id inventory comes from the same script — all 22 ids and titles are in `sheet-access.md` (re-probe now shows 22/22).

## 4. Vendor GET probes (all non-destructive, unauthenticated — real keys are Vercel-Sensitive)

| Probe | Call | Result | Interpretation |
|---|---|---|---|
| Freshdesk | `GET https://dabdoobapp.freshdesk.com/api/v2/tickets?per_page=1` | **HTTP 401** (0.78 s) | Host up, endpoint exists, auth wall correct. Key validity unverifiable until real `FRESHDESK_API_KEY` supplied |
| Maqsam base ping | `GET https://api.mq.maqsam.com/v2/calls` | **HTTP 401** | Maqsam API infra reachable; real `MAQSAM_DOMAIN` (`base_url` from Maqsam settings) needed — `api.dabdoob.maqsam.com` does **not** resolve (guess wrong) |
| Freshchat | `GET https://dabdoob.freshchat.com/v2/conversations?items_per_page=1` | **HTTP 401** | Expected fail per WP spec — key absent. Host serves a Freshchat tenant (likely `dabdoob`), domain unconfirmed |

## 5. What's still missing (blocked-register deltas)

- **B3 widened**: not just `FRESHCHAT_API_KEY` — **all vendor values** are Vercel-Sensitive redacted. Owner fix: paste real values into `.env.local` (or temporarily un-flag Sensitive in Vercel → re-pull). Needed: `FRESHDESK_API_KEY`, `FRESHCHAT_API_KEY`+`FRESHCHAT_DOMAIN`, `MAQSAM_API_KEY`+`MAQSAM_API_SECRET`+`MAQSAM_DOMAIN`. Vendor keys **do** work in production (maqsam mirror live per `90-google-access.md`) — this is a local-runs gap only.
- **WP-35**: unblocked for all 22 sheet sources — `.env.local` Google vars verified. Only HTTP-route mode needs `MIGRATION_SECRET_KEY`; CLI dry-run does not.
- **WP-51**: sheet access fully confirmed (22/22). Gate remaining: WP-30/31/32 mappings + WP-33 validator only.
- **WP-52**: G1/G5/G6/G8 unblocked (all sheets readable). G7 partial — Drive API enabled but legacy attachment files need sharing to the SA. G2/G3/G4 still blocked — Gmail+Calendar APIs are **disabled in the GCP project** and need enablement + mailbox share/DwD.
- **WP-53**: still blocked — `FRESHCHAT_API_KEY` absent.
- **B5**: unchanged — `CRON_SECRET` + app URL still absent everywhere.

## 6. Side findings

- `sc_months` tab is no longer empty — now 3 rows (2026-09, 2026-10, 2026-11), all mapping to the Oct-2026 productivity workbook `1I29yjZ2XaX5yJnnHgKLxthBsKfSgBrK7aCRfafniuVI` (probe labels observed this run).
- `MIGRATION_SECRET_KEY` exists in Vercel (name in `.env.pulled`) but is also `[SENSITIVE]`-redacted.
- `check-sheet-access.mts` deprecation noise (`keyFilename` → `auth` ctor) — cosmetic only.
