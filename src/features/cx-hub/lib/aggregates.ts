/**
 * Aggregates.js page reads — verbatim port of Command_Center_V2_deprecated/Aggregates.js
 * (`getHomePage`, `dqEarliestAt_`; refreshQueueNow itself is already ported in
 * features/cx-queue/lib/pages.ts).
 *
 * Store seams: the Live tables the GAS version read via dqCachedLive_ come from
 * platform readStore/dqCachedLive; Config comes from configAll (the injected
 * `cfg` map dqSetting_ reads). Missing stores behave like missing sheets: [].
 */

import {
  configAll,
  dqLastRun,
  dqSetting,
  ecosystemHealth,
  readStore,
  requireRole,
} from '@/features/shared/platform'
import {
  dqBandCounts_,
  dqBandInfo_,
  dqHuman_,
  dqNum_,
  dqOpenAgingFlags_,
  dqQueueView_,
  dqSlotsToday_,
  dqSortQueues_,
  dqSubmissionsFor_,
  dqTodaySnapshots_,
  dqWithCurrentTl_,
} from '@/features/cx-queue/lib'
import { dqDateKey_, normEmail_, type Cfg } from '@/features/shared/lib/adapters'
import {
  peopleHomeCards_,
  planHomeCards_,
  workHomeCards_,
  type HomeCard,
  type HomeUser,
} from './home-cards'

/** perf_ — the GAS perf timer; kept as a no-op lap recorder so lap marks stay 1:1. */
function perf_(name: string): { lap(mark: string): void; end(): void } {
  const t = Date.now()
  const marks: [string, number][] = []
  return {
    lap(mark: string) {
      marks.push([mark, Date.now() - t])
    },
    end() {
      void name
      void marks
    },
  }
}

/** DQ_HOME_PROVIDERS — same order: people / work / plan. */
const DQ_HOME_PROVIDERS = [peopleHomeCards_, workHomeCards_, planHomeCards_]

const DQ_FLAGS_TABLE = 'dq_aging_flags'
const DQ_SUBMISSIONS_TABLE = 'queue_submissions'

/** getHomePage verbatim — the injected rows stand in for the GAS sheet reads. */
export async function getHomePage(cfg?: Cfg): Promise<Record<string, unknown>> {
  const perf = perf_('getHomePage')
  const user = await requireRole(['admin', 'tl', 'agent'])
  const now = new Date()
  if (!cfg) cfg = await configAll()
  const bands = dqBandInfo_(cfg)
  const top = (bands.edges as unknown[]).length
  const [agingRows, rosterRows, submissionRows, flagRows] = await Promise.all([
    readStore('aging_open_tickets'),
    readStore('roster'),
    readStore(DQ_SUBMISSIONS_TABLE),
    readStore(DQ_FLAGS_TABLE),
  ])
  const roster = rosterRows.exists ? rosterRows.rows : null
  const submissions = submissionRows.exists ? submissionRows.rows : null
  const flags = flagRows.exists ? flagRows.rows : null
  const aging = dqWithCurrentTl_(agingRows.rows, roster)
  const slots = user.role === 'agent' ? [] : dqSlotsToday_(now, cfg, submissions)
  const needs: Record<string, unknown>[] = []
  const toTicket = (r: Record<string, unknown>) => ({
    id: String(r.ticket_id),
    queue: String(r.queue),
    status: String(r.status),
    ageH: dqNum_(r.age_h),
    band: dqNum_(r.band),
    agent: String(r.agent_name),
  })
  let oldest: Record<string, unknown>[] = []
  if (user.specialist) {
    oldest = []
  } else if (user.role === 'agent') {
    oldest = aging.filter((r) => r.agent_email === user.email)
  } else if (user.role === 'tl') {
    oldest = aging.filter((r) => normEmail_(r.tl_email) === user.email)
  } else {
    oldest = aging
  }
  const over = oldest.filter((r) => dqNum_(r.band) === top)
  if (!user.specialist && (over.length || user.role !== 'agent')) {
    const byQueue: Record<string, number> = {}
    over.forEach((r) => {
      byQueue[String(r.queue)] = (byQueue[String(r.queue)] || 0) + 1
    })
    const who = Object.keys(byQueue)
      .sort((a, b) => byQueue[b] - byQueue[a])
      .slice(0, 3)
      .map((q) => q + ': ' + byQueue[q])
    if (over[0]) who.push('Oldest: ' + dqHuman_(dqNum_(over[0].age_h)) + ', ' + over[0].queue)
    const waitingOnOthers = over.filter(
      (r) => !(r.actionable === true || r.actionable === 'TRUE' || r.actionable === 'true')
    ).length
    if (waitingOnOthers)
      who.push(waitingOnOthers + ' waiting on another team (3PL, Ops) rather than on CX')
    needs.push({
      id: 'aging',
      count: over.length,
      title:
        user.role === 'agent'
          ? 'Your tickets open ' + (bands.edges as number[])[top - 1] + ' h or more'
          : user.role === 'tl'
            ? "Your team's tickets open " + (bands.edges as number[])[top - 1] + ' h or more'
            : 'Tickets open ' + (bands.edges as number[])[top - 1] + ' h or more',
      who,
      status: over.length ? 'bad' : 'ok',
      link: user.role === 'tl' ? '#/aging?mine=1&band=top' : '#/aging?band=top',
      linkLabel: 'Open aging cases',
      waitedH: over[0] ? dqNum_(over[0].age_h) : 0,
    })
  }
  if (user.role !== 'agent') {
    const nobody = aging.filter((r) => !r.agent_email && dqNum_(r.band) >= top - 1)
    if (nobody.length) {
      const byQ: Record<string, number> = {}
      nobody.forEach((r) => {
        byQ[String(r.queue)] = (byQ[String(r.queue)] || 0) + 1
      })
      needs.push({
        id: 'unassigned',
        count: nobody.length,
        title: 'Tickets open ' + (bands.edges as number[])[top - 2] + ' h or more with no agent',
        who: Object.keys(byQ)
          .sort((a, b) => byQ[b] - byQ[a])
          .slice(0, 3)
          .map((q) => q + ': ' + byQ[q]),
        status: 'warn',
        link: '#/aging?unassigned=1',
        linkLabel: 'Assign them',
        waitedH: dqNum_(nobody[0].age_h),
      })
    }
  }
  if (user.role !== 'agent') {
    const missed = slots.filter((s) => s.state === 'missed')
    const due = slots.filter((s) => s.state === 'due')
    if (missed.length || due.length) {
      needs.push({
        id: 'checkins',
        count: missed.length || due.length,
        title: missed.length ? 'Check-ins missed today' : 'Check-in due now',
        who: missed
          .map((s) => s.slot + ', ' + s.name + ': missed')
          .concat(due.map((s) => s.slot + ', ' + s.name + ': due now')),
        status: missed.length ? 'bad' : 'warn',
        link: missed.length ? '#/checkins?slot=' + missed[0].slot : '#/checkins',
        linkLabel:
          user.role === 'tl'
            ? missed.length
              ? 'Answer the ' + missed[0].slot + ' check-in'
              : 'Submit check-in'
            : 'Open check-ins',
        waitedH: missed.length
          ? (now.getTime() - new Date(missed[0].dueAt).getTime()) / 3600000
          : 0,
      })
    }
  }
  if (user.role !== 'agent') {
    const asks = dqOpenAgingFlags_(flags, aging).filter(
      (f) => user.role === 'admin' || f.tlEmail === user.email
    )
    if (asks.length) {
      needs.push({
        id: 'aging-help',
        count: asks.length,
        title: 'Agents asking for help on aged tickets',
        who: asks
          .slice(0, 3)
          .map((f) => '#' + f.ticketId + ', ' + f.by.split('@')[0] + ': ' + f.note.slice(0, 100)),
        status: 'bad',
        link: '#/aging?flagged=1',
        linkLabel: 'Open the flagged tickets',
        waitedH:
          (now.getTime() -
            dqEarliestAt_(asks.map((f) => ({ submitted_at: f.at })))) /
          3600000,
      })
    }
  }
  if (user.role === 'admin') {
    const help = dqSubmissionsFor_(submissions, [dqDateKey_(now, cfg)]).filter(
      (s) => String(s.help_needed) === 'true' || s.help_needed === true
    )
    if (help.length) {
      needs.push({
        id: 'checkin-help',
        count: help.length,
        title: 'Team leads asking for your help (check-ins)',
        who: help.map(
          (s) =>
            s.slot +
            ', ' +
            String(s.submitted_by).split('@')[0] +
            ': ' +
            (String(s.help_note || s.general_note || '').slice(0, 120) || 'no note')
        ),
        status: 'bad',
        link: '#/checkins',
        linkLabel: 'Open check-ins',
        waitedH: (now.getTime() - new Date(dqEarliestAt_(help)).getTime()) / 3600000,
      })
    }
  }
  perf.lap('tickets')
  const homeUser = user as unknown as HomeUser
  for (const fn of DQ_HOME_PROVIDERS) {
    try {
      ;((await fn(homeUser)) || []).forEach((c: HomeCard) => {
        needs.push(c as unknown as Record<string, unknown>)
      })
    } catch (e) {
      console.log(fn.name + ' failed: ' + (e as Error).message)
    }
    perf.lap(fn.name)
  }
  needs.sort(
    (a, b) =>
      Number(b.status === 'bad') - Number(a.status === 'bad') ||
      dqNum_(b.waitedH) - dqNum_(a.waitedH)
  )

  const ladder = dqBandCounts_({}, cfg)
  oldest.forEach((r) => {
    ladder[dqNum_(r.band)]++
  })
  const out: Record<string, unknown> = {
    now: now.toISOString(),
    role: user.role,
    specialist: !!user.specialist,
    name: user.name,
    dataAsOf: await dqLastRun('queue_aggregates'),
    bands,
    ticketUrl: 'https://' + String(await dqSetting('freshdesk_domain')) + '/a/tickets/',
    needs,
    slots,
    ladder,
    oldest: oldest.slice(0, 10).map(toTicket),
    openTotal: oldest.length,
    queues: [] as unknown[],
  }
  if (user.role === 'admin') {
    const [snapRows, queueNow] = await Promise.all([
      readStore('queue_snapshots'),
      readStore('agg_queue_now'),
    ])
    const snaps = dqTodaySnapshots_(now, cfg, snapRows.rows)
    out.queues = dqSortQueues_(
      queueNow.rows.map(
        (q) => dqQueueView_(q, snaps.prev[String(q.queue)], cfg) as { ours: unknown; open: number }
      )
    ).slice(0, 12)
    out.sinceSlot = snaps.latest
  }
  // Hub home: the ecosystem diagram rides on this call; never throws.
  if (user.role === 'admin' || user.role === 'tl') {
    try {
      out.ecosystem = await ecosystemHealth()
    } catch (e) {
      console.log('ecosystem health failed: ' + (e as Error).message)
      out.ecosystem = null
    }
    perf.lap('ecosystem')
  }
  perf.end()
  return out
}

export function dqEarliestAt_(subs: { submitted_at?: unknown }[]): number {
  const t = subs
    .map((x) => new Date(String(x.submitted_at)).getTime())
    .filter((v) => isFinite(v))
  return t.length ? Math.min.apply(null, t) : Date.now()
}
