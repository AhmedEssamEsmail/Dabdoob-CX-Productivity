/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim OneOnOnes.js port:
   sheet/JSON rows are dynamic records; `any` is the honest shape here. */
/**
 * OneOnOnes.js part 2 — the page/read/context/suggest/submit half:
 * oneOnOnesPage, oneOnOnesGetLog, pwSuggestTopics_ + pwDataSuggestions_,
 * pwOneOnOneContext_, oneOnOnesStart, oneOnOnesSubmit + pwSubmitWrite_ /
 * pwRefuseDuplicateLog_ / pwRaiseEscalation_ / pwBuildSummary_, and the
 * productivity period endpoint (oneOnOnesProductivity).
 *
 * Datastore change: pwRows_ reads Postgres (missing table -> []), the
 * double-submit CacheService key becomes the repo in-memory cache, and the
 * workbook/aggregate reads go through the seams in scorecard-server.ts and
 * stores.ts. Everything else is verbatim.
 */
import 'server-only'

import {
  dqAddDays_,
  dqNum_,
  normEmail_,
  pwAddDays_,
  pwIso_,
  pwKwDate_,
  pwKwTime_,
  pwMs_,
  pwStr_,
  pwToday_,
  PW_DAY_MS,
  type Cfg,
  type Directory,
} from '@/features/shared/lib/adapters'
import { cacheGet, cachePut, cacheRemove, findRow, updateRow, newId } from '@/features/shared/platform/repo'
import { assertWritable } from '@/features/shared/platform/viewas'
import { requireRole, pwDirectory } from '@/features/shared/platform/identity'
import { getConfig, configAll, dqSetting } from '@/features/shared/platform/settings'
import { dqCachedLive, dqLastRun, readStore } from '@/features/shared/platform/stores'
import { raisePopup, resolvePopups } from '@/features/shared/platform/popups'
import { sendMail, escapeHtml } from '@/features/shared/platform/mail'
import {
  dqBandInfo_,
  dqOpenAgingFlags_,
  dqSlotsToday_,
  dqWithCurrentTl_,
} from '@/features/shared/lib/queue-core'
import {
  pwOpenSeriesActions_,
  pwIsOpenStatus_,
  pwActionOut_,
  pwUpdateOut_,
  scAdd_,
  scBucket_,
  scDerive_,
  scNumRow_,
  scMonthsOf_,
  scMonthView_,
  scRound1_,
  pwScoreMonths_,
  pwScoreOut_,
} from './scorecard/index'
import {
  pwBuildActions_,
  pwApplyReviews_,
  pwAppend_,
  pwCanSeeAction_,
  type PwUser,
} from './actions'
import { pwRows_, pwTaskContext_, pwTasksOut_ } from './work-core'
import { scIo_, scWho_, scKpiCtx_, scReadRange_, scMonthRowsDb_, scDateOk_ } from './scorecard-server'
import {
  PW_OUTCOMES,
  PW_NO_ACTION_TOPICS,
  PW_EVIDENCE_FIELDS,
  PW_FAIRNESS_OUTCOMES,
  pwTopicLibraryDb_,
  pwTopicDef_,
  pwSeriesKey_,
  pwPair_,
  pwOneOnOneCutoff_,
  pwCadenceDays_,
  pwNextWorkingOnOrAfter_,
  pwIsMissed_,
  pwScheduleOut_,
  pwLogOut_,
  pwCanReadLog_,
  pwNewestLogFirst_,
  pwDayLabel_,
  pwWeekOf_,
  pwOoRemindersChanged_,
  pwTopicLibraryDb_ as pwLibraryDb,
} from './one-on-ones'
import { pwDeletedOut_ } from './one-on-ones-delete'

// ---------------------------------------------------------------- page

export async function oneOnOnesPage() {
  const user = await requireRole(['admin', 'tl'])
  const dir = await pwDirectory()
  const now = Date.now()
  const [schedule, logs, topics, privates] = await Promise.all([
    pwRows_('one_on_one_schedule'),
    pwRows_('one_on_one_logs'),
    pwRows_('one_on_one_topics'),
    pwRows_('one_on_one_private_notes'),
  ])

  const reports =
    user.role === 'admin'
      ? dir.tls().concat(
          Object.keys(dir.by)
            .map((k) => dir.by[k])
            .filter((p) => (p.role === 'agent' || p.role === 'specialist') && p.active),
        )
      : dir.agentsOf(user.email)

  const cutoff = await pwOneOnOneCutoff_()
  const today = pwToday_(now)
  const people = await Promise.all(
    reports.map(async (p) => {
      const kind = p.role === 'tl' ? 'tl' : 'agent'
      const pairLogs = logs
        .filter((l) => normEmail_(l.report_email) === p.email)
        .sort(pwNewestLogFirst_)
      const last = pairLogs[0]
      const cadence = await pwCadenceDays_(kind)
      const lastHeld = last ? pwKwDate_(last.held_at) : ''
      const nextDue = await pwNextWorkingOnOrAfter_(p.email, lastHeld ? pwAddDays_(lastHeld, cadence) : today)
      const next = schedule
        .filter((s) => normEmail_(s.report_email) === p.email && String(s.status) === 'scheduled')
        .sort((a, b) => pwMs_(a.scheduled_at) - pwMs_(b.scheduled_at))[0]
      return {
        email: p.email, name: p.name, kind, managerEmail: dir.managerOf(p.email) || '',
        lastHeld, nextDue, cadenceDays: cadence,
        scheduled: next ? pwScheduleOut_(next, dir) : null,
        overdueUnscheduled: !next && nextDue < today,
      }
    }),
  )
  people.sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : a.name < b.name ? -1 : 1))

  const mine = schedule.filter(
    (s) => user.role === 'admin' || normEmail_(s.manager_email) === user.email || normEmail_(s.report_email) === user.email,
  )
  const visibleLogs = logs.filter((l) => pwCanReadLog_(l, user)).sort(pwNewestLogFirst_).slice(0, 40)

  return {
    me: { email: user.email, name: user.name, role: user.role },
    cutoff,
    people,
    upcoming: mine
      .filter((s) => String(s.status) === 'scheduled')
      .sort((a, b) => pwMs_(a.scheduled_at) - pwMs_(b.scheduled_at))
      .map((s) => pwScheduleOut_(s, dir)),
    missed: mine
      .filter((s) => String(s.status) === 'missed' && normEmail_(s.manager_email) === user.email)
      .map((s) => pwScheduleOut_(s, dir)),
    logs: visibleLogs.map((l) =>
      pwLogOut_(
        l,
        topics.filter((t) => String(t.log_id) === String(l.log_id)),
        privates.filter((p) => String(p.log_id) === String(l.log_id)),
        user,
        dir,
      ),
    ),
    library: { agent: await pwTopicLibraryDb_('agent'), tl: await pwTopicLibraryDb_('tl') },
    outcomes: PW_OUTCOMES,
    deleted: user.role === 'admin' ? await pwDeletedOut_(dir) : [],
  }
}

/** One record, as the caller may see it (oneOnOnesGetLog). */
export async function oneOnOnesGetLog(logId: string) {
  const user = await requireRole(['admin', 'tl', 'agent'])
  const dir = await pwDirectory()
  const log = await findRow('one_on_one_logs', 'log_id', String(logId))
  if (!log || !pwCanReadLog_(log, user) || (log.deleted_at && user.role !== 'admin')) {
    throw new Error('That 1:1 record is not available to you.')
  }
  if (user.role === 'admin') await resolvePopups('escalation_1on1', String(logId), user.email)
  return pwLogOut_(
    log,
    await pwRows_('one_on_one_topics', (t) => String(t.log_id) === String(logId)),
    await pwRows_('one_on_one_private_notes', (p) => String(p.log_id) === String(logId)),
    user,
    dir,
  )
}

// ---------------------------------------------------------------- suggestions

/**
 * pwSuggestTopics_ — system-suggested topics with a one-line reason (pure; every
 * row injected). Sources: an open "Formal concern raised"/"Monitor" outcome from
 * the last 1:1, rows in people_signals, no career/development topic in 90 days,
 * an action closed since the last 1:1, plus ctx (pwOneOnOneContext_) figures.
 */
export function pwSuggestTopics_(
  pair: { kind: string; manager: string; report: string },
  logs: Record<string, any>[],
  topicsRows: Record<string, any>[],
  actions: Record<string, any>[],
  nowMs: number,
  ctx?: Record<string, any> | null,
  signals?: Record<string, any>[],
): { topic: string; label: string; reason: string; performance: boolean }[] {
  const out: { topic: string; label: string; reason: string; performance: boolean }[] = []
  const add = (topic: string, reason: string) => {
    if (!pwTopicDef_(pair.kind, topic)) return
    if (out.some((s) => s.topic === topic)) return
    const def = pwTopicDef_(pair.kind, topic)!
    out.push({ topic, label: def.label, reason, performance: !!def.performance })
  }
  const pairLogs = logs.filter((l) => normEmail_(l.report_email) === pair.report).sort(pwNewestLogFirst_)
  const last = pairLogs[0]
  const since = last ? pwMs_(last.held_at) : nowMs - 30 * PW_DAY_MS

  if (last) {
    topicsRows
      .filter(
        (t) =>
          String(t.log_id) === String(last.log_id) &&
          !t.skipped_reason &&
          (t.outcome === 'Formal concern raised' || t.outcome === 'Monitor'),
      )
      .forEach((t) => {
        add(String(t.topic), 'Follow-up: "' + t.outcome + '" on ' + pwKwDate_(last.held_at))
      })
  }

  ;(signals || []).forEach((r) => {
    const at = pwMs_(r.signal_date)
    if (!isNaN(at) && at >= since) add(String(r.topic), String(r.reason || ''))
  })

  if (ctx) pwDataSuggestions_(pair.kind, ctx, add)

  const careerTopic = pair.kind === 'tl' ? 'development' : 'career'
  const careerLogIds: Record<string, boolean> = {}
  topicsRows.forEach((t) => {
    if (String(t.topic) === careerTopic && !t.skipped_reason) careerLogIds[String(t.log_id)] = true
  })
  const lastCareer = pairLogs.filter((l) => careerLogIds[String(l.log_id)])[0]
  if (!lastCareer || pwMs_(lastCareer.held_at) < nowMs - 90 * PW_DAY_MS) {
    add(
      careerTopic,
      lastCareer ? 'Last career conversation on ' + pwKwDate_(lastCareer.held_at) : 'No career conversation on record',
    )
  }

  const done = actions.filter(
    (a) => normEmail_(a.owner_email) === pair.report && a.status === 'done' && pwMs_(a.closed_at) >= since,
  )[0]
  if (done) add('recognition', 'Closed "' + String(done.title) + '" on ' + pwKwDate_(done.closed_at))
  return out
}

// ---------------------------------------------------------------- what is on the table

/** V1's scorecard bands: 90 and over green, 75 to 90 amber, under 75 red. */
export async function pwScoreFloor_(): Promise<number> {
  const n = Number(await getConfig('one_on_one_score_floor', 75))
  return n > 0 ? n : 75
}

export function pwNumOrNull_(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return isFinite(n) ? n : null
}

export function pwPct_(ratio: unknown): number | null {
  const n = pwNumOrNull_(ratio)
  return n === null ? null : Math.round(n * 1000) / 10
}

/**
 * The 1:1 shows three scorecard parameters, each judged on its own and INSTEAD
 * OF a weighted overall score (Mohamed: no overall in the 1:1).
 */
export const PW_SCORE_PARAMS = [
  { id: 'prod', key: 'prod', label: 'Productivity', topic: 'productivity' },
  { id: 'qual', key: 'qual', label: 'Quality', topic: 'quality' },
  { id: 'fcr', key: 'fcr', label: 'FCR (first contact resolution)', topic: 'fcr' },
]

/** Competition rank of `email` by `key` among rows with a value (higher is better). */
export function pwParamRank_(rows: Record<string, any>[], key: string, email: string) {
  const withV = rows.filter((r) => r[key] !== null && r[key] !== undefined)
  const mine = withV.filter((r) => r.email === email)[0]
  if (!mine) return { rank: null, of: withV.length }
  return { rank: 1 + withV.filter((r) => r[key] > mine[key]).length, of: withV.length }
}

export function pwParamsOut_(
  cur: Record<string, any>,
  prev: Record<string, any>,
  email: string,
  curRow: Record<string, any> | null,
  prevRow: Record<string, any> | null,
) {
  const days = cur.days ? (cur.days(email) as Record<string, any>[]).slice(0, 14).reverse() : []
  return PW_SCORE_PARAMS.map((p) => {
    const v = curRow ? curRow[p.key] : null
    const last = prevRow ? prevRow[p.key] : null
    const r = pwParamRank_(cur.rows, p.key, email)
    return {
      id: p.id, label: p.label, topic: p.topic,
      value: v === undefined ? null : v,
      rank: v === null || v === undefined ? null : r.rank,
      rankOf: r.of,
      lastMonth: last === undefined ? null : last,
      change:
        v !== null && v !== undefined && last !== null && last !== undefined ? scRound1_(v - last) : null,
      trend: days.map((d) => ({ date: d.date, value: d[p.key] === undefined ? null : d[p.key] })),
    }
  })
}

/** The previous period of the same length (the 1:1 productivity period picker). */
export function pwPrevPeriod_(from: string, to: string) {
  const len = Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1
  const prevTo = dqAddDays_(from, -1)
  return { from: dqAddDays_(prevTo, -(len - 1)), to: prevTo, days: len }
}

/**
 * pwProdSum_ — one agent's scorecard days in [from, to]: productivity over
 * Matrix days, quality over audits, FCR over verdicts. null when there is no
 * Matrix day and no FCR verdict (never 0).
 */
export function pwProdSum_(rows: Record<string, any>[], email: string, from: string, to: string, fcrDated: boolean) {
  const a = scBucket_(0)
  const f = { passed: 0, failed: 0, excluded: 0 }
  let n = 0
  let any = false
  rows.forEach((r) => {
    if (r.email !== email || r.date < from || r.date > to) return
    f.passed += r.fcr_passed || 0
    f.failed += r.fcr_failed || 0
    f.excluded += r.fcr_excluded || 0
    if ((r.fcr_passed || 0) + (r.fcr_failed || 0)) any = true
    if (!r.matrix_day) return
    scAdd_(a, r)
    n++
  })
  if (!n && !any) return null
  const d = scDerive_(a, f, null, null)
  const fcrOk = fcrDated !== false
  return {
    days: n, prod: n ? d.prod : null, totalTarget: d.totalTarget, totalAchieved: d.totalAchieved,
    inbProd: d.inbProd, inbAchieved: d.inbAchieved, inbTarget: d.inbTarget, txtProd: d.txtProd,
    txtAchieved: d.txtAchieved, txtTarget: d.txtTarget, waProd: d.waProd, waAchieved: d.waAchieved,
    waTarget: d.waTarget, qual: d.qual, audits: d.audits,
    fcr: fcrOk ? d.fcr : null, fcrPassed: fcrOk ? d.fcrPassed : 0, fcrFailed: fcrOk ? d.fcrFailed : 0,
  }
}

export async function oneOnOnesProductivity(reportEmail: string, from: string, to: string) {
  const user = await requireRole(['admin', 'tl'])
  const dir = await pwDirectory()
  const pair = pwPair_(user, reportEmail, dir) // the agent's manager, or an admin
  from = String(from || '')
  to = String(to || '')
  if (!scDateOk_(from) || !scDateOk_(to)) throw new Error('Dates are yyyy-MM-dd.')
  if (from > to) throw new Error('"From" is after "To".')
  const prev = pwPrevPeriod_(from, to)
  if (prev.days > 400) throw new Error('Pick a period of 13 months or less.')
  const rows = (await scReadRange_('sc_daily', prev.from, to)).map(scNumRow_)
  // FCR can only be split by period when every month in range has a dated FCR tab.
  const months = await scMonthRowsDb_()
  const undated = scMonthsOf_(prev.from, to).filter((m) => {
    const v = scMonthView_(m, months[m], null)
    return Number(v.fcrRows) > 0 && !v.fcrDated
  })
  const dated = !undated.length
  return {
    from, to, days: prev.days, prevFrom: prev.from, prevTo: prev.to,
    fcrNote: dated
      ? ''
      : 'The FCR tab has no dates for ' +
        undated.join(', ') +
        ', so FCR is a whole-month figure and cannot be shown for a period.',
    current: pwProdSum_(rows, pair.report, from, to, dated),
    previous: pwProdSum_(rows, pair.report, prev.from, prev.to, dated),
  }
}

/** Queue productivity from the agents aggregate (agg_agent_perf, cached): last 7 days, the 7 before, month to date. */
export function pwProdOut_(perfRows: Record<string, any>[], email: string) {
  const out: Record<string, unknown> = {}
  perfRows.forEach((r) => {
    if (normEmail_(r.email) !== email) return
    out[String(r.period)] = {
      fromDate: String(r.from_date), toDate: String(r.to_date), days: dqNum_(r.days),
      overallPct: pwPct_(r.overall_pct), inboundPct: pwPct_(r.inbound_pct), textingPct: pwPct_(r.texting_pct),
      waPct: pwPct_(r.wa_pct), inboundAchieved: dqNum_(r.inbound_achieved), inboundMissed: dqNum_(r.inbound_missed),
      textingAchieved: dqNum_(r.texting_achieved), waAchieved: dqNum_(r.wa_achieved),
      productiveMin: dqNum_(r.productive_min), idleMin: dqNum_(r.idle_min), audits: dqNum_(r.audits),
      avgScore: pwNumOrNull_(r.avg_score) === null ? null : Math.round(Number(r.avg_score) * 10) / 10,
    }
  })
  return { last7: out['7d'] || null, prev7: out['prev7d'] || null, mtd: out['mtd'] || null }
}

/** Open-ticket aging for a set of rows (aging_open_tickets, cached): totals, the two oldest bands, the oldest few. */
export function pwAgingOut_(rows: Record<string, any>[], top: number, n: number) {
  const sorted = rows.slice().sort((a, b) => dqNum_(b.age_h) - dqNum_(a.age_h))
  return {
    open: rows.length,
    overTop: rows.filter((r) => dqNum_(r.band) === top).length,
    nearTop: rows.filter((r) => dqNum_(r.band) === top - 1).length,
    oldestH: sorted[0] ? dqNum_(sorted[0].age_h) : 0,
    oldest: sorted.slice(0, n).map((r) => ({
      id: String(r.ticket_id), queue: String(r.queue), status: String(r.status), ageH: dqNum_(r.age_h),
      band: dqNum_(r.band), agent: String(r.agent_name || ''),
    })),
  }
}

/**
 * pwOneOnOneContext_ — the numbers that sit beside the 1:1 form. Only cached
 * aggregates and memoised tables, plus one sc_daily read for the scores. Each
 * part fails on its own: a missing source becomes a note, never a zero.
 */
export async function pwOneOnOneContext_(
  pair: { kind: string; manager: string; report: string },
  dir: Directory,
  logs: Record<string, any>[],
): Promise<Record<string, any>> {
  const now = new Date()
  const today = pwToday_(now.getTime()) // Kuwait, the business day
  const notes: string[] = []
  const part = <T,>(label: string, fn: () => T | Promise<T>, dflt: T): T | Promise<T> => {
    try {
      const v = fn()
      if (v && typeof (v as any).catch === 'function') {
        return (v as Promise<T>).catch((e) => {
          console.log('1:1 context ' + label + ' failed: ' + e.message)
          notes.push(label + ' could not be read: ' + e.message)
          return dflt
        })
      }
      return v
    } catch (e) {
      console.log('1:1 context ' + label + ' failed: ' + (e as Error).message)
      notes.push(label + ' could not be read: ' + (e as Error).message)
      return dflt
    }
  }
  const cfg = (await configAll()) as Cfg
  const bands = await part('Aging bands', () => dqBandInfo_(cfg), { edges: [] as number[], labels: [] as string[] })
  const top = (bands.edges as unknown[]).length
  let scoreError = ''
  let scores: Record<string, any> | null = null
  try {
    const io = await scIo_(cfg)
    const kctx = await scKpiCtx_({ from: today.slice(0, 7) + '-01', to: today })
    scores = pwScoreMonths_(io, scWho_(dir), today, kctx)
  } catch (e) {
    scoreError = String((e as Error)?.message || e)
    console.log('1:1 context scorecard failed: ' + scoreError)
  }
  const aging = await part('Open tickets', async () => {
    const rows = await dqCachedLive('aging_open_tickets')
    const rosterRows = (await pwRows_('roster')) as Record<string, unknown>[]
    return dqWithCurrentTl_(rows, rosterRows.length ? rosterRows : null)
  }, [] as Record<string, unknown>[])
  const prodRows = await part('Productivity', () => dqCachedLive('agg_agent_perf'), [] as Record<string, unknown>[])
  const base: Record<string, any> = {
    today,
    floor: await pwScoreFloor_(),
    bands: bands.labels,
    scoreAsOf: await part('Scorecard date', () => (scores ? scores.current.to : ''), ''),
    scoreNotes: scores ? scores.notes : [],
    prodAsOf: await part('Productivity date', () => dqLastRun('agent_aggregates'), ''),
    agingAsOf: await part('Aging date', () => dqLastRun('queue_aggregates'), ''),
    ticketUrl: await part(
      'Freshdesk link',
      async () => 'https://' + String(await dqSetting('freshdesk_domain')) + '/a/tickets/',
      '',
    ),
    notes,
  }

  if (pair.kind === 'agent') {
    const curRow = scores
      ? scores.current.rows.filter((r: Record<string, any>) => r.email === pair.report)[0] || null
      : null
    base.agent = {
      // Never an empty panel: why there are no scorecard figures, in one line.
      scoreUnavailable: !scores
        ? 'Scorecard not available: ' + (scoreError || 'the scorecard could not be read.')
        : !curRow
          ? 'Scorecard not available: the Productivity Matrix has no day for this agent in ' +
            scores.current.month +
            (scores.current.status === 'never'
              ? ' (that month has not been loaded yet; an admin can set its workbook under Admin).'
              : '.')
          : '',
      score: scores ? pwScoreOut_(scores.current, pair.report) : null,
      lastMonth: scores ? pwScoreOut_(scores.previous, pair.report) : null,
      params: scores
        ? pwParamsOut_(
            scores.current,
            scores.previous,
            pair.report,
            curRow,
            scores.previous.rows.filter((r: Record<string, any>) => r.email === pair.report)[0] || null,
          )
        : [],
      scoreMonth: scores ? scores.current.month : today.slice(0, 7),
      productivity: pwProdOut_(prodRows, pair.report),
      aging: pwAgingOut_(
        aging.filter((r) => normEmail_(r.agent_email) === pair.report),
        top,
        5,
      ),
    }
    return base
  }

  const members = dir.agentsOf(pair.report)
  const mine: Record<string, boolean> = {}
  members.forEach((p) => {
    mine[p.email] = true
  })
  const teamAging = aging.filter((r) => mine[normEmail_(r.agent_email)])
  const lastHeld: Record<string, number> = {}
  logs.forEach((l) => {
    const e = normEmail_(l.report_email)
    if (mine[e] && (!lastHeld[e] || pwMs_(l.held_at) > lastHeld[e])) lastHeld[e] = pwMs_(l.held_at)
  })
  const cadence = await pwCadenceDays_('agent')
  /** The lowest of productivity, quality and FCR (the ones that exist), or null when none does. */
  const lowestOf = (vals: (number | null | undefined)[]) => {
    const have = vals.filter((v) => v !== null && v !== undefined) as number[]
    return have.length ? Math.min.apply(null, have) : null
  }
  const agents = members
    .map((p) => {
      const cur = scores ? pwScoreOut_(scores.current, p.email) : null
      const prev = scores ? pwScoreOut_(scores.previous, p.email) : null
      const prod = pwProdOut_(prodRows, p.email)
      const theirs = teamAging.filter((r) => normEmail_(r.agent_email) === p.email)
      const v = { prod: (cur ? cur.prod : null) as number | null, qual: (cur ? cur.qual : null) as number | null, fcr: (cur ? cur.fcr : null) as number | null }
      return {
        email: p.email, name: p.name,
        prod: v.prod as number | null, qual: v.qual as number | null, fcr: v.fcr as number | null,
        prodLast: prev ? (prev.prod as number | null) : null, qualLast: prev ? (prev.qual as number | null) : null, fcrLast: prev ? (prev.fcr as number | null) : null,
        lowest: lowestOf([v.prod, v.qual, v.fcr]),
        behaviorCases: cur ? cur.behaviorCases : 0,
        prod7: prod.last7 ? (prod.last7 as Record<string, unknown>).overallPct : null,
        prodPrev7: prod.prev7 ? (prod.prev7 as Record<string, unknown>).overallPct : null,
        open: theirs.length,
        overTop: theirs.filter((r) => dqNum_(r.band) === top).length,
        lastOneOnOne: lastHeld[p.email] ? pwKwDate_(lastHeld[p.email]) : '',
      }
    })
    .sort((a, b) => {
      // Worst first by the lowest of productivity, quality and FCR; no scorecard figures last; then name.
      if (a.lowest !== null && b.lowest !== null && a.lowest !== b.lowest) return (a.lowest as number) - (b.lowest as number)
      if (a.lowest === null !== (b.lowest === null)) return a.lowest === null ? 1 : -1
      return a.name.localeCompare(b.name)
    })
  const byQueue: Record<string, number> = {}
  teamAging.forEach((r) => {
    if (dqNum_(r.band) === top) byQueue[String(r.queue)] = (byQueue[String(r.queue)] || 0) + 1
  })
  const flags = await part('Help requests', async () => {
    const flagStore = await readStore('dq_aging_flags')
    return dqOpenAgingFlags_(flagStore.exists ? flagStore.rows : null, aging).filter(
      (f) => f.tlEmail === pair.report || mine[f.by],
    )
  }, [] as { tlEmail: string; by: string; ticketId: string; note: string; at: string }[])
  const slots = await part(
    'Check-ins',
    async () => {
      const subs = await readStore('queue_submissions')
      return dqSlotsToday_(now, cfg, subs.exists ? subs.rows : null)
    },
    [] as Record<string, any>[],
  )
  const scored = agents.filter((a) => a.lowest !== null)
  base.team = {
    headcount: members.length,
    scored: scored.length,
    belowFloor: scored.filter((a) => (a.lowest as number) < base.floor).length,
    aging: pwAgingOut_(teamAging, top, 5),
    overTopByQueue: Object.keys(byQueue)
      .sort((a, b) => byQueue[b] - byQueue[a])
      .slice(0, 3)
      .map((q) => ({ queue: q, count: byQueue[q] })),
    // A ticket with no agent belongs to no team; every lead sees these until someone takes them (as on Home).
    noAgent: aging.filter((r) => !r.agent_email && dqNum_(r.band) >= top - 1).length,
    agents,
    slots: slots.map((s) => ({
      slot: s.slot, name: s.name, state: s.state,
      submittedBy: s.submittedBy ? dir.name(s.submittedBy) : '',
    })),
    flags: flags.map((f) => ({ ticketId: f.ticketId, by: dir.name(f.by), note: f.note, at: f.at })),
    oneOnOnes: {
      cadenceDays: cadence,
      overdue: members.filter(
        (p) => !lastHeld[p.email] || lastHeld[p.email] < now.getTime() - (cadence + 3) * PW_DAY_MS,
      ).length,
      missed30: (
        await pwRows_(
          'one_on_one_schedule',
          (s) =>
            normEmail_(s.manager_email) === pair.report &&
            String(s.status) === 'missed' &&
            pwMs_(s.scheduled_at) >= now.getTime() - 30 * PW_DAY_MS,
        )
      ).length,
    },
  }
  return base
}

/** Suggested topics from the numbers in ctx, worst first (pwDataSuggestions_). */
export function pwDataSuggestions_(
  kind: string,
  ctx: Record<string, any>,
  add: (topic: string, reason: string) => void,
) {
  const floor = ctx.floor
  if (kind === 'agent' && ctx.agent) {
    // Score topics come only from productivity, quality and FCR under the floor (no overall score).
    const s = ctx.agent.score
    const ag = ctx.agent.aging
    if (s && s.qual !== null && s.qual < floor)
      add('quality', 'Quality ' + s.qual + '% over ' + s.audits + ' audit' + (s.audits === 1 ? '' : 's') + ' this month (red under ' + floor + '%)')
    if (s && s.prod !== null && s.prod < floor)
      add('productivity', 'Productivity ' + s.prod + '% of target this month (red under ' + floor + '%)')
    if (s && s.fcr !== null && s.fcr < floor)
      add('fcr', 'FCR ' + s.fcr + '% this month: ' + s.fcrPassed + ' of ' + (s.fcrPassed + s.fcrFailed) + ' checked contacts resolved first time (red under ' + floor + '%)')
    if (ag && ag.overTop > 0)
      add('backlog', ag.overTop + ' open ticket' + (ag.overTop > 1 ? 's' : '') + ' in the oldest aging band')
    return
  }
  if (kind === 'tl' && ctx.team) {
    const t = ctx.team
    const risky = (ctx.tasks || []).filter(
      (x: Record<string, any>) => x.overdue || x.progressState === 'blocked' || (x.riskReasons || []).length,
    )
    if (risky.length)
      add('delivery', risky.length + ' project' + (risky.length > 1 ? 's' : '') + ' past deadline, blocked or at risk')
    if (t.headcount && t.belowFloor)
      add('team_performance', t.belowFloor + ' of ' + t.headcount + ' agents under ' + floor + '% on productivity, quality or FCR this month')
    if (t.aging.overTop || t.flags.length) {
      add('escalations', [
        t.aging.overTop ? t.aging.overTop + ' team ticket' + (t.aging.overTop > 1 ? 's' : '') + ' in the oldest band' : '',
        t.flags.length ? t.flags.length + ' agent help request' + (t.flags.length > 1 ? 's' : '') + ' open' : '',
      ].filter(String).join(', '))
    }
    if (t.oneOnOnes.overdue || t.oneOnOnes.missed30) {
      add('coaching', [
        t.oneOnOnes.overdue ? t.oneOnOnes.overdue + ' agent' + (t.oneOnOnes.overdue > 1 ? 's' : '') + ' with no 1:1 in ' + (t.oneOnOnes.cadenceDays + 3) + ' days' : '',
        t.oneOnOnes.missed30 ? t.oneOnOnes.missed30 + ' missed 1:1' + (t.oneOnOnes.missed30 > 1 ? 's' : '') + ' in 30 days' : '',
      ].filter(String).join(', '))
    }
    const missedSlots = t.slots.filter((x: Record<string, any>) => x.state === 'missed')
    if (missedSlots.length) add('operations', 'Check-in missed today: ' + missedSlots.map((x: Record<string, any>) => x.slot).join(', '))
    if ((ctx.tasks || []).length && !risky.length)
      add('delivery', (ctx.tasks || []).length + ' open project' + ((ctx.tasks || []).length > 1 ? 's' : '') + ' to walk through')
    if (t.headcount && !t.belowFloor)
      add('team_performance', t.headcount + ' agent' + (t.headcount === 1 ? '' : 's') + ' on the team, none under ' + floor + '% on productivity, quality or FCR')
  }
}

/** A TL task as the 1:1 projects panel shows it (pwOneOnOneTaskOut_). */
export function pwOneOnOneTaskOut_(t: Record<string, any>) {
  const last = t.milestones.length ? t.milestones[t.milestones.length - 1] : null
  return {
    actionId: t.actionId, title: t.title, description: t.description || '', ownerEmail: t.ownerEmail,
    status: t.status, priority: t.priority, startAt: t.startAt, deadlineAt: t.deadlineAt, estHours: t.estHours,
    percent: t.percent, freeHours: t.hours ? t.hours.free : null, fitStatus: t.fitStatus,
    progressState: t.progressState, ragSelf: t.ragSelf, blockedReason: t.blockedReason, overdue: t.overdue,
    riskReasons: t.riskReasons, expectation: t.expectation || '',
    lastUpdate: last ? { note: last.note, nextStep: last.nextStep, at: last.at, byName: last.byName } : null,
  }
}

/**
 * oneOnOnesStart — opens a 1:1 with reportEmail: the carry-forward list (must
 * all be reviewed), the person's other open actions, suggested topics and the
 * last record.
 */
export async function oneOnOnesStart(reportEmail: string) {
  const user = await requireRole(['admin', 'tl'])
  const dir = await pwDirectory()
  const pair = pwPair_(user, reportEmail, dir)
  const series = pwSeriesKey_(pair.manager, pair.report)
  const [actions, logs, topics] = await Promise.all([
    pwRows_('actions'),
    pwRows_('one_on_one_logs'),
    pwRows_('one_on_one_topics'),
  ])
  const carry = pwOpenSeriesActions_(series, actions).filter((a) => pwCanSeeAction_(a, user, dir))
  const other = actions.filter(
    (a) =>
      normEmail_(a.owner_email) === pair.report &&
      pwIsOpenStatus_(String(a.status || 'open')) &&
      String(a.series_id) !== series &&
      pwCanSeeAction_(a, user, dir) &&
      !(a.track_as_task === true || String(a.track_as_task).toLowerCase() === 'true'), // tasks get their own list below
  )
  // The report's open TL tasks with progress, so the old tasks are discussed in the same window.
  let tasks: Record<string, any>[] = []
  try {
    const taskRows = pwTasksOut_(await pwTaskContext_())
    const working = taskRows
      .filter(
        (t) =>
          normEmail_(t.ownerEmail) === pair.report &&
          pwIsOpenStatus_(String(t.status || 'open')) &&
          pwCanSeeAction_(t, user, dir),
      )
      .sort((a, b) => pwMs_(a.deadlineAt) - pwMs_(b.deadlineAt))
    // pwWorkingHours_ needs the calendar: each task's hours come from the ctx memo.
    tasks = working.map(pwOneOnOneTaskOut_)
  } catch (e) {
    console.log('1:1 tasks failed: ' + (e as Error).message)
  }
  const ctx = await pwOneOnOneContext_(pair, dir, logs)
  ctx.tasks = tasks
  const signals = await pwRows_('people_signals', (r) => normEmail_(r.email) === pair.report)
  const suggestions = pwSuggestTopics_(pair, logs, topics, actions, Date.now(), ctx, signals)
  delete ctx.tasks // already sent as start.tasks
  const last = logs.filter((l) => normEmail_(l.report_email) === pair.report).sort(pwNewestLogFirst_)[0]
  const updates = await pwRows_('action_updates')
  const latestUpdate = (id: unknown) => {
    const u = updates
      .filter((x) => String(x.action_id) === String(id))
      .sort((a, b) => pwMs_(b.submitted_at) - pwMs_(a.submitted_at))[0]
    return u ? pwUpdateOut_(u, dir) : null
  }
  return {
    kind: pair.kind,
    report: { email: pair.report, name: pair.reportName },
    seriesId: series,
    carryForward: carry.map((a) => {
      const o = pwActionOut_(a, dir)
      o.latestUpdate = latestUpdate(a.action_id)
      return o
    }),
    otherOpen: other.map((a) => pwActionOut_(a, dir)),
    tasks,
    context: ctx,
    suggestions,
    lastLog: last ? { logId: String(last.log_id), heldAt: pwIso_(last.held_at), summary: String(last.summary || '') } : null,
    // TL 1:1: who a project can be handed to (team leads and admins), for the projects panel.
    taskOwners:
      pair.kind === 'tl'
        ? dir
            .tls()
            .concat(dir.admins.map((e) => dir.person(e)).filter(Boolean) as never)
            .map((p: { email: string; name: string }) => ({ email: p.email, name: p.name }))
        : [],
    library: await pwLibraryDb(pair.kind),
    outcomes: PW_OUTCOMES,
    owners: [
      { email: pair.manager, name: dir.name(pair.manager) },
      { email: pair.report, name: pair.reportName },
    ],
  }
}

// ---------------------------------------------------------------- submit

export function pwValidateTopic_(kind: string, t: Record<string, any>, i: number) {
  const def = pwTopicDef_(kind, t && t.topic)
  if (!def) throw new Error('Topic ' + (i + 1) + ' is not in the topic library.')
  const outcome = String(t.outcome || '')
  if (PW_OUTCOMES.indexOf(outcome) === -1) throw new Error('Choose an outcome for "' + def.label + '".')
  const fields = t.fields || {}
  ;(def.fields || []).forEach((f) => {
    if (f.required && !String(fields[f.id] || '').trim()) throw new Error('"' + def.label + '" needs ' + f.label + '.')
  })
  let evidence: Record<string, unknown> | null = null
  if (def.performance) {
    evidence = t.evidence || {}
    const evd = evidence as Record<string, unknown>
    PW_EVIDENCE_FIELDS.forEach((k) => {
      if (!String((evidence as Record<string, unknown>)[k] || '').trim()) {
        throw new Error(
          '"' +
            def.label +
            '" is a performance topic: fill in the behaviour, evidence, standard, whether the standard was shown before, and their explanation.',
        )
      }
    })
    const shown = String(evd.shownBefore).toLowerCase()
    if (['yes', 'no', 'unsure'].indexOf(shown) === -1)
      throw new Error('Answer "Was the standard shown before?" with Yes, No or Unsure.')
    // Fairness rule: a standard nobody showed them cannot be a performance concern.
    if (shown !== 'yes' && PW_FAIRNESS_OUTCOMES.indexOf(outcome) === -1) {
      throw new Error(
        'The standard was not shown before, so "' +
          def.label +
          '" can only be recorded as Standard communicated or Coaching given.',
      )
    }
    evidence = {
      behaviour: String(evd.behaviour), evidence: String(evd.evidence),
      standard: String(evd.standard), shownBefore: shown, explanation: String(evd.explanation),
    }
  }
  const raised = ['tl', 'agent', 'system', 'mohamed'].indexOf(String(t.raisedBy)) !== -1 ? String(t.raisedBy) : 'tl'
  return {
    def, outcome, evidence, raisedBy: raised, fields,
    confidential: def.id === 'wellbeing' && String(fields.confidential).toLowerCase() === 'yes',
  }
}

/**
 * oneOnOnesSubmit — payload:
 *   reportEmail, scheduleId?, heldAt,
 *   reviews: [{ actionId, outcome, note, newDueDate }]   - every carry-forward action
 *   topics:  [{ topic, raisedBy, answers {promptId: text}, fields {}, evidence {}, outcome }]  (1-3)
 *   skipped: [{ topic, reason }]                          - unticked suggested performance topics
 *   actions: [{ title, ownerEmail, dueDate, trackAsTask }] (>= 1 unless noActionReason applies)
 *   noActionReason, privateNote, assessment { saw, concerns, ownActions } (TL 1:1s, admin only)
 */
export async function oneOnOnesSubmit(payload: Record<string, any>) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const dir = await pwDirectory()
  payload = payload || {}
  const pair = pwPair_(user, payload.reportEmail, dir)
  const series = pwSeriesKey_(pair.manager, pair.report)
  const now = Date.now()
  const heldMs = payload.heldAt ? pwMs_(payload.heldAt) : now
  if (isNaN(heldMs)) throw new Error('Enter when the 1:1 was held.')
  if (heldMs > now + 5 * 60 * 1000) throw new Error('A 1:1 cannot be logged before it happens.')

  // A 1:1 is logged once: checked first, so a duplicate gets this message rather than a form error.
  let schedule: Record<string, any> | null = null
  if (payload.scheduleId) {
    schedule = await findRow('one_on_one_schedule', 'schedule_id', String(payload.scheduleId))
    if (!schedule || pwSeriesKey_(schedule.manager_email, schedule.report_email) !== series) {
      throw new Error('That scheduled 1:1 is not with this person.')
    }
    if (['rescheduled', 'cancelled', 'deleted'].indexOf(String(schedule.status)) !== -1) {
      throw new Error('That booking was moved, marked not held or deleted. Choose the current booking, or none.')
    }
    if (['scheduled', 'missed', 'excused'].indexOf(String(schedule.status)) === -1) {
      throw new Error(
        'The 1:1 booked for ' +
          pwDayLabel_(pwMs_(schedule.scheduled_at)) +
          ' at ' +
          pwKwTime_(schedule.scheduled_at) +
          ' is already logged. Open it under Records; it is not logged twice.',
      )
    }
  }
  const logs = await pwRows_('one_on_one_logs')
  const bookedRows = schedule
    ? []
    : await pwRows_('one_on_one_schedule', (s) => {
        return (
          normEmail_(s.manager_email) === pair.manager &&
          normEmail_(s.report_email) === pair.report &&
          ['scheduled', 'missed'].indexOf(String(s.status)) !== -1
        )
      })
  pwRefuseDuplicateLog_(pair, schedule, heldMs, logs, bookedRows, dir)

  // Topics: 1 to 3, from the library, with the fairness rule.
  const topics = payload.topics || []
  if (topics.length < 1 || topics.length > 3) throw new Error('Pick between 1 and 3 topics.')
  const seen: Record<string, boolean> = {}
  const checked = topics.map((t: Record<string, any>, i: number) => {
    if (seen[t.topic]) throw new Error('Each topic can be picked once.')
    seen[t.topic] = true
    return pwValidateTopic_(pair.kind, t, i)
  })

  // A suggested performance topic left out needs a reason, so a skipped issue is visible.
  const [actionsAll, topicRows] = await Promise.all([pwRows_('actions'), pwRows_('one_on_one_topics')])
  const suggestions = pwSuggestTopics_(pair, logs, topicRows, actionsAll, now, null,
    await pwRows_('people_signals', (r) => normEmail_(r.email) === pair.report))
  const skipped: Record<string, string> = {}
  ;(payload.skipped || []).forEach((s: Record<string, any>) => {
    skipped[s.topic] = String(s.reason || '').trim()
  })
  const skippedRows: { topic: string; reason: string }[] = []
  suggestions.forEach((s) => {
    if (seen[s.topic]) return
    if (s.performance && !skipped[s.topic])
      throw new Error('Say why the suggested topic "' + s.label + '" was not discussed.')
    if (skipped[s.topic]) skippedRows.push({ topic: s.topic, reason: skipped[s.topic] })
  })
  // Topics suggested from the numbers beside the form (pwDataSuggestions_) are not re-derived here,
  // because the cached numbers can move between opening and submitting; the window asks for the
  // reason, and it is kept the same way.
  Object.keys(skipped).forEach((topic) => {
    if (!skipped[topic] || seen[topic] || !pwTopicDef_(pair.kind, topic)) return
    if (skippedRows.some((r) => r.topic === topic)) return
    skippedRows.push({ topic, reason: skipped[topic] })
  })

  // Carry-forward: every open action in this series must get an outcome.
  const open = pwOpenSeriesActions_(series, actionsAll)
  const reviewed: Record<string, boolean> = {}
  ;(payload.reviews || []).forEach((r: Record<string, any>) => {
    reviewed[r.actionId] = true
  })
  const missing = open.filter((a) => !reviewed[String(a.action_id)])
  if (missing.length)
    throw new Error('Review every open action first: ' + missing.map((a) => '"' + String(a.title) + '"').join(', ') + '.')

  // Close: at least one owned, dated action, or the narrow no-action exception.
  const newActions = payload.actions || []
  const noActionReason = String(payload.noActionReason || '').trim()
  if (!newActions.length) {
    const allowed = checked.every((c: Record<string, any>) => PW_NO_ACTION_TOPICS.indexOf(c.def.id) !== -1 && c.outcome === 'Resolved')
    if (!allowed) throw new Error('Agree at least one action with an owner and a due date.')
    if (!noActionReason) throw new Error('Say in one line why no action is needed.')
  }

  // A double click sends the same record twice in a few hundred ms: the second one stops here.
  const busyKey = 'pw:oo-submitting:' + series
  if (cacheGet(busyKey)) throw new Error('This 1:1 is already being saved. Wait a moment, then check Records.')
  cachePut(busyKey, '1', 60)
  try {
    return await pwSubmitWrite_(
      payload, user, dir, pair, series, now, heldMs, checked, topics, suggestions, skippedRows, open,
      newActions, noActionReason, schedule,
    )
  } finally {
    cacheRemove(busyKey)
  }
}

/**
 * pwRefuseDuplicateLog_ — the second record for the same 1:1 is refused: a
 * booking already logged, a record for the same pair in the same Kuwait week,
 * or a booked one that week that the record should attach to.
 */
export function pwRefuseDuplicateLog_(
  pair: { manager: string; report: string },
  schedule: Record<string, any> | null,
  heldMs: number,
  logs: Record<string, any>[],
  bookedRows: Record<string, any>[],
  dir: { name: (e: string) => string },
) {
  const name = dir.name(pair.report)
  const mine = logs.filter(
    (l) => normEmail_(l.manager_email) === pair.manager && normEmail_(l.report_email) === pair.report,
  )
  if (schedule) {
    const hit = mine.filter((l) => String(l.schedule_id) === String(schedule.schedule_id))[0]
    if (hit)
      throw new Error(
        'The 1:1 with ' + name + ' booked for ' + pwDayLabel_(pwMs_(schedule.scheduled_at)) + ' is already logged (held ' +
          pwDayLabel_(pwMs_(hit.held_at)) + ' at ' + pwKwTime_(hit.held_at) + '). It is not logged twice.',
      )
    return
  }
  const week = pwWeekOf_(heldMs)
  const inWeek = (ms: number) => {
    const d = pwKwDate_(ms)
    return d >= week.start && d <= week.end
  }
  const same = mine.filter((l) => inWeek(pwMs_(l.held_at)))[0]
  if (same) {
    throw new Error(
      'A 1:1 with ' + name + ' is already logged that week, held ' + pwDayLabel_(pwMs_(same.held_at)) + ' at ' +
        pwKwTime_(same.held_at) + '. One record a week: if that record is wrong, an admin can delete it first.',
    )
  }
  const booked = bookedRows.filter((s) => inWeek(pwMs_(s.scheduled_at)))[0]
  if (booked) {
    throw new Error(
      'There is a 1:1 with ' + name + ' booked that week (' + pwDayLabel_(pwMs_(booked.scheduled_at)) + ' at ' +
        pwKwTime_(booked.scheduled_at) + '). Choose it under "Which booked slot does this record?" so it is logged against that booking.',
    )
  }
}

export async function pwSubmitWrite_(
  payload: Record<string, any>,
  user: PwUser,
  dir: Directory,
  pair: { kind: string; manager: string; report: string },
  series: string,
  now: number,
  heldMs: number,
  checked: Record<string, any>[],
  topics: Record<string, any>[],
  suggestions: Record<string, any>[],
  skippedRows: { topic: string; reason: string }[],
  open: Record<string, any>[],
  newActions: Record<string, any>[],
  noActionReason: string,
  schedule: Record<string, any> | null,
) {
  const logId = newId('OOL')
  const sourceType = pair.kind === 'tl' ? 'one_on_one_tl' : 'one_on_one_agent'
  const actionRows = pwBuildActions_(
    newActions,
    { sourceType, sourceId: logId, seriesId: series, allowedOwners: [pair.manager, pair.report] },
    user,
    dir,
  )
  const onTime = schedule ? !pwIsMissed_(pwMs_(schedule.scheduled_at), now, now, await pwOneOnOneCutoff_()) : true

  // Writes. Reviews first: if a guard refuses, nothing else is stored.
  await pwApplyReviews_(payload.reviews || [], 'one_on_one', logId, series, user, dir)
  const summary = pwBuildSummary_(checked, actionRows, payload.reviews || [], open, dir)
  await pwAppend_('one_on_one_logs', [{
    log_id: logId, schedule_id: schedule ? schedule.schedule_id : '', kind: pair.kind, manager_email: pair.manager,
    report_email: pair.report, held_at: new Date(heldMs).toISOString(), summary,
    no_action_reason: newActions.length ? '' : noActionReason, on_time: onTime,
  }], user.email)
  await pwAppend_(
    'one_on_one_topics',
    checked
      .map((c, i): Record<string, unknown> => {
        const t = topics[i]
        return {
          log_id: logId, topic: c.def.id, position: i + 1, raised_by: c.raisedBy,
          suggested: suggestions.some((s) => s.topic === c.def.id), skipped_reason: '', outcome: c.outcome,
          confidential: c.confidential, answers_json: JSON.stringify(t.answers || {}),
          fields_json: JSON.stringify(c.fields || {}), evidence_json: c.evidence ? JSON.stringify(c.evidence) : '',
        }
      })
      .concat(
        skippedRows.map((s) => ({
          log_id: logId, topic: s.topic, position: '', raised_by: 'system', suggested: true,
          skipped_reason: s.reason, outcome: '', confidential: false, answers_json: '', fields_json: '', evidence_json: '',
        })),
      ),
    user.email,
  )
  await pwAppend_('actions', actionRows, user.email)

  const privateRows: Record<string, unknown>[] = []
  if (String(payload.privateNote || '').trim()) {
    privateRows.push({ log_id: logId, kind: 'private_note', author_email: user.email, note: String(payload.privateNote).trim() })
  }
  if (payload.assessment && pair.kind === 'tl' && user.role === 'admin') {
    const a = payload.assessment
    const text = [
      'What I saw: ' + String(a.saw || '').trim(),
      'Concerns: ' + String(a.concerns || '').trim(),
      'My own actions: ' + String(a.ownActions || '').trim(),
    ].join('\n')
    if (String(a.saw || a.concerns || a.ownActions || '').trim()) {
      privateRows.push({ log_id: logId, kind: 'private_assessment', author_email: user.email, note: text })
    }
  }
  await pwAppend_('one_on_one_private_notes', privateRows, user.email)

  if (schedule) {
    await updateRow('one_on_one_schedule', 'schedule_id', schedule.schedule_id, {
      status: onTime ? 'held' : 'held_late', log_id: logId,
    }, { actor: user.email })
    await resolvePopups('missed_1on1', String(schedule.schedule_id), user.email)
    pwOoRemindersChanged_()
  }
  await pwRaiseEscalation_(logId, checked, pair, user, dir)
  // The coaching signals for this person reached their 1:1: close the TL's pop-ups.
  const sigs = await pwRows_('people_signals', (r) => normEmail_(r.email) === pair.report)
  for (const r of sigs) await resolvePopups('coaching_signal', String(r.signal_id), user.email)
  return oneOnOnesGetLog(logId)
}

/**
 * pwRaiseEscalation_ — "Escalate to Mohamed" on any topic reaches every admin:
 * a pop-up and one email. Opening the record in oneOnOnesGetLog resolves it.
 */
export async function pwRaiseEscalation_(
  logId: string,
  checked: Record<string, any>[],
  pair: { report: string },
  user: { email: string; name?: string },
  dir: Directory,
) {
  const esc = checked.filter((c) => c.outcome === 'Escalate to Mohamed')
  if (!esc.length) return
  const topicsText = esc.map((c) => c.def.label || c.def.id).join(', ')
  const who = dir.name(pair.report)
  const adminEmails = new Set(dir.admins.map((e) => String(e || '').trim().toLowerCase()))
  Object.keys(dir.by).forEach((e) => {
    if (dir.by[e].role === 'admin') adminEmails.add(e)
  })
  const admins = [...adminEmails].filter((e) => {
    const p = dir.person(e)
    return p && p.role === 'admin' && p.active && e !== user.email
  })
  for (const admin of admins) {
    await raisePopup(
      {
        recipient: admin, kind: 'escalation_1on1', ref: logId,
        title: user.name + ' escalated a 1:1 with ' + who,
        body: 'Topic: ' + topicsText + '. Open the record to see what was discussed and agreed.',
        link: '#/one-on-ones?log=' + logId,
      },
      user.email,
    )
  }
  if (admins.length) {
    await sendMail(
      {
        to: admins, kind: 'escalation_1on1', ref: logId, subject: 'Escalated to you: 1:1 with ' + who,
        htmlBody:
          '<p>' + escapeHtml(user.name) + ' escalated a 1:1 with ' + escapeHtml(who) + ' to you (' +
          escapeHtml(topicsText) + ').</p><p>Open 1:1s in Dabdoob CX to read the record.</p>',
      },
      user.email,
    )
  }
}

/** pwBuildSummary_ — the shared record: topics, outcomes, reviewed and new actions. No private material. */
export function pwBuildSummary_(
  checked: Record<string, any>[],
  actionRows: Record<string, any>[],
  reviews: Record<string, any>[],
  open: Record<string, any>[],
  dir: { name: (e: string) => string },
): string {
  const lines: string[] = []
  checked.forEach((c) => {
    lines.push(c.def.label + ': ' + c.outcome + (c.confidential ? ' (confidential)' : ''))
  })
  if (reviews.length) {
    const byId: Record<string, Record<string, any>> = {}
    open.forEach((a) => {
      byId[String(a.action_id)] = a
    })
    lines.push(
      'Reviewed: ' +
        reviews
          .map((r) => {
            const a = byId[String(r.actionId)]
            return (a ? a.title : r.actionId) + ' (' + r.outcome + ')'
          })
          .join('; '),
    )
  }
  actionRows.forEach((a) => {
    lines.push('Action: ' + a.title + ', ' + dir.name(String(a.owner_email)) + ', due ' + pwStr_(a.due_date))
  })
  return lines.join('\n')
}
