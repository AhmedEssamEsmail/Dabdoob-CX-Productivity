/**
 * RosterSync.js admin surface — verbatim port of
 * Command_Center_V2_deprecated/RosterSync.js:
 * getRosterAdmin, setPersonV2Fields, setPersonOverrides, addHoliday,
 * removeHoliday, syncRosterNow (+ the pure HCT resolver dqRosterFromHct_ and
 * friends, so a connected sheet source can run the whole legacy sync).
 *
 * Seams: ROSTER_TABLE -> `roster`, DQ_HOLIDAYS_TABLE -> `holidays`,
 * scriptProps_().dq_last_roster_sync -> the config key of the same name,
 * dqReadHct_ -> the hct adapter (throws an honest error until a headcount
 * source is connected — Google Sheets cannot be read from here).
 */

import 'server-only'

import {
  appendRow,
  appendRows,
  configAll,
  getConfig,
  readStore,
  requireRole,
  setConfig,
  updateRow,
  updateRows,
} from '@/features/shared/platform'
import { assertWritable } from '@/features/shared/platform/viewas'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { hbBeat, hbFlush } from '@/features/shared/platform/health'
import { wcReset, dqParseDaysOff } from '@/features/shared/platform/calendar'
import { dqLogRun_ } from '@/features/cx-queue/lib/jobs'
import { normEmail_, dqKeyPart_, dqSetting_, formatDate_, type Cfg } from '@/features/shared/lib/adapters'

export const ROSTER_TABLE = 'roster'
export const DQ_HOLIDAYS_TABLE = 'holidays'
export const DQ_ROSTER_EXTRA = [
  'freshdesk_id', 'freshdesk_name', 'maqsam_name', 'position', 'section', 'hiring_date', 'source',
]
export const DQ_ROSTER_V2_COLS = [
  'based_in_country', 'days_off', 'role_override', 'tl_override', 'updated_by', 'updated_at',
]
export const DQ_ROSTER_ROLES = ['admin', 'tl', 'agent', 'specialist']
export const DQ_COUNTRY_LIST = 'person.country'
export const DQ_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// The HCT mirror columns (the DQ_HCT_COLS map in legacy) are owned by the
// hct adapter, which already returns {name,email,position,department,section,
// manager,status,lwd,hiringDate,fdId,fdName,maqsamName} records.
function dqNameKey_(s: unknown): string {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function dqCleanEmail_(v: unknown): string {
  return String(v || '').replace(/[\s​-‍⁠﻿]/g, '').toLowerCase()
}

function dqNameTokens_(s: unknown): string[] {
  return dqNameKey_(s)
    .replace(/[^a-z؀-ۿ ]/g, ' ')
    .split(' ')
    .filter(String)
    .map((t) => t.replace(/(.)\1+/g, '$1'))
}

function dqNameWithin_(short: string[], full: string[]): boolean {
  if (!short.length || !full.length || short[0] !== full[0]) return false
  let j = 0
  for (let i = 0; i < full.length && j < short.length; i++) if (full[i] === short[j]) j++
  return j === short.length
}

interface HctPerson { key: string; tokens: string[]; email: string; active: boolean; inScope: boolean }

function dqResolveManager_(
  name: unknown,
  people: HctPerson[],
  aliases: Record<string, string>
): { email: string; reason?: string } {
  const key = dqNameKey_(name)
  if (!key || key === '-') return { email: '' }
  const alias = Object.keys(aliases || {}).filter((k) => dqNameKey_(k) === key)[0]
  if (alias) return { email: dqCleanEmail_(aliases[alias]) }
  const pick = (list: HctPerson[]): HctPerson[] => {
    if (list.length < 2) return list
    const tiers = [
      (p: HctPerson) => p.inScope && p.active,
      (p: HctPerson) => p.active,
      () => true,
    ]
    for (const t of tiers) {
      const hit = list.filter(t)
      if (hit.length) return hit
    }
    return list
  }
  const dedupe = (list: HctPerson[]): HctPerson[] => {
    const seen: Record<string, boolean> = {}
    return list.filter((p) => {
      if (seen[p.email]) return false
      seen[p.email] = true
      return true
    })
  }
  const exact = pick(dedupe(people.filter((p) => p.key === key)))
  if (exact.length === 1) return { email: exact[0].email }
  const tokens = dqNameTokens_(name)
  const fuzzy =
    tokens.length >= 2
      ? pick(dedupe(people.filter((p) => dqNameWithin_(tokens, p.tokens))))
      : []
  if (fuzzy.length === 1) return { email: fuzzy[0].email }
  if (exact.length > 1 || fuzzy.length > 1) {
    return {
      email: '',
      reason:
        'ambiguous: ' + (exact.length > 1 ? exact : fuzzy).map((p) => p.email).join(', '),
    }
  }
  return { email: '', reason: 'no HCT employee with that name' }
}

function dqRoleFor_(position: unknown, email: string, cfg: Record<string, unknown>): string {
  const pos = dqNameKey_(position)
  const has = (list: unknown) =>
    ((list as unknown[]) || []).some((x) => {
      const k = dqNameKey_(x)
      return k && pos.indexOf(k) !== -1
    })
  if (has(cfg.adminPositions)) return 'admin'
  if (/team\s*lead(er)?/.test(pos)) return 'tl'
  if (
    has(cfg.nonAgentPositions) ||
    ((cfg.nonAgentEmails as unknown[]) || []).map(dqCleanEmail_).indexOf(email) !== -1
  )
    return 'specialist'
  return 'agent'
}

async function dqRosterCfg_(cfg: Cfg): Promise<Record<string, unknown>> {
  return {
    aliases: dqSetting_(cfg, 'roster_manager_aliases') || {},
    adminPositions: dqSetting_(cfg, 'roster_admin_positions') || [],
    nonAgentPositions: dqSetting_(cfg, 'roster_non_agent_positions') || [],
    nonAgentEmails: dqSetting_(cfg, 'roster_non_agent_emails') || [],
  }
}

function dqHctActive_(rec: Record<string, unknown>): boolean {
  const lwd =
    rec.lwd instanceof Date ? 'date' : String(rec.lwd === null || rec.lwd === undefined ? '' : rec.lwd).trim()
  return String(rec.status || '').trim().toLowerCase() === 'current' && (lwd === '' || lwd === '-')
}

function dqInScope_(rec: Record<string, unknown>, scope: unknown[]): boolean {
  return (scope || []).map(dqNameKey_).indexOf(dqNameKey_(rec.section)) !== -1
}

/**
 * dqRosterFromHct_ verbatim (pure): HCT records -> Roster rows.
 * Returns { rows, unresolved, outOfScope }.
 */
export function dqRosterFromHct_(
  records: Record<string, unknown>[],
  scope: unknown[],
  tz: string | undefined,
  cfg: Record<string, unknown>
): { rows: Record<string, unknown>[]; unresolved: { email: string; manager: string; reason?: string }[]; outOfScope: Record<string, number> } {
  cfg = cfg || {}
  const people: HctPerson[] = []
  records.forEach((rec) => {
    const email = dqCleanEmail_(rec.email)
    const key = dqNameKey_(rec.name)
    if (!email || !key) return
    people.push({
      key,
      tokens: dqNameTokens_(rec.name),
      email,
      active: dqHctActive_(rec),
      inScope: dqInScope_(rec, scope),
    })
  })
  const rows: Record<string, unknown>[] = []
  const unresolved: { email: string; manager: string; reason?: string }[] = []
  const outOfScope: Record<string, number> = {}
  const seen: Record<string, { i: number; active: boolean }> = {}
  records.forEach((rec) => {
    const email = dqCleanEmail_(rec.email)
    if (!email) return
    if (!dqInScope_(rec, scope)) {
      const k = String(rec.department || '').trim() + ' / ' + String(rec.section || '').trim()
      outOfScope[k] = (outOfScope[k] || 0) + 1
      return
    }
    const active = dqHctActive_(rec)
    if (seen[email] && (seen[email].active || !active)) return
    const resolved = dqResolveManager_(rec.manager, people, (cfg.aliases as Record<string, string>) || {})
    const tl = resolved.email
    if (resolved.reason)
      unresolved.push({ email, manager: String(rec.manager).trim(), reason: resolved.reason })
    const role = dqRoleFor_(rec.position, email, cfg)
    const hd =
      rec.hiringDate instanceof Date && !isNaN((rec.hiringDate as Date).getTime())
        ? formatDate_(rec.hiringDate as Date, tz || 'Africa/Cairo', 'yyyy-MM-dd')
        : String(rec.hiringDate || '').trim()
    const row: Record<string, unknown> = {
      email,
      name: String(rec.name || '').replace(/\s+/g, ' ').trim(),
      role,
      tl_email: tl === email ? '' : tl,
      country: '',
      active,
      freshdesk_id: String(rec.fdId || '').trim(),
      freshdesk_name: String(rec.fdName || '').trim(),
      maqsam_name: String(rec.maqsamName || '').trim(),
      position: String(rec.position || '').trim(),
      section: String(rec.section || '').trim(),
      hiring_date: hd,
      source: 'hct',
    }
    row.hct_role = row.role
    row.hct_tl_email = row.tl_email
    if (seen[email]) rows[seen[email].i] = row
    else {
      seen[email] = { i: rows.length, active }
      rows.push(row)
    }
    seen[email].active = active
  })
  return { rows, unresolved, outOfScope }
}

/**
 * dqReadHct_ seam: the HCT employee sheet. There is no Google Sheets source in
 * this app; until one is connected (a `dq_hct` mirror or a Sheets adapter),
 * syncRosterNow throws the same honest failure the legacy reader produced.
 */
export async function dqReadHct_(): Promise<Record<string, unknown>[]> {
  const { readStore: rs } = await import('@/features/shared/platform')
  const store = await rs('dq_hct')
  if (!store.exists) {
    throw new Error(
      'Roster master is not connected: no dq_hct mirror table. The HCT source (the employee spreadsheet) cannot be read from this app yet.'
    )
  }
  return store.rows
}

async function dqLastRosterSync_(): Promise<Record<string, unknown> | null> {
  try {
    const v = await getConfig('dq_last_roster_sync')
    return v ? (typeof v === 'string' ? JSON.parse(v) : (v as Record<string, unknown>)) : null
  } catch {
    return null
  }
}

/** dqSyncRoster_ verbatim — dqReadHct_ injected; `roster` + config stores. */
export async function dqSyncRoster_(cfg?: Cfg, actor = 'system:roster_sync'): Promise<Record<string, unknown>> {
  const started = Date.now()
  if (!cfg) cfg = await configAll()
  const res = dqRosterFromHct_(
    await dqReadHct_(),
    (dqSetting_(cfg, 'roster_scope') as unknown[]) || [],
    // Session.getScriptTimeZone() in the GAS build — the app's data timezone,
    // not business_tz (Kuwait is where check-ins live; Cairo is where dates stamp).
    String(dqSetting_(cfg, 'data_tz') || 'Africa/Cairo'),
    await dqRosterCfg_(cfg)
  )
  if (!res.rows.length)
    throw new Error(
      'No HCT rows matched roster_scope ' +
        JSON.stringify(dqSetting_(cfg, 'roster_scope')) +
        '. Departments/sections seen: ' +
        Object.keys(res.outOfScope).join('; ')
    )
  const now = new Date().toISOString()
  const existing: Record<string, Record<string, unknown>> = {}
  ;(await readStore(ROSTER_TABLE)).rows.forEach((r) => {
    existing[normEmail_(r.email)] = r
  })
  const fields = ['name', 'role', 'tl_email', 'active'].concat(
    DQ_ROSTER_EXTRA.filter((f) => f !== 'synced_at')
  )
  const updates: { key: string; patch: Record<string, unknown> }[] = []
  const appends: Record<string, unknown>[] = []
  const incoming: Record<string, boolean> = {}
  const changes: Record<string, unknown>[] = []
  res.rows.forEach((row) => {
    incoming[String(row.email)] = true
    const cur = existing[String(row.email)]
    if (!cur) {
      row.synced_at = now
      appends.push(row)
      return
    }
    if (cur.source && cur.source !== 'hct') return
    if (DQ_ROSTER_ROLES.indexOf(String(cur.role_override || '')) !== -1)
      row.role = String(cur.role_override)
    if (cur.tl_override) row.tl_email = normEmail_(cur.tl_override)
    const patch: Record<string, unknown> = {}
    fields.forEach((f) => {
      if (String(cur[f]) !== String(row[f])) patch[f] = row[f]
    })
    if (Object.keys(patch).length) {
      const shown = Object.keys(patch).filter(
        (f) => f === 'name' || f === 'role' || f === 'tl_email' || f === 'active' || f === 'position'
      )
      if (shown.length)
        changes.push({
          email: row.email,
          name: String(row.name || row.email),
          fields: shown.map((f) => f + ': ' + String(cur[f] || '-') + ' -> ' + String(row[f] || '-')),
        })
      patch.synced_at = now
      updates.push({ key: String(cur.email), patch })
    }
  })
  Object.keys(existing).forEach((e) => {
    const cur = existing[e]
    const wasActive = cur.active === true || String(cur.active).toLowerCase() === 'true'
    if (cur.source === 'hct' && !incoming[e] && wasActive) {
      updates.push({ key: String(cur.email), patch: { active: false, synced_at: now } })
      changes.push({
        email: normEmail_(cur.email),
        name: String(cur.name || cur.email),
        fields: ['left the HCT scope: now inactive'],
      })
    }
  })
  if (appends.length) await appendRows(ROSTER_TABLE, appends, actor)
  if (updates.length) await updateRows(ROSTER_TABLE, 'email', updates, { actor })
  wcReset()
  const note = res.unresolved.length
    ? 'Unresolved Direct Repporter: ' +
      res.unresolved.map((u) => u.email + ' -> "' + u.manager + '" (' + u.reason + ')').join('; ')
    : 'All managers resolved'
  await dqLogRun_('roster_sync', started, res.unresolved.length ? 'warn' : 'ok', {
    rowsIn: res.rows.length,
    rowsOut: appends.length + updates.length,
    note: note.slice(0, 1500),
  })
  const out = {
    synced: res.rows.length,
    added: appends.length,
    changed: updates.length,
    unresolved: res.unresolved,
    outOfScope: res.outOfScope,
    addedPeople: appends.map((a) => String(a.name || a.email)),
    changes,
    at: now,
  }
  await setConfig(
    'dq_last_roster_sync',
    JSON.stringify(out).slice(0, 8500),
    'Last roster sync result (People & holidays).',
    'system:roster_sync'
  ).catch(() => undefined)
  return out
}

/** Admin "sync now" — verbatim. */
export async function syncRosterNow(): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  return dqSyncRoster_(undefined, user.email)
}

/**
 * jobRosterSync (RosterSync.js:265) verbatim: the daily scheduled run —
 * dqStep_('roster_sync') semantics (ok/error heartbeat + dqLogRun_ on error,
 * never rethrows) inside hbFlush_. GATED G1: no cron route exists until the
 * HCT mirror (dq_hct) is populated; dqSyncRoster_ itself throws the adapter's
 * honest error while the source is unconnected.
 */
export async function jobRosterSync(): Promise<Record<string, unknown> | null> {
  await requireJobCaller()
  try {
    const r = await dqSyncRoster_()
    hbBeat('roster_sync', 'ok', '')
    return r
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await dqLogRun_('roster_sync', Date.now(), 'error', { error: msg })
    hbBeat('roster_sync', 'error', msg)
    return null
  } finally {
    await hbFlush()
  }
}

function dqRosterBase_(row: Record<string, unknown>): { role: string; tlEmail: string; known: boolean } {
  const hasBase = String(row.hct_role || '') !== ''
  return {
    role: hasBase ? String(row.hct_role) : row.role_override ? 'agent' : String(row.role || 'agent'),
    tlEmail: hasBase
      ? normEmail_(row.hct_tl_email)
      : row.tl_override
        ? ''
        : normEmail_(row.tl_email),
    known: hasBase || (!row.role_override && !row.tl_override),
  }
}

/** setPersonOverrides verbatim. */
export async function setPersonOverrides(
  email: string,
  o: { role?: string; tlEmail?: string }
): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  o = o || {}
  let role = String(o.role || '').trim().toLowerCase()
  if (role && DQ_ROSTER_ROLES.indexOf(role) === -1)
    throw new Error('Role must be one of ' + DQ_ROSTER_ROLES.join(', ') + '.')
  let tl = dqCleanEmail_(o.tlEmail)
  const rows = (await readStore(ROSTER_TABLE)).rows
  const byEmail: Record<string, Record<string, unknown>> = {}
  rows.forEach((r) => {
    byEmail[normEmail_(r.email)] = r
  })
  const hit = byEmail[normEmail_(email)]
  if (!hit) throw new Error('No roster row for ' + email + '.')
  const me = normEmail_(hit.email)
  if (tl) {
    if (tl === me) throw new Error('A person cannot report to themselves.')
    const mgr = byEmail[tl]
    if (!mgr) throw new Error(tl + ' is not on the roster.')
    const mgrActive =
      mgr.active === '' || mgr.active === true || String(mgr.active).toLowerCase() === 'true'
    if (!mgrActive || (mgr.role !== 'tl' && mgr.role !== 'admin')) {
      throw new Error(
        String(mgr.name || tl) +
          ' is not an active team lead or admin, so nobody can report to them.'
      )
    }
    const seen: Record<string, boolean> = {}
    let up: string = tl
    for (let i = 0; up && i < 20 && !seen[up]; i++) {
      if (up === me)
        throw new Error(
          String(mgr.name || tl) +
            ' already reports to ' +
            String(hit.name || me) +
            ', directly or through someone else.'
        )
      seen[up] = true
      up = byEmail[up] ? normEmail_(byEmail[up].tl_email) : ''
    }
  }
  const base = dqRosterBase_(hit)
  if (role === base.role) role = ''
  if (tl && tl === base.tlEmail) tl = ''
  const patch: Record<string, unknown> = {
    role_override: role,
    tl_override: tl,
    role: role || base.role,
    tl_email: tl || base.tlEmail,
  }
  if (String(hit.hct_role || '') === '' && base.known && (role || tl)) {
    patch.hct_role = base.role
    patch.hct_tl_email = base.tlEmail
  }
  await updateRow(ROSTER_TABLE, 'email', String(hit.email), patch, { actor: user.email })
  wcReset()
  return {
    email: me,
    role: patch.role,
    tlEmail: patch.tl_email,
    roleOverride: role,
    tlOverride: tl,
    baseRole: base.role,
    baseTlEmail: base.tlEmail,
    baseKnown: base.known,
  }
}

/** dqParseDaysOff_ — the shared WorkCalendar.js port (identical strings/limits). */
const dqParseDaysOff_ = dqParseDaysOff

/** getRosterAdmin verbatim — people + holidays + sync + weekdays + defaults. */
export async function getRosterAdmin(cfg?: Cfg): Promise<Record<string, unknown>> {
  await requireRole(['admin'])
  if (!cfg) cfg = await configAll()
  const people = (await readStore(ROSTER_TABLE)).rows
    .map((r) => ({
      email: normEmail_(r.email),
      name: String(r.name || ''),
      role: String(r.role || ''),
      tlEmail: normEmail_(r.tl_email),
      hctRole: String(r.hct_role || ''),
      hctTlEmail: normEmail_(r.hct_tl_email),
      roleOverride: String(r.role_override || ''),
      tlOverride: normEmail_(r.tl_override),
      section: String(r.section || ''),
      position: String(r.position || ''),
      source: String(r.source || 'manual'),
      active: r.active === true || String(r.active).toLowerCase() === 'true',
      basedInCountry: String(r.based_in_country || ''),
      daysOff: dqParseDaysOff_(r.days_off),
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  const holidays = (await readStore(DQ_HOLIDAYS_TABLE)).rows
    .filter((h) => !h.deleted_at)
    .map((h) => ({
      id: String(h.holiday_id || h.id),
      country: String(h.country),
      date: dqKeyPart_('date', h.date).slice(0, 10),
      name: String(h.name),
      addedBy: String(h.submitted_by),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.country.localeCompare(b.country)))
  return {
    people,
    holidays,
    lastSync: await dqLastRosterSync_(),
    weekdays: DQ_WEEKDAYS,
    daysOffDefault: dqParseDaysOff_(dqSetting_(cfg, 'days_off_default')),
    daysOffByCountry: dqSetting_(cfg, 'days_off_by_country') || {},
    countryList: DQ_COUNTRY_LIST,
  }
}

/** setPersonV2Fields verbatim. */
export async function setPersonV2Fields(
  email: string,
  fields: { basedInCountry?: unknown; daysOff?: unknown }
): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  fields = fields || {}
  const country = String(fields.basedInCountry || '').replace(/\s+/g, ' ').trim()
  if (country.length > 60) throw new Error('Keep the country under 60 characters.')
  const days = dqParseDaysOff_(fields.daysOff)
  if (days.length > 5) throw new Error('At least two working days a week, please check the days off.')
  let row = await updateRow(
    ROSTER_TABLE,
    'email',
    normEmail_(email),
    { based_in_country: country, days_off: days.join(',') },
    { actor: user.email }
  )
  if (!row) {
    const hit = (await readStore(ROSTER_TABLE)).rows.filter(
      (r) => normEmail_(r.email) === normEmail_(email)
    )[0]
    if (!hit) throw new Error('No roster row for ' + email + '.')
    row = await updateRow(
      ROSTER_TABLE,
      'email',
      String(hit.email),
      { based_in_country: country, days_off: days.join(',') },
      { actor: user.email }
    )
  }
  wcReset()
  return { email: normEmail_(email), basedInCountry: country, daysOff: days }
}

async function dqIsHoliday_(country: string, date: string): Promise<boolean> {
  return (await readStore(DQ_HOLIDAYS_TABLE)).rows.some(
    (h) =>
      !h.deleted_at &&
      dqKeyPart_('date', h.date).slice(0, 10) === date &&
      String(h.country).trim().toLowerCase() === country.trim().toLowerCase()
  )
}

/** addHoliday verbatim — throws when (country, date) already has one. */
export async function addHoliday(h: {
  country?: unknown
  date?: unknown
  name?: unknown
}): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  h = h || {}
  const country = String(h.country || '').replace(/\s+/g, ' ').trim()
  const date = String(h.date || '').trim()
  const name = String(h.name || '').replace(/\s+/g, ' ').trim()
  if (!country) throw new Error('Choose the country the holiday applies to.')
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || isNaN(new Date(date + 'T00:00:00Z').getTime()))
    throw new Error('Enter the date as yyyy-mm-dd.')
  if (!name || name.length > 80) throw new Error('Give the holiday a name, up to 80 characters.')
  if (await dqIsHoliday_(country, date))
    throw new Error(country + ' already has a holiday on ' + date + '.')
  const row = await appendRow(
    DQ_HOLIDAYS_TABLE,
    { country, date, name, deleted_at: null },
    user.email
  )
  wcReset()
  return {
    id: String(row.holiday_id || row.id),
    country,
    date,
    name,
    addedBy: String(row.submitted_by || user.email),
  }
}

/** removeHoliday verbatim — soft delete; the row stays with deleted_at. */
export async function removeHoliday(id: string): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const rows = (await readStore(DQ_HOLIDAYS_TABLE)).rows
  // updateRow_ matches holiday_id whatever deleted_at holds — a repeat removal
  // still returns { id } (the row stays, deleted_at overwritten again).
  const hit = rows.filter((h) => String(h.holiday_id || h.id) === String(id))[0]
  if (!hit) throw new Error('That holiday no longer exists.')
  await updateRow(
    DQ_HOLIDAYS_TABLE,
    'id',
    hit.id,
    { deleted_at: new Date().toISOString() },
    { actor: user.email }
  )
  wcReset()
  return { id: String(id) }
}
