import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { fetchWorkbookTabs } from '@/features/shared/jobs/sheets'

const SS_QUALITY = '1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w'

function sheetDate(v: unknown): string {
  const s = String(v === undefined || v === null ? '' : v).replace(/^'/, '').trim()
  const m = /(\d{4}-\d{2}-\d{2})/.exec(s)
  if (m) return m[1]
  const d = new Date(s)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

async function main() {
  const tabs = await fetchWorkbookTabs(SS_QUALITY, ['qa_audits'])
  const rows = tabs['qa_audits'] || []
  const head = (rows[0] || []).map((h) => String(h || '').trim())
  const iId = head.indexOf('audit_id')
  const iDate = head.indexOf('audit_date')
  const iSub = head.indexOf('submitted_at')
  const iEmail = head.indexOf('agent_email')
  const iAud = head.indexOf('auditor_email')
  console.log('sheet qa_audits rows (incl header):', rows.length, 'cols:', { iId, iDate, iSub, iEmail, iAud })
  if (iId < 0) return

  const sheet = rows
    .slice(1)
    .map((r) => ({
      id: String(r[iId] || '').trim(),
      date: sheetDate(r[iDate]),
      sub: sheetDate(r[iSub]),
      agent: String(r[iEmail] || '').trim(),
      auditor: String(r[iAud] || '').trim(),
    }))
    .filter((r) => r.id)
  const ids = new Set(sheet.map((r) => r.id))
  console.log('data rows:', sheet.length, '| distinct audit_ids:', ids.size, '| dupes:', sheet.length - ids.size)
  const dates = sheet.map((r) => r.date || r.sub).filter(Boolean).sort()
  console.log('sheet date range:', dates[0] || '?', '..', dates[dates.length - 1] || '?')

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const dbIds = new Set<string>()
  let dbMax = ''
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('qa_audits')
      .select('audit_id,audit_date')
      .range(from, from + 999)
    if (error) throw error
    ;(data || []).forEach((r) => {
      dbIds.add(String(r.audit_id))
      const d = String(r.audit_date || '').slice(0, 10)
      if (d > dbMax) dbMax = d
    })
    if (!data || data.length < 1000) break
  }
  console.log('db qa_audits rows:', dbIds.size, '| max audit_date:', dbMax)

  const fresh = sheet.filter((r) => !dbIds.has(r.id))
  fresh.sort((a, b) => (b.date || b.sub).localeCompare(a.date || a.sub))
  console.log('\nNEW audits on sheet not in DB:', fresh.length)
  fresh.slice(0, 25).forEach((r) => console.log(' ', r.date || r.sub || 'nodate', r.id, r.agent, 'auditor:' + r.auditor))
}
main().catch((e) => console.error(e))
