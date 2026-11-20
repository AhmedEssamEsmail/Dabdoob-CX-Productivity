/**
 * qa-ctls-sync.ts — pull CTL status forward from the two gsheet stores.
 *
 * Source 1: daily_report 'CTL & Quality' — rows where Coached? is any value
 *   except 'Pending'/empty advance matching qa_ctls rows (hist-<Call ID> or
 *   audit_id match) to the verbatim sheet value.
 *
 * Source 2: quality workbook 'qa_ctls' tab — the legacy app's CTL store,
 *   same schema as the table (CTL_* ids). Forward-only advance by status
 *   rank open < submitted < confirmed: a sheet row updates the db row only
 *   when it is strictly ahead; 'on_hold'/'cancelled' db rows are never
 *   touched. All sheet columns are copied verbatim (timestamps kept only
 *   when ISO-shaped, reopen_count parsed).
 *
 * Reads via googleapis directly: neither tab is in the sheets-freeze
 * allowlist; this is an ops sync tool and app runtime stays frozen.
 *
 * Run: npx tsx --tsconfig scripts/tsconfig.json scripts/ops/qa-ctls-sync.ts
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { google, type sheets_v4 } from 'googleapis'

const DAILY_REPORT = '1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4'
const SS_QUALITY = '1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w'
const APP_ADVANCED = new Set(['submitted', 'confirmed', 'on_hold', 'cancelled'])
const RANK: Record<string, number> = { open: 0, submitted: 1, confirmed: 2 }
const TS_COLS = new Set(['submitted_at', 'agent_confirmed_at', 'reopened_at', 'updated_at'])

async function fetchTab(sheets: sheets_v4.Sheets, id: string, tab: string): Promise<unknown[][]> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `'${tab}'!A:ZZ` })
  return (res.data.values || []) as unknown[][]
}

async function loadDb(sb: SupabaseClient): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('qa_ctls').select('*').range(from, from + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

async function upsert(sb: SupabaseClient, updates: Record<string, unknown>[]): Promise<number> {
  let n = 0
  for (let i = 0; i < updates.length; i += 500) {
    const { error } = await sb.from('qa_ctls').upsert(updates.slice(i, i + 500), { onConflict: '"ctl_id"' })
    if (error) throw new Error(`qa_ctls upsert rows ${i}: ${error.message}`)
    n += Math.min(500, updates.length - i)
  }
  return n
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const dbRows = await loadDb(sb)
  const byCtl = new Map(dbRows.map((r) => [String(r.ctl_id), r]))
  const byAudit = new Map(dbRows.filter((r) => r.audit_id).map((r) => [String(r.audit_id), r]))
  const now = new Date().toISOString()
  let total = 0

  // ---- Source 1: daily_report 'CTL & Quality' (Coached? -> status verbatim)
  {
    const rows = await fetchTab(sheets, DAILY_REPORT, 'CTL & Quality')
    const h = (rows[0] || []).map((c) => String(c || '').trim().toLowerCase())
    const iCall = h.indexOf('call id'), iCoached = h.indexOf('coached?')
    const done = new Map<string, string>()
    rows.slice(1).forEach((r) => {
      const call = String(r[iCall] || '').trim()
      const c = String(r[iCoached] || '').trim()
      if (call && c && c !== 'Pending') done.set(call, c)
    })
    const updates: Record<string, unknown>[] = []
    let alreadyDone = 0, kept = 0, noMatch = 0
    for (const [call, coached] of done) {
      const row = byCtl.get('hist-' + call) || byAudit.get(call)
      if (!row) { noMatch++; continue }
      const st = String(row.status)
      if (APP_ADVANCED.has(st) || st === coached) {
        if (st === coached) alreadyDone++
        else kept++
        continue
      }
      updates.push({ ...row, status: coached, updated_at: now, updated_by: 'sheet-sync' })
    }
    const n = await upsert(sb, updates)
    total += n
    console.log(`[CTL & Quality] sheet done: ${done.size} | updated: ${n} | already done: ${alreadyDone} | app-advanced kept: ${kept} | no db row: ${noMatch}`)
  }

  // ---- Source 2: quality 'qa_ctls' tab (forward-only status advance)
  {
    const rows = await fetchTab(sheets, SS_QUALITY, 'qa_ctls')
    const head = (rows[0] || []).map((c) => String(c || '').trim())
    const iId = head.indexOf('ctl_id'), iSt = head.indexOf('status')
    if (iId < 0 || iSt < 0) throw new Error('qa_ctls tab missing ctl_id/status')
    const updates: Record<string, unknown>[] = []
    let same = 0, downgraded = 0, guarded = 0, noMatch = 0
    const diffs: string[] = []
    rows.slice(1).forEach((r) => {
      const id = String(r[iId] || '').trim()
      const st = String(r[iSt] || '').trim()
      if (!id) return
      const row = byCtl.get(id)
      if (!row) { noMatch++; return }
      const dbSt = String(row.status)
      if (dbSt === 'on_hold' || dbSt === 'cancelled') { guarded++; return }
      if (dbSt === st) { same++; return }
      if ((RANK[st] ?? -1) <= (RANK[dbSt] ?? -1)) { downgraded++; return }
      const out: Record<string, unknown> = { ...row }
      head.forEach((col, i) => {
        if (!col || !(col in out) || col === 'id') return
        let v = r[i] === '' ? null : r[i]
        if (TS_COLS.has(col) && v !== null && v !== undefined && !/^\d{4}-\d{2}-\d{2}/.test(String(v))) v = null
        if (col === 'reopen_count') v = parseInt(String(v ?? ''), 10) || 0
        out[col] = v === undefined ? null : v
      })
      out.updated_at = String(out.updated_at || now)
      updates.push(out)
      diffs.push(`${id} ${dbSt}->${st}`)
    })
    const n = await upsert(sb, updates)
    total += n
    console.log(`[quality qa_ctls] updated: ${n} | same: ${same} | sheet-behind kept: ${downgraded} | protected: ${guarded} | not in db: ${noMatch}`)
    diffs.slice(0, 20).forEach((d) => console.log('  ', d))
  }

  console.log('total updated:', total)
}
main().catch((e) => console.error(e))
