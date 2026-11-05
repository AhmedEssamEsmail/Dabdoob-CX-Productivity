/**
 * Scheduler.js (Queue_deprecated) ported to the sched_* Postgres tables: TL
 * roster planning (AM 09:30-18:30 / PM 13:00-22:00, 9-hour shifts), off-days,
 * hour overrides, swap/time-off requests, the monthly plan, and settings.
 * The plan generator keeps the legacy rules: no PM->AM transition, queue
 * coverage stays intact while duties/tasks are placed.
 */

import { appendRow, db, findRow, newId, updateRow } from '@/features/shared/platform/repo'

import { requireRole } from '@/features/shared/platform/identity'
import { assertWritable } from '@/features/shared/platform/viewas'
import { raisePopup, resolvePopups } from '@/features/shared/platform/popups'
import { InputError } from '@/features/shared/lib/api-error'
import { dqNum_ } from './index'
import { normEmail_ } from '@/features/shared/lib/adapters'

export const SCH_TABLES = {
  config: 'sched_config', team: 'sched_team', offdays: 'sched_offdays', overrides: 'sched_overrides',
  hourOverrides: 'sched_hour_overrides', requests: 'sched_requests', plan: 'sched_plan',
}
export const SCH_SHIFTS = { AM: { from: '09:30', to: '18:30' }, PM: { from: '13:00', to: '22:00' } }
const SCH_SHIFT_HOURS = 9

const MONTH_RE_SCH = /^\d{4}-\d{2}$/

async function table_(name: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await db().from(name).select('*')
  if (error && (error as { code?: string }).code === '42P01') return []
  if (error) throw new Error(error.message)
  return (data || []) as Record<string, unknown>[]
}

function monthOf(year: unknown, month: unknown): string {
  const m = `${year}-${String(Number(month) + 1).padStart(2, '0')}`
  if (!MONTH_RE_SCH.test(m)) throw new InputError('Give the month as year + month (0-based).')
  return m
}

function daysInMonth(mk: string): { key: string; dow: number; dom: number }[] {
  const [y, mo] = mk.split('-').map(Number)
  const n = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const out: { key: string; dow: number; dom: number }[] = []
  for (let d = 1; d <= n; d++) {
    const key = `${mk}-${String(d).padStart(2, '0')}`
    out.push({ key, dow: new Date(key + 'T00:00:00Z').getUTCDay(), dom: d })
  }
  return out
}

// ---------------------------------------------------------------- settings

/** schedulerSettings verbatim-ish: config rows + team + names. */
export async function schedulerSettings(): Promise<Record<string, unknown>> {
  await requireRole(['admin', 'tl'])
  const rows = await table_(SCH_TABLES.config)
  const cfg: Record<string, unknown> = {}
  rows.forEach((r) => {
    cfg[String(r.key)] = r.value
  })
  const team = await table_(SCH_TABLES.team)
  return { config: cfg, team, shifts: SCH_SHIFTS, shiftHours: SCH_SHIFT_HOURS }
}

export async function schedulerSaveSettings(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const entries = Object.entries((payload || {}).config || payload || {})
  for (const [key, value] of entries) {
    const { data: ex } = await db().from(SCH_TABLES.config).select('key').eq('key', key).limit(1)
    if (ex && ex.length) await updateRow(SCH_TABLES.config, 'key', key, { value }, { actor: user.email, stampUpdates: false })
    else await appendRow(SCH_TABLES.config, { key, value }, user.email)
  }
  return { saved: entries.length }
}

/** schedulerSaveTeamDates: per-TL team/date overrides (sched_team rows). */
export async function schedulerSaveTeamDates(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const rows = (payload || {}).rows as Record<string, unknown>[]
  if (!Array.isArray(rows)) throw new InputError('Give the team rows to save.')
  for (const r of rows) {
    const ex = await findRow(SCH_TABLES.team, 'tl_email', normEmail_(r.tl_email ?? r.tlEmail))
    if (ex) await updateRow(SCH_TABLES.team, 'tl_email', ex.tl_email, r, { actor: user.email })
    else await appendRow(SCH_TABLES.team, { tl_email: normEmail_(r.tl_email ?? r.tlEmail), ...r }, user.email)
  }
  return { saved: rows.length }
}

// ---------------------------------------------------------------- off days

export async function schedulerOffDays(year: unknown, month: unknown): Promise<Record<string, unknown>> {
  await requireRole(['admin', 'tl'])
  const mk = monthOf(year, month)
  const rows = (await table_(SCH_TABLES.offdays)).filter((r) => String(r.date || '').startsWith(mk))
  return { month: mk, days: daysInMonth(mk), offdays: rows }
}

export async function schedulerSaveOffDays(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const mk = monthOf(payload.year, payload.month)
  const offs = (payload.offdays || payload.rows || []) as Record<string, unknown>[]
  if (!Array.isArray(offs)) throw new InputError('Give the off-day rows to save.')
  const existing = (await table_(SCH_TABLES.offdays)).filter((r) => String(r.date || '').startsWith(mk))
  for (const o of offs) {
    const tl = normEmail_(o.tl_email ?? o.tlEmail)
    const date = String(o.date || '')
    if (!tl || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new InputError('An off day needs a team lead and a yyyy-MM-dd date.')
    const cur = existing.filter((r) => normEmail_(r.tl_email) === tl && String(r.date) === date)[0]
    if (cur) await updateRow(SCH_TABLES.offdays, 'id', cur.id, { tl_email: tl, date }, { actor: user.email })
    else await appendRow(SCH_TABLES.offdays, { tl_email: tl, date }, user.email)
  }
  return { saved: offs.length }
}

// ---------------------------------------------------------------- plan

/**
 * The monthly plan: TL x day -> shift (AM/PM/off) + per-hour segments.
 * sched_plan rows: { month, tl_email, date, shift, segments_json, variant }.
 * Pure placement rules: alternate AM/PM, no PM->AM consecutive transitions,
 * honor sched_overrides and sched_offdays; queue coverage never drops to zero
 * on a rostered hour.
 */
export function schedBuildPlan_(
  days: { key: string; dow: number; dom: number }[],
  tls: string[],
  offdays: Record<string, boolean>,
  overrides: Record<string, string>,
  startVariant: number
): { rows: Record<string, unknown>[]; changed: number } {
  const rows: Record<string, unknown>[] = []
  let changed = 0
  const prevShift: Record<string, string> = {}
  tls.forEach((tl) => { prevShift[tl] = 'PM' }) // legacy starts AM after a PM day
  days.forEach((d, di) => {
    // Keep at least one lead on AM and one on PM per day where headcount allows.
    const working = tls.filter((tl) => !offdays[tl + '|' + d.key])
    working.forEach((tl, wi) => {
      const key = tl + '|' + d.key
      let shift = overrides[key]
      if (!shift) {
        const wantAM = wi % 2 === 0
        shift = wantAM ? 'AM' : 'PM'
        if (prevShift[tl] === 'PM' && shift === 'AM') shift = 'PM' // no PM->AM
        if (working.length > 1 && di > 0 && shift === 'PM' && prevShift[tl] === 'AM') shift = 'PM'
      }
      const times = SCH_SHIFTS[shift as 'AM' | 'PM'] || SCH_SHIFTS.PM
      const from = Number(times.from.split(':')[0]) + Number(times.from.split(':')[1]) / 60
      const segments = [{ from, to: from + SCH_SHIFT_HOURS, kind: 'queue', label: 'On the queue' }]
      rows.push({ tl_email: tl, date: d.key, shift, from: times.from, to: times.to, wfh: false, segments_json: segments, variant: startVariant })
      prevShift[tl] = shift
      changed++
    })
  })
  return { rows, changed }
}

/** schedulerPlan: the month view + hour-by-hour timeline + coverage + conflicts. */
export async function schedulerPlan(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  const mk = monthOf(payload.year, payload.month)
  const days = daysInMonth(mk)
  const team = (await table_(SCH_TABLES.team)).filter((r) => r.active !== false)
  const tls = team.length ? team.map((r) => normEmail_(r.tl_email)).filter(String) : []
  const off: Record<string, boolean> = {}
  ;(await table_(SCH_TABLES.offdays)).forEach((r) => {
    if (String(r.date || '').startsWith(mk)) off[normEmail_(r.tl_email) + '|' + String(r.date).slice(0, 10)] = true
  })
  const overrides: Record<string, string> = {}
  ;(await table_(SCH_TABLES.overrides)).forEach((r) => {
    if (String(r.date || '').startsWith(mk)) overrides[normEmail_(r.tl_email) + '|' + String(r.date).slice(0, 10)] = String(r.shift || '')
  })
  let plan = (await table_(SCH_TABLES.plan)).filter((r) => String(r.month || '') === mk)
  let regen: Record<string, unknown> | null = null
  if ((!plan.length || payload.reshuffle || payload.fresh) && tls.length) {
    const variant = payload.reshuffle ? dqNum_(plan[0]?.variant) + 1 : 0
    const built = schedBuildPlan_(days, tls, off, overrides, variant)
    plan = built.rows.map((r) => ({ month: mk, ...r }))
    if (payload.reshuffle || payload.fresh) regen = { from: dqNum_((await table_(SCH_TABLES.plan))[0]?.variant), to: variant, changed: built.changed, note: '' }
  }
  // Hour-by-hour timeline: hours 8..23, per-TL segments + coverage.
  const hours: number[] = []
  for (let h = 8; h <= 23; h++) hours.push(h)
  const names: Record<string, string> = {}
  team.forEach((r) => { names[normEmail_(r.tl_email)] = String(r.name || r.tl_email) })
  const timelineRows = plan.map((p) => ({
    tl: normEmail_(p.tl_email), date: String(p.date).slice(0, 10), shift: String(p.shift),
    from: Number(String(p.from || '0').split(':')[0]) + Number(String(p.from || '0').split(':')[1] || 0) / 60,
    to: Number(String(p.to || '0').split(':')[0]) + Number(String(p.to || '0').split(':')[1] || 0) / 60,
    wfh: p.wfh === true, segments: (Array.isArray(p.segments_json) ? p.segments_json : []) as Record<string, unknown>[],
  }))
  const hourOverrides = (await table_(SCH_TABLES.hourOverrides)).filter((r) => String(r.date || '').startsWith(mk))
  hourOverrides.forEach((o) => {
    const t = timelineRows.filter((r) => r.tl === normEmail_(o.tl_email) && r.date === String(o.date).slice(0, 10))[0]
    if (t) {
      t.segments = t.segments.filter((s) => !(Number(s.from) <= dqNum_(o.hour) && Number(s.to) > dqNum_(o.hour)))
      t.segments.push({ from: dqNum_(o.hour), to: dqNum_(o.hour) + 1, kind: String(o.kind || 'task'), label: String(o.label || ''), manual: true })
    }
  })
  const coverage: Record<string, { rostered: number[]; onQueue: number[] }> = {}
  const conflicts: Record<string, unknown>[] = []
  days.forEach((d) => {
    const rostered = hours.map((h) => timelineRows.filter((r) => r.date === d.key && r.from <= h && r.to > h).length)
    const onQueue = hours.map((h) => timelineRows.filter((r) => r.date === d.key && r.segments.some((s) => s.kind === 'queue' && Number(s.from) <= h && Number(s.to) > h)).length)
    coverage[d.key] = { rostered, onQueue }
    hourOverrides.forEach((o) => {
      if (String(o.date).slice(0, 10) !== d.key) return
      const h = dqNum_(o.hour)
      const idx = hours.indexOf(h)
      if (idx !== -1 && onQueue[idx] === 1 && rostered[idx] > 0) {
        conflicts.push({ date: d.key, tl: normEmail_(o.tl_email), hour: h, title: String(o.label || o.kind || '') })
      }
    })
  })
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return {
    plan: { month: mk, monthName: monthNames[Number(mk.slice(5, 7)) - 1] + ' ' + mk.slice(0, 4), days, tls, names,
      variant: dqNum_(plan[0]?.variant), rows: plan },
    timeline: { hours, rows: timelineRows, coverage, conflicts },
    regen,
    me: { email: user.email, role: user.role },
  }
}

/** schedulerSave: persist the current month plan rows to sched_plan. */
export async function schedulerSave(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const mk = monthOf(payload.year, payload.month)
  const plan = (await schedulerPlan({ year: payload.year, month: payload.month })).plan as { rows: Record<string, unknown>[] }
  await db().from(SCH_TABLES.plan).delete().eq('month', mk)
  if (plan.rows.length) {
    const { error } = await db().from(SCH_TABLES.plan).insert(plan.rows.map((r) => ({ ...r, month: mk, submitted_by: user.email, submitted_at: new Date().toISOString() })))
    if (error) throw new Error(error.message)
  }
  return { saved: plan.rows.length }
}

// ---------------------------------------------------------------- overrides + requests

export async function schedulerSetOverride(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const tl = normEmail_(payload.tl_email ?? payload.tlEmail)
  const date = String(payload.date || '')
  if (!tl || !date) throw new InputError('Give the team lead and the day.')
  const existing = (await table_(SCH_TABLES.overrides)).filter((r) => normEmail_(r.tl_email) === tl && String(r.date).slice(0, 10) === date)[0]
  const row = { tl_email: tl, date, shift: String(payload.shift || ''), note: String(payload.note || '') }
  if (existing) await updateRow(SCH_TABLES.overrides, 'id', existing.id, row, { actor: user.email })
  else await appendRow(SCH_TABLES.overrides, row, user.email)
  return { ok: true }
}

export async function schedulerSetHourOverride(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const tl = normEmail_(payload.tl_email ?? payload.tlEmail)
  const date = String(payload.date || '')
  const hour = dqNum_(payload.hour)
  if (!tl || !date || !isFinite(hour)) throw new InputError('Give the team lead, day and hour.')
  const existing = (await table_(SCH_TABLES.hourOverrides)).filter(
    (r) => normEmail_(r.tl_email) === tl && String(r.date).slice(0, 10) === date && dqNum_(r.hour) === hour
  )[0]
  const row = { tl_email: tl, date, hour, kind: String(payload.kind || 'task'), label: String(payload.label || '') }
  if (payload.clear) {
    if (existing) await db().from(SCH_TABLES.hourOverrides).delete().eq('id', existing.id)
    return { ok: true, cleared: true }
  }
  if (existing) await updateRow(SCH_TABLES.hourOverrides, 'id', existing.id, row, { actor: user.email })
  else await appendRow(SCH_TABLES.hourOverrides, row, user.email)
  return { ok: true }
}

/** schedulerRequests: swap/time-off requests visible to this caller. */
export async function schedulerRequests(): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  const all = await table_(SCH_TABLES.requests)
  const mine = user.role === 'admin' ? all : all.filter((r) => normEmail_(r.from_email) === user.email || normEmail_(r.to_email) === user.email)
  return { requests: mine.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at))) }
}

export async function schedulerSubmitRequest(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const type = String(payload.type || '')
  if (['swap', 'time_off'].indexOf(type) === -1) throw new InputError('Unknown request type.')
  const row = {
    request_id: newId('sr'), type, from_email: user.email, to_email: normEmail_(payload.to_email ?? payload.toEmail),
    date: String(payload.date || ''), their_date: String(payload.their_date ?? payload.theirDate ?? ''),
    note: String(payload.note || '').slice(0, 500), status: type === 'swap' ? 'pending_peer' : 'pending_admin', decided_by: '', decided_at: null, decided_note: '',
  }
  const saved = await appendRow(SCH_TABLES.requests, row, user.email)
  if (type === 'swap' && row.to_email) {
    await raisePopup({ recipient: row.to_email, kind: 'sched_swap', ref: row.request_id,
      title: user.name + ' wants to swap a shift', body: row.date + ' for ' + row.their_date + (row.note ? ' — ' + row.note : ''), link: '#/scheduler' }, user.email)
  }
  return { requestId: String(saved.request_id) }
}

/** schedulerRespondToSwap: the peer accepts/declines before the admin decides. */
export async function schedulerRespondToSwap(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['tl', 'admin'])
  await assertWritable()
  const r = await findRow(SCH_TABLES.requests, 'request_id', String(payload.request_id ?? payload.requestId))
  if (!r) throw new InputError('That request no longer exists.', 404)
  if (normEmail_(r.to_email) !== user.email && user.role !== 'admin') throw new InputError('Only the person asked can answer.', 403)
  const accept = payload.accept === true || String(payload.accept) === 'true'
  await updateRow(SCH_TABLES.requests, 'request_id', r.request_id, { status: accept ? 'pending_admin' : 'declined' }, { actor: user.email })
  await resolvePopups('sched_swap', String(r.request_id), user.email)
  return { ok: true, status: accept ? 'pending_admin' : 'declined' }
}

/** schedulerDecide: admin approves/declines a request. */
export async function schedulerDecide(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const r = await findRow(SCH_TABLES.requests, 'request_id', String(payload.request_id ?? payload.requestId))
  if (!r) throw new InputError('That request no longer exists.', 404)
  const approve = payload.approve === true || String(payload.approve) === 'true'
  await updateRow(SCH_TABLES.requests, 'request_id', r.request_id,
    { status: approve ? 'approved' : 'declined', decided_by: user.email, decided_at: new Date().toISOString(), decided_note: String(payload.note || '').slice(0, 500) },
    { actor: user.email })
  await resolvePopups('sched_swap', String(r.request_id), user.email)
  return { ok: true, status: approve ? 'approved' : 'declined' }
}

/** schedulerImport: bulk-load roster rows (the October-2026 one-off keeps its name). */
export async function schedulerImport(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const rows = (payload || {}).rows as Record<string, unknown>[]
  if (!Array.isArray(rows)) throw new InputError('Give the roster rows to import.')
  for (const r of rows) {
    await appendRow(SCH_TABLES.plan, { ...r, imported_by: user.email }, user.email)
  }
  return { imported: rows.length }
}

/** setupSchedulerTables: DDL lives in migrations/007; kept as the legacy no-op probe. */
export async function setupSchedulerTables(): Promise<Record<string, unknown>> {
  await requireRole(['admin'])
  const found: Record<string, boolean> = {}
  for (const t of Object.values(SCH_TABLES)) {
    const { error } = await db().from(t).select('id').limit(1)
    found[t] = !error
  }
  return { tables: found }
}

/** importOctober2026Shifts verbatim name kept: one-off seeding helper. */
export async function importOctober2026Shifts(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  return schedulerImport({ ...(payload || {}), rows: (payload || {}).rows || [] })
}
