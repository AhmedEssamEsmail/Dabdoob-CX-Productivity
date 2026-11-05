import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: mn } = await sb.from('prod_intervals').select('date').order('date', { ascending: true }).limit(1)
  const { data: mx } = await sb.from('prod_intervals').select('date').order('date', { ascending: false }).limit(1)
  console.log('prod_intervals range:', mn?.[0]?.date, '..', mx?.[0]?.date)
  const { data: rows } = await sb.from('prod_intervals').select('date').limit(30000)
  const perMonth: Record<string, number> = {}
  ;(rows || []).forEach((r) => {
    const m = String(r.date).slice(0, 7)
    perMonth[m] = (perMonth[m] || 0) + 1
  })
  console.log('per month:', JSON.stringify(perMonth, null, 0))
}
main().catch((e) => console.error(e))
