import { createAuthClient } from '@/features/shared/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createAuthClient()
  const { email, password } = await req.json()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, user: data.user })
}
