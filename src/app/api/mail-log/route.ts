import { NextResponse } from 'next/server'
import { requireRole, readRows } from '@/lib/platform'


/** The MailLog tab for Admin: latest 200 attempts, newest first. Admin only. */
export async function GET() {
  try {
    await requireRole(['admin'])
    const rows = await readRows('mail_log', { orderBy: 'id', ascending: false, limit: 200 })
    return NextResponse.json({ rows })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 })
  }
}
