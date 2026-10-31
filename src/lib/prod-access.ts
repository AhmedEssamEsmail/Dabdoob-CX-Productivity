import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * prodScope_ / pwIsManagerOf_ port: who may see or decide a flag.
 * Admin everything; a TL their team (roster tl_email, with the flag's stored tl_email as a
 * fallback when the roster line changed since detection); an agent only their own flags.
 */
export async function flagInScope(
  supabase: SupabaseClient,
  user: { email?: string | null; role: string },
  flag: { agent_email?: string | null; tl_email?: string | null }
): Promise<boolean> {
  const email = String(user.email || '').toLowerCase()
  if (!email) return false
  if (user.role === 'admin') return true

  const agentEmail = String(flag.agent_email || '').toLowerCase()
  if (user.role === 'agent') return agentEmail === email
  if (user.role !== 'tl') return false

  if (String(flag.tl_email || '').toLowerCase() === email) return true
  const { data } = await supabase
    .from('roster')
    .select('tl_email')
    .eq('email', agentEmail)
    .maybeSingle()
  return String(data?.tl_email || '').toLowerCase() === email
}
