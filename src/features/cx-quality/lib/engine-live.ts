/**
 * engine-live.ts — the Postgres port of QaEngine.js's data-touching build path.
 *
 * Legacy sources and their Supabase stand-ins:
 *   'Users List'              -> roster (+ directory) — fd_id/fd_name/name/email
 *   'New Tickets Daily'       -> fd_activities mirror rows (cols jsonb, 10 cols)
 *   'Freshdesk Current State' -> tickets snapshot (subject/orderId absent: '')
 *   'Queue Log'               -> qe_queue_log (qeLogField_-mapped columns)
 *   'Candidates'              -> qe_candidates (queued_date, agent, candidates)
 *   'Build Outcomes'          -> qe_outcomes (queued_date, ran_at, mode, outcomes)
 *   'Builds'                  -> qe_builds
 *   'Catalogue'               -> qe_catalogue (kind, value, times_seen, last_seen)
 *   Freshdesk API fallback    -> BLOCKED (no FD credentials); stub returns a note.
 *
 * Pure pieces (qeMakeRng_, qeSelectForAgent_, qePartitionLog_ order rules...) are
 * transcribed verbatim from QaEngine.js so the same day rebuilds the same queue.
 */
import { db, readRows, sanitizeInput } from '@/features/shared/platform/repo'
import { getConfig, setConfig } from '@/features/shared/platform/settings'
import { described } from '@/features/shared/lib/errors'
import {
  QE_LOG_COL,
  QE_LOG_HEADERS,
  QE_OUTCOME_MAX_CHARS,
  QE_CANDIDATES_PER_AGENT,
  qeLocal_,
  qeWall_,
  qeFmt_,
  qeAsDateText_,
  qeRetentionWindow_,
  qeParseTouchDate_,
  qeGroupToChannel_,
  qeTierOf_,
  qeMakeRng_,
  qeShuffle_,
  qeStatusKey_,
  qeStatusName_,
  qeSelectForAgent_,
  qeQuotaFor_,
  qeWeekKeyFor_,
  qeSettingsFrom_,
} from './engine'

type Row = Record<string, unknown>

const QE_TBL_LOG = 'qe_queue_log'
const QE_TBL_CANDIDATES = 'qe_candidates'
const QE_TBL_OUTCOMES = 'qe_outcomes'
const QE_TBL_BUILDS = 'qe_builds'
const QE_TBL_CATALOGUE = 'qe_catalogue'
const QE_MIG_DONE_KEY = 'qe_migration_done'
const QE_MAX_TOUCH_ROWS = 60000

function qeLogField_(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

async function qeSettings_(): Promise<Row> {
  return qeSettingsFrom_(await getConfig('qa_engine_settings', {})) as Row
}

// =====================================================================
// Source reads: roster / touches / ticket detail
// =====================================================================

/** qeIsRealAgentName_ verbatim. */
function qeIsRealAgentName_(name: unknown): boolean {
  if (!name) return false
  const n = String(name).trim()
  if (!n) return false
  if (n === 'Unassigned' || n === 'System' || n === '-') return false
  if (n.indexOf('Unknown Agent') === 0) return false
  if (n.indexOf('(Customer)') >= 0) return false
  return true
}

/** qeResolvePerformer_ verbatim. */
function qeResolvePerformer_(raw: unknown, roster: { byId: Record<string, Row>; byName: Record<string, Row> }): string | null {
  const s = String(raw || '').trim()
  if (!s) return null
  if (!qeIsRealAgentName_(s)) return null
  const m = s.match(/^User\s+(\d+)$/i)
  const id = m ? m[1] : /^\d{6,}$/.test(s) ? s : null
  if (id) {
    const rec = roster.byId[id]
    if (!rec || rec.excluded) return null
    return String(rec.name)
  }
  const byName = roster.byName[s]
  if (byName) return byName.excluded ? null : String(byName.name)
  return null
}

/** qeIsCreationActivity_ verbatim. */
function qeIsCreationActivity_(activityType: unknown, fieldChanged: unknown): boolean {
  const s = (String(activityType || '') + ' ' + String(fieldChanged || '')).toLowerCase()
  return /creat|new ticket|opened/.test(s)
}

/** qeResolveOpener_ verbatim. */
function qeResolveOpener_(rec: Row | undefined, createdAt: Date | null, since: Date | null): string | null {
  if (!rec) return null
  if (rec.createAgent) return String(rec.createAgent)
  if (rec.firstAgent && createdAt && since && createdAt >= since) return String(rec.firstAgent)
  return null
}

/**
 * qeReadAgentRoster_ verbatim: Users List -> { byId, byName }. The Postgres
 * stand-in is `roster` (fd_id = Freshdesk user id, fd_name = display name,
 * falling back to name when the Freshdesk name column is empty).
 */
async function qeReadAgentRoster_(S: Row): Promise<{ byId: Record<string, Row>; byName: Record<string, Row>; count: number; excluded: number; tabName: string }> {
  const rows = (await readRows('roster').catch(() => [] as Row[])) as Row[]
  const byId: Record<string, Row> = {}
  const byName: Record<string, Row> = {}
  let n = 0
  let excludedCount = 0
  rows.forEach((r) => {
    const name = String(r.fd_name || r.name || '').trim()
    if (!name) return
    const id = String(r.fd_id || r.freshdesk_id || '').trim()
    const email = String(r.email || '').trim().toLowerCase()
    let excluded = false
    ;((S.excludeEmailDomains as string[]) || []).forEach((d) => {
      if (email.indexOf('@' + d) >= 0) excluded = true
    })
    if (((S.excludeAgents as string[]) || []).indexOf(name) >= 0) excluded = true
    const rec = { id, name, email, excluded }
    if (id) byId[id] = rec
    byName[name] = rec
    n++
    if (excluded) excludedCount++
  })
  return { byId, byName, count: n, excluded: excludedCount, tabName: 'roster' }
}

/** One fd_activities cols array/object -> the named cells the engine reads. */
function qeTouchCells_(cols: unknown): { at: unknown; tid: unknown; name: unknown; type: unknown; act: unknown; fld: unknown; newV: unknown } {
  if (Array.isArray(cols)) {
    // 'Activities' mirror layout: 0 Performed At, 1 Ticket ID, 2 Performer Name,
    // 3 Performer Type, 4 Activity Type, 5 Field Changed, 6 New Value, 7 Old Value, 8 Group.
    return { at: cols[0], tid: cols[1], name: cols[2], type: cols[3], act: cols[4], fld: cols[5], newV: cols[6] }
  }
  const o = (cols || {}) as Row
  const pick = (...names: string[]) => {
    for (const n of names) {
      if (o[n] !== undefined && o[n] !== null && String(o[n]) !== '') return o[n]
    }
    const low: Record<string, unknown> = {}
    Object.keys(o).forEach((k) => {
      low[k.toLowerCase()] = o[k]
    })
    for (const n of names) {
      if (low[n.toLowerCase()] !== undefined) return low[n.toLowerCase()]
    }
    return ''
  }
  return {
    at: pick('Performed At'), tid: pick('Ticket ID'), name: pick('Performer Name'),
    type: pick('Performer Type'), act: pick('Activity Type'), fld: pick('Field Changed'), newV: pick('New Value'),
  }
}

/**
 * qeReadTouches_ verbatim: distinct {ticketId, agent} pairs touched in
 * [since, until), plus openers. Reads the fd_activities mirror (ts_ms window),
 * newest first, capped at QE_MAX_TOUCH_ROWS — the chunked bottom-up scan of the
 * legacy, without the sheet.
 */
async function qeReadTouches_(since: Date, until: Date, roster: { byId: Record<string, Row>; byName: Record<string, Row> }): Promise<Row> {
  const { data, error } = await db()
    .from('fd_activities')
    .select('cols')
    .gte('ts_ms', since.getTime())
    .lt('ts_ms', until.getTime())
    .order('ts_ms', { ascending: false })
    .limit(QE_MAX_TOUCH_ROWS)
  if (error) throw described(error, { table: 'fd_activities' })
  const map: Record<string, Row> = {}
  const openers: Record<string, Row> = {}
  const seenActivity: Record<string, number> = {}
  const perDay: Record<string, number> = {}
  let scanned = 0
  let inWindow = 0
  let skippedName = 0
  let unresolved = 0
  let newest: Date | null = null
  const unresolvedSamples: Record<string, number> = {}
  ;((data || []) as { cols: unknown }[]).forEach((r) => {
    const c = qeTouchCells_(r.cols)
    const tid = c.tid
    if (!tid) return
    scanned++
    const when = qeParseTouchDate_(c.at)
    if (!when) return
    if (newest === null || when > newest) newest = when
    if (when < since || when >= until) return
    const pt = String(c.type || '').trim().toLowerCase()
    if (pt === 'contact' || pt === 'customer' || pt === 'requester') {
      skippedName++
      return
    }
    const rawName = String(c.name || '').trim()
    const name = qeResolvePerformer_(rawName, roster)
    if (!name) {
      skippedName++
      unresolved++
      if (rawName && Object.keys(unresolvedSamples).length < 8) unresolvedSamples[rawName] = (unresolvedSamples[rawName] || 0) + 1
      return
    }
    inWindow++
    const dayKey = qeFmt_(when, 'yyyy-MM-dd')
    perDay[dayKey] = (perDay[dayKey] || 0) + 1
    const ticketId = String(tid).trim()
    const act = String(c.act || '').trim()
    if (act) seenActivity[act] = (seenActivity[act] || 0) + 1
    if (!openers[ticketId]) openers[ticketId] = { firstAgent: null, firstAt: null, createAgent: null, createAt: null }
    const op = openers[ticketId]
    if (op.firstAt === null || when <= (op.firstAt as Date)) {
      op.firstAt = when
      op.firstAgent = name
    }
    if (qeIsCreationActivity_(act, c.fld)) {
      if (!op.createAt || when <= (op.createAt as Date)) {
        op.createAt = when
        op.createAgent = name
      }
    }
    const key = ticketId + '|' + name
    if (!map[key]) map[key] = { ticketId, agent: name, touches: 0, lastTouch: when, firstTouch: when, lastStatus: '', statusAt: null, days: {}, statusLog: [] }
    const rec = map[key]
    rec.touches = (rec.touches as number) + 1
    ;(rec.days as Record<string, boolean>)[dayKey] = true
    if (when > (rec.lastTouch as Date)) rec.lastTouch = when
    if (when < (rec.firstTouch as Date)) rec.firstTouch = when
    const fld = String(c.fld || '')
    const isStatusRow = /status/i.test(fld) || (!/new_ticket/i.test(fld) && /status/i.test(act))
    if (isStatusRow) {
      const stName = qeStatusName_(c.newV)
      ;(rec.statusLog as { at: Date; status: string }[]).push({ at: when, status: stName })
      if (rec.statusAt === null || when >= (rec.statusAt as Date)) {
        rec.statusAt = when
        rec.lastStatus = stName
      }
    }
  })
  const pairs: Row[] = []
  for (const k in map) pairs.push(map[k])
  return { pairs, openers, seenActivity, perDay, scanned, inWindow, skippedName, unresolved, unresolvedSamples, newest, tabName: 'fd_activities' }
}

/** qeFdFillMissingDetail_ — BLOCKED: the Freshdesk API creds (QQ_FD_*) are not
 * ported. Returns the no-op fallback the build tolerates (empty index, note). */
async function qeFdFillMissingDetail_(_neededIds: Record<string, boolean>, _index: Record<string, Row>): Promise<{ filled: number; note: string }> {
  void _neededIds
  void _index
  return { filled: 0, note: '' }
}

/**
 * qeReadTicketDetail_ verbatim: detail for the needed ticket ids. Postgres
 * stand-in is the `tickets` snapshot. It has no subject/order_id columns, so
 * those cells are '' (the FD API fallback that filled them is BLOCKED).
 */
async function qeReadTicketDetail_(neededIds: Record<string, boolean>, sinceHint: Date): Promise<{ index: Record<string, Row>; rowsScanned: number; tabName: string; fallback: Row }> {
  const want = Object.keys(neededIds)
  const idx: Record<string, Row> = {}
  let scanned = 0
  for (let i = 0; i < want.length; i += 200) {
    const { data, error } = await db()
      .from('tickets')
      .select('ticket_id,group_name,contact_type_1,contact_type_2,contact_type_3,status,country,channel,source,created_at')
      .in('ticket_id', want.slice(i, i + 200))
    if (error) throw described(error, { table: 'tickets' })
    scanned += (data || []).length
    ;(data || []).forEach((r) => {
      idx[String(r.ticket_id)] = {
        groupName: String(r.group_name || ''), l1: String(r.contact_type_1 || ''), l2: String(r.contact_type_2 || ''),
        l3: String(r.contact_type_3 || ''), subject: '', status: String(r.status || ''), country: String(r.country || ''),
        orderId: '', sheetChannel: String(r.channel || ''), source: String(r.source || ''),
        createdAt: r.created_at ? String(r.created_at) : '',
      }
    })
  }
  const fallback = await qeFdFillMissingDetail_(neededIds, idx)
  void sinceHint
  return { index: idx, rowsScanned: scanned, tabName: 'tickets', fallback: fallback as unknown as Row }
}

// =====================================================================
// Selection (old Engine.js, pure)
// =====================================================================

/** qeSourceLagNote_ verbatim. */
function qeSourceLagNote_(touch: Row, since: Date, until: Date): string {
  const newest = touch.newest ? qeFmt_(touch.newest as Date, 'yyyy-MM-dd HH:mm') : '(none)'
  const days: string[] = []
  for (let t = since.getTime(); t < until.getTime(); t += 86400000) {
    const key = qeFmt_(new Date(t), 'yyyy-MM-dd')
    days.push(key + ': ' + (((touch.perDay as Record<string, number>) || {})[key] || 0))
  }
  return 'Newest activity in the source is ' + newest + '. Window coverage: ' + days.join(', ') +
    '. The source is refreshed by another process and normally lags a day, so an empty window usually means it has not run yet.'
}

/** qeChooseWindow_ verbatim: slides the window back to where detail has coverage. */
function qeChooseWindow_(pairs: Row[], detail: { index: Record<string, Row> }, since: Date, until: Date, maxShift: number): { shift: number; since: Date; until: Date; usable: number; best?: number } {
  const span = until.getTime() - since.getTime()
  let best: { shift: number; since: Date; until: Date; usable: number } | null = null
  for (let shift = 0; shift <= maxShift; shift++) {
    const s2 = new Date(since.getTime() - shift * 86400000)
    const u2 = new Date(s2.getTime() + span)
    let usable = 0
    for (let i = 0; i < pairs.length; i++) {
      const t = pairs[i].lastTouch as Date
      if (t < s2 || t >= u2) continue
      if (detail.index[String(pairs[i].ticketId)]) usable++
    }
    if (!best || usable > best.usable) best = { shift, since: s2, until: u2, usable }
  }
  const b = best as { shift: number; since: Date; until: Date; usable: number }
  for (let sh = 0; sh <= maxShift; sh++) {
    const s3 = new Date(since.getTime() - sh * 86400000)
    const u3 = new Date(s3.getTime() + span)
    let n = 0
    for (let j = 0; j < pairs.length; j++) {
      const t3 = pairs[j].lastTouch as Date
      if (t3 < s3 || t3 >= u3) continue
      if (detail.index[String(pairs[j].ticketId)]) n++
    }
    if (n >= b.usable * 0.5 && n > 0) return { shift: sh, since: s3, until: u3, usable: n, best: b.usable }
  }
  return b
}

/** qeStatusLogText_ verbatim: agent status changes on one ticket, deduplicated. */
function qeStatusLogText_(log: { at: Date; status: string }[]): string {
  const seen: Record<string, boolean> = {}
  const out: string[] = []
  ;(log || [])
    .slice()
    .sort((a, b) => (a.at as unknown as number) - (b.at as unknown as number))
    .forEach((e) => {
      const t = qeFmt_(e.at, 'yyyy-MM-dd HH:mm') + ' ' + e.status
      if (!seen[t]) {
        seen[t] = true
        out.push(t)
      }
    })
  return out.slice(-8).join('; ')
}

/** qeBuildPool_ verbatim: joins touches with ticket detail into the eligible pool. */
async function qeBuildPool_(S: Row, since: Date, until: Date): Promise<Row> {
  const roster = await qeReadAgentRoster_(S)
  const maxShift = Math.max(0, Number(S.maxWindowShiftDays) || 0)
  const readSince = new Date(since.getTime() - maxShift * 86400000)
  const touch = (await qeReadTouches_(readSince, until, roster)) as Row
  if (!(touch.pairs as Row[]).length) {
    throw new Error('No agent touches found in the ' + S.lookbackDays + '-day window. ' + qeSourceLagNote_(touch, since, until) +
      ' Scanned ' + touch.scanned + ' rows of "' + touch.tabName + '", ' + touch.unresolved + ' performers unresolved, roster ' + roster.count + ' users.')
  }
  const needed: Record<string, boolean> = {}
  ;(touch.pairs as Row[]).forEach((p) => {
    needed[String(p.ticketId)] = true
  })
  const detail = await qeReadTicketDetail_(needed, readSince)
  if (!Object.keys(detail.index).length) {
    throw new Error('None of the ' + Object.keys(needed).length + ' touched tickets were found in "' + detail.tabName + '". ' +
      qeSourceLagNote_(touch, since, until))
  }
  const win = qeChooseWindow_(touch.pairs as Row[], detail, since, until, maxShift)
  since = win.since
  until = win.until
  const allPairs = touch.pairs as Row[]
  touch.pairs = allPairs.filter((p) => (p.lastTouch as Date) >= since && (p.lastTouch as Date) < until)

  const g2c = qeGroupToChannel_(S)
  const excludedStatus: Record<string, boolean> = {}
  const excludedAgentStatus: Record<string, boolean> = {}
  ;((S.excludeStatuses as string[]) || []).forEach((s) => {
    excludedStatus[qeStatusKey_(s)] = true
  })
  ;((S.excludeAgentStatuses as string[]) || []).forEach((s) => {
    excludedAgentStatus[qeStatusKey_(s)] = true
  })
  const openerOnly: Record<string, boolean> = {}
  ;((S.openerOnlyChannels as string[]) || []).forEach((c) => {
    openerOnly[c] = true
  })

  const pool: Row[] = []
  let missingDetail = 0
  let offChannel = 0
  let statusExcluded = 0
  let notOpener = 0
  let noOpenerKnown = 0
  const unmappedGroups: Record<string, number> = {}
  const seenL2: Record<string, number> = {}
  const seenL3: Record<string, number> = {}
  const seenStatus: Record<string, number> = {}
  const seenAgentStatus: Record<string, number> = {}
  const seenType: Record<string, number> = {}
  const dropByAgent: Record<string, Record<string, number>> = {}
  const excludedBy: Record<string, number> = {}
  function drop(p: Row, why: string) {
    const d = (dropByAgent[String(p.agent)] = dropByAgent[String(p.agent)] || {})
    d[why] = (d[why] || 0) + 1
  }
  const sinceKey = qeFmt_(since, 'yyyy-MM-dd')
  const lastKey = qeFmt_(new Date(until.getTime() - 1), 'yyyy-MM-dd')
  ;(touch.pairs as Row[]).forEach((p) => {
    const info = detail.index[String(p.ticketId)]
    if (!info) {
      missingDetail++
      drop(p, 'no ticket detail')
      return
    }
    if (info.l2) seenL2[String(info.l2)] = (seenL2[String(info.l2)] || 0) + 1
    if (info.l3) seenL3[String(info.l3)] = (seenL3[String(info.l3)] || 0) + 1
    const channel = g2c[String(info.groupName).toLowerCase()]
    if (!channel) {
      offChannel++
      drop(p, 'group not mapped to a channel')
      const g = String(info.groupName || '(blank)')
      unmappedGroups[g] = (unmappedGroups[g] || 0) + 1
      return
    }
    const status = String(info.status || p.lastStatus || '')
    if (status) seenStatus[status] = (seenStatus[status] || 0) + 1
    if (p.lastStatus) seenAgentStatus[String(p.lastStatus)] = (seenAgentStatus[String(p.lastStatus)] || 0) + 1
    const exWhy = excludedStatus[qeStatusKey_(status)]
      ? 'ticket now: ' + status
      : p.lastStatus && excludedAgentStatus[qeStatusKey_(p.lastStatus)]
        ? 'agent set: ' + String(p.lastStatus)
        : ''
    if (exWhy) {
      statusExcluded++
      excludedBy[exWhy] = (excludedBy[exWhy] || 0) + 1
      drop(p, exWhy)
      return
    }
    if (openerOnly[channel]) {
      const opener = qeResolveOpener_((touch.openers as Record<string, Row>)[String(p.ticketId)], qeParseTouchDate_(info.createdAt), since)
      if (!opener) {
        noOpenerKnown++
        drop(p, 'no identifiable opener')
        return
      }
      if (opener !== p.agent) {
        notOpener++
        drop(p, 'not the opener')
        return
      }
    }
    const contactType = String(info.l3 || info.l2 || info.l1 || '(not set)')
    seenType[contactType] = (seenType[contactType] || 0) + 1
    const inDays = Object.keys((p.days as Record<string, boolean>) || {})
      .filter((k) => k >= sinceKey && k <= lastKey)
      .sort()
    pool.push({
      ticketId: p.ticketId, agent: p.agent, channel, group: info.groupName,
      contactType,
      tier: qeTierOf_(String(info.l2 || ''), String(info.l3 || ''), S),
      country: info.country, orderId: info.orderId, sheetChannel: info.sheetChannel, source: info.source,
      subject: info.subject, status, agentStatus: p.lastStatus || '', touches: p.touches, lastTouch: p.lastTouch,
      interactionAt: p.firstTouch || p.lastTouch,
      actionAt: p.statusAt || p.lastTouch,
      statusLog: qeStatusLogText_(p.statusLog as { at: Date; status: string }[]),
      day: inDays[0] || qeFmt_(p.lastTouch as Date, 'yyyy-MM-dd'),
    })
  })
  return { pool, touch, detail, roster, window: win, since, until,
    missingDetail, offChannel, statusExcluded, notOpener, noOpenerKnown, seenActivity: touch.seenActivity || {},
    unmappedGroups, seenL2, seenL3, seenStatus, seenAgentStatus, seenType, dropByAgent, excludedBy }
}

/** qePoolFunnelNote_ verbatim. */
function qePoolFunnelNote_(built: Row): string {
  const pairs = built.touch && (built.touch as Row).pairs ? ((built.touch as Row).pairs as Row[]).length : 0
  return 'Of ' + pairs + ' ticket+agent pairs in the window: ' + built.missingDetail + ' had no row in the ticket-detail tab, ' +
    built.offChannel + ' were in a group mapped to no audit channel, ' + (Number(built.statusExcluded) || 0) + ' were excluded by status, ' +
    (Number(built.notOpener) || 0) + ' were not the agent who opened the ticket, ' + (Number(built.noOpenerKnown) || 0) +
    ' had no identifiable opener, leaving ' + (built.pool as Row[]).length + ' in the pool.'
}

// =====================================================================
// Log rows <-> qe_queue_log
// =====================================================================

/** qeLogRow_ verbatim: one Queue Log row for a drawn pool record. */
function qeLogRow_(rec: Row, agent: string, dateStr: string, weekKey: string, slot: unknown, who: Row | null): unknown[] {
  const row: unknown[] = []
  row[QE_LOG_COL['Key']] = String(rec.ticketId) + '|' + agent
  row[QE_LOG_COL['Queued Date']] = dateStr
  row[QE_LOG_COL['ISO Week']] = weekKey
  row[QE_LOG_COL['Slot']] = slot
  row[QE_LOG_COL['Agent']] = agent
  row[QE_LOG_COL['Channel']] = rec.channel
  row[QE_LOG_COL['Group']] = rec.group
  row[QE_LOG_COL['Contact Type']] = rec.contactType
  row[QE_LOG_COL['Tier']] = rec.tier
  row[QE_LOG_COL['Ticket ID']] = Number(rec.ticketId)
  row[QE_LOG_COL['Subject']] = rec.subject
  row[QE_LOG_COL['Country']] = rec.country
  row[QE_LOG_COL['Status']] = rec.status
  row[QE_LOG_COL['Last Touch']] = qeFmt_(rec.lastTouch as Date, 'yyyy-MM-dd HH:mm')
  row[QE_LOG_COL['Touches']] = rec.touches
  row[QE_LOG_COL['State']] = 'pending'
  row[QE_LOG_COL['Audited At']] = ''
  row[QE_LOG_COL['Audited By']] = ''
  row[QE_LOG_COL['Interaction']] = rec.interactionAt ? qeFmt_(rec.interactionAt as Date, 'yyyy-MM-dd HH:mm') : ''
  row[QE_LOG_COL['Agent Status']] = rec.agentStatus || ''
  row[QE_LOG_COL['Passed To']] = ''
  row[QE_LOG_COL['Action Time']] = rec.actionAt ? qeFmt_(rec.actionAt as Date, 'yyyy-MM-dd HH:mm') : ''
  row[QE_LOG_COL['Agent Status Log']] = rec.statusLog || ''
  row[QE_LOG_COL['Pass Reason']] = ''
  row[QE_LOG_COL['Agent Email']] = (who && who.email) || ''
  row[QE_LOG_COL['Agent FD ID']] = who && who.id ? String(who.id) : ''
  return row
}

/** Values row -> qe_queue_log record. */
function qeValuesToRecord_(r: unknown[]): Row {
  const o: Row = {}
  QE_LOG_HEADERS.forEach((h, i) => {
    o[qeLogField_(h)] = r[i] === undefined || r[i] === null ? '' : r[i]
  })
  return o
}

/** qe_queue_log record -> values row in QE_LOG_HEADERS order. */
function qeRecordToValues_(o: Row): unknown[] {
  return QE_LOG_HEADERS.map((h) => {
    const v = o[qeLogField_(h)]
    return v === undefined || v === null ? '' : v
  })
}

/** qeReadLog_ verbatim: the whole log (the no-repeat rule needs all of it). */
async function qeReadLog_(): Promise<unknown[][]> {
  const rows = (await readRows(QE_TBL_LOG, { orderBy: 'id', ascending: true, limit: 200000 } as never).catch(() => [] as Row[])) as Row[]
  return rows.map((r) => qeRecordToValues_(r))
}

/** qeWriteLogAll_ verbatim: replace the log with these rows. */
async function qeWriteLogAll_(rows: unknown[][]): Promise<number> {
  // The sheet rewrite is delete-all + bulk insert; Postgres keeps the same
  // semantics (a build regenerates today's pending rows, keeps the rest).
  const { error: de } = await db().from(QE_TBL_LOG).delete().neq('key', '__never__')
  if (de) throw described(de, { table: QE_TBL_LOG })
  const recs = rows.map((r) => sanitizeInput(qeValuesToRecord_(r)) as Row)
  for (let i = 0; i < recs.length; i += 500) {
    const { error } = await db().from(QE_TBL_LOG).insert(recs.slice(i, i + 500))
    if (error) throw described(error, { table: QE_TBL_LOG })
  }
  return recs.length
}

/** qeCandToArr_ verbatim: pool record -> compact JSON array for Candidates. */
function qeCandToArr_(r: Row): unknown[] {
  return [r.ticketId, r.channel, r.group, r.contactType, r.tier, String(r.subject || '').slice(0, 80), r.country, r.status,
    r.agentStatus || '', (r.lastTouch as Date).getTime(), ((r.interactionAt || r.lastTouch) as Date).getTime(), r.touches, r.day,
    ((r.actionAt || r.lastTouch) as Date).getTime(), r.statusLog || '']
}

/** qeWriteCandidates_ verbatim: replace Candidates with this build's unpicked. */
async function qeWriteCandidates_(dateStr: string, byAgent: Record<string, Row[]>): Promise<void> {
  const { error: de } = await db().from(QE_TBL_CANDIDATES).delete().neq('queued_date', '__never__')
  if (de) throw described(de, { table: QE_TBL_CANDIDATES })
  const rows = Object.keys(byAgent)
    .sort()
    .map((a) => ({ queued_date: dateStr, agent: a, candidates: JSON.stringify(byAgent[a].map(qeCandToArr_)) }))
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db().from(QE_TBL_CANDIDATES).insert(rows.slice(i, i + 200))
    if (error) throw described(error, { table: QE_TBL_CANDIDATES })
  }
}

/** qeUpdateCatalogue_ verbatim: every value the source actually contains. */
async function qeUpdateCatalogue_(built: Row): Promise<void> {
  const stamp = qeFmt_(new Date(), 'yyyy-MM-dd')
  const existing: Record<string, { count: number; seen?: string }> = {}
  const rows = (await readRows(QE_TBL_CATALOGUE).catch(() => [] as Row[])) as Row[]
  rows.forEach((r) => {
    if (String(r.kind || '') === '') return
    existing[String(r.kind) + '||' + String(r.value)] = { count: Number(r.times_seen) || 0, seen: qeAsDateText_(r.last_seen, false) }
  })
  function bump(kind: string, map: Record<string, number>) {
    Object.keys(map || {}).forEach((v) => {
      const k = kind + '||' + v
      if (!existing[k]) existing[k] = { count: 0 }
      existing[k].count += map[v]
      existing[k].seen = stamp
    })
  }
  bump('L2', built.seenL2 as Record<string, number>)
  bump('L3', built.seenL3 as Record<string, number>)
  bump('Status', (built.seenStatus as Record<string, number>) || {})
  bump('Agent Status', (built.seenAgentStatus as Record<string, number>) || {})
  bump('Contact Type', (built.seenType as Record<string, number>) || {})
  bump('Activity', (built.seenActivity as Record<string, number>) || {})
  bump('Group', built.unmappedGroups as Record<string, number>)
  const mapped: Record<string, number> = {}
  ;(built.pool as Row[]).forEach((r) => {
    mapped[String(r.group)] = (mapped[String(r.group)] || 0) + 1
  })
  bump('Group', mapped)
  const out = Object.keys(existing)
    .sort()
    .map((k) => {
      const parts = k.split('||')
      return { kind: parts[0], value: parts[1], times_seen: existing[k].count, last_seen: existing[k].seen || '' }
    })
  const { error: de } = await db().from(QE_TBL_CATALOGUE).delete().neq('kind', '__never__')
  if (de) throw described(de, { table: QE_TBL_CATALOGUE })
  for (let i = 0; i < out.length; i += 500) {
    const { error } = await db().from(QE_TBL_CATALOGUE).insert(out.slice(i, i + 500))
    if (error) throw described(error, { table: QE_TBL_CATALOGUE })
  }
}

// =====================================================================
// Build (old Store.js)
// =====================================================================

/** qeSlotsFor_ verbatim: this build's slots for one agent. */
function qeSlotsFor_(alreadyThisWeek: Record<string, number>, mode: string, S: Row, quota: { perDay: number; perWeek: number; offerPerDay: number; offerPerWeek: number }): number {
  const perDay = (quota && (quota.offerPerDay || quota.perDay)) || (S.auditsPerDay as number)
  const perWeek = (quota && (quota.offerPerWeek || quota.perWeek)) || (S.auditsPerWeek as number)
  let taken = 0
  Object.keys(alreadyThisWeek).forEach((c) => {
    taken += alreadyThisWeek[c]
  })
  const weeklyRemaining = Math.max(0, perWeek - taken)
  return mode === 'week' ? weeklyRemaining : Math.min(perDay, weeklyRemaining)
}

/** qePartitionLog_ verbatim (rule order as the legacy). */
function qePartitionLog_(rows: unknown[][], dateStr: string, weekKey: string, expireBefore: string, reofferExpired: boolean, keepKeys?: Record<string, boolean>): {
  kept: unknown[][]; blocked: Record<string, boolean>; blockedTickets: Record<string, boolean>;
  weekTaken: Record<string, Record<string, number>>; todayTaken: Record<string, number>; expired: number
} {
  const kept: unknown[][] = []
  const blocked: Record<string, boolean> = {}
  const blockedTickets: Record<string, boolean> = {}
  const weekTaken: Record<string, Record<string, number>> = {}
  const todayTaken: Record<string, number> = {}
  let expired = 0
  rows.forEach((r0) => {
    let r = r0
    const qDate = String(r[QE_LOG_COL['Queued Date']])
    const state = String(r[QE_LOG_COL['State']])
    const pending = state === 'pending'
    if (qDate === dateStr && pending && !(keepKeys && keepKeys[String(r[QE_LOG_COL['Key']])])) return
    if (pending && qDate < expireBefore) {
      r = r.slice()
      r[QE_LOG_COL['State']] = 'expired'
      expired++
    }
    kept.push(r)
    const st = String(r[QE_LOG_COL['State']])
    if (!reofferExpired || st !== 'expired') blocked[String(r[QE_LOG_COL['Key']])] = true
    if (st === 'passed') blockedTickets[String(r[QE_LOG_COL['Ticket ID']])] = true
    const a = String(r[QE_LOG_COL['Agent']])
    if (String(r[QE_LOG_COL['ISO Week']]) === weekKey && st !== 'passed') {
      const c = String(r[QE_LOG_COL['Channel']])
      if (!weekTaken[a]) weekTaken[a] = {}
      weekTaken[a][c] = (weekTaken[a][c] || 0) + 1
    }
    if (qDate === dateStr && (st === 'pending' || st === 'audited')) todayTaken[a] = (todayTaken[a] || 0) + 1
  })
  return { kept, blocked, blockedTickets, weekTaken, todayTaken, expired }
}

/** qeAgentOutcomes_ verbatim. */
function qeAgentOutcomes_(S: Row, built: Row, byAgent: Record<string, Row[]>, cfSet: Record<string, boolean>, weekTaken: Record<string, Record<string, number>>): Row {
  const a: Record<string, Row> = {}
  const rec = (n: string): Row => {
    if (a[n]) return a[n]
    const who = built.roster && (built.roster as Row).byName ? ((built.roster as Row).byName as Record<string, Row>)[n] : null
    const q = qeQuotaFor_(n, S)
    let w = 0
    Object.keys(weekTaken[n] || {}).forEach((c) => {
      w += weekTaken[n][c]
    })
    return (a[n] = { e: (who && who.email) || '', i: who && who.id ? String(who.id) : '', t: 0, d: (built.dropByAgent as Record<string, Row>)[n] || {}, p: 0,
      f: (byAgent[n] || []).length, w, o: q.offerPerDay, c: q.offerPerWeek, r: '' })
  }
  ;(((built.touch as Row) && ((built.touch as Row).pairs as Row[])) || []).forEach((x) => {
    rec(String(x.agent)).t = (rec(String(x.agent)).t as number) + 1
  })
  ;(built.pool as Row[]).forEach((x) => {
    rec(String(x.agent)).p = (rec(String(x.agent)).p as number) + 1
  })
  Object.keys(a).forEach((n) => {
    const o = a[n]
    if (!o.f) o.r = 'none'
    else if ((o.f as number) < (S.minTouches as number)) o.r = 'min'
    else if (S.requireCustomerFacing && !cfSet[n]) o.r = 'cf'
  })
  return { a, m: S.minTouches, cf: !!S.requireCustomerFacing, lb: S.lookbackDays }
}

/** qeOutcomesCell_ verbatim: outcomes under QE_OUTCOME_MAX_CHARS. */
function qeOutcomesCell_(outcomes: Row): string {
  let txt = JSON.stringify(outcomes)
  if (txt.length <= QE_OUTCOME_MAX_CHARS) return txt
  const slim = JSON.parse(txt) as { a: Record<string, Row> }
  Object.keys(slim.a).forEach((n) => {
    if (slim.a[n].r === 'ok') delete slim.a[n]
  })
  txt = JSON.stringify(slim)
  if (txt.length <= QE_OUTCOME_MAX_CHARS) return txt
  Object.keys(slim.a).forEach((n) => {
    slim.a[n].d = {}
  })
  return JSON.stringify(slim).slice(0, QE_OUTCOME_MAX_CHARS)
}

/** qeDraw_ verbatim: pool + current log -> the new log, candidates, result. */
function qeDraw_(S: Row, built: Row, logRows: unknown[][], now: Date, mode: string, keepKeys: Record<string, boolean> | undefined, extraTaken: Record<string, number> | undefined): Row {
  const dateStr = qeFmt_(now, 'yyyy-MM-dd')
  const weekKey = qeWeekKeyFor_(now, S)
  const pool = built.pool as Row[]
  const since = built.since as Date
  const until = built.until as Date
  if (!pool.length) {
    throw new Error('No touched tickets reached the pool. ' + qePoolFunnelNote_(built) + ' Groups seen but not mapped: ' +
      (Object.keys(built.unmappedGroups as Record<string, number>).slice(0, 8).join(', ') || '(none)') + '. ' + qeSourceLagNote_(built.touch as Row, since, until))
  }
  const expireBefore = qeRetentionWindow_(S, now)
  const part = qePartitionLog_(logRows, dateStr, weekKey, expireBefore, S.reofferExpired !== false, keepKeys)
  const kept = part.kept
  const blocked = part.blocked
  const weekTaken = part.weekTaken
  const expired = part.expired
  Object.keys(extraTaken || {}).forEach((a) => {
    if (!weekTaken[a]) weekTaken[a] = {}
    weekTaken[a].Requested = (weekTaken[a].Requested || 0) + (extraTaken as Record<string, number>)[a]
  })
  const fresh = pool.filter((r) => !blocked[String(r.ticketId) + '|' + String(r.agent)] && !part.blockedTickets[String(r.ticketId)])
  const byAgent: Record<string, Row[]> = {}
  const cfSet: Record<string, boolean> = {}
  fresh.forEach((r) => {
    if (!byAgent[String(r.agent)]) byAgent[String(r.agent)] = []
    byAgent[String(r.agent)].push(r)
    if (((S.customerFacing as string[]) || []).indexOf(String(r.channel)) >= 0) cfSet[String(r.agent)] = true
  })
  const agents = Object.keys(byAgent)
    .filter((a) => {
      if (byAgent[a].length < (S.minTouches as number)) return false
      if (S.requireCustomerFacing && !cfSet[a]) return false
      return true
    })
    .sort()
  if (!agents.length) {
    throw new Error('No agents qualified for auditing. ' + fresh.length + ' eligible tickets across ' + Object.keys(byAgent).length +
      ' people, but none met the minimum of ' + S.minTouches + ' tickets' + (S.requireCustomerFacing ? ' in a customer-facing channel' : '') +
      '. ' + qePoolFunnelNote_(built) + ' ' + qeSourceLagNote_(built.touch as Row, since, until))
  }
  const newRows: unknown[][] = []
  const gaps: Record<string, number> = {}
  let atQuota = 0
  let onPlan = 0
  const shortAgents: string[] = []
  const candidates: Record<string, Row[]> = {}
  const outcomes = qeAgentOutcomes_(S, built, byAgent, cfSet, weekTaken)
  agents.forEach((agent) => {
    const rng = qeMakeRng_(dateStr + '|' + agent)
    const alreadyThisWeek = weekTaken[agent] || {}
    const quota = qeQuotaFor_(agent, S)
    if (quota.actionPlan) onPlan++
    let slots = qeSlotsFor_(alreadyThisWeek, mode, S, quota)
    const o = (outcomes.a as Record<string, Row>)[agent]
    o.s = slots
    o.y = part.todayTaken[agent] || 0
    o.r = slots <= 0 ? 'week' : mode !== 'week' && slots < (o.o as number) ? 'capped' : ''
    if (mode !== 'week') slots = Math.max(0, slots - (part.todayTaken[agent] || 0))
    if (slots <= 0) {
      atQuota++
      if (!o.r) o.r = 'today'
      return
    }
    const res = qeSelectForAgent_(byAgent[agent] as never[], slots, alreadyThisWeek, rng, S as never, quota.offerPerWeek || quota.perWeek) as { picked: Row[] }
    o.k = res.picked.length
    if (!o.r) o.r = (res.picked.length >= slots ? 'ok' : (o.f as number) < slots ? 'pool' : 'channel')
    if (res.picked.length < slots) shortAgents.push(agent + ' ' + res.picked.length + '/' + slots)
    const who = built.roster && (built.roster as Row).byName ? ((built.roster as Row).byName as Record<string, Row>)[agent] : null
    res.picked.forEach((rec, i) => {
      newRows.push(qeLogRow_(rec, agent, dateStr, weekKey, i + 1, who))
    })
    const pickedKeys: Record<string, boolean> = {}
    res.picked.forEach((rec) => {
      pickedKeys[String(rec.ticketId)] = true
    })
    const left = byAgent[agent].filter((rec) => !pickedKeys[String(rec.ticketId)])
    qeShuffle_(left, qeMakeRng_(dateStr + '|left|' + agent))
    candidates[agent] = left.slice(0, QE_CANDIDATES_PER_AGENT)
    for (const ch in (S.channelWeights as Record<string, number>)) {
      if (!(S.channelWeights as Record<string, number>)[ch]) continue
      let inPool = 0
      byAgent[agent].forEach((r) => {
        if (String(r.channel) === ch) inPool++
      })
      if (!inPool) gaps[ch] = (gaps[ch] || 0) + 1
    }
  })
  const shift = (built.window && (built.window as Row).shift as number) || 0
  const fdNote = (built.detail && (built.detail as Row).fallback && ((built.detail as Row).fallback as Row).note as string) || ''
  const exBy = (built.excludedBy as Record<string, number>) || {}
  const exTop = Object.keys(exBy)
    .sort((a, b) => exBy[b] - exBy[a])
    .slice(0, 5)
    .map((k) => k + ' ' + exBy[k])
  const notes = built.offChannel + ' off-channel, ' + built.missingDetail + ' without detail, ' + (Number(built.statusExcluded) || 0) +
    ' excluded by status' + (exTop.length ? ' (' + exTop.join('; ') + ')' : '') + ', ' + (Number(built.notOpener) || 0) + ' not the opener, ' + (Number(built.noOpenerKnown) || 0) + ' opener unknown, ' +
    Object.keys(built.unmappedGroups as Record<string, number>).length + ' unmapped groups, ' + expired + ' expired' +
    (shift ? ', window slid back ' + shift + ' day(s): the ticket-detail tab has not kept up' : '') +
    (fdNote ? ', ' + fdNote : '') + (onPlan ? ', ' + onPlan + ' on an action plan' : '') +
    (shortAgents.length ? ', short: ' + shortAgents.slice(0, 12).join(', ') : '')
  return {
    log: kept.concat(newRows), newRows, candidates, outcomes, notes: notes + ', ' + atQuota + ' at quota',
    result: {
      dateStr, weekKey, mode, agents: agents.length - atQuota, atQuota, queued: newRows.length,
      onPlan, short: shortAgents, poolSize: pool.length, eligible: fresh.length, offChannel: built.offChannel,
      missingDetail: built.missingDetail, expired, unmappedGroups: built.unmappedGroups,
      touchesScanned: (built.touch as Row).scanned, touchesInWindow: (built.touch as Row).inWindow,
      newestTouch: (built.touch as Row).newest ? qeFmt_((built.touch as Row).newest as Date, 'yyyy-MM-dd HH:mm') : '',
      windowShiftDays: shift, windowFrom: qeFmt_(since, 'yyyy-MM-dd'), windowTo: qeFmt_(new Date(until.getTime() - 1), 'yyyy-MM-dd'), gaps,
    },
  }
}

/** qeMigrationDone_ -> the qe_migration_done config flag. */
async function qeMigrationDone_(): Promise<boolean> {
  return !!(await getConfig(QE_MIG_DONE_KEY, false))
}

/** qaRecordVolume_ verbatim-ish: qa_volume rows of the pool's eligible tickets. */
async function qaRecordVolume_(pool: Row[]): Promise<void> {
  try {
    const by: Record<string, number> = {}
    pool.forEach((r) => {
      const k = String(r.day || '') + '|' + String(r.channel || '') + '|' + String(r.contactType || '(not set)')
      by[k] = (by[k] || 0) + 1
    })
    const now = new Date().toISOString()
    const rows = Object.keys(by).map((k) => {
      const p = k.split('|')
      return { date: p[0], channel: p[1], contact_type: p[2], tickets: by[k], updated_at: now }
    })
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db().from('qa_volume').upsert(rows.slice(i, i + 200), { onConflict: 'date,channel,contact_type' })
      if (error) throw described(error, { table: 'qa_volume' })
    }
  } catch (e) {
    console.log('qa_volume not written: ' + ((e as Error)?.message || e))
  }
}

/**
 * qeBuildQueue_ verbatim: draws today's ('day') or the rest of the week's
 * ('week') sample into qe_queue_log. opts: { keepKeys, extraTaken, now,
 * skipMigrationCheck }. Returns drawn.result (the builds row fields).
 */
export async function qeBuildQueue(mode: string, actor: string, opts?: { keepKeys?: Record<string, boolean>; extraTaken?: Record<string, number>; now?: Date; skipMigrationCheck?: boolean }): Promise<Row> {
  opts = opts || {}
  if (!opts.skipMigrationCheck && !(await qeMigrationDone_())) {
    throw new Error('The old Queue Log has not been copied into CC2 Quality yet, so the no-repeat rule has no history. Run migrateQualityQueueHistory until it says done.')
  }
  const S = await qeSettings_()
  const now = opts.now || new Date()
  const w = qeWall_(now)
  const until = qeLocal_(w.y, w.m, w.d + 1)
  const since = new Date(until.getTime() - (S.lookbackDays as number) * 86400000)
  const built = await qeBuildPool_(S, since, until)
  // Postgres serializes writes per request; the build's read-partition-write
  // block is one code path here, matching the legacy script lock's intent.
  const drawn = qeDraw_(S, built, await qeReadLog_(), now, mode === 'week' ? 'week' : 'day', opts.keepKeys, opts.extraTaken)
  await qeWriteLogAll_(drawn.log as unknown[][])
  await qeWriteCandidates_((drawn.result as Row).dateStr as string, drawn.candidates as Record<string, Row[]>)
  await qeUpdateCatalogue_(built)
  const { error: be } = await db().from(QE_TBL_BUILDS).insert({
    ran_at: qeFmt_(now, 'yyyy-MM-dd HH:mm:ss'), by: actor || 'trigger', mode: (drawn.result as Row).mode,
    agents: (drawn.result as Row).agents, queued: (drawn.result as Row).queued, pool: (drawn.result as Row).poolSize,
    eligible: (drawn.result as Row).eligible, notes: drawn.notes,
  })
  if (be) throw described(be, { table: QE_TBL_BUILDS })
  const { error: oe } = await db().from(QE_TBL_OUTCOMES).insert({
    queued_date: (drawn.result as Row).dateStr, ran_at: qeFmt_(now, 'yyyy-MM-dd HH:mm:ss'),
    mode: (drawn.result as Row).mode, outcomes: qeOutcomesCell_(drawn.outcomes as Row),
  })
  if (oe) throw described(oe, { table: QE_TBL_OUTCOMES })
  await qaRecordVolume_(built.pool as Row[])
  return drawn.result as Row
}

/** Exported for the admin "mark migration done" action + tests. */
export async function qeSetMigrationDone_(done: boolean): Promise<void> {
  await setConfig(QE_MIG_DONE_KEY, done)
}
