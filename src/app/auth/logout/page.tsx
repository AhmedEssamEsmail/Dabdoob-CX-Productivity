import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  await supabase.auth.signOut()
  redirect('/auth/login')
}
