import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@/features/shared/lib/supabase'

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

/**
 * requireRole — the single role gate (legacy requireRole_, Auth.js:80-86).
 * The one implementation lives in platform/identity.ts (currentUser —
 * view-as aware, domain check, admin_emails, active flag, specialist ->
 * agent; legacy denial message). Re-exported here so API routes keep their
 * '@/features/shared/lib/auth' import path; there is no second copy.
 * (It cannot live in this module: the golden tests mock this module down
 * to createAuthClient, so a real export here would be unreachable to the
 * platform/identity consumers the tests exercise.)
 */
export { requireRole } from '@/features/shared/platform/identity'

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
