import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase'

export async function createAuthClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export async function getUser() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireRole(allowedRoles: string[]) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: rosterUser } = await supabase
    .from('roster')
    .select('role')
    .eq('email', user.email)
    .single()
  const role = rosterUser?.role || 'unknown'
  if (!allowedRoles.includes(role)) throw new Error(`Forbidden`)
  return { ...user, role }
}

export async function getViewAsUser(userEmail: string) {
  const supabase = createClient()
  const { data: viewAsRecord } = await supabase
    .from('view_as')
    .select('*')
    .eq('owner_email', userEmail)
    .eq('action', 'start')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  if (viewAsRecord && viewAsRecord.target_email) {
    return viewAsRecord.target_email
  }

  return null
}
