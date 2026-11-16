import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { qaPeriodOf_ } from '@/features/cx-quality/lib/core'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
function weekOf(d: string) { return qaPeriodOf_(d, 'week', 0) }
const WEEKS = [] as string[]
for (let i = 0; i < 12; i++) {
  const d = new Date(Date.UTC(2026, 7, 30) + i * 7 * 864e5)
  WEEKS.push(d.toISOString().slice(0, 10))
}
async function main() {
  const audits = [] as Record<string, unknown>[]
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('qa_audits').select('agent_email,audit_date').gte('audit_date', '2026-08-01').range(from, from + 999)
    if (error) throw new Error(error.message)
    audits.push(...(data as Record<string, unknown>[]))
    if (!data || data.length < 1000) break
  }
  const per: Record<string, Record<string, number>> = {}
  audits.forEach((a) => {
    const e = String(a.agent_email || '').trim()
    if (!e) return
    const w = weekOf(String(a.audit_date).slice(0, 10))
    if (w < '2026-08-30' || w > '2026-11-15') return
    ;(per[e] = per[e] || {})[w] = ((per[e] || {})[w] || 0) + 1
  })
  console.log('=== COUNTA by audit_date ===')
  console.log('WEEK       ' + WEEKS.map((w) => w.slice(5)).join('  '))
  Object.keys(per).sort().forEach((e) => {
    console.log(e.padEnd(38), WEEKS.map((w) => String((per[e] || {})[w] || 0).padStart(8)).join(''))
  })
}
main().catch((e) => console.error(e))
