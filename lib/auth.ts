import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireRole(allowedRoles: string[]) {
  const user = await requireAuth()
  
  // Get user role from roster table
  const supabase = await createClient()
  const { data: rosterUser } = await supabase
    .from('roster')
    .select('role')
    .eq('email', user.email)
    .single()
  
  const role = rosterUser?.role || 'unknown'
  
  if (!allowedRoles.includes(role)) {
    throw new Error(`Forbidden: Role ${role} not allowed`)
  }
  
  return { ...user, role }
}
