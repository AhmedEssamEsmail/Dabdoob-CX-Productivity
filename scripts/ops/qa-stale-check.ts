import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { qaPeriodOf_, qaWhen_ } from '@/features/cx-quality/lib/core'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
function weekOf(d: string) { return qaPeriodOf_(d, 'week', 0) }
function iDate(v: unknown): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(qaWhen_(String(v ?? '').replace(/^'/, '')))
  return m ? m[1] : ''
}
async function main() {
  const { data, error } = await sb
    .from('qa_audits')
    .select('audit_id,agent_email,interaction_at,audit_date,submitted_at,updated_at,updated_by,source,status')
    .eq('agent_email', 'abdelsamad.mohamed@dabdoob.com')
    .gte('audit_date', '2026-08-01')
  if (error) throw new Error(error.message)
  const rows = (data || []) as Record<string, string>[]
  const targets = ['2026-09-06', '2026-09-13', '2026-09-20', '2026-10-11', '2026-10-18']
  rows.forEach((r) => {
    const w = weekOf(iDate(r.interaction_at) || String(r.audit_date).slice(0, 10))
    if (!targets.includes(w)) return
    const edited = String(r.updated_at || '').slice(0, 10) > String(r.submitted_at || '').slice(0, 10)
    console.log(w, '| iat:', String(r.interaction_at).slice(0, 22).padEnd(24), '| adate:', r.audit_date, '| sub:', String(r.submitted_at).slice(0, 10), '| upd:', String(r.updated_at).slice(0, 10), edited ? '*EDITED*' : '', '| by:', r.updated_by)
  })
}
main().catch((e) => console.error(e))
