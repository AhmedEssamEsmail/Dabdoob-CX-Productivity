import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { qaRollupAudits_, qaPeriodOf_, qaWhen_ } from '@/features/cx-quality/lib/core'
import { qaScoreDate_, qaScoreKnown_, qaSampleBasis_ } from '@/features/cx-quality/lib/analytics'
import { normEmail_ } from '@/features/shared/lib/adapters'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function weekOf(d: string) { return qaPeriodOf_(d, 'week', 0) }
function sheetDate(v: unknown): string {
  const s = String(v === undefined || v === null ? '' : v).replace(/^'/, '')
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(qaWhen_(s)) || /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return m ? m[1] : ''
}

async function main() {
  const audits = [] as Record<string, unknown>[]
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('qa_audits')
      .select('audit_id,kind,queue_id,agent_email,interaction_at,audit_date,status,score,score_final,source,sample_basis,audit_type')
      .gte('audit_date', '2026-06-01').range(from, from + 999)
    if (error) throw new Error(error.message)
    audits.push(...(data as Record<string, unknown>[]))
    if (!data || data.length < 1000) break
  }

  // Replicate qaRollupAudits_ exclusion to attribute each row
  const rolled = new Set(qaRollupAudits_(audits).map((a) => String(a.audit_id)))
  const W0 = '2026-08-30', W1 = '2026-11-15'
  type Cnt = Record<string, number>
  const per: Record<string, Record<string, Cnt>> = {}
  const bump = (e: string, w: string, k: string) => {
    if (w < W0 || w > W1) return
    const c = ((per[e] = per[e] || {})[w] = per[e][w] || {})
    c[k] = (c[k] || 0) + 1
  }
  audits.forEach((a) => {
    const e = normEmail_(a.agent_email)
    if (!e) return
    const rawD = sheetDate(a.interaction_at)
    const rawW = rawD ? weekOf(rawD) : '(nodate)'
    const appW = weekOf(qaScoreDate_(a, 'interaction'))
    let why: string
    if (!rolled.has(String(a.audit_id))) why = 'rollup(kind/voided/disputed)'
    else if (!qaScoreKnown_(a)) why = 'blank-score'
    else {
      const b = qaSampleBasis_(a)
      if (b !== 'random' && b !== 'historical') why = 'basis:' + b
      else why = 'counted'
    }
    // attribute the row to its RAW pivot week with its exclusion reason;
    // if it moved weeks via audit_date fallback, note that too
    bump(e, rawW === '(nodate)' ? rawW : rawW, why + (rawW !== appW ? ` ->appW:${appW}` : ''))
  })

  Object.keys(per).sort().forEach((e) => {
    console.log('\n' + e)
    Object.keys(per[e]).sort().forEach((w) => {
      const c = per[e][w]
      const parts = Object.keys(c).sort().map((k) => `${k}=${c[k]}`)
      console.log('  ' + w + '  ' + parts.join('  '))
    })
  })
}
main().catch((e) => console.error(e))
