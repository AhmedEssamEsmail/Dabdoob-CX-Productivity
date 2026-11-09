import { createAuthClient } from '@/features/shared/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createAuthClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: new URL('/auth/callback', req.url).toString(),
      queryParams: { hd: 'dabdoob.com' },
    },
  })

  if (error || !data.url) {
    return NextResponse.json(
      { error: error?.message ?? 'Google sign-in unavailable' },
      { status: 400 }
    )
  }

  return NextResponse.json({ url: data.url })
}
