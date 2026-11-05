/**
 * productivity.js + the ProductivityApp.js rule layer ported 1:1. Pure functions keep the
 * legacy name and signature; every sheet/config read became an injectable argument or a
 * callback on the `ProdIo` surface — the engine itself stays free of storage.
 *
 * Orchestration: prodComputeDates_ does the compute AND calls io.upsert/io.upsertIn with the
 * same (table, cols, rows, year) arguments Stores.js receives; prodDetectDates_ likewise
 * reads io.prodRows and writes through io.upsertIn/io.upsert/io.append (prod_flag_log).
 */

import {
  dqAddDays_,
  dqDateKey_,
  dqSetting_,
  dqTzOffsetMin_,
  getConfig_,
  normEmail_,
  prodActivityKey_,
  prodDateKey_,
  prodFileFor_,
  prodHeadcountRows_,
  prodNameToEmail_,
  prodReadCols_,
  type Cfg,
  type HeadcountRow,
  type SheetBookLike,
} from '@/features/shared/lib/adapters'
import {
  prodAdjustAux_,
  prodCasesByEmail_,
  prodCasesFromActivityRows_,
  prodConfidenceScore_,
  prodDetectFlags_,
  prodDueDate_,
  prodEffectiveStatus_,
  prodIn_,
  prodIsAutoDue_,
  prodWindowHist_,
} from './validation'

export { prodActivityKey_ } from '@/features/shared/lib/adapters'

// ---------------------------------------------------------------- ProductivityApp.js settings seam

/** PROD_SETTINGS defaults — verbatim (the value a fresh setup seeds). */
export const PROD_SETTINGS: Record<string, { value: unknown; description?: string }> = {
  prod_activity_tz: { value: 'Asia/Kuwait' },
  prod_status_map: { value: {} },
  prod_flag_cases_x: { value: 2 },
  prod_flag_window_min: { value: 10 },
  prod_flag_min_interval_min: { value: 5 },
  prod_flag_statuses: { value: ['IDLE'] },
  prod_working_statuses: { value: ['Available', 'Chats'] },
  prod_offline_statuses: { value: ['Offline'] },
  prod_channel_status: { value: { chat: 'Chats', ticket: 'Available', wa: 'Waiting Address' } },
  prod_replacement_statuses: { value: ['Available', 'Chats', 'Inbound Calls', 'Waiting Address', 'Busy'] },
  prod_reason_statuses: { value: ['Busy'] },
  prod_review_days: { value: 7 },
  prod_dispute_days: { value: 3 },
  prod_flag_auto_accept: { value: true },
  prod_confidence_auto_threshold: { value: 50 },
  prod_confidence_warning_threshold: { value: 30 },
  quarterly_report_recipients: { value: '' },
  prod_chat_groups: { value: ['FreshChat'] },
  prod_wa_groups: { value: ['Waiting Address', 'Unreachable Customers'] },
  tph_channels: {
    value: [
      { key: 'internal', name: 'Internal', kind: 'ticket', groups: ['Customer Support - Internal', 'Kuwait - Customer Support - Internal', 'KSA - Customer Support', 'Out Of Stock (OOS)', 'OOS - Kuwait'] },
      { key: 'chats', name: 'Chats', kind: 'chat', groups: ['FreshChat'] },
      { key: 'wa', name: 'Waiting address', kind: 'manual', groups: ['Waiting Address', 'Unreachable Customers'] },
      { key: 'calls', name: 'Inbound calls', kind: 'manual', groups: ['Inbound Calls Documentation'] },
    ],
  },
  tph_activities: { value: [{ key: 'break', name: 'Break' }, { key: 'meeting', name: 'Meeting' }] },
  tph_ticket_statuses: { value: ['Open', 'Pending on CX'] },
  tph_chat_exclude_statuses: { value: [] },
  tph_day_hours: { value: [8, 24] },
  tph_minutes_per_case: { value: 3 },
  tph_cap_window_min: { value: 55 },
  tph_calls_minute_factor: { value: 0.5 },
  tph_call_states: { value: ['Serviced'] },
  tph_tl_edit_days: { value: 3 },
  tph_eligible_days: { value: 28 },
}

/** PROD_SETTINGS_SUPERSEDED verbatim: earlier defaults setupProductivity upgrades. */
export const PROD_SETTINGS_SUPERSEDED: Record<string, unknown[]> = {
  tph_channels: [
    [
      { key: 'internal', name: 'Internal', kind: 'ticket', groups: ['Customer Support - Internal', 'Kuwait - Customer Support - Internal', 'KSA - Customer Support'] },
      { key: 'chats', name: 'Chats', kind: 'chat', groups: ['FreshChat'] },
      { key: 'wa', name: 'Waiting address', kind: 'manual', groups: ['Waiting Address', 'Unreachable Customers'] },
      { key: 'calls', name: 'Inbound calls', kind: 'manual', groups: ['Inbound Calls Documentation'] },
    ],
    [
      { key: 'internal', name: 'Internal tickets', kind: 'ticket', groups: ['Customer Support - Internal'] },
      { key: 'kw_internal', name: 'Kuwait internal tickets', kind: 'ticket', groups: ['Kuwait - Customer Support - Internal'] },
      { key: 'ksa', name: 'KSA tickets', kind: 'ticket', groups: ['Internal Tickets - KSA'] },
      { key: 'chats', name: 'Chats', kind: 'chat', groups: ['FreshChat'] },
      { key: 'wa', name: 'Waiting address', kind: 'ticket', groups: ['Waiting Address', 'Unreachable Customers'] },
    ],
    [
      { key: 'internal', name: 'Internal tickets', kind: 'ticket', groups: ['Customer Support - Internal'] },
      { key: 'kw_internal', name: 'Kuwait internal tickets', kind: 'ticket', groups: ['Kuwait - Customer Support - Internal'] },
      { key: 'ksa', name: 'KSA tickets', kind: 'ticket', groups: ['KSA - Customer Support'] },
      { key: 'chats', name: 'Chats', kind: 'chat', groups: ['FreshChat'] },
      { key: 'wa', name: 'Waiting address', kind: 'manual', groups: ['Waiting Address', 'Unreachable Customers'] },
      { key: 'calls', name: 'Inbound calls', kind: 'manual', groups: ['Inbound Calls Documentation'] },
    ],
  ],
  tph_ticket_statuses: [['Open', 'Pending', 'Pending on CX', 'Pending on Ops', 'Pending on 3PL', 'Waiting on Customer', 'No Response From customer']],
  tph_chat_exclude_statuses: [['Waiting on Customer']],
}

/** prodSettingToWrite_: undefined to leave a stored value, else today's default. */
export function prodSettingToWrite_(key: string, has: boolean, current: unknown): unknown {
  if (!has) return PROD_SETTINGS[key].value
  const now = JSON.stringify(current)
  return (PROD_SETTINGS_SUPERSEDED[key] || []).some((v) => JSON.stringify(v) === now)
    ? PROD_SETTINGS[key].value
    : undefined
}

/** prodSetting_: Config value, else the PROD_SETTINGS default, else ''. */
export function prodSetting_(cfg: Cfg, key: string): unknown {
  const d = PROD_SETTINGS[key]
  return getConfig_(cfg, key, d ? d.value : '')
}

export function prodList_(cfg: Cfg, key: string): string[] {
  return ([] as unknown[]).concat(prodSetting_(cfg, key) || []).map(String).filter(String)
}

export function prodRule_(cfg: Cfg): {
  x: number
  windowMin: number
  minIntervalMin: number
  statuses: string[]
  channelStatus: Record<string, string>
} {
  return {
    x: Math.max(1, Math.round(Number(prodSetting_(cfg, 'prod_flag_cases_x')) || 2)),
    windowMin: Math.max(1, Number(prodSetting_(cfg, 'prod_flag_window_min')) || 10),
    minIntervalMin: Math.max(0, Number(prodSetting_(cfg, 'prod_flag_min_interval_min')) || 0),
    statuses: prodList_(cfg, 'prod_flag_statuses'),
    channelStatus: (prodSetting_(cfg, 'prod_channel_status') || {}) as Record<string, string>,
  }
}

export function prodGroups_(cfg: Cfg): { chat: string[]; wa: string[] } {
  return { chat: prodList_(cfg, 'prod_chat_groups'), wa: prodList_(cfg, 'prod_wa_groups') }
}

/** prodReady_: true once ss_productivity_id is configured. */
export function prodReady_(cfg: Cfg): boolean {
  return !!getConfig_(cfg, 'ss_productivity_id', '')
}

export function prodToday_(cfg: Cfg, now?: number | Date): string {
  return dqDateKey_(now === undefined ? new Date() : new Date(now), cfg)
}

export function prodNowIso_(now?: number | Date): string {
  return (now === undefined ? new Date() : new Date(now)).toISOString()
}

export function prodTicketUrl_(cfg: Cfg): string {
  return 'https://' + String(dqSetting_(cfg, 'freshdesk_domain')) + '/a/tickets/'
}

/** prodIntervalOf_: a stored prod_intervals row -> the shape the rules use. */
export function prodIntervalOf_(r: Record<string, unknown>): {
  date: string
  agentEmail: string
  agentName: string
  status: string
  startMs: number
  endMs: number
  minutes: number
} {
  return {
    date: String(r.date),
    agentEmail: normEmail_(r.agent_email),
    agentName: String(r.agent_name),
    status: String(r.status),
    startMs: Date.parse(String(r.start_at)),
    endMs: Date.parse(String(r.end_at)),
    minutes: Number(r.minutes) || 0,
  }
}

/** prodFlagsForDates_: flags of these dates (every decision), for the effective layer. */
export function prodFlagsForDates_(dates: string[], flagRows: Record<string, unknown>[]): Record<string, unknown>[] {
  const want: Record<string, boolean> = {}
  dates.forEach((d) => {
    want[d] = true
  })
  return flagRows.filter((f) => want[String(f.date)])
}

// ---------------------------------------------------------------- assumptions

export interface ProdAssumptions {
  mqTarget: number
  textTarget: number
  waTarget: number
}

/** prodAssumptions_ (V1 getProductivityAssumptions_): Assumptions B4/B5/B6, minutes. */
export function prodAssumptions_(ss: SheetBookLike): ProdAssumptions {
  const sh = ss.getSheetByName('Assumptions')!
  return {
    mqTarget: Number(singleCell_(sh.getRange(4, 2, 1, 1).getValues())),
    textTarget: Number(singleCell_(sh.getRange(5, 2, 1, 1).getValues())),
    waTarget: Number(singleCell_(sh.getRange(6, 2, 1, 1).getValues())),
  }
}

function singleCell_(vals: unknown[][]): unknown {
  return vals[0] ? vals[0][0] : undefined
}

// ---------------------------------------------------------------- activities

export interface ProdActivity {
  agentEmail: string
  performerName: unknown
  fieldChanged: unknown
  newValue: unknown
  channelGroup: unknown
  date: string | null
}

/**
 * prodActivitiesFromRows_: Activities (A..J), de-duplicated on prodActivityKey_, restricted
 * to the wanted date keys. agentEmail stays '' when the performer is off the roster.
 */
export function prodActivitiesFromRows_(
  rows: unknown[][],
  dates: string[],
  nameToEmail: Record<string, string>,
  localTz: string
): ProdActivity[] {
  const want: Record<string, boolean> = {}
  dates.forEach((d) => {
    want[d] = true
  })
  const seen: Record<string, boolean> = {}
  const out: ProdActivity[] = []
  rows.forEach((r) => {
    const date = prodDateKey_(r[9] || r[0])
    if (date === null || !want[date]) return
    const k = prodActivityKey_(r, localTz)
    if (seen[k]) return
    seen[k] = true
    const name = String(r[2] || '').trim().toLowerCase()
    out.push({
      agentEmail: nameToEmail[name] || '',
      performerName: r[2],
      fieldChanged: r[5],
      newValue: r[6],
      channelGroup: r[8],
      date,
    })
  })
  return out
}

/** prodLoadActivities_: all Activities rows of the FD workbook -> the events for `dates`. */
export function prodLoadActivities_(
  cfg: Cfg,
  openSpreadsheet: (id: string) => SheetBookLike,
  dates: string[],
  nameToEmail: Record<string, string>
): ProdActivity[] {
  const rows = prodReadCols_(
    openSpreadsheet(String(dqSetting_(cfg, 'fd_activity_ss_id'))),
    'Activities',
    1,
    10,
    1
  )
  return prodActivitiesFromRows_(rows, dates, nameToEmail, String(dqSetting_(cfg, 'activity_local_tz')))
}

// ---------------------------------------------------------------- month workbook load

export interface ProdRawData {
  maqsamCalls: { agentEmail: string; state: unknown; direction: unknown; date: string | null; handlingMin: number }[]
  fdAux: { agentName: unknown; email: string; status: unknown; minutes: number; date: string | null }[]
  auxExceptions: { email: string; date: string | null; minutes: number }[]
  quality: { email: string; date: string | null; score: number }[]
  ticketActivity: ProdActivity[]
}

/** prodLoadMonth_ (V1 loadProductivityRawData_): the four tabs of one month file, for `dates`. */
export function prodLoadMonth_(ss: SheetBookLike, dates: string[], activities: ProdActivity[]): ProdRawData {
  const want: Record<string, boolean> = {}
  dates.forEach((d) => {
    want[d] = true
  })
  const keep = (o: { date: string | null }) => !!o.date && want[o.date]
  // Maqsam Calls G..L: G=Agent email, H=Call state, I=Call direction, K=Date, L=Handling time (decimal min).
  const maqsamCalls = prodReadCols_(ss, 'Maqsam Calls', 7, 6, 1)
    .map((r) => ({
      agentEmail: String(r[0] || '').trim().toLowerCase(),
      state: r[1],
      direction: r[2],
      date: prodDateKey_(r[4]),
      handlingMin: Number(r[5]) || 0,
    }))
    .filter(keep)
  // FD_AUX A..G: A=Agent name, B=Status name, E=Email, F=minutes, G=Date.
  const fdAux = prodReadCols_(ss, 'FD_AUX', 1, 7, 1)
    .map((r) => ({
      agentName: r[0],
      email: String(r[4] || '').trim().toLowerCase(),
      status: r[1],
      minutes: Number(r[5]) || 0,
      date: prodDateKey_(r[6]),
    }))
    .filter(keep)
  // AUXes Exceptions A..D: A=Agent Mail, B=Date, D=Duration.
  const auxExceptions = prodReadCols_(ss, 'AUXes Exceptions', 1, 4, 1)
    .map((r) => ({
      email: String(r[0] || '').trim().toLowerCase(),
      date: prodDateKey_(r[1]),
      minutes: Number(r[3]) || 0,
    }))
    .filter(keep)
  // Quality A..C: A=Agent Email, B=Call Date, C=Final Score.
  const quality = prodReadCols_(ss, 'Quality', 1, 3, 1)
    .map((r) => ({
      email: String(r[0] || '').trim().toLowerCase(),
      date: prodDateKey_(r[1]),
      score: Number(r[2]) || 0,
    }))
    .filter(keep)
  return { maqsamCalls, fdAux, auxExceptions, quality, ticketActivity: activities }
}

// ---------------------------------------------------------------- the V1 day formula

export interface ProdDayRow {
  [key: string]: unknown
  agentName: unknown
  date: string
  email: string
  inboundAvailMin: number
  inboundTarget: number
  inboundAchieved: number
  inboundMissed: number
  inboundProdPct: number | null
  inboundGap: number | null
  textingAvailMin: number
  textingTarget: number
  textingAchieved: number
  textingProdPct: number | null
  textingGap: number | null
  waAvailMin: number
  waTarget: number
  waAchieved: number
  waProdPct: number | null
  waGap: number | null
  overallProdPct: number | null
  totalAudits: number
  avgScore: number | null
  productiveMinAux: number
  productiveMinResolution: number
  idleMin: number
  computedAt: Date
  layer?: string
}

/**
 * computeProductivityForDate_ — V1's function, verbatim (productivity.js:88-170).
 * No rounding anywhere: the pct fields are raw ratios (1 = 100%).
 */
export function computeProductivityForDate_(
  dateStr: string,
  raw: ProdRawData,
  assumptions: ProdAssumptions,
  now?: number | Date
): ProdDayRow[] {
  const mqTarget = assumptions.mqTarget
  const textTarget = assumptions.textTarget
  const waTarget = assumptions.waTarget

  const calls = raw.maqsamCalls.filter((c) => c.date === dateStr)
  const fdAuxToday = raw.fdAux.filter((f) => f.date === dateStr)
  const exceptionsToday = raw.auxExceptions.filter((x) => x.date === dateStr)
  const ticketsToday = raw.ticketActivity.filter((t) => t.date === dateStr && t.agentEmail)
  const qualityToday = raw.quality.filter((q) => q.date === dateStr)

  const emails = new Set<string>()
  calls.forEach((c) => c.agentEmail && emails.add(c.agentEmail))
  fdAuxToday.forEach((f) => f.email && emails.add(f.email))
  ticketsToday.forEach((t) => emails.add(t.agentEmail))
  qualityToday.forEach((q) => q.email && emails.add(q.email))

  // K3's shared-pool rule: system-wide count of open/pending-CX Internal Escalation
  // tickets, used as a hard cap on every agent's texting target.
  let iePool = 0
  ticketsToday.forEach((t) => {
    if (t.channelGroup !== 'Internal Escalation') return
    if (t.newValue === 'Open') iePool++
    if (t.newValue === 'Pending on CX') iePool++
  })

  const results: ProdDayRow[] = []
  emails.forEach((email) => {
    const myCalls = calls.filter((c) => c.agentEmail === email)
    const inboundAvailMin = myCalls
      .filter((c) => c.direction === 'Inbound')
      .reduce((s, c) => s + c.handlingMin, 0)
    const inboundAchieved = myCalls.filter((c) => c.direction === 'Inbound' && c.state === 'Serviced').length
    const inboundMissed = myCalls.filter((c) => c.direction === 'Inbound' && c.state === 'Abandoned').length
    const inboundTarget = mqTarget > 0 ? inboundAvailMin / mqTarget : 0

    const myFdAux = fdAuxToday.filter((f) => f.email === email)
    const auxMin = (status: unknown) =>
      myFdAux.filter((f) => f.status === status).reduce((s, f) => s + f.minutes, 0)
    const idleMin = Math.min(auxMin('IDLE'), 480)

    const exceptionMin = exceptionsToday
      .filter((x) => x.email === email)
      .reduce((s, x) => s + x.minutes, 0)

    const myTickets = ticketsToday.filter((t) => t.agentEmail === email)
    const textingAchieved = myTickets.filter(
      (t) => (t.channelGroup === 'Chat' || t.channelGroup === 'Internal Escalation') && t.fieldChanged === 'status'
    ).length
    const waAchieved = myTickets.filter(
      (t) => t.channelGroup === 'Waiting Address' && t.fieldChanged === 'status'
    ).length

    // J3: texting avail time, with the literal l_val>5 fallback.
    const rawTextAvail = Math.min(
      Math.max(auxMin('Available') + auxMin('Inbound Calls') + auxMin('Chats') + exceptionMin - inboundAvailMin, 0),
      480 - idleMin
    )
    const textingAvailMin = textingAchieved > 5 && rawTextAvail === 0 ? textingAchieved * 5 : rawTextAvail
    const textingTarget = textTarget > 0 ? Math.min(textingAvailMin / textTarget, iePool) : 0

    // O3: WA avail time, capped [0, 480, waAchieved*4].
    const waAvailMin = Math.min(auxMin('Waiting Address'), 480, waAchieved * 4)
    const waTargetVal = waTarget > 0 ? waAvailMin / waTarget : 0

    const myQuality = qualityToday.filter((q) => q.email === email)
    const totalAudits = myQuality.length
    const avgScore = totalAudits > 0 ? myQuality.reduce((s, q) => s + q.score, 0) / totalAudits : null

    const availSum = inboundAvailMin + textingAvailMin + waAvailMin
    const overallProdPct =
      availSum > 0
        ? (inboundAchieved * mqTarget + textingAchieved * textTarget + waAchieved * waTarget) / availSum
        : null

    const displayName =
      (myFdAux[0] && myFdAux[0].agentName) || (myTickets[0] && myTickets[0].performerName) || email

    results.push({
      agentName: displayName,
      date: dateStr,
      email,
      inboundAvailMin,
      inboundTarget,
      inboundAchieved,
      inboundMissed,
      inboundProdPct: inboundTarget > 0 ? inboundAchieved / inboundTarget : null,
      inboundGap: inboundTarget > 0 ? inboundAchieved - inboundTarget : null,
      textingAvailMin,
      textingTarget,
      textingAchieved,
      textingProdPct: textingTarget > 0 ? textingAchieved / textingTarget : null,
      textingGap: textingTarget > 0 ? textingAchieved - textingTarget : null,
      waAvailMin,
      waTarget: waTargetVal,
      waAchieved,
      waProdPct: waTargetVal > 0 ? waAchieved / waTargetVal : null,
      waGap: waTargetVal > 0 ? waAchieved - waTargetVal : null,
      overallProdPct,
      totalAudits,
      avgScore,
      productiveMinAux: availSum,
      productiveMinResolution: inboundAchieved * mqTarget + textingAchieved * textTarget + waAchieved * waTarget,
      idleMin,
      computedAt: now === undefined ? new Date() : new Date(now),
    })
  })

  return results
}

// ---------------------------------------------------------------- orchestration

/**
 * The seams prodComputeDates_ / prodComputeRange_ touch in legacy Apps Script.
 * openSpreadsheet = openSpreadsheet_; prodRows = prodRows_ (prod_flags reads);
 * upsert/upsertIn = dqUpsert_/dqUpsertIn_ (the caller decides the store).
 */
export interface ProdIo {
  cfg: Cfg
  openSpreadsheet: (id: string) => SheetBookLike
  /** prodRows_ equivalent: stored objects of a prod table (prod_flags). */
  prodRows?: (name: string) => Record<string, unknown>[]
  /** dqRosterPeople_ equivalent: null when unsynced (falls back to month Headcount). */
  roster?: HeadcountRow[] | null
  upsert: (table: string, cols: string[], rows: Record<string, unknown>[], year: number | null) => void
  upsertIn?: (table: string, cols: string[], rows: Record<string, unknown>[], year: number | null) => void
  append?: (table: string, rows: Record<string, unknown>[]) => void
  log?: (msg: string) => void
  /** Freeze for computedAt/prodToday_ (legacy `new Date()`); default real time. */
  now?: number | Date
}

/** prodComputeRange_: computes an inclusive range of yyyy-MM-dd keys. Returns rows written. */
export function prodComputeRange_(startKey: string, endKey: string, io: ProdIo): number {
  const dates: string[] = []
  for (let d = startKey; d <= endKey; d = dqAddDays_(d, 1)) dates.push(d)
  return prodComputeDates_(dates, null, io)
}

/**
 * prodComputeDates_ verbatim: each date computed twice by computeProductivityForDate_ —
 * effective (flags applied via prodAdjustAux_) then raw when the store is ready. Writes:
 * agg_productivity_daily on (date, email) per year; prod_daily_layers on (date, email, layer).
 */
export function prodComputeDates_(dates: string[], activityRows: unknown[][] | null, io: ProdIo): number {
  if (!dates.length) return 0
  const byMonth: Record<string, string[]> = {}
  dates.forEach((d) => {
    ;(byMonth[d.slice(0, 7)] = byMonth[d.slice(0, 7)] || []).push(d)
  })
  const monthFiles: Record<string, SheetBookLike> = {}
  const roster = io.roster === undefined ? null : io.roster // dqRosterPeople_() output
  let allHeadcount = roster || []
  Object.keys(byMonth).forEach((m) => {
    monthFiles[m] = io.openSpreadsheet(prodFileFor_(m, io.cfg))
    if (!roster) allHeadcount = allHeadcount.concat(prodHeadcountRows_(monthFiles[m]))
  })
  const rows =
    activityRows ||
    prodReadCols_(
      io.openSpreadsheet(String(dqSetting_(io.cfg, 'fd_activity_ss_id'))),
      'Activities',
      1,
      10,
      1
    )
  const activities = prodActivitiesFromRows_(
    rows,
    dates,
    prodNameToEmail_(allHeadcount),
    String(dqSetting_(io.cfg, 'activity_local_tz'))
  )
  const layered = prodReady_(io.cfg)
  const flags = layered ? prodFlagsForDates_(dates, (io.prodRows || (() => []))('prod_flags')) : []
  let total = 0
  let clipped = 0
  Object.keys(byMonth).forEach((m) => {
    const ss = monthFiles[m]
    const assumptions = prodAssumptions_(ss)
    const raw = prodLoadMonth_(ss, byMonth[m], activities)
    const adj = prodAdjustAux_(raw.fdAux as never, flags as never)
    clipped += adj.clippedMin
    const eff = {
      maqsamCalls: raw.maqsamCalls,
      fdAux: adj.rows as unknown as ProdRawData['fdAux'],
      auxExceptions: raw.auxExceptions,
      quality: raw.quality,
      ticketActivity: raw.ticketActivity,
    }
    const byYear: Record<string, ProdDayRow[]> = {}
    const layers: ProdDayRow[] = []
    byMonth[m].forEach((date) => {
      computeProductivityForDate_(date, eff, assumptions, io.now).forEach((r) => {
        ;(byYear[date.slice(0, 4)] = byYear[date.slice(0, 4)] || []).push(r)
        layers.push(Object.assign({ layer: 'effective' }, r))
      })
      if (layered)
        computeProductivityForDate_(date, raw, assumptions, io.now).forEach((r) => {
          layers.push(Object.assign({ layer: 'raw' }, r))
        })
    })
    Object.keys(byYear).forEach((y) => {
      io.upsert('agg_productivity_daily', ['date', 'email'], byYear[y], Number(y))
      total += byYear[y].length
    })
    if (layered) io.upsert('prod_daily_layers', ['date', 'email', 'layer'], layers, null)
  })
  if (clipped > 0 && io.log)
    io.log(
      'Productivity layers: ' +
        clipped +
        ' flagged minutes were more than FD_AUX held for that status and were not moved.'
    )
  return total
}

/** dqProductivityRollup_: nightly — yesterday and the day before, in business dates. */
export function dqProductivityRollup_(io: ProdIo, now?: number | Date): number {
  const today = dqDateKey_(now === undefined ? new Date() : new Date(now), io.cfg)
  return prodComputeRange_(dqAddDays_(today, -2), dqAddDays_(today, -1), io)
}

/**
 * runProductivityRange (admin/backfill): recompute an inclusive range. Guard + run log +
 * optional buildAgentAggregates_ are io hooks; the message is verbatim.
 */
export function runProductivityRange(
  startKey: string,
  endKey: string,
  io: ProdIo & {
    requireJobCaller?: () => void
    logRun?: (job: string, startedMs: number, status: string, info: Record<string, unknown>) => void
    buildAgentAggregates?: () => void
    startedMs?: number
  }
): string {
  if (io.requireJobCaller) io.requireJobCaller()
  if (!/^\d{4}-\d\d-\d\d$/.test(String(startKey)) || !/^\d{4}-\d\d-\d\d$/.test(String(endKey)))
    throw new Error('Dates are yyyy-MM-dd.')
  const started = io.startedMs === undefined ? Date.now() : io.startedMs
  const n = prodComputeRange_(String(startKey), String(endKey), io)
  if (io.logRun) io.logRun('productivity_range', started, 'ok', { rowsOut: n, note: startKey + '..' + endKey })
  if (io.buildAgentAggregates) io.buildAgentAggregates()
  return n + ' agent-days written (raw and effective layers).'
}

// ---------------------------------------------------------------- ProductivityApp.js views/rules (pure parts)

/** prodPersonName_: dir.name(e) or ''. */
export function prodPersonName_(dir: { name: (e: string) => string }, e: unknown): string {
  return e ? dir.name(String(e)) : ''
}

/** prodSeenStatuses_: status names in the interval rows over the last 14 days, with counts. */
export function prodSeenStatuses_(intervalRows: { date?: unknown; status?: unknown }[], todayKey: string): { status: unknown; rows: number }[] {
  const from = dqAddDays_(todayKey, -14)
  const seen: Record<string, number> = {}
  intervalRows.forEach((r) => {
    if (String(r.date) >= from) seen[String(r.status)] = (seen[String(r.status)] || 0) + 1
  })
  return Object.keys(seen).sort().map((s) => ({ status: s, rows: seen[s] }))
}

/** prodStatusChoices_: the replacement list + statuses seen (not IDLE / offline). */
export function prodStatusChoices_(
  cfg: Cfg,
  seen: { status: unknown; rows: number }[]
): string[] {
  const list = prodList_(cfg, 'prod_replacement_statuses')
  const skip = prodList_(cfg, 'prod_flag_statuses').concat(prodList_(cfg, 'prod_offline_statuses'))
  seen.forEach((x) => {
    if (!prodIn_(x.status, list) && !prodIn_(x.status, skip)) list.push(String(x.status))
  })
  return list
}

/** prodFlagView_ verbatim: a stored flag -> the page shape. */
export function prodFlagView_(f: Record<string, unknown>, dir: { name: (e: string) => string }): Record<string, unknown> {
  let spans: unknown[] = []
  let ids: unknown[] = []
  let mix: Record<string, unknown> = {}
  try {
    spans = JSON.parse(String(f.spans_json || '[]'))
  } catch {
    spans = []
  }
  try {
    ids = JSON.parse(String(f.case_ids_json || '[]'))
  } catch {
    ids = []
  }
  try {
    mix = JSON.parse(String(f.channel_mix_json || '{}'))
  } catch {
    mix = {}
  }
  return {
    flagId: String(f.flag_id),
    date: String(f.date),
    agentEmail: String(f.agent_email),
    agentName: prodPersonName_(dir, f.agent_email) || String(f.agent_name),
    tlEmail: String(f.tl_email || ''),
    tlName: prodPersonName_(dir, f.tl_email),
    rawStatus: String(f.raw_status),
    intervalStart: String(f.interval_start),
    intervalEnd: String(f.interval_end),
    intervalMin: Number(f.interval_min) || 0,
    flaggedMin: Number(f.flagged_min) || 0,
    spans: spans,
    caseCount: Number(f.case_count) || 0,
    distinctCases: Number(f.distinct_cases) || 0,
    cases: (ids as unknown[][]).map((x) => ({ id: String(x[0]), channel: String(x[1]) })),
    channelMix: mix,
    suggestedStatus: String(f.suggested_status),
    decision: String(f.decision),
    validatedStatus: String(f.validated_status || ''),
    effectiveStatus: prodEffectiveStatus_(f as never) || String(f.raw_status),
    decidedBy: f.decided_by === 'auto' ? 'auto' : prodPersonName_(dir, f.decided_by),
    decidedAt: String(f.decided_at || ''),
    reason: String(f.reason || ''),
    dueDate: String(f.due_date || ''),
  }
}

/** prodScope_: who the caller may see: admin everyone, a TL their team, an agent themselves. */
export function prodScope_(
  user: { role: string; email: string },
  dir: { managerOf: (e: string) => string | null }
): (e: string) => boolean {
  if (user.role === 'admin') return () => true
  if (user.role === 'tl') return (e) => dir.managerOf(e) === user.email
  return (e) => normEmail_(e) === user.email
}

/** prodRuleView_: the rule as the review page shows it. */
export function prodRuleView_(cfg: Cfg): Record<string, unknown> {
  const r = prodRule_(cfg)
  return {
    x: r.x,
    windowMin: r.windowMin,
    minIntervalMin: r.minIntervalMin,
    flagStatuses: r.statuses,
    channelStatus: r.channelStatus,
    reviewDays: Number(prodSetting_(cfg, 'prod_review_days')),
  }
}

/** prodAnalyticsFor_: analytics for the people in `scope` over the 4 weeks ending `week`. */
export function prodAnalyticsFor_(
  cfg: Cfg,
  io: { prodRows: (name: string) => Record<string, unknown>[] },
  dir: { by: Record<string, { name: string; tlEmail?: string | null }>; name: (e: string) => string },
  week: string,
  scope: (e: string) => boolean,
  full: boolean,
  prodAnalytics_: (inp: unknown) => Record<string, unknown>,
  today?: number | Date
): Record<string, unknown> {
  const todayKey = prodToday_(cfg, today)
  const weeks = [dqAddDays_(week, -21), dqAddDays_(week, -14), dqAddDays_(week, -7), week]
  const from = weeks[0]
  const to = dqAddDays_(week, 6)
  const inRange = (d: unknown) => String(d) >= from && String(d) <= to
  const intervals = io
    .prodRows('prod_intervals')
    .filter((r) => inRange(r.date) && scope(String(r.agent_email)))
    .map(prodIntervalOf_)
  const flags = io.prodRows('prod_flags').filter((f) => inRange(f.date) && scope(String(f.agent_email)))
  const layers = io.prodRows('prod_daily_layers').filter((r) => inRange(r.date) && scope(String(r.email)))
  const people: Record<string, { name: string; tlEmail: string }> = {}
  Object.keys(dir.by).forEach((e) => {
    people[e] = { name: dir.by[e].name, tlEmail: dir.by[e].tlEmail || '' }
  })
  const tz = String(dqSetting_(cfg, 'business_tz'))
  const out = prodAnalytics_({
    intervals,
    flags,
    layers,
    hist: full ? io.prodRows('prod_window_hist') : [],
    people,
    tlName: (e: string) => dir.name(e),
    week,
    weeks,
    todayKey,
    flagStatuses: prodList_(cfg, 'prod_flag_statuses'),
    offlineStatuses: prodList_(cfg, 'prod_offline_statuses'),
    channelStatus: prodSetting_(cfg, 'prod_channel_status'),
    offsetMs: (ms: number) => dqTzOffsetMin_(new Date(ms), tz) * 60000,
    full,
  })
  out.week = week
  out.weeks = weeks
  return out
}

// ---------------------------------------------------------------- flag orchestration (store seams)

/**
 * prodDetectDates_ verbatim: detection over stored intervals + activities. Store reads via
 * io.prodRows; writes via io.upsertIn (prod_flags), io.upsert (prod_window_hist) and
 * io.append (prod_flag_log). Lock/viewAs guards are the caller's concern.
 */
export function prodDetectDates_(
  dates: string[],
  activityRows: unknown[][],
  io: ProdIo & {
    prodRows: (name: string) => Record<string, unknown>[]
    dir: { managerOf: (e: string) => string | null }
    newId?: (prefix: string) => string
    today?: number | Date
    nowMs?: number
    headcount?: HeadcountRow[]
  }
): { flagged: number; added: number; voided: number; cases?: number; intervals?: number } {
  if (!prodReady_(io.cfg) || !dates.length) return { flagged: 0, added: 0, voided: 0 }
  const want: Record<string, boolean> = {}
  dates.forEach((d) => {
    want[d] = true
  })
  const intervals = io
    .prodRows('prod_intervals')
    .filter((r) => want[String(r.date)])
    .map(prodIntervalOf_)
  const people = io.headcount || []
  const cases = prodCasesFromActivityRows_(
    activityRows,
    dates,
    prodNameToEmail_(people),
    String(dqSetting_(io.cfg, 'activity_local_tz')),
    prodGroups_(io.cfg)
  )
  const byEmail = prodCasesByEmail_(cases)
  const rule = prodRule_(io.cfg)
  const found = prodDetectFlags_(intervals, byEmail, rule)
  const dir = io.dir
  const today = prodToday_(io.cfg, io.today)
  const now = prodNowIso_(io.nowMs)
  const autoAccept = prodSetting_(io.cfg, 'prod_flag_auto_accept')
  const existing: Record<string, Record<string, unknown>> = {}
  io.prodRows('prod_flags').forEach((f) => {
    existing[String(f.flag_id)] = f
  })
  const up: Record<string, unknown>[] = []
  const log: Record<string, unknown>[] = []
  const seen: Record<string, boolean> = {}
  found.forEach((f) => {
    seen[String(f.flag_id)] = true
    const old = existing[String(f.flag_id)]
    if (old && old.decision !== 'pending' && old.decision !== 'void') return
    const row = Object.assign({}, old || {}, f, { updated_at: now })
    if (!old || old.decision === 'void') {
      if (autoAccept) {
        const confidenceThreshold = prodSetting_(io.cfg, 'prod_confidence_auto_threshold')
        const confidence = prodConfidenceScore_(f, null, null, null)
        row.confidence_score = confidence.score
        row.confidence_level = confidence.level
        row.confidence_factors_json = JSON.stringify(confidence.factors)
        if (confidence.score >= Number(confidenceThreshold)) {
          row.decision = 'auto'
          row.validated_status = f.suggested_status
          row.decided_by = 'auto'
          row.decided_at = now
          row.reason = 'Auto-accepted (confidence: ' + confidence.score + ')'
          row.review_open_ms = ''
          row.created_at = now
          log.push({
            flagId: f.flag_id,
            action: 'auto-accepted',
            from: f.raw_status,
            to: f.suggested_status,
            by: 'auto',
            reason: 'Auto-accepted (confidence: ' + confidence.score + ')',
          })
        } else {
          row.decision = 'pending'
          row.validated_status = ''
          row.decided_by = ''
          row.decided_at = ''
          row.reason = 'Low confidence (' + confidence.score + ') - requires review'
          row.review_open_ms = ''
          row.created_at = now
          row.due_date = prodDueDate_(today, prodSetting_(io.cfg, 'prod_review_days'))
          row.tl_email = dir.managerOf(String(f.agent_email)) || ''
          log.push({
            flagId: f.flag_id,
            action: 'detected',
            from: f.raw_status,
            to: f.suggested_status,
            by: 'system',
            reason: 'Low confidence: ' + confidence.score,
          })
        }
      } else {
        row.decision = 'pending'
        row.validated_status = ''
        row.decided_by = ''
        row.decided_at = ''
        row.reason = ''
        row.review_open_ms = ''
        row.created_at = now
        row.due_date = prodDueDate_(today, prodSetting_(io.cfg, 'prod_review_days'))
        row.tl_email = dir.managerOf(String(f.agent_email)) || ''
        log.push({ flagId: f.flag_id, action: 'detected', from: f.raw_status, to: f.suggested_status, by: 'system' })
      }
    }
    up.push(row)
  })
  Object.keys(existing).forEach((id) => {
    const f = existing[id]
    if (!want[String(f.date)] || seen[id] || f.decision !== 'pending') return
    up.push(Object.assign({}, f, { decision: 'void', updated_at: now }))
    log.push({
      flagId: id,
      action: 'void',
      from: f.raw_status,
      to: '',
      by: 'system',
      reason: 'No longer detected (data or rule changed).',
    })
  })
  if (io.upsertIn) io.upsertIn('prod_flags', ['flag_id'], up, null)
  else io.upsert('prod_flags', ['flag_id'], up, null)
  if (io.append && log.length)
    io.append(
      'prod_flag_log',
      log.map((r) => ({
        log_id: io.newId ? io.newId('pfl') : 'pfl',
        flag_id: r.flagId,
        action: r.action,
        from_status: r.from || '',
        to_status: r.to || '',
        by: r.by,
        at: now,
        reason: r.reason || '',
      }))
    )
  io.upsert(
    'prod_window_hist',
    ['date', 'class'],
    dates.reduce((rows2: Record<string, unknown>[], d) => {
      const perDate = prodWindowHist_(
        intervals.filter((iv) => iv.date === d),
        byEmail,
        rule.windowMin,
        { idle: rule.statuses, working: prodList_(io.cfg, 'prod_working_statuses') }
      )
      ;['idle', 'working'].forEach((cls) => {
        const n = Object.keys(perDate[cls as 'idle' | 'working']).reduce(
          (s, k) => s + perDate[cls as 'idle' | 'working'][Number(k)],
          0
        )
        rows2.push({ date: d, class: cls, windows: n, counts_json: JSON.stringify(perDate[cls as 'idle' | 'working']), computed_at: now })
      })
      return rows2
    }, []),
    null
  )
  const added = log.filter((l) => l.action === 'detected' || l.action === 'auto-accepted').length
  return { flagged: found.length, added, voided: log.length - added, cases: cases.length, intervals: intervals.length }
}

/** prodAutoAccept_: pending flags past due take the suggested status, decided by 'auto'. */
export function prodAutoAccept_(
  io: ProdIo & {
    prodRows: (name: string) => Record<string, unknown>[]
    newId?: (prefix: string) => string
    today?: number | Date
    nowMs?: number
    /** prodMarkDirty_ seam: marks recomputation-needed dates (PROD_DIRTY_PROP). */
    markDirty?: (dates: string[]) => void
  }
): { skipped?: string; rowsOut?: number; note?: string } {
  if (!prodReady_(io.cfg)) return { skipped: 'CC2 Productivity is not set up' }
  const today = prodToday_(io.cfg, io.today)
  const now = prodNowIso_(io.nowMs)
  const due = io.prodRows('prod_flags').filter((f) => prodIsAutoDue_(f as never, today))
  const rows = due.map((f) =>
    Object.assign({}, f, {
      decision: 'auto',
      validated_status: f.suggested_status,
      decided_by: 'auto',
      decided_at: now,
      updated_at: now,
    })
  )
  if (io.upsertIn) io.upsertIn('prod_flags', ['flag_id'], rows, null)
  else io.upsert('prod_flags', ['flag_id'], rows, null)
  if (io.append && rows.length)
    io.append(
      'prod_flag_log',
      due.map((f) => ({
        log_id: io.newId ? io.newId('pfl') : 'pfl',
        flag_id: f.flag_id,
        action: 'auto',
        from_status: f.raw_status,
        to_status: f.suggested_status,
        by: 'auto',
        at: now,
        reason: 'Not reviewed by ' + f.due_date + '.',
      }))
    )
  if (rows.length && io.markDirty) io.markDirty(due.map((f) => String(f.date)))
  return { rowsOut: rows.length, note: rows.length + ' flags auto-accepted' }
}
