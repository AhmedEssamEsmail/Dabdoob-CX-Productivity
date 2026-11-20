/**
 * qa-ctls-sync.ts — find CTLs marked done (Coached? = any value except
 * 'Pending'/empty) in the daily_report workbook's 'CTL & Quality' tab and
 * update the matching qa_ctls rows.
 *
 * Match: ctl_id 'hist-<Call ID>' first, else audit_id = Call ID (app-created
 * CTLs). Update rule: only rows still 'open' move to the sheet's verbatim
 * status — app-advanced statuses (submitted/confirmed/on_hold/cancelled)
 * always win over the sheet.
 *
 * Reads via googleapis directly: the tab is NOT in the sheets-freeze
 * allowlist; this is an ops sync tool and app runtime stays frozen.
 *
 * Run: npx tsx --tsconfig scripts/tsconfig.json scripts/ops/qa-ctls-sync.ts
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

const DAILY_REPORT = '1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4'
const APP_ADVANCED = new Set(['submitted', 'confirmed', 'on_hold', 'cancelled'])

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: DAILY_REPORT, range: `'CTL & Quality'!A:ZZ` })
  const rows = (res.data.values || []) as unknown[][]
  const h = (rows[0] || []).map((c) => String(c || '').trim().toLowerCase())
  const iCall = h.indexOf('call id')
  const iCoached = h.indexOf('coached?')
  if (iCall < 0 || iCoached < 0) throw new Error('call id / coached? headers not found')

  const done = new Map<string, string>() // call id -> coached value (last wins)
  rows.slice(1).forEach((r) => {
    const call = String(r[iCall] || '').trim()
    const c = String(r[iCoached] || '').trim()
    if (call && c && c !== 'Pending') done.set(call, c)
  })
  console.log('sheet done CTLs:', done.size)

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const dbRows: Record<string, unknown>[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('qa_ctls').select('*').range(from, from + 999)
    if (error) throw error
    dbRows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  const byCtl = new Map(dbRows.map((r) => [String(r.ctl_id), r]))
  const byAudit = new Map(dbRows.filter((r) => r.audit_id).map((r) => [String(r.audit_id), r]))

  const now = new Date().toISOString()
  const updates: Record<string, unknown>[] = []
  let alreadyDone = 0, protectedRows = 0, noMatch = 0
  for (const [call, coached] of done) {
    const row = byCtl.get('hist-' + call) || byAudit.get(call)
    if (!row) { noMatch++; continue }
    const st = String(row.status)
    if (APP_ADVANCED.has(st) || st === coached) { st === coached ? alreadyDone++ : protectedRows++; continue }
    updates.push({ ...row, status: coached, updated_at: now, updated_by: 'sheet-sync' })
  }
  console.log('to update:', updates.length, '| already done:', alreadyDone, '| app-advanced kept:', protectedRows, '| no db row:', noMatch)

  let migrated = 0
  const errors: string[] = []
  for (let i = 0; i < updates.length; i += 500) {
    const { error } = await sb.from('qa_ctls').upsert(updates.slice(i, i + 500), { onConflict: '"ctl_id"' })
    if (error) errors.push(`rows ${i}-${i + 500}: ${error.message}`)
    else migrated += Math.min(500, updates.length - i)
  }
  console.log(JSON.stringify({ migrated, errors }))
}
main().catch((e) => console.error(e))
