/**
 * Aggregates.js page reads — verbatim port of Command_Center_V2_deprecated/Aggregates.js
 * (`getHomePage`, `dqEarliestAt_`; refreshQueueNow itself is already ported in
 * features/cx-queue/lib/pages.ts).
 *
 * Store seams: the Live tables the GAS version read via dqCachedLive_ come from
 * platform readStore/dqCachedLive; Config comes from configAll (the injected
 * `cfg` map dqSetting_ reads). Missing stores behave like missing sheets: [].
 */

import 'server-only'

import {
  configAll,
  dqLastRun,
  dqSetting,
  ecosystemHealth,
  readStore,
  readStoreFiltered,
  requireRole,
  type StoreRead,
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
import { dqAddDays_, dqDateKey_, normEmail_, type Cfg } from '@/features/shared/lib/adapters'
import { inDateRange, pick } from '@/features/shared/lib/fragments'
import {
  scAdd_,
  scBucket_,
  scNum_,
  scNumRow_,
  scRound1_,
} from '@/features/cx-people/lib/scorecard'
import {
  peopleHomeCards_,
  planHomeCards_,
  workHomeCards_,
  type HomeCard,
  type HomeUser,
} from './home-cards'

/** perf_ — the GAS perf timer; lap marks + per-promise durations emitted as one line. */
function perf_(name: string): {
  lap(mark: string): void
  time<T>(label: string, p: Promise<T>): Promise<T>
  end(): void
} {
  const t = Date.now()
  const marks: [string, number][] = []
  const durs: [string, number][] = []
  return {
    lap(mark: string) {
      marks.push([mark, Date.now() - t])
    },
    time<T>(label: string, p: Promise<T>): Promise<T> {
      const s = Date.now()
      const rec = () => {
        durs.push([label, Date.now() - s])
      }
      return p.then(
        (v) => {
          rec()
          return v
        },
        (e) => {
          rec()
          throw e
        }
      )
    },
    end() {
      const parts = durs.map(([l, ms]) => l + '=' + ms)
      marks.forEach(([m, ms]) => parts.push(m + '@' + ms))
      console.log('[perf] ' + name + ' total=' + (Date.now() - t) + ' ' + parts.join(' '))
    },
  }
}

/** DQ_HOME_PROVIDERS — same order: people / work / plan. */
const DQ_HOME_PROVIDERS = [peopleHomeCards_, workHomeCards_, planHomeCards_]

/**
 * Team pulse — quality/productivity/fcr over a window for a scope of emails
 * (null = every row, admin). Same cascade as kpiPayoutFor: sc_daily matrix_day
 * rows win, else prod_daily_layers ('effective' layer, else 'raw'), fcr from
 * fcr_daily when sc_daily was not used. Schedule adherence has no data source
 * -> always null. A missing store yields null for its metrics; never throws.
 */
function pulseFor_(
  scDaily: StoreRead,
  prodLayers: StoreRead,
  fcrDaily: StoreRead,
  emails: Set<string> | null,
  from: string,
  to: string
): { quality: number | null; productivity: number | null; fcr: number | null; adherence: null } {
  const inScope = (e: unknown) => emails === null || emails.has(normEmail_(e))
  let quality: number | null = null
  let productivity: number | null = null
  let fcr: number | null = null
  let usedSc = false
  const fcrSums = { passed: 0, failed: 0, excluded: 0 }

  const scRows = scDaily.rows
    .map((r) => scNumRow_(r))
    .filter((r) => inScope(r.email) && inDateRange(r.date, from, to))
  if (scDaily.exists && scRows.length) {
    usedSc = true
    const a = scBucket_()
    scRows.forEach((r) => {
      fcrSums.passed += Number(r.fcr_passed) || 0
      fcrSums.failed += Number(r.fcr_failed) || 0
      fcrSums.excluded += Number(r.fcr_excluded) || 0
      if (!r.matrix_day) return
      scAdd_(a, r as Record<string, number>)
    })
    const totalTarget = a.inbTarget + a.txtTarget + a.waTarget
    const totalAchieved = a.inbAchieved + a.txtAchieved + a.waAchieved
    productivity = totalTarget > 0 ? scRound1_((totalAchieved / totalTarget) * 100) : null
    quality = a.audits > 0 ? scRound1_(a.scoreXaudits / a.audits) : null
  } else {
    const layers = prodLayers.rows.filter(
      (r) => inScope(r.email) && inDateRange(r.date, from, to)
    )
    const eff = layers.filter((r) => String(r.layer) === 'effective')
    const use = eff.length ? eff : layers.filter((r) => String(r.layer || 'raw') === 'raw')
    if (prodLayers.exists && use.length) {
      let tgt = 0
      let ach = 0
      let audits = 0
      let scoreX = 0
      use.forEach((r) => {
        tgt +=
          scNum_(pick(r, 'inboundTarget')) +
          scNum_(pick(r, 'textingTarget')) +
          scNum_(pick(r, 'waTarget'))
        ach +=
          scNum_(pick(r, 'inboundAchieved')) +
          scNum_(pick(r, 'textingAchieved')) +
          scNum_(pick(r, 'waAchieved'))
        audits += scNum_(pick(r, 'totalAudits'))
        scoreX += scNum_(pick(r, 'avgScore')) * scNum_(pick(r, 'totalAudits'))
      })
      productivity = tgt > 0 ? scRound1_((ach / tgt) * 100) : null
      quality = audits > 0 ? scRound1_(scoreX / audits) : null
    }
  }

  if (usedSc) {
    const den = fcrSums.passed + fcrSums.failed
    fcr = den > 0 ? scRound1_((fcrSums.passed / den) * 100) : null
  } else if (fcrDaily.exists) {
    const rows = fcrDaily.rows.filter(
      (r) => inScope(pick(r, 'agent_email', 'email')) && inDateRange(pick(r, 'date'), from, to)
    )
    const p = rows.reduce((s, r) => s + scNum_(pick(r, 'passed', 'fcr_passed')), 0)
    const f = rows.reduce((s, r) => s + scNum_(pick(r, 'failed', 'fcr_failed')), 0)
    fcr = p + f > 0 ? scRound1_((p / (p + f)) * 100) : null
  }
  return { quality, productivity, fcr, adherence: null }
}

const DQ_FLAGS_TABLE = 'dq_aging_flags'
const DQ_SUBMISSIONS_TABLE = 'queue_submissions'

/** getHomePage verbatim — the injected rows stand in for the GAS sheet reads. */
export async function getHomePage(cfg?: Cfg): Promise<Record<string, unknown>> {
  const perf = perf_('getHomePage')
  const user = await perf.time('requireRole', requireRole(['admin', 'tl', 'agent']))
  const now = new Date()
  if (!cfg) cfg = await perf.time('configAll', configAll())
  const bands = dqBandInfo_(cfg)
  const top = (bands.edges as unknown[]).length
  const pulseTo = dqDateKey_(now, cfg)
  const pulseFrom = dqAddDays_(pulseTo, -6)
  const [agingRows, rosterRows, submissionRows, flagRows, scDaily, prodLayers, fcrDaily] =
    await Promise.all([
      perf.time('read:aging_open_tickets', readStore('aging_open_tickets')),
      perf.time('read:roster', readStore('roster')),
      // Prefix bound (data-2): keeps stored 'YYYY-MM-DD…' variants; dqSubmissionsFor_ re-filters.
      perf.time(
        'read:queue_submissions',
        readStoreFiltered(DQ_SUBMISSIONS_TABLE, {
          gte: { slot_date: pulseTo },
          lte: { slot_date: pulseTo + String.fromCharCode(0xfffd) },
        })
      ),
      perf.time('read:dq_aging_flags', readStore(DQ_FLAGS_TABLE)),
      perf.time(
        'read:sc_daily',
        readStoreFiltered('sc_daily', { gte: { date: pulseFrom }, lte: { date: pulseTo } })
      ),
      perf.time(
        'read:prod_daily_layers',
        readStoreFiltered('prod_daily_layers', { gte: { date: pulseFrom }, lte: { date: pulseTo } })
      ),
      perf.time(
        'read:fcr_daily',
        readStoreFiltered('fcr_daily', { gte: { date: pulseFrom }, lte: { date: pulseTo } })
      ),
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
  const providerCards = await Promise.all(
    DQ_HOME_PROVIDERS.map((fn) =>
      perf
        .time(fn.name, fn(homeUser))
        .then(
          (cards) => (cards || []) as HomeCard[],
          (e) => {
            console.log(fn.name + ' failed: ' + (e as Error).message)
            return [] as HomeCard[]
          }
        )
        .then((cards) => {
          perf.lap(fn.name)
          return cards
        })
    )
  )
  providerCards.forEach((cards) => {
    cards.forEach((c) => {
      needs.push(c as unknown as Record<string, unknown>)
    })
  })
  needs.sort(
    (a, b) =>
      Number(b.status === 'bad') - Number(a.status === 'bad') ||
      dqNum_(b.waitedH) - dqNum_(a.waitedH)
  )

  const ladder = dqBandCounts_({}, cfg)
  oldest.forEach((r) => {
    ladder[dqNum_(r.band)]++
  })
  let pulseEmails: Set<string> | null = null
  if (user.role !== 'admin') {
    pulseEmails = new Set([normEmail_(user.email)])
    if (user.role === 'tl') {
      ;(roster || []).forEach((r) => {
        if (normEmail_(r.tl_email) === user.email) pulseEmails?.add(normEmail_(r.email))
      })
    }
  }
  const pulse = pulseFor_(scDaily, prodLayers, fcrDaily, pulseEmails, pulseFrom, pulseTo)
  const out: Record<string, unknown> = {
    now: now.toISOString(),
    role: user.role,
    specialist: !!user.specialist,
    name: user.name,
    dataAsOf: await perf.time('dqLastRun', dqLastRun('queue_aggregates')),
    bands,
    ticketUrl:
      'https://' +
      String(await perf.time('dqSetting', dqSetting('freshdesk_domain'))) +
      '/a/tickets/',
    needs,
    slots,
    ladder,
    oldest: oldest.slice(0, 10).map(toTicket),
    openTotal: oldest.length,
    pulse,
    queues: [] as unknown[],
  }
  if (user.role === 'admin') {
    const [snapRows, queueNow] = await Promise.all([
      perf.time(
        'read:queue_snapshots',
        readStoreFiltered('queue_snapshots', { eq: { slot_date: pulseTo } })
      ),
      perf.time('read:agg_queue_now', readStore('agg_queue_now')),
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
      out.ecosystem = await perf.time('ecosystemHealth', ecosystemHealth())
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
