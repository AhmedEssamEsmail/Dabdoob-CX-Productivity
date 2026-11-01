import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  for (const t of ['fd_activities', 'maqsam_calls', 'freshchat', 'agg_inflow_hourly', 'health']) {
    const { data, error } = await sb.from(t).select('*').limit(1)
    console.log(t, '->', error ? `ERR ${error.code} ${error.message}` : `OK ${JSON.stringify(data)}`)
  }
  // intervals real coverage (min/max + per-month counts)
  const { data: mn } = await sb.from('prod_intervals').select('date').order('date', { ascending: true }).limit(1)
  const { data: mx } = await sb.from('prod_intervals').select('date').order('date', { ascending: false }).limit(1)
  console.log('prod_intervals range:', mn?.[0]?.date, '..', mx?.[0]?.date)
  const { data: days } = await sb.from('prod_tph_days').select('date, agent_email').limit(50)
  console.log('prod_tph_days sample:', JSON.stringify(days?.slice(0, 10)))
  const { data: ch } = await sb.from('config').select('value').eq('key', 'prod_channel_status').single()
  const { data: chs } = await sb.from('config').select('value').eq('key', 'tph_channels').single()
  console.log('prod_channel_status:', JSON.stringify(ch?.value))
  console.log('tph_channels:', JSON.stringify(chs?.value).slice(0, 400))
}

main().catch((e) => console.error(e))
