/**
 * qa-ctls-check.ts — probe the daily_report workbook's 'CTL & Quality' tab,
 * report distinct 'Coached?' values, and diff sheet-done CTLs vs qa_ctls.
 *
 * Reads via googleapis directly (not readSheet): the tab is NOT in the
 * sheets-freeze allowlist — this is an ops recon/sync tool, app runtime
 * stays frozen. Run: npx tsx --tsconfig scripts/tsconfig.json scripts/ops/qa-ctls-check.ts
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

const DAILY_REPORT = '1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4'

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: DAILY_REPORT,
    range: `'CTL & Quality'!A:ZZ`,
  })
  const rows = (res.data.values || []) as unknown[][]
  const head = (rows[0] || []).map((h, i) => `${i}:${String(h || '').trim()}`)
  console.log('rows (incl header):', rows.length)
  console.log('headers:', head.filter((h) => !/:\s*$/.test(h)).join(' | '))

  const h = (rows[0] || []).map((c) => String(c || '').trim().toLowerCase())
  const iCall = h.indexOf('call id')
  const iCoached = h.indexOf('coached?')
  const iEmail = h.indexOf('agent email')
  const iOpened = h.indexOf('date only (ctl)')
  const iCtlDate = h.indexOf('ctl date')
  console.log('cols:', { iCall, iCoached, iEmail, iOpened, iCtlDate })

  const vals: Record<string, number> = {}
  const done: { call: string; coached: string; email: string; ctlDate: string }[] = []
  rows.slice(1).forEach((r) => {
    const call = String(r[iCall] || '').trim()
    if (!call) return
    const c = String(r[iCoached] || '').trim()
    vals[c === '' ? '(empty)' : c] = (vals[c === '' ? '(empty)' : c] || 0) + 1
    if (c && c !== 'Pending') {
      done.push({ call, coached: c, email: String(r[iEmail] || '').trim(), ctlDate: String(r[iCtlDate] || '').trim() })
    }
  })
  console.log('\nCoached? value counts:', JSON.stringify(vals, null, 1))
  console.log('done rows:', done.length)
  done.slice(0, 15).forEach((d) => console.log(' ', d.call, '|', d.coached, '|', d.email, '| ctlDate', d.ctlDate))

  // db side
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const dbRows: { ctl_id: string; audit_id: string; status: string; agent_email: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('qa_ctls').select('ctl_id,audit_id,status,agent_email').range(from, from + 999)
    if (error) throw error
    dbRows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  const stat: Record<string, number> = {}
  dbRows.forEach((r) => { stat[r.status] = (stat[r.status] || 0) + 1 })
  console.log('\ndb qa_ctls rows:', dbRows.length, '| status counts:', JSON.stringify(stat))

  const byCtl = new Map(dbRows.map((r) => [r.ctl_id, r]))
  const byAudit = new Map(dbRows.filter((r) => r.audit_id).map((r) => [r.audit_id, r]))
  let matchOpen = 0, matchOther = 0, noMatch = 0
  const otherVals: Record<string, number> = {}
  done.forEach((d) => {
    const row = byCtl.get('hist-' + d.call) || byAudit.get(d.call)
    if (!row) { noMatch++; return }
    if (row.status === 'open') matchOpen++
    else { matchOther++; otherVals[row.status] = (otherVals[row.status] || 0) + 1 }
  })
  console.log('sheet-done vs db: open-pending update:', matchOpen, '| already non-open:', matchOther, JSON.stringify(otherVals), '| no db row:', noMatch)
}
main().catch((e) => console.error(e))
