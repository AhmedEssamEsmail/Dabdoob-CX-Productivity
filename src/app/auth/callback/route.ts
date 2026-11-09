import { createAuthClient } from '@/features/shared/lib/auth'
import { normEmail, roleForEmail } from '@/features/shared/platform/identity'
import { NextResponse } from 'next/server'

function loginRedirect(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/auth/login?error=${error}`, request.url))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  if (url.searchParams.get('error') || !code) {
    return loginRedirect(request, 'auth')
  }

  const supabase = await createAuthClient()
  let exchange: Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>>

  try {
    exchange = await supabase.auth.exchangeCodeForSession(code)
  } catch {
    await supabase.auth.signOut()
    return loginRedirect(request, 'auth')
  }

  const email = normEmail(exchange.data?.user?.email)
  if (exchange.error || !email) {
    await supabase.auth.signOut()
    return loginRedirect(request, 'auth')
  }

  let user
  try {
    user = await roleForEmail(email)
  } catch {
    await supabase.auth.signOut()
    return loginRedirect(request, 'auth')
  }
  if (user.role === 'unknown') {
    await supabase.auth.signOut()
    return loginRedirect(request, 'denied')
  }

  return NextResponse.redirect(new URL('/', request.url))
}
