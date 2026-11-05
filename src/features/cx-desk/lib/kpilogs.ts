/**
 * KPI logs page (#/kpi-logs) — verbatim port of Desk_deprecated/KpiLogs.js.
 * Three hand-kept lists, because no system records them (Mohamed 2026-10-11):
 *   behaviour  HR-confirmed business-behaviour cases -> kpi_behaviour_log
 *   leave      unplanned leaves -> kpi_leave_log
 *   exclusion  tickets left out of an area's Freshdesk SLA -> tlp_ticket_exclusions
 * Entries are never deleted: Remove stamps removed_by / removed_at and readers
 * skip them (kpiLogRows_). dqUpsertIn_ -> Postgres upsert on the same keys.
 */

import { db, newId } from '@/features/shared/platform/repo'
import { readStore } from '@/features/shared/platform/stores'
import { getConfig } from '@/features/shared/platform/settings'
import { normEmail, pwDirectory, requireRole, type Directory, type PlatformUser } from '@/features/shared/platform/identity'
import { assertWritable } from '@/features/shared/platform/viewas'
import { pwIso, pwToday, dqAddDays } from '@/features/shared/platform/time'
import { KPI_LEAVE_TYPES, kpiLogRows_ } from '@/features/cx-people/lib/kpi'
import { tlpAreasFor_ } from './tlperformance'

type Row = Record<string, unknown>

const KL_TABLES: Record<string, [string, string]> = {
  behaviour: ['kpi_behaviour_log', 'log_id'],
  leave: ['kpi_leave_log', 'log_id'],
  exclusion: ['tlp_ticket_exclusions', 'key'],
}
const KL_DAYS = 180

function klDate_(v: unknown, label: string): string {
  const d = String(v || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Choose the ' + label + '.')
  return d
}

/** Areas whose SLA comes from Freshdesk (tlp_area_sources, seeded by the Hub); Returns when not set yet. */
async function klAreas_(): Promise<string[]> {
  const keys = Object.keys(((await getConfig('tlp_area_sources', {})) || {}) as Record<string, unknown>)
  return keys.length ? keys : ['Returns']
}

async function klCanExclude_(user: PlatformUser, area: string): Promise<boolean> {
  return user.role === 'admin' || (await tlpAreasFor_(user.email)).some((a) => a.area === area)
}

function klOut_(kind: string, r: Row, dir: Directory) {
  const base = { id: String(r[KL_TABLES[kind][1]]), loggedBy: dir.name(String(r.logged_by)), loggedAt: pwIso(r.logged_at) }
  if (kind === 'exclusion') {
    return Object.assign(base, { area: String(r.area), ticketId: String(r.ticket_id), reason: String(r.reason || '') })
  }
  const out: Row = Object.assign(base, { email: normEmail(r.email), name: dir.name(String(r.email)), note: String(r.note || '') })
  if (kind === 'behaviour') out.date = String(r.date).slice(0, 10)
  else {
    out.from = String(r.from_date).slice(0, 10)
    out.to = String(r.to_date || r.from_date).slice(0, 10)
    out.type = String(r.type || '')
  }
  return out
}

/** The page: the last 180 days of each list (newest first), the agents to pick from, leave types and areas. */
export async function kpiLogsPage() {
  const user = await requireRole(['admin', 'tl'])
  const dir = await pwDirectory()
  const cut = dqAddDays(pwToday(), -KL_DAYS)
  const stores: Record<string, Row[]> = {}
  for (const kind of Object.keys(KL_TABLES)) {
    stores[kind] = (await readStore(KL_TABLES[kind][0])).rows
  }
  const list = (kind: string, dateOf: (r: Row) => string) =>
    kpiLogRows_(stores[kind])
      .filter((r) => dateOf(r) >= cut)
      .map((r) => klOut_(kind, r, dir))
      .sort((a, b) => {
        const ax = String((a as Row).date || (a as Row).from || (a as Row).loggedAt)
        const bx = String((b as Row).date || (b as Row).from || (b as Row).loggedAt)
        return bx < ax ? -1 : 1
      })
  const agents = Object.keys(dir.by)
    .map((e) => dir.by[e])
    .filter((p) => p.active && (p.role === 'agent' || p.role === 'specialist'))
    .map((p) => ({ email: p.email, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const areas = await klAreas_()
  const canExclude: string[] = []
  for (const a of areas) if (await klCanExclude_(user, a)) canExclude.push(a)
  return {
    agents,
    leaveTypes: KPI_LEAVE_TYPES,
    areas,
    days: KL_DAYS,
    canExclude,
    behaviour: list('behaviour', (r) => String(r.date).slice(0, 10)),
    leaves: list('leave', (r) => String(r.to_date || r.from_date).slice(0, 10)),
    exclusions: list('exclusion', (r) => pwIso(r.logged_at).slice(0, 10)),
  }
}

/**
 * Adds one entry. kind 'behaviour': { email, date, note }; 'leave': { email, from, to, type, note };
 * 'exclusion': { area, ticketIds (one or more, comma / space separated), reason }. Returns the saved rows.
 */
export async function kpiLogSave(
  kind: string,
  input: { email?: string; date?: string; from?: string; to?: string; type?: string; note?: string; area?: string; ticketIds?: string; reason?: string },
) {
  const user = await requireRole(['admin', 'tl'])
  if (!KL_TABLES[kind]) throw new Error('Unknown log.')
  await assertWritable()
  input = input || {}
  const dir = await pwDirectory()
  const now = new Date().toISOString()
  const note = String(input.note || '').trim().slice(0, 1000)
  let rows: Row[]
  if (kind === 'exclusion') {
    const area = String(input.area || '')
    if ((await klAreas_()).indexOf(area) === -1) throw new Error('Choose the area.')
    if (!(await klCanExclude_(user, area))) throw new Error("Tickets are excluded by the area's owner or an admin.")
    const ids = String(input.ticketIds || '')
      .split(/[\s,;]+/)
      .map((x) => x.replace(/^#/, ''))
      .filter(String)
    if (!ids.length || ids.some((x) => !/^\d{1,12}$/.test(x))) throw new Error('Ticket IDs are numbers, separated by commas or spaces.')
    const reason = String(input.reason || '').trim().slice(0, 300)
    if (reason.length < 3) throw new Error('Say why (for example: Ajex, or outside KSA).')
    rows = ids.slice(0, 200).map((id) => ({
      key: area + '|' + id,
      area,
      ticket_id: id,
      reason,
      logged_by: user.email,
      logged_at: now,
      removed_by: '',
      removed_at: null,
    }))
  } else {
    const email = normEmail(input.email)
    const p = dir.person(email)
    if (!p || !(p.role === 'agent' || p.role === 'specialist')) throw new Error('Choose the agent.')
    if (kind === 'behaviour') {
      if (note.length < 5) throw new Error('Describe the case as HR confirmed it.')
      rows = [{ log_id: newId('BH'), email, date: klDate_(input.date, 'date of the case'), note, logged_by: user.email, logged_at: now }]
    } else {
      const from = klDate_(input.from, 'first day')
      const to = input.to ? klDate_(input.to, 'last day') : from
      if (to < from) throw new Error('The last day is before the first day.')
      const type = String(input.type || '')
      if (KPI_LEAVE_TYPES.indexOf(type as never) === -1) throw new Error('Choose the leave type.')
      rows = [{ log_id: newId('LV'), email, from_date: from, to_date: to, type, note, logged_by: user.email, logged_at: now }]
    }
  }
  const [table, keyCol] = KL_TABLES[kind]
  const { error } = await db().from(table).upsert(rows, { onConflict: keyCol })
  if (error) throw new Error(error.message)
  return rows.map((r) => klOut_(kind, r, dir))
}

/** Removes one entry (kept, stamped removed). The person who logged it, or an admin. */
export async function kpiLogRemove(kind: string, id: string) {
  const user = await requireRole(['admin', 'tl'])
  const t = KL_TABLES[kind]
  if (!t) throw new Error('Unknown log.')
  await assertWritable()
  const r = (await readStore(t[0])).rows.filter((x) => String(x[t[1]]) === String(id) && !x.removed_at)[0]
  if (!r) throw new Error('That entry is no longer there.')
  if (user.role !== 'admin' && normEmail(r.logged_by) !== user.email) {
    throw new Error('Only the person who logged it, or an admin, can remove it.')
  }
  const { error } = await db()
    .from(t[0])
    .update({ removed_by: user.email, removed_at: new Date().toISOString() })
    .eq(t[1], String(id))
  if (error) throw new Error(error.message)
  return { id: String(id) }
}
