import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { qaWhen_ } from '@/features/cx-quality/lib/core'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const rows = [] as { interaction_at: string }[]
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('qa_audits').select('interaction_at').gte('audit_date', '2026-06-01').range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data as { interaction_at: string }[]))
    if (!data || data.length < 1000) break
  }
  const bad: Record<string, number> = {}
  const samples: string[] = []
  rows.forEach((r) => {
    const s = String(r.interaction_at || '').replace(/^'/, '')
    const n = qaWhen_(s)
    if (!/^\d{4}-\d{2}-\d{2}/.test(n)) {
      const shape = s.replace(/\d/g, '#').slice(0, 40)
      bad[shape] = (bad[shape] || 0) + 1
      if (samples.length < 25 && s) samples.push(JSON.stringify(s))
    }
  })
  console.log('unparseable shapes:', JSON.stringify(bad, null, 1))
  console.log('samples:', samples.join(' | '))
}
main().catch((e) => console.error(e))
