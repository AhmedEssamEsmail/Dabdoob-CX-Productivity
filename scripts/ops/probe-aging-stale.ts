import { createClient } from '@supabase/supabase-js'
require('dotenv').config({ path: '.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const IDS = ['351136', '351351', '351068', '350945']

async function main() {
  const { data: tk, error: e1 } = await sb
    .from('tickets')
    .select('ticket_id,status,group_name,responder_id,created_at,updated_at,resolved_at,closed_at,status_updated_at,synced_at')
    .in('ticket_id', IDS)
  console.log('== tickets =='); console.log(JSON.stringify(tk, null, 1)); if (e1) console.log('ERR', e1.message)

  const { data: ag, error: e2 } = await sb
    .from('aging_open_tickets')
    .select('ticket_id,queue,status,age_h,band,agent_name,refreshed_at')
    .in('ticket_id', IDS)
  console.log('== aging_open_tickets =='); console.log(JSON.stringify(ag, null, 1)); if (e2) console.log('ERR', e2.message)

  const { data: cfg } = await sb
    .from('config')
    .select('key,value')
    .in('key', ['v2_fd_inc_cursor', 'v2_fd_full_cursor', 'v2_fd_sync_running', 'open_statuses', 'actionable_statuses', 'freshdesk_domain', 'aging_bands_h'])
  console.log('== config =='); console.log(JSON.stringify(cfg, null, 1))

  const { data: log } = await sb
    .from('refresh_log')
    .select('job,started_at,finished_at,rows_in,rows_out,status,error,note,source_cursor')
    .in('job', ['freshdesk_sync', 'freshdesk_full_sync', 'queue_aggregates'])
    .order('started_at', { ascending: false })
    .limit(15)
  console.log('== refresh_log =='); console.log(JSON.stringify(log, null, 1))

  const { count } = await sb.from('aging_open_tickets').select('*', { count: 'exact', head: true })
  console.log('aging rows total:', count)
}
main().catch((e) => console.error(e))
