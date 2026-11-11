/**
 * TL performance — verbatim port of Desk_deprecated/TlPerformance.js (+ the
 * KpiLogs.js page lives in ./kpilogs.ts, MailDesk.js in ./maildesk.ts).
 *
 *   tlPerformancePage / tlpRateArea / tlpRateProject
 *   kbTrackerPage / kbTrackerSave / otdSave
 *   setupDesk / installDeskTriggers
 *
 * Datastore notes: dqReadObjects_(..., missingOk) -> readStore rows ([] when
 * the table is absent); dqUpsertIn_ -> Postgres upsert on the same key
 * columns; the script lock has no Postgres equivalent — upserts apply
 * serially per call. pwTxt_ ("'2026-10") is a sheet-cell concern: text
 * columns store the plain value.
 */

import 'server-only'

import { db, newId, readRows } from '@/features/shared/platform/repo'
import { readStore } from '@/features/shared/platform/stores'
import { getConfig, setConfig, configAll } from '@/features/shared/platform/settings'
import { dqLastRun } from '@/features/shared/platform/stores'
import {
  normEmail,
  pwDirectory,
  pwIsManagerOf,
  requireRole,
  type Directory,
  type PlatformUser,
} from '@/features/shared/platform/identity'
import { assertWritable } from '@/features/shared/platform/viewas'
import { pwIso, pwMs, pwToday, dqAddDays } from '@/features/shared/platform/time'
import { mdForTl_ } from './maildesk'

type Row = Record<string, unknown>

export const TLP_HEADERS: Record<string, string[]> = {
  tlp_resp_ratings: ['rating_id', 'tl_email', 'week', 'area', 'rating', 'note', 'rated_by', 'rated_at'],
  tlp_kb: ['kb_id', 'topic', 'requested_at', 'done_at', 'accurate', 'owner_email', 'note', 'created_by', 'created_at', 'updated_at'],
  tlp_otd: ['key', 'month', 'warehouse', 'value', 'entered_by', 'entered_at'],
  tlp_ticket_exclusions: ['key', 'area', 'ticket_id', 'reason', 'logged_by', 'logged_at', 'removed_by', 'removed_at'],
}

/** Mohamed's responsibility sheet (2026-10-11): area -> target and how it is measured. */
export const TLP_AREAS_SEED: Record<string, { target: string; measuredBy: string }> = {
  Refunds: { target: '100% accuracy; 95% within SLA', measuredBy: 'Freshdesk reports' },
  'Operational loss': { target: '100% accuracy; 95% within SLA', measuredBy: 'Operational loss tracker (Google Sheet)' },
  'Knowledge base': { target: 'At least 100% accuracy; updates within 1 day', measuredBy: 'KB tracker (Google Sheet)' },
  'WBR comments': { target: 'Comments in by Monday end of day', measuredBy: 'The WBR presentation' },
  Returns: { target: 'At least 90% within the 4-day SLA (Ajex and areas outside KSA excluded)', measuredBy: 'Freshdesk reports' },
  WBR: { target: 'Numbers 100% accurate, 90% on time; WBR ready on Sunday', measuredBy: 'Google Slides (when the slides were shared)' },
  'Daily report': { target: 'Numbers 100% accurate; sent before 11 PM', measuredBy: 'Time sent on WhatsApp (Google Sheet)' },
  OTD: { target: 'Numbers 100% accurate; by 12 PM', measuredBy: 'OTD Google Sheet' },
  'Scheduling accuracy': {
    target: "At least 90% excluding peaks: HC needed per day from the last 3 months' heatmap; owns leave approvals",
    measuredBy: 'TL scheduler + the monthly plan review on the 25th',
  },
  Complaints: { target: 'Every complaint handled the same day (100% SLA)', measuredBy: 'Unverified: ask Mohamed' },
}

export const TLP_OWNERS_BY_NAME = [
  { names: ['Noha Hassan Foaad Qandil', 'Noha'], areas: ['Refunds', 'Operational loss'] },
  { names: ['Menna Mekawy', 'Menna'], areas: ['Knowledge base', 'WBR comments', 'Returns'] },
  { names: ['Ahmed Essam Ismail Ali', 'Esmail', 'Ismail'], areas: ['WBR', 'Daily report', 'OTD', 'Scheduling accuracy'] },
  { names: ['Ahmed Naguib', 'Nagieb', 'Naguib'], areas: ['Complaints'] },
]

export const TLP_SETTINGS: Record<string, { value: unknown; description: string }> = {
  tlp_weights: {
    value: { team: 85, responsibilities: 15 },
    description:
      "JSON: weight (%) in a team lead's overall score of the team KPI (mean of the agents' KPI payout, KpiPayout.js) and of the TL's own responsibilities (mean of this week's slider ratings). 85 / 15 is UNCONFIRMED (2026-10-11).",
  },
  tlp_rating_zones: {
    value: { meets: 75, exceeds: 95 },
    description:
      'JSON: where a 0-100 rating turns from Below to Meets (meets) and from Meets to Exceeds (exceeds). Default: below under 75, meets 75-94, exceeds 95 and over.',
  },
  otd_warehouses: {
    value: ['Warehouse 1', 'Warehouse 2', 'Warehouse 3', 'Warehouse 4', 'Warehouse 5', 'Warehouse 6', 'Warehouse 7'],
    description: 'The 7 warehouses of the OTD monthly entry (names to be set).',
  },
  otd_sheet_id: { value: '', description: 'OTD Google Sheet (comes later). Empty: OTD is entered by hand, one value per warehouse per month.' },
  tlp_responsibility_areas: { value: TLP_AREAS_SEED, description: 'JSON: responsibility area -> { target, measuredBy } (Mohamed 2026-10-11).' },
  tlp_tl_areas: {
    value: {},
    description: 'JSON: team lead email -> the areas they own. setupDesk fills it from the Roster by first name (Noha, Menna, Esmail, Nagieb).',
  },
}

const TLP_MANAGER_EMAIL = 'k.elnaggar@dabdoob.com'

async function tlpSetting_(key: string): Promise<unknown> {
  const d = TLP_SETTINGS[key]
  return getConfig(key, d ? d.value : '')
}

// =====================================================================
// Pure rules
// =====================================================================

/** Sunday that starts the CX week of a yyyy-MM-dd date (same as Queue.js dqWeekStart_). */
export function tlpWeek_(key: string): string {
  const p = String(key).split('-')
  const dow = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] - dow)).toISOString().slice(0, 10)
}

/**
 * Weighted mean of the components that exist (0-100). parts: { quality, fcr, productivity, responsibilities }.
 * Returns { score, used, missing, weights } with weights = the shares (%) actually applied.
 */
export function tlpOverall_(
  parts: Record<string, number | null | undefined>,
  weights: Record<string, number> | null,
): { score: number | null; used: string[]; missing: string[]; weights: Record<string, number> } {
  const w = weights || {}
  const keys = Object.keys(w).filter((k) => Number(w[k]) > 0)
  const has = (k: string) => parts[k] !== null && parts[k] !== undefined && parts[k] !== ('' as unknown) && isFinite(Number(parts[k]))
  const used = keys.filter(has)
  const missing = keys.filter((k) => !has(k))
  const total = used.reduce((s, k) => s + Number(w[k]), 0)
  const shares: Record<string, number> = {}
  used.forEach((k) => {
    shares[k] = Math.round((Number(w[k]) / total) * 1000) / 10
  })
  const score = total ? Math.round((used.reduce((s, k) => s + Number(parts[k]) * Number(w[k]), 0) / total) * 10) / 10 : null
  return { score, used, missing, weights: shares }
}

/** Mean of the numbers (one decimal); null when none. */
export function tlpMean_(vals: unknown[]): number | null {
  const v = vals.filter((x) => x !== null && x !== undefined && x !== '' && isFinite(Number(x))).map(Number)
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
}

/** Below / Meets / Exceeds of a 0-100 rating (tlp_rating_zones). '' when there is no rating. */
export function tlpLabel_(value: unknown, zones: { meets?: unknown; exceeds?: unknown } | null): string {
  if (value === null || value === undefined || value === '' || !isFinite(Number(value))) return ''
  const v = Number(value)
  const z = zones || {}
  return v >= Number(z.exceeds || 95) ? 'exceeds' : v >= Number(z.meets || 75) ? 'meets' : 'below'
}

/** A slider value: a whole number 0-100 in steps of 5, or throws. */
export function tlpCheckValue_(v: unknown): number {
  const n = Number(v)
  if (!isFinite(n) || n < 0 || n > 100 || n % 5) throw new Error('A rating is 0 to 100 in steps of 5.')
  return n
}

interface PersonLike {
  active?: unknown
  name?: unknown
  email?: string
  role?: string
}

/** Roster people whose name matches one of `names`: the full name exactly, or a short name as one of its words. Pure. */
export function tlpByName_(people: PersonLike[], names: string[]): PersonLike[] {
  const key = (s: unknown) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const full = people.filter((p) => p.active && names.some((n) => key(p.name) === key(n)))
  if (full.length) return full
  return people.filter((p) => p.active && names.some((n) => key(p.name).split(' ').indexOf(key(n)) !== -1))
}

/** KB tracker numbers over rows done since fromIso: % accurate (of the rows marked) and % done within 1 day. Pure. */
export function tlpKbMetrics_(rows: Row[], fromIso: string) {
  const done = rows.filter((r) => r.done_at && String(r.done_at) >= fromIso)
  const marked = done.filter((r) => r.accurate === 'yes' || r.accurate === 'no')
  const timed = done.filter((r) => r.requested_at)
  const fast = timed.filter((r) => Date.parse(String(r.done_at)) - Date.parse(String(r.requested_at)) <= 86400000)
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null)
  return {
    done: done.length,
    accuratePct: pct(marked.filter((r) => r.accurate === 'yes').length, marked.length),
    withinDayPct: pct(fast.length, timed.length),
    open: rows.filter((r) => !r.done_at).length,
  }
}

// =====================================================================
// Page and actions
// =====================================================================

function tlpCanView_(user: PlatformUser, tl: string, dir: Directory): boolean {
  return user.role === 'admin' || user.email === tl || pwIsManagerOf(user, tl, dir)
}

export async function tlpAreasFor_(tlEmail: string): Promise<{ area: string; target: string; measuredBy: string }[]> {
  const map = ((await tlpSetting_('tlp_tl_areas')) || {}) as Record<string, string[]>
  const defs = ((await tlpSetting_('tlp_responsibility_areas')) || {}) as Record<string, { target?: string; measuredBy?: string }>
  let mine: string[] = []
  Object.keys(map).forEach((e) => {
    if (normEmail(e) === tlEmail) mine = ([] as string[]).concat(map[e] || [])
  })
  return mine.map((a) => {
    const d = defs[a] || {}
    return { area: String(a), target: String(d.target || ''), measuredBy: String(d.measuredBy || '') }
  })
}

async function rowsOf(name: string): Promise<Row[]> {
  // dqReadObjects_(missingOk): [] when the store simply isn't there — but a read
  // that fails propagates (legacy dqSheet_ opens fine, then getLastRow throws).
  // readStore swallows that failure into exists=false; readRows rethrows it so
  // tlPerformancePage's part() notes land on both sides.
  const r = await readStore(name)
  if (!r.exists) return readRows(name) // rethrow the real error message
  return r.rows
}

/** The TL's tasks for the page: open ones, and delivered ones from the last 90 days or not rated yet. */
async function tlpProjects_(tlEmail: string, nowMs: number, zones: { meets?: unknown; exceeds?: unknown }) {
  const details: Record<string, Row> = {}
  ;(await rowsOf('action_task_details')).forEach((d) => {
    details[String(d.action_id)] = d
  })
  const mine = await rowsOf('actions')
  return mine
    .filter(
      (a) =>
        normEmail(a.owner_email) === tlEmail &&
        (a.track_as_task === true || String(a.track_as_task).toLowerCase() === 'true') &&
        String(a.status) !== 'dropped',
    )
    .map((a) => {
      const d = details[String(a.action_id)] || {}
      const status = String(a.status || 'open')
      const v = d.outcome_rating === '' || d.outcome_rating === undefined || !isFinite(Number(d.outcome_rating)) ? null : Number(d.outcome_rating)
      return {
        actionId: String(a.action_id),
        title: String(a.title),
        status,
        deadlineAt: pwIso(d.deadline_at),
        deliveredAt: pwIso(d.delivered_at),
        expectation: String(d.expectation || ''),
        value: v,
        label: tlpLabel_(v, zones),
        ratingNote: String(d.outcome_note || ''),
        ratedAt: pwIso(d.rated_at),
        overdue: status !== 'done' && nowMs > pwMs(d.deadline_at),
      }
    })
    .filter((t) => t.status !== 'done' || t.value === null || pwMs(t.deliveredAt) >= nowMs - 90 * 86400000)
    .sort((a, b) => pwMs(b.deadlineAt) - pwMs(a.deadlineAt))
}

/** OTD entries for the last 3 months: [{ month, values: [7 or null], avg }]. */
async function tlpOtd_(today: string) {
  const names = ([] as string[]).concat((await tlpSetting_('otd_warehouses')) as string[])
  const months = [0, 1, 2].map((n) => {
    const p = today.split('-').map(Number)
    const d = new Date(Date.UTC(p[0], p[1] - 1 - n, 1))
    return d.toISOString().slice(0, 7)
  })
  const rows = await rowsOf('tlp_otd')
  return {
    warehouses: names,
    months: months.map((m) => {
      const values = names.map((w, i) => {
        const r = rows.filter((x) => String(x.month).replace(/^'/, '') === m && Number(x.warehouse) === i)[0]
        return r && r.value !== '' && r.value !== null ? Number(r.value) : null
      })
      return { month: m, values, avg: tlpMean_(values) }
    }),
  }
}

/** The TL performance page. tlEmail empty: the caller (a TL) or the first TL (admin). */
export async function tlPerformancePage(tlEmail?: string) {
  const user = await requireRole(['admin', 'tl'])
  const dir = await pwDirectory()
  const tls = dir.tls().map((p) => ({ email: p.email, name: p.name }))
  const tl = normEmail(tlEmail) || (user.role === 'tl' ? user.email : tls[0] ? tls[0].email : '')
  if (!tl) return { tls, tl: '', name: '', notes: ['No team leads on the Roster.'] }
  if (!tlpCanView_(user, tl, dir)) throw new Error('You can see your own performance only.')
  const today = pwToday()
  const from = dqAddDays(today, -6)
  const week = tlpWeek_(today)
  const nowMs = Date.now()
  const zones = ((await tlpSetting_('tlp_rating_zones')) || {}) as { meets?: number; exceeds?: number }
  const notes: string[] = []
  const part = async <T>(label: string, fn: () => Promise<T>, dflt: T): Promise<T> => {
    try {
      return await fn()
    } catch (e) {
      notes.push(label + ' could not be read: ' + ((e as Error)?.message || e))
      return dflt
    }
  }

  const team = await part('Team scores', async () => {
    const r = (await rowsOf('tlp_team')).filter((x) => normEmail(x.tl_email) === tl)[0]
    const n = (v: unknown) => (v === '' || v === undefined || v === null ? null : Number(v))
    return r
      ? {
          quality: n(r.quality),
          fcr: n(r.fcr),
          productivity: n(r.productivity),
          agents: Number(r.agents) || 0,
          month: String(r.month),
          asOf: String(r.updated_at),
          kpi: {
            score: n(r.kpi_score),
            prod: n(r.kpi_prod),
            qual: n(r.kpi_qual),
            fcr: n(r.kpi_fcr),
            behavior: n(r.kpi_behavior),
            agents: Number(r.kpi_agents) || 0,
            olAgents: Number(r.ol_agents) || 0,
            ineligible: Number(r.ineligible_agents) || 0,
            redZone: Number(r.red_zone) || 0,
            actionPlan: Number(r.action_plan) || 0,
            probation: Number(r.probation_agents) || 0,
            partial: Number(r.partial_agents) || 0,
          },
        }
      : null
  }, null)

  type AreaOut = {
    area: string
    target: string
    measuredBy: string
    value: number | null
    label: string
    note: string
    history: { week: string; value: number }[]
    measured: { pct: number | null; met: number; total: number; rule: string; from: string } | null
    /** Legacy adds the key only to the 'Knowledge base' area — absent elsewhere, not null. */
    kb?: ReturnType<typeof tlpKbMetrics_> | null
  }
  const areas = await part('Responsibilities', async (): Promise<AreaOut[]> => {
    const ratings = (await rowsOf('tlp_resp_ratings')).filter((r) => normEmail(r.tl_email) === tl)
    const metrics: Record<string, Row> = {}
    ;(await rowsOf('tlp_area_metrics')).forEach((m) => {
      if (normEmail(m.tl_email) === tl) metrics[String(m.area)] = m
    })
    const mine = await tlpAreasFor_(tl)
    return mine.map((a) => {
      const rs = ratings.filter((r) => r.area === a.area && isFinite(Number(r.rating)) && r.rating !== '' && r.rating !== null).sort((x, y) => (String(x.week) < String(y.week) ? 1 : -1))
      const cur = rs.filter((r) => r.week === week)[0]
      const m = metrics[a.area]
      const v = cur ? Number(cur.rating) : null
      return {
        area: a.area,
        target: a.target,
        measuredBy: a.measuredBy,
        value: v,
        label: tlpLabel_(v, zones),
        note: cur ? String(cur.note || '') : '',
        history: rs
          .filter((r) => r.week !== week)
          .slice(0, 6)
          .map((r) => ({ week: String(r.week), value: Number(r.rating) })),
        measured: m
          ? {
              pct: m.pct === '' || m.pct === null ? null : Number(m.pct),
              met: Number(m.met) || 0,
              total: Number(m.total) || 0,
              rule: String(m.rule),
              from: String(m.from),
            }
          : null,
      }
    })
  }, [] as AreaOut[])
  if (areas.some((a) => a.area === 'Knowledge base')) {
    const kb = await part('KB tracker', async () => tlpKbMetrics_(await rowsOf('tlp_kb'), new Date(nowMs - 30 * 86400000).toISOString()), null)
    areas.forEach((a) => {
      if (a.area === 'Knowledge base') a.kb = kb
    })
  }
  const otd = areas.some((a) => a.area === 'OTD') ? await part('OTD', () => tlpOtd_(today), null) : null

  const queue = await part('Queue-hour numbers', async () => {
    const rows = (await rowsOf('tlp_queue_daily'))
      .filter((r) => normEmail(r.tl_email) === tl && String(r.date) >= from && String(r.date) <= today)
      .sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1))
    const sum = (k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)
    const sv = sum('calls_serviced')
    const ab = sum('calls_abandoned')
    const rc = sum('resp_count')
    const respSum = rows.reduce((s, r) => s + (Number(r.resp_avg_min) || 0) * (Number(r.resp_count) || 0), 0)
    return {
      days: rows.map((r) => ({
        date: String(r.date),
        windows: String(r.windows || ''),
        queueMin: Number(r.queue_min) || 0,
        callsIn: Number(r.calls_in) || 0,
        answerRate: r.answer_rate === '' || r.answer_rate === null ? null : Number(r.answer_rate),
        touches: Number(r.text_touches) || 0,
        respAvgMin: r.resp_avg_min === '' || r.resp_avg_min === null ? null : Number(r.resp_avg_min),
        respCount: Number(r.resp_count) || 0,
      })),
      total: {
        queueMin: sum('queue_min'),
        callsIn: sum('calls_in'),
        serviced: sv,
        abandoned: ab,
        answerRate: sv + ab ? Math.round((sv / (sv + ab)) * 1000) / 10 : null,
        touches: sum('text_touches'),
        respAvgMin: rc ? Math.round((respSum / rc) * 10) / 10 : null,
        respCount: rc,
      },
      source: rows.length ? String(rows[rows.length - 1].text_source || '') : '',
      asOf: await dqLastRun('tl_queue_metrics'),
    }
  }, null)

  const resp = tlpMean_(areas.map((a) => a.value))
  return {
    tls: user.role === 'admin' ? tls : tls.filter((t) => t.email === tl),
    tl,
    name: dir.name(tl),
    from,
    to: today,
    week,
    canRate: pwIsManagerOf(user, tl, dir) && user.email !== tl,
    zones: { meets: Number(zones.meets || 75), exceeds: Number(zones.exceeds || 95) },
    team,
    responsibilities: resp,
    overall: tlpOverall_({ team: team && team.kpi ? team.kpi.score : null, responsibilities: resp }, (await tlpSetting_('tlp_weights')) as Record<string, number>),
    areas,
    otd,
    projects: await part('Projects', () => tlpProjects_(tl, nowMs, zones), [] as Awaited<ReturnType<typeof tlpProjects_>>),
    queue,
    mail: await part('Mail tracking', () => mdForTl_(tl, from, today, dir), null),
    notes,
  }
}

/** Mohamed (the TL's manager, or an admin) rates one area for the current week: the slider value 0-100. */
export async function tlpRateArea(tlEmail: string, area: string, value: unknown, note?: string) {
  const user = await requireRole(['admin', 'tl'])
  const dir = await pwDirectory()
  const tl = normEmail(tlEmail)
  if (!pwIsManagerOf(user, tl, dir) || tl === user.email) throw new Error("Only the team lead's manager rates their responsibilities.")
  const v = tlpCheckValue_(value)
  const noteTxt = String(note || '').trim().slice(0, 2000)
  const zones = ((await tlpSetting_('tlp_rating_zones')) || {}) as { meets?: number; exceeds?: number }
  if (tlpLabel_(v, zones) === 'below' && noteTxt.length < 10) {
    throw new Error('Say what fell short (a rating under ' + (zones.meets || 75) + ' is Below).')
  }
  if (!(await tlpAreasFor_(tl)).some((a) => a.area === area)) {
    throw new Error('"' + area + '" is not one of this team lead\'s areas (Admin: tlp_tl_areas).')
  }
  await assertWritable() // legacy's viewAsGuard_ fires inside dqUpsertIn_ — after every check above
  const week = tlpWeek_(pwToday())
  const row = {
    rating_id: week + '|' + tl + '|' + area,
    tl_email: tl,
    week,
    area,
    rating: v,
    note: noteTxt,
    rated_by: user.email,
    rated_at: new Date().toISOString(),
  }
  const { error } = await db().from('tlp_resp_ratings').upsert(row, { onConflict: 'rating_id' })
  if (error) throw new Error(error.message)
  return { area, week, value: v, label: tlpLabel_(v, zones), note: noteTxt }
}

/**
 * The 1:1 decision on a delivered task against the expectation set at assignment: the slider value 0-100
 * (label from tlp_rating_zones). The owner's manager (Mohamed) or an admin, on a task marked done. It can
 * be changed; each rating is written to the task's history.
 */
export async function tlpRateProject(actionId: string, value: unknown, note?: string) {
  const user = await requireRole(['admin', 'tl'])
  const dir = await pwDirectory()
  const v = tlpCheckValue_(value)
  const noteTxt = String(note || '').trim().slice(0, 2000)
  const zones = ((await tlpSetting_('tlp_rating_zones')) || {}) as { meets?: number; exceeds?: number }
  await assertWritable()
  const a = (await rowsOf('actions')).filter((r) => String(r.action_id) === String(actionId))[0]
  if (!a) throw new Error('That task no longer exists.')
  if (!pwIsManagerOf(user, normEmail(a.owner_email), dir)) throw new Error("Only the owner's manager rates a task.")
  if (String(a.status) !== 'done') throw new Error('Rate a task once it is delivered (marked done).')
  if (tlpLabel_(v, zones) === 'below' && noteTxt.length < 10) throw new Error('Say what fell short of the expectation.')
  const at = new Date().toISOString()
  const { error } = await db()
    .from('action_task_details')
    .update({ outcome_rating: v, outcome_note: noteTxt, rated_by: user.email, rated_at: at, updated_by: user.email, updated_at: at })
    .eq('action_id', String(actionId))
  if (error) throw new Error(error.message)
  const { error: uerr } = await db()
    .from('action_updates')
    .insert({
      update_id: newId('AUP'),
      action_id: String(actionId),
      kind: 'status',
      note: 'Rated ' + v + ' (' + tlpLabel_(v, zones) + ') against the expectation by ' + dir.name(String(user.email)) + (noteTxt ? ': ' + noteTxt : ''),
      submitted_by: user.email,
      submitted_at: at,
    })
  if (uerr) throw new Error(uerr.message)
  return { actionId: String(actionId), value: v, label: tlpLabel_(v, zones), ratingNote: noteTxt, ratedAt: at }
}

// =====================================================================
// KB tracker and OTD entry
// =====================================================================

/** Who edits the KB tracker: admins and the TLs who own the Knowledge base area. */
export async function tlpKbEditor_(user: PlatformUser): Promise<boolean> {
  return user.role === 'admin' || (await tlpAreasFor_(user.email)).some((a) => a.area === 'Knowledge base')
}

function tlpKbOut_(r: Row, dir: Directory) {
  return {
    id: String(r.kb_id),
    topic: String(r.topic),
    requestedAt: pwIso(r.requested_at),
    doneAt: pwIso(r.done_at),
    accurate: String(r.accurate || ''),
    owner: r.owner_email ? dir.name(String(r.owner_email)) : '',
    ownerEmail: normEmail(r.owner_email),
    note: String(r.note || ''),
  }
}

/** KB tracker page: rows from the last 90 days or still open, and the 30-day numbers. */
export async function kbTrackerPage() {
  const user = await requireRole(['admin', 'tl'])
  const dir = await pwDirectory()
  const all = await rowsOf('tlp_kb')
  const cut = new Date(Date.now() - 90 * 86400000).toISOString()
  return {
    canEdit: await tlpKbEditor_(user),
    metrics: tlpKbMetrics_(all, new Date(Date.now() - 30 * 86400000).toISOString()),
    owners: dir.tls().map((p) => ({ email: p.email, name: p.name })),
    rows: all
      .filter((r) => !r.done_at || String(r.done_at) >= cut)
      .map((r) => tlpKbOut_(r, dir))
      .sort((a, b) => (a.doneAt ? 1 : 0) - (b.doneAt ? 1 : 0) || (a.requestedAt < b.requestedAt ? 1 : -1)),
  }
}

/** Adds or edits one KB row. input: { id?, topic, requestedAt, doneAt, accurate: 'yes'|'no'|'', ownerEmail, note }. */
export async function kbTrackerSave(input: { id?: string; topic?: string; requestedAt?: string; doneAt?: string; accurate?: string; ownerEmail?: string; note?: string }) {
  const user = await requireRole(['admin', 'tl'])
  if (!(await tlpKbEditor_(user))) throw new Error('The KB tracker is kept by the Knowledge base owner.')
  await assertWritable()
  input = input || {}
  const topic = String(input.topic || '').trim().slice(0, 300)
  if (topic.length < 3) throw new Error('Write the article or topic.')
  const req = pwIso(input.requestedAt)
  const done = input.doneAt ? pwIso(input.doneAt) : ''
  if (!req) throw new Error('When was the update requested?')
  if (done && done < req) throw new Error('Done cannot be before it was requested.')
  const acc = ['yes', 'no', ''].indexOf(String(input.accurate || '')) !== -1 ? String(input.accurate || '') : ''
  const now = new Date().toISOString()
  const old = input.id ? (await rowsOf('tlp_kb')).filter((r) => String(r.kb_id) === String(input.id))[0] : null
  if (input.id && !old) throw new Error('That row no longer exists.')
  const row = {
    kb_id: old ? old.kb_id : newId('KB'),
    topic,
    requested_at: req,
    done_at: done || null,
    accurate: acc,
    owner_email: normEmail(input.ownerEmail) || user.email,
    note: String(input.note || '').trim().slice(0, 1000),
    created_by: old ? old.created_by : user.email,
    created_at: old ? old.created_at : now,
    updated_at: now,
  }
  const { error } = await db().from('tlp_kb').upsert(row, { onConflict: 'kb_id' })
  if (error) throw new Error(error.message)
  return tlpKbOut_(row, await pwDirectory())
}

/** OTD entry for one month: values = one % (0-100, or '' to clear) per warehouse in otd_warehouses order. Admins and the OTD owner. */
export async function otdSave(month: string, values: unknown[]) {
  const user = await requireRole(['admin', 'tl'])
  if (user.role !== 'admin' && !(await tlpAreasFor_(user.email)).some((a) => a.area === 'OTD')) {
    throw new Error('OTD is entered by its owner or an admin.')
  }
  await assertWritable()
  if (!/^\d{4}-\d{2}$/.test(String(month))) throw new Error('Choose the month.')
  const n = ([] as string[]).concat((await tlpSetting_('otd_warehouses')) as string[]).length
  const at = new Date().toISOString()
  const rows = ([] as unknown[]).concat(values || []).slice(0, n).map((v, i) => {
    const x = v === '' || v === null || v === undefined ? '' : Number(v)
    if (x !== '' && (!isFinite(x) || x < 0 || x > 100)) throw new Error('OTD values are percentages, 0 to 100.')
    return { key: month + '|' + i, month, warehouse: i, value: x === '' ? null : x, entered_by: user.email, entered_at: at }
  })
  const { error } = await db().from('tlp_otd').upsert(rows, { onConflict: 'key' })
  if (error) throw new Error(error.message)
  return tlpOtd_(pwToday())
}

// =====================================================================
// Setup
// =====================================================================

/**
 * Seeds the settings, fills tlp_tl_areas from the Roster by first name (only names that match exactly
 * one active person), adds Mohamed's manager to admin_emails. Returns what it did and what it could
 * not match. (The GAS "create the tabs" step is the migration file here.)
 */
export async function setupDesk() {
  const user = await requireRole(['admin'])
  await assertWritable()
  const cfg = await configAll()
  const report: string[] = []
  const { MD_SETTINGS } = await import('./maildesk')
  const sets: Record<string, { value: unknown; description: string }>[] = [TLP_SETTINGS, MD_SETTINGS]
  for (const set of sets) {
    for (const k of Object.keys(set)) {
      if (k in cfg) continue
      await setConfig(k, set[k].value, set[k].description, String(user.email))
      report.push('Setting added: ' + k)
    }
  }
  let owners = (await getConfig('tlp_tl_areas', {})) as Record<string, string[]>
  if (!Object.keys(owners || {}).length) {
    owners = {}
    const dir = await pwDirectory()
    const people = Object.keys(dir.by).map((e) => dir.by[e] as unknown as PersonLike)
    for (const o of TLP_OWNERS_BY_NAME) {
      const hits = tlpByName_(people, o.names)
      if (hits.length === 1) {
        owners[String(hits[0].email)] = o.areas
        report.push(o.names[0] + ' -> ' + hits[0].email + ' (' + hits[0].role + ')')
      } else {
        report.push('NOT SET: ' + o.names[0] + (hits.length ? ' matches ' + hits.map((h) => h.email).join(', ') : ' is not on the Roster') + '. Add them to tlp_tl_areas by hand.')
      }
    }
    await setConfig('tlp_tl_areas', owners, TLP_SETTINGS.tlp_tl_areas.description, String(user.email))
  } else report.push('tlp_tl_areas already set: left as it is.')
  const admins = String((await getConfig('admin_emails', '')) || '').split(',').map(normEmail).filter(String)
  if (admins.indexOf(TLP_MANAGER_EMAIL) === -1) {
    await setConfig('admin_emails', admins.concat([TLP_MANAGER_EMAIL]).join(','), '', String(user.email))
    report.push('Admin access added: ' + TLP_MANAGER_EMAIL)
  }
  return report.join('\n')
}

/**
 * installDeskTriggers: the Gmail poll (10-minute trigger in legacy) is a
 * pg_cron schedule at the 15-minute D-SCHED floor, not scriptable from here.
 * Kept for API parity — returns the schedule note the cron config carries.
 */
export async function installDeskTriggers() {
  await requireRole(['admin'])
  await assertWritable() // legacy newTrigger_ guards before ScriptApp — refuse View as the same way
  return 'Installed: jobMailDesk every 15 minutes (pg_cron per D-SCHED; not installable from the app).'
}
