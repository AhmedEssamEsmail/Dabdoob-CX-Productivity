/**
 * HomeCards.js — Home card providers (people / work / plan). Each takes the
 * user from currentUser_ and returns
 * [{ id, count, title, who: [string], status: 'bad'|'warn'|'ok'|'neutral', link, linkLabel, waitedH }].
 *
 *   peopleHomeCards_  1:1s not logged, the caller's own open actions, the team's
 *                     overdue actions, 1:1s escalated to an admin.
 *   workHomeCards_    TL tasks past their deadline.
 *   planHomeCards_    open action items due before the next meeting or BR.
 *
 * getHomePage catches a provider that throws, so one broken area never blanks Home.
 */

import 'server-only'

import { normEmail_, pwAt_, pwDateOnly_, pwKwDate_, pwKwTime_, pwMs_, pwToday_ } from '@/features/shared/lib/adapters'
import { pwWorkingDaysBetween } from '@/features/shared/platform/calendar'
import { pendingPopupsFor } from '@/features/shared/platform/popups'
import { pwIsOpenStatus_, pwOpenSeriesActions_ } from '@/features/cx-people/lib/scorecard'
import { pwNextMeetings_, pwRows_, pwTaskContext_, pwTasksOut_ } from '@/features/cx-people/lib/work-core'
import { pwDirectory, type Directory } from '@/features/shared/platform/identity'

const PW_HOME_LIST = 3

export interface HomeUser {
  email: string
  role: string
  specialist?: boolean
}

export interface HomeCard {
  id: string
  count: number
  title: string
  who: string[]
  status: 'bad' | 'warn' | 'ok' | 'neutral'
  link: string
  linkLabel: string
  waitedH: number
}

function pwHoursSince_(ms: number, nowMs: number): number {
  return isNaN(ms) ? 0 : Math.max(0, (nowMs - ms) / 3600000)
}

function pwTally_(keys: string[]): string[] {
  const by: Record<string, number> = {}
  keys.forEach((k) => {
    by[k] = (by[k] || 0) + 1
  })
  return Object.keys(by)
    .sort((a, b) => by[b] - by[a])
    .map((k) => k + ': ' + by[k])
}

/**
 * "Your next 1:1" (pwOwnOneOnOneCard_): the caller's own booked 1:1s as the report —
 * date, Kuwait time, length, who, and when the last one was held. Timing only,
 * never the record's notes or topics.
 */
async function pwOwnOneOnOneCard_(user: HomeUser, dir: Directory, now: number): Promise<HomeCard | null> {
  const booked = (
    await pwRows_('one_on_one_schedule', (s) => {
      return (
        normEmail_(s.report_email) === user.email &&
        String(s.status) === 'scheduled' &&
        pwMs_(s.scheduled_at) + (Number(s.duration_min) || 30) * 60000 > now
      )
    })
  ).sort((a, b) => pwMs_(a.scheduled_at) - pwMs_(b.scheduled_at))
  const held = (await pwRows_('one_on_one_logs', (l) => normEmail_(l.report_email) === user.email))
    .map((l) => pwMs_(l.held_at))
    .filter((ms) => !isNaN(ms))
    .sort((a, b) => b - a)[0]
  if (!booked.length && !held) return null
  const day = (ms: number) => {
    const d = pwKwDate_(ms)
    const x = new Date(d + 'T00:00:00Z')
    return (
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][x.getUTCDay()] +
      ' ' +
      x.getUTCDate() +
      ' ' +
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][x.getUTCMonth()]
    )
  }
  const line = (s: Record<string, unknown>) =>
    day(pwMs_(s.scheduled_at)) +
    ' at ' +
    pwKwTime_(pwMs_(s.scheduled_at)) +
    ' Kuwait, ' +
    (Number(s.duration_min) || 30) +
    ' min, with ' +
    dir.name(String(s.manager_email))
  const who = booked.slice(0, 2).map(line)
  who.push(held ? 'Last 1:1 held ' + day(held) : 'No 1:1 held yet')
  return {
    // With nothing booked the card shows as a 0 line on Home, so the title carries the last date.
    id: 'my-one-on-one',
    count: booked.length,
    title: booked.length ? 'Your next 1:1' : 'No 1:1 booked for you (last held ' + day(held!) + ')',
    who,
    status: 'neutral',
    link: user.role === 'agent' ? '#/my-actions' : '#/one-on-ones',
    linkLabel: user.role === 'agent' ? 'Get your actions ready' : 'Open your booked 1:1s',
    waitedH: 0,
  }
}

export async function peopleHomeCards_(user: HomeUser): Promise<HomeCard[]> {
  const now = Date.now()
  const today = pwToday_(now)
  const dir = await pwDirectory()
  const cards: HomeCard[] = []

  if (user.role !== 'agent') {
    const missed = (
      await pwRows_('one_on_one_schedule', (s) => {
        return String(s.status) === 'missed' && (user.role === 'admin' || normEmail_(s.manager_email) === user.email)
      })
    ).sort((a, b) => pwMs_(a.scheduled_at) - pwMs_(b.scheduled_at))
    if (missed.length) {
      cards.push({
        id: 'one-on-ones-missed',
        count: missed.length,
        title: 'One-to-ones held but not logged',
        who:
          user.role === 'admin'
            ? pwTally_(missed.map((s) => dir.name(String(s.manager_email)))).slice(0, PW_HOME_LIST)
            : missed
                .slice(0, PW_HOME_LIST)
                .map((s) => dir.name(String(s.report_email)) + ', planned ' + pwKwDate_(pwMs_(s.scheduled_at))),
        status: 'bad',
        link: '#/one-on-ones',
        linkLabel: 'Open 1:1s',
        waitedH: pwHoursSince_(pwMs_(missed[0].scheduled_at), now),
      })
    }
  }

  const own = await pwOwnOneOnOneCard_(user, dir, now)
  if (own) cards.push(own)

  const actions = await pwRows_('actions', (a) => pwIsOpenStatus_(String(a.status || 'open')))
  const isOverdue = (a: Record<string, unknown>) => pwDateOnly_(a.due_date) < today
  const isTask = (a: Record<string, unknown>) => a.track_as_task === true || String(a.track_as_task).toLowerCase() === 'true'

  // The caller's own commitments (tasks have their own card and page).
  const mine = actions
    .filter((a) => normEmail_(a.owner_email) === user.email && !isTask(a))
    .sort((a, b) => (pwDateOnly_(a.due_date) < pwDateOnly_(b.due_date) ? -1 : 1))
  const mineLate = mine.filter(isOverdue)
  if (mine.length && (user.role === 'agent' || mineLate.length)) {
    cards.push({
      id: 'my-actions',
      count: user.role === 'agent' ? mine.length : mineLate.length,
      title: user.role === 'agent' ? 'Your open actions' : 'Your overdue actions',
      who: (user.role === 'agent' ? mine : mineLate).slice(0, PW_HOME_LIST).map((a) => {
        const due = pwDateOnly_(a.due_date)
        return (
          String(a.title) +
          ', due ' +
          due +
          (due < today ? ' (overdue)' : '') +
          (String(a.status) === 'blocked' ? ' (blocked)' : '')
        )
      }),
      status: mineLate.length ? 'bad' : 'neutral',
      link: '#/my-actions',
      linkLabel: 'Post where each stands',
      waitedH: mineLate.length ? pwHoursSince_(pwAt_(pwDateOnly_(mineLate[0].due_date), '23:59'), now) : 0,
    })
  }

  if (user.role !== 'agent') {
    const team = actions
      .filter((a) => {
        const owner = normEmail_(a.owner_email)
        if (owner === user.email || isTask(a) || !isOverdue(a)) return false
        if (a.visibility === 'private' && user.role !== 'admin') return false
        return user.role === 'admin' || dir.managerOf(owner) === user.email
      })
      .sort((a, b) => (pwDateOnly_(a.due_date) < pwDateOnly_(b.due_date) ? -1 : 1))
    if (team.length) {
      cards.push({
        id: 'team-actions',
        count: team.length,
        title: user.role === 'admin' ? 'Overdue actions across the team' : "Your team's overdue actions",
        who:
          user.role === 'admin'
            ? pwTally_(team.map((a) => dir.name(String(a.owner_email)))).slice(0, PW_HOME_LIST)
            : team
                .slice(0, PW_HOME_LIST)
                .map((a) => dir.name(String(a.owner_email)) + ': ' + String(a.title) + ', due ' + pwDateOnly_(a.due_date)),
        status: 'warn',
        link: '#/one-on-ones',
        linkLabel: 'Review in the next 1:1',
        waitedH: pwHoursSince_(pwAt_(pwDateOnly_(team[0].due_date), '23:59'), now),
      })
    }
  }

  if (user.role === 'admin') {
    const esc = (await pendingPopupsFor(user.email)).filter((p) => p.kind === 'escalation_1on1')
    if (esc.length) {
      cards.push({
        id: 'escalations',
        count: esc.length,
        title: '1:1s escalated to you',
        who: esc.slice(0, PW_HOME_LIST).map((p) => p.title),
        status: 'bad',
        link: esc[0].link || '#/one-on-ones',
        linkLabel: 'Read the record',
        waitedH: pwHoursSince_(pwMs_(esc[0].createdAt), now),
      })
    }
  }
  return cards
}

export async function workHomeCards_(user: HomeUser): Promise<HomeCard[]> {
  if (user.role === 'agent') return []
  const ctx = await pwTaskContext_()
  const late = pwTasksOut_(ctx).filter(
    (t) => t.overdue === true && pwIsOpenStatus_(String(t.status)) && (user.role === 'admin' || t.ownerEmail === user.email),
  )
  if (!late.length) return []
  return [
    {
      id: 'tasks-overdue',
      count: late.length,
      title: user.role === 'admin' ? 'TL tasks past their deadline' : 'Your tasks past their deadline',
      who: late
        .slice(0, PW_HOME_LIST)
        .map((t) => (user.role === 'admin' ? ctx.dir.name(String(t.ownerEmail)) + ': ' : '') + String(t.title)),
      status: 'bad',
      link: '#/tl-tasks',
      linkLabel: 'Open TL tasks',
      waitedH: pwHoursSince_(pwMs_(late[0].deadlineAt), ctx.now),
    },
  ]
}

export async function planHomeCards_(user: HomeUser): Promise<HomeCard[]> {
  if (user.role === 'agent') return []
  const now = Date.now()
  const today = pwToday_(now)
  const actions = await pwRows_('actions', (a) => a.source_type === 'meeting')
  const cards: HomeCard[] = []
  const next = await pwNextMeetings_(now)
  for (const n of next) {
    const date = pwKwDate_(pwMs_(n.at))
    if (date < today || (await pwWorkingDaysBetween(user.email, today, date)) > 2) continue
    const open = pwOpenSeriesActions_(String(n.series.series_id), actions)
    const isChair = normEmail_(n.series.chair_email) === user.email
    const shown = isChair || user.role === 'admin' ? open : open.filter((a) => normEmail_(a.owner_email) === user.email)
    if (!shown.length) continue
    const yours = open.filter((a) => normEmail_(a.owner_email) === user.email).length
    const who: string[] = []
    if (shown.length !== yours) who.push(yours + (yours === 1 ? ' is yours' : ' are yours'))
    shown.slice(0, PW_HOME_LIST).forEach((a) => who.push(String(a.title) + ', due ' + pwDateOnly_(a.due_date)))
    cards.push({
      id: 'meeting-actions-' + String(n.series.series_id),
      count: shown.length,
      title: 'Action items due before ' + String(n.series.title) + ' (' + date + ')',
      who,
      status: shown.some((a) => pwDateOnly_(a.due_date) < today) ? 'bad' : 'warn',
      link: '#/meetings',
      linkLabel: 'Post updates',
      waitedH: 0,
    })
  }
  return cards
}
