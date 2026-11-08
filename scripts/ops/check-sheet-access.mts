/**
 * check-sheet-access.mts — read-only probe for the shard-80/90 Google gate.
 *
 * Collects every spreadsheet id the migration needs (V2 stores from the Config
 * tab of CC2 Core, tracker registry, scorecard months, plus ids hardcoded in
 * legacy code), then asks the Sheets API for each one's title. A successful
 * spreadsheets.get proves the service account can see it (i.e. it is shared);
 * a 403/404 means it is not shared with GOOGLE_SERVICE_ACCOUNT_EMAIL.
 *
 * Run:  npx tsx scripts/ops/check-sheet-access.mts
 * Auth: service-account JSON key via GOOGLE_APPLICATION_CREDENTIALS or
 *       scripts/../cx-kpis-*.json next to package.json; falls back to
 *       GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY env vars.
 */
import { google } from 'googleapis'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

dotenv.config({ path: '.env.pulled' })
dotenv.config({ path: '.env.production' })

// Prefer a service-account JSON key file (gitignored). Env-var creds are the
// fallback for environments where only the split vars exist.
const keyFile =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  fs.readdirSync(ROOT)
    .filter((f) => /\.iam\.gserviceaccount\.com\.json$|^cx-kpis-.*\.json$|^service-account.*\.json$/.test(f))
    .map((f) => path.join(ROOT, f))[0]

const auth = keyFile
  ? new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
  : new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
const sheets = google.sheets({ version: 'v4', auth })

// CC2 Core — from MIGRATION_READINESS.md (GOOGLE_SHEET_ID is env-only/sensitive).
const CORE_ID = process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SHEET_ID !== '[SENSITIVE]'
  ? process.env.GOOGLE_SHEET_ID
  : '1PdDr3J5JECemwPAcf5sCy8b8ivZ5C6hBxBsso1bZVGs'
const ID_RE = /^[A-Za-z0-9_-]{25,}$/

// Ids hardcoded in legacy code / migration route (label -> id)
const HARDCODED: Record<string, string> = {
  'CC2 Quality (store)': '1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w',
  'CC2 Productivity (store)': '1h77da05ZjlxjGCArlr1tGJv7OEtmemFGde8sBnitc-g',
  'QA form responses — Voice QA Form V1': '1bna3_kNAxdaS2dPJUMTTw75NKQiwAN6NJVbxRxPKeqA',
  'QA form responses — Texting QA Form V1': '1BNzinvWZ_1qm5QZX-Thqk0oR3CvfkNMnJ7TPi1_wy6k',
  'Tracker — Blocked customers': '1KFC6ENFbQWPmRSziH9gLsBQED1hnh_e9ZknsjwruPEA',
  'Tracker — Promocodes': '1GsBilEGkmXqBSgmiv4jM5UHWPeW0_DpdmBVA3L1zgTw',
  'Tracker — Operational loss': '12jVdX8CziY9sS_AVd1kZJEnRp82I3YFLXSCUuu_e5Uc',
  'Tracker — Customer strikes': '1Odij24BsYeukoqdGXOmqnVq36SL7s-8pFR9Jpz3OMmQ',
  'Tracker — Refund calculator backend': '1ZaJnCVOmZF42KAYpd3YwDrsr1gY7fIEwTxUeAESgGU8',
  'Read-only — touch archive': '1qch1vaZP2xaiQQ3k0FFhWLGJ4gVL0i7Zx_vbX3jG_-A',
  'Read-only — daily report': '1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4',
  'Read-only — productivity workbook (fallback)': '1I29yjZ2XaX5yJnnHgKLxthBsKfSgBrK7aCRfafniuVI',
  'Read-only — Freshdesk activity log': '1Fc6VCk8bLmy8ZUMCeBDPHvu7dMWDtONn6CRd9H_aHzM',
  'Read-only — roster master (Egypt Operations HCT)': '1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw',
  'Read-only — Freshchat messages (fc_messages)': '1ZxDxS13pu0xXS3aPBfXxajtodwKIndaF0NOjZv6xacM',
  'Read-only — Freshdesk Database (QE engine source)': '1VtBT8kIIhK7PxKYJJQlnhxNtmz17ewhkWtpUt8jiB4s',
}

const candidates = new Map<string, string[]>() // id -> labels
const add = (id: string | undefined | null, label: string) => {
  const v = String(id || '').trim()
  if (!ID_RE.test(v)) return
  const list = candidates.get(v) || []
  if (!list.includes(label)) list.push(label)
  candidates.set(v, list)
}

async function readTab(ssId: string, tab: string): Promise<string[][]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ssId,
    range: `'${tab.replace(/'/g, "\\'")}'!A:ZZ`,
  })
  return (res.data.values || []) as string[][]
}

async function main() {
  if (!CORE_ID) {
    console.error('GOOGLE_SHEET_ID is not set — cannot read the CC2 Core Config tab.')
    process.exit(1)
  }
  add(CORE_ID, 'CC2 Core (GOOGLE_SHEET_ID)')
  for (const [label, id] of Object.entries(HARDCODED)) add(id, label)

  // --- Config tab of CC2 Core: store ids + workbook maps ---
  let configRows: string[][] = []
  try {
    configRows = await readTab(CORE_ID, 'Config')
  } catch (e) {
    console.error(`Cannot read Config tab of CC2 Core (${CORE_ID}): ${(e as Error).message}`)
    console.error('=> CC2 Core itself is NOT shared with the service account. Every other lookup below is limited to hardcoded ids.')
  }

  const cfg = new Map<string, string>()
  if (configRows.length > 1) {
    const head = configRows[0].map((h) => String(h).trim().toLowerCase())
    const ki = head.indexOf('key')
    const vi = head.indexOf('value')
    for (const r of configRows.slice(1)) {
      if (ki >= 0 && vi >= 0 && r[ki]) cfg.set(String(r[ki]).trim(), String(r[vi] ?? '').trim())
    }
  }

  // store ids + any config value that is a bare spreadsheet id
  for (const [key, val] of cfg) {
    if (ID_RE.test(val) && /(^ss_.*_id$|_ss_id$|spreadsheet_id$|workbook|sheet)/i.test(key)) {
      add(val, `Config.${key}`)
    }
  }

  // productivity_files: { "yyyy-MM": "<workbook id>" }
  try {
    const pf = JSON.parse(cfg.get('productivity_files') || '{}') as Record<string, string>
    for (const [month, id] of Object.entries(pf)) add(id, `Config.productivity_files[${month}]`)
  } catch { /* not JSON / absent */ }

  // --- Trackers tab (CC2 Core): external tracker spreadsheets ---
  try {
    const tRows = await readTab(CORE_ID, 'Trackers')
    if (tRows.length > 1) {
      const head = tRows[0].map((h) => String(h).trim().toLowerCase())
      const ni = head.indexOf('name')
      const si = head.indexOf('storage_mode')
      const idi = head.indexOf('spreadsheet_id')
      const ti = head.indexOf('tab_name')
      for (const r of tRows.slice(1)) {
        if (si >= 0 && String(r[si]).toLowerCase() !== 'external') continue
        add(r[idi], `Tracker "${r[ni] || '?'}" (tab ${r[ti] || '?'})`)
      }
    }
  } catch (e) {
    console.log(`(Trackers tab not readable: ${(e as Error).message})`)
  }

  // --- sc_months tab in CC2 Live: scorecard workbook ids ---
  const liveId = cfg.get('ss_live_id') || ''
  if (ID_RE.test(liveId)) {
    try {
      const mRows = await readTab(liveId, 'sc_months')
      if (mRows.length > 1) {
        const head = mRows[0].map((h) => String(h).trim().toLowerCase())
        const mi = head.indexOf('month')
        const wi = head.indexOf('workbook_id')
        const ti = head.indexOf('title')
        for (const r of mRows.slice(1)) {
          add(r[wi], `sc_months ${r[mi] || '?'} — ${r[ti] || ''}`.trim())
        }
      }
    } catch (e) {
      console.log(`(sc_months not readable in CC2 Live: ${(e as Error).message})`)
    }
  } else {
    console.log('(no ss_live_id in Config — sc_months workbook ids not collected)')
  }

  // --- Probe every candidate ---
  let saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ''
  if (keyFile) {
    try { saEmail = String(JSON.parse(fs.readFileSync(keyFile, 'utf8')).client_email || saEmail) } catch { /* keep env */ }
  }
  console.log(`\nProbing ${candidates.size} spreadsheet ids as ${saEmail || '(unknown SA)'}\n`)
  const ok: { id: string; title: string; labels: string[] }[] = []
  const bad: { id: string; labels: string[]; err: string }[] = []
  for (const [id, labels] of candidates) {
    try {
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: id,
        fields: 'properties.title',
      })
      ok.push({ id, title: meta.data.properties?.title || '(untitled)', labels })
    } catch (e) {
      const err = e as { code?: number; message?: string }
      bad.push({ id, labels, err: `${err.code ?? ''} ${err.message ?? String(e)}`.trim() })
    }
  }

  console.log('=== SHARED / READABLE ===')
  for (const s of ok) {
    console.log(`OK   ${s.id}  "${s.title}"`)
    for (const l of s.labels) console.log(`       <- ${l}`)
  }
  console.log('\n=== NOT SHARED / UNREADABLE ===')
  for (const b of bad) {
    console.log(`FAIL ${b.id}  (${b.err})`)
    for (const l of b.labels) console.log(`       <- ${l}`)
  }
  console.log(`\n${ok.length} readable, ${bad.length} not shared.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
