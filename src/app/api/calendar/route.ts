import { NextResponse } from 'next/server'
import {
  requireRole, pwDirectory, pwIsManagerOf, getWorkingCalendar, wcDay, pwWorkingHours, normEmail,
} from '@/lib/platform'


/**
 * The working calendar for one person: ?email=&from=yyyy-MM-dd&to=yyyy-MM-dd
 * (days + holiday/off reasons), ?date= for a single day, or
 * ?hours=1&start=<iso>&end=<iso> for working hours. Reading someone else's
 * calendar needs to be their manager or an admin.
 */
export async function GET(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl', 'agent'])
    const { searchParams } = new URL(req.url)
    const email = normEmail(searchParams.get('email') || user.email)
    if (email !== user.email) {
      const dir = await pwDirectory()
      if (!pwIsManagerOf(user, email, dir)) {
        return NextResponse.json({ error: 'You can only read the calendar of someone you manage.' }, { status: 403 })
      }
    }
    const date = searchParams.get('date')
    if (date) return NextResponse.json({ day: await wcDay(email, date) })
    if (searchParams.get('hours')) {
      const start = Number(searchParams.get('start')) || Date.parse(String(searchParams.get('start')))
      const end = Number(searchParams.get('end')) || Date.parse(String(searchParams.get('end')))
      if (!(end > start)) return NextResponse.json({ error: 'Give start and end instants.' }, { status: 400 })
      return NextResponse.json(await pwWorkingHours(email, start, end))
    }
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (!from || !to) {
      return NextResponse.json({ error: 'Give from and to as yyyy-MM-dd, or date, or hours=1&start&end.' }, { status: 400 })
    }
    return NextResponse.json({ email, days: await getWorkingCalendar(email, from, to) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 })
  }
}
