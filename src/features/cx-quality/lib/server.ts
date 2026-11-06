/**
 * Quality — server-side port of Quality.js + QaEngine.js (+ QaMigrate.js seams).
 *
 * Every exported function is a verbatim port of the legacy google.script.run
 * entry point it is named after; the underscore-suffixed helpers are the same
 * for the private functions. Sheet reads become Postgres reads (qaRows_ /
 * readRows against the qa_* / qe_* tables, the `tickets` snapshot, and the
 * tlp_shifts store); the old app's Queue Log is read through fetchWorkbookTabs
 * while qa_engine_live is off (the migration seam).
 *
 * Timezone: wall-clock strings are Asia/Riyadh (QE_TZ, UTC+3 no DST). pwToday /
 * dqAddDays_ produce the same keys; qeFmt_ is the engine's formatter.
 */

import { appendRow, cacheGet, cachePut, db, newId, readRows, sanitizeInput } from '@/features/shared/platform/repo'
import { getConfig, setConfig } from '@/features/shared/platform/settings'
import { requireRole, requireJobCaller, actorEmail, normEmail, pwDirectory, assistantOwnerEmail, type Directory, type DirectoryPerson } from '@/features/shared/platform/identity'
import { assertWritable } from '@/features/shared/platform/viewas'
import { hbBeat, hbFlush, hbRun } from '@/features/shared/platform/health'
import { getWorkingCalendar } from '@/features/shared/platform/calendar'
import { optionsFor } from '@/features/shared/platform/options'
import { resolvePopups } from '@/features/shared/platform/popups'
import { notify, type NotifyInput } from '@/features/shared/platform/notify'
import { pwToday } from '@/features/shared/platform/time'
import { readStore } from '@/features/shared/platform/stores'
import { tlsOnShift_, tlsShifts_ } from '@/features/cx-queue/lib'
import { fetchWorkbookTabs } from '@/features/shared/jobs/sheets'
import { described } from '@/features/shared/lib/errors'
import { dqAddDays_ } from '@/features/shared/lib/adapters'

import {
  QA_SETTINGS,
  qaBool_, qaRound1_, qaLostQuestions_, qaNeedsCtl_,
  qaCanCloseCtl_, qaCtlVisibleTo_, qaFindOpenCtls_,
  qaCtlSla_, qaDisputeStats_, qaAuditorKpis_, qaEmailList_,
  qaQueueFromSheet_, qaForms_, qaAuditView_, qaCleanForm_,
  qaItemRef_, qaItemId_, qaItemTag_, qaIsNonTicket_, qaWhen_, qaParse_, qaFinalScore_,
  qaQuestions_, qaAlignment_, qaRollupAudits_, qaCtlDue_, qaCtlDenyRecipients_,
  qaAgentIndex_,
  type QaQueueCtx,
} from './core'
import {
  qaCleanInteractionAt_, qaTakenByOther_, qaScoreSubmission_,
  qaCleanFailReasons_, qaNewCtl_, qaCtlPopups_, qaAuditMail_, qaMyAuditCounts_,
  qaCanWaive_, qaCleanReason_, qaRequestRows_, qaTicketQueueRow_,
  qaNonTicketClash_, qaNonTicketRow_, qaCleanPassReason_,
  qaAuditorVia_, qaKbItem_, qaWeekQuota_, qaSquash_, qaTimesAsText_, qaTextTime_,
  qaQueueFields_, qaQueueClosed_, QA_REQUEST_OPEN, QA_PASS_REASONS, qaPeriods_,
  qaCoverage_, qaCheckRange_, QA_COVERAGE_DAYS,
} from './pure'
import {
  QE_LOG_HEADERS, QE_OLD_DATA_SS_ID,
  qeSettingsFrom_, qeFmt_, qeWeekKeyFor_, qeCanonAgent_, qeQuotaFor_, qeGroupToChannel_,
  qeStatusKey_, qeCleanSamplingInput_, qeWithSampling_, qeMergeSettings_, qeLocal_,
  QE_FD_STATUS_NAMES,
} from './engine'
import { qaAnalytics_, qaDrill_, qaScoresRange_, qaDeriveBasis_, qaFailMemory_ } from './analytics'

type Row = Record<string, unknown>

// Postgres tables backing the engine (supabase/migrations/006_quality.sql).
const QE_TBL_LOG = 'qe_queue_log'
const QE_TBL_CANDIDATES = 'qe_candidates'
const QE_TBL_OUTCOMES = 'qe_outcomes'
const QE_TBL_BUILDS = 'qe_builds'
const QA_ACCESS_LOG = 'qa_access_log'
const MAIL_LOG_TABLE = 'mail_log'
const HEALTH_TABLE = 'health'

type QaUser = { email: string; name: string; role: string }

/** requireRole_ verbatim: throws the legacy messages; returns the { email, name, role } Quality.js expects. */
async function qaRequireRole_(roles: string[]): Promise<QaUser> {
  const u = await requireRole(roles)
  return { email: normEmail(u.email), name: String(u.name || u.email), role: u.role }
}

// =====================================================================
// Storage seam
// =====================================================================

/** qaRows_ verbatim: one sheet's data rows as objects; [] when the table is absent. */
async function qaRows_(name: string): Promise<Row[]> {
  try {
    return (await readRows(name)) as Row[]
  } catch (e) {
    const err = e as { code?: string; status?: number }
    if (err.code === '42P01' || err.status === 404) return []
    throw e
  }
}

/** dqUpsertIn_ verbatim: update rows matching every key field, insert the rest. */
async function qaUpsertIn_(name: string, keys: string[], rows: Row[]): Promise<number> {
  const clean = rows.map((r) => sanitizeInput(r)) as Row[]
  let n = 0
  for (const row of clean) {
    let q = db().from(name).select(keys.join(',')).limit(1)
    for (const k of keys) q = q.eq(k, (row[k] ?? '') as string)
    const { data: found, error } = await q
    if (error) throw described(error, { table: name })
    if (found && found.length) {
      const patch: Row = {}
      Object.keys(row).forEach((f) => {
        if (keys.indexOf(f) === -1) patch[f] = row[f]
      })
      let u = db().from(name).update(patch)
      for (const k of keys) u = u.eq(k, (row[k] ?? '') as string)
      const { error: ue } = await u
      if (ue) throw described(ue, { table: name })
    } else {
      const { error: ie } = await db().from(name).insert(row)
      if (ie) throw described(ie, { table: name })
    }
    n++
  }
  return n
}

// LockService seam: Postgres has no multi-statement transaction helper here, so
// the few mutating paths serialize on a process-local mutex exactly as
// LockService serialized the legacy writes.
let qaLock_: Promise<void> = Promise.resolve()

/** qaVersion_ verbatim: analytics cache-buster bumped on every write. */
async function qaVersion_(): Promise<string> {
  let v = cacheGet('qa_ver')
  if (!v) {
    v = String(Date.now())
    cachePut('qa_ver', v, 21600)
  }
  return v
}
async function qaBumpVersion_(): Promise<void> {
  try {
    cachePut('qa_ver', String(Date.now()) + Math.random().toString(36).slice(2, 5), 21600)
  } catch {
    /* ignore */
  }
}

/**
 * qaTx_ verbatim: runs fn under the lock; fn re-reads what it checks. Bumps the
 * analytics cache version afterwards (as the legacy qaTx_ did).
 */
async function qaTx_<T>(fn: () => Promise<T>): Promise<T> {
  const prev = qaLock_
  let release!: () => void
  qaLock_ = new Promise((r) => (release = r))
  await prev
  try {
    const r = await fn()
    await qaBumpVersion_()
    return r
  } finally {
    release()
  }
}

const qaNowIso_ = () => new Date().toISOString()
const qaToday_ = () => pwToday()

// =====================================================================
// Settings / access
// =====================================================================

/** getSetting_ verbatim: config value with the QA_SETTINGS default. */
async function qaSetting_(key: string): Promise<unknown> {
  const def = QA_SETTINGS[key] ? QA_SETTINGS[key].value : ''
  return getConfig(key, def)
}
async function qaNumSetting_(key: string): Promise<number> {
  const n = Number(await qaSetting_(key))
  return isFinite(n) ? n : 0
}
async function qaEngineLive_(): Promise<boolean> {
  return qaBool_(await qaSetting_('qa_engine_live'))
}
async function qeSettings_(): Promise<Row> {
  return qeSettingsFrom_(await getConfig('qa_engine_settings', {}))
}

/** qaAuditorPosKeywords_ verbatim: the position keywords that make an auditor. */
async function qaAuditorPosKeywords_(): Promise<string[]> {
  const v = await qaSetting_('qa_auditor_positions')
  return Array.isArray(v) ? v.map(String) : qaEmailList_(v)
}
/** qaEmailList_(qa_auditor_emails): extra auditor emails granted by an admin. */
async function qaAuditorGrants_(): Promise<string[]> {
  return qaEmailList_(await qaSetting_('qa_auditor_emails'))
}
/** qaKbNotifyList_ verbatim: the people emailed about, and marking, KB gaps. */
async function qaKbNotifyList_(): Promise<string[]> {
  return qaEmailList_(await qaSetting_('qa_kb_notify_emails'))
}
async function qaWaiverList_(): Promise<string[]> {
  return qaEmailList_(await qaSetting_('qa_request_waiver_emails'))
}

/** qaAuditors_ verbatim: every active TL or position-matching person, plus grants. */
async function qaAuditors_(dir: Directory): Promise<string[]> {
  const keys = (await qaAuditorPosKeywords_()).map((s) => String(s).toLowerCase().trim()).filter(String)
  const seen: Record<string, boolean> = {}
  Object.keys(dir.by).forEach((k) => {
    const p = dir.by[k]
    const pos = String(p.position || '').toLowerCase()
    if (p.active && (p.role === 'tl' || keys.some((w) => pos.indexOf(w) !== -1))) seen[k] = true
  })
  ;([] as unknown[]).concat(((await qaSetting_('qa_auditor_emails')) as unknown[]) || [])
    .map(normEmail).filter(String).forEach((e) => { seen[e] = true })
  return Object.keys(seen)
}

function qaDisputeOwnerSync_(ownerCfg: unknown, assistantOwner: string): string {
  return normEmail(ownerCfg) || normEmail(assistantOwner)
}
/** qaDisputeOwner_ verbatim: configured owner, else the assistant owner. */
async function qaDisputeOwner_(): Promise<string> {
  return qaDisputeOwnerSync_(await qaSetting_('qa_dispute_owner_email'), await assistantOwnerEmail())
}

/** qaIsAuditor_ verbatim: admin | in qaAuditors_. */
async function qaIsAuditor_(user: QaUser | null, dir: Directory): Promise<boolean> {
  if (!user) return false
  if (user.role === 'admin') return true
  return (await qaAuditors_(dir)).indexOf(user.email) !== -1
}

/** qaIsKbEditor_ verbatim: admin | on qa_kb_notify_emails. */
async function qaIsKbEditor_(user: QaUser | null): Promise<boolean> {
  if (!user) return false
  return user.role === 'admin' || (await qaKbNotifyList_()).indexOf(user.email) !== -1
}

/** qaOnShiftNow_ verbatim: TLs whose tlp_shifts cover now. */
async function qaOnShiftNow_(): Promise<string[]> {
  const today = qaToday_()
  const rows = (await readStore('tlp_shifts').catch(() => ({ rows: [] as Row[] }))).rows || []
  return tlsOnShift_(tlsShifts_(rows, dqAddDays_(today, -1), dqAddDays_(today, 1)), Date.now())
}

/** qaWorkingFn_ verbatim: working-day predicate for one email's calendar. */
async function qaWorkingFn_(email: string, fromKey: string): Promise<(d: string) => boolean> {
  const map: Record<string, boolean> = {}
  try {
    ;(await getWorkingCalendar(email, fromKey, dqAddDays_(fromKey, 45))).forEach((d) => {
      map[d.date] = d.working
    })
  } catch (e) {
    console.log('working calendar failed for ' + email + ': ' + ((e as Error)?.message || e))
  }
  return (key: string) => map[key] !== false // unknown days count as working (legacy)
}

/** qaTicketUrl_ verbatim. */
async function qaTicketUrl_(): Promise<string> {
  return 'https://' + String((await getConfig('freshdesk_domain', '')) || '') + '/a/tickets/'
}

/** qaAuditTypes_ verbatim: the audit_type option list. */
async function qaAuditTypes_(): Promise<string[]> {
  return (await optionsFor('qa.audit_type')) as string[]
}

/** qaImportablePeople_ verbatim: active agents, specialists and TLs. */
function qaImportablePeople_(dir: Directory | { by: Record<string, DirectoryPerson> }): DirectoryPerson[] {
  return Object.keys(dir.by)
    .map((k) => dir.by[k])
    .filter((p) => p.active && (p.role === 'agent' || p.role === 'specialist' || p.role === 'tl'))
}

/** dqHeadcount_ seam: the roster's Freshdesk ids/names (fd_id, fd_name columns on roster). */
async function qaHeadcount_(): Promise<{ email: string; fdId: string; fdName: string }[]> {
  try {
    const rows = (await readRows('roster')) as Row[]
    return rows.map((r) => ({
      email: normEmail(r.email), fdId: String(r.fd_id || r.freshdesk_id || ''), fdName: String(r.fd_name || r.freshdesk_name || ''),
    }))
  } catch {
    return []
  }
}

/** dqLastRun_ seam: the health row's last_run_at for a job. */
async function qaLastRun_(job: string): Promise<string> {
  try {
    const { data, error } = await db().from(HEALTH_TABLE).select('last_run_at').eq('job', String(job)).limit(1)
    if (error || !data || !data.length) return ''
    return String((data[0] as Row).last_run_at || '')
  } catch {
    return ''
  }
}

// =====================================================================
// The Hub's ticket snapshot + roster
// =====================================================================

/** qeHubTicketDetail_ verbatim: ticket_id -> {groupName, responderId, l1, l2, l3, status}. */
async function qeHubTicketDetail_(ids: Record<string, boolean> | string[]): Promise<Record<string, { groupName: string; responderId: string; l1: string; l2: string; l3: string; status: string }>> {
  const want = (Array.isArray(ids) ? ids : Object.keys(ids || {})).map(String).filter(Boolean)
  const out: Record<string, { groupName: string; responderId: string; l1: string; l2: string; l3: string; status: string }> = {}
  for (let i = 0; i < want.length; i += 200) {
    const { data, error } = await db()
      .from('tickets')
      .select('ticket_id,group_name,responder_id,contact_type_1,contact_type_2,contact_type_3,status')
      .in('ticket_id', want.slice(i, i + 200))
    if (error) throw described(error, { table: 'tickets' })
    ;(data || []).forEach((r) => {
      out[String(r.ticket_id)] = {
        groupName: String(r.group_name || ''), responderId: String(r.responder_id || ''),
        l1: String(r.contact_type_1 || ''), l2: String(r.contact_type_2 || ''),
        l3: String(r.contact_type_3 || ''), status: String(r.status || ''),
      }
    })
  }
  return out
}

/** qaQueueCtx_ verbatim: the QaQueueCtx the queue parser needs (roster + headcount). */
async function qaQueueCtx_(dir: Directory): Promise<QaQueueCtx> {
  const people = qaImportablePeople_(dir).map((p) => ({ email: p.email, name: p.name, tlEmail: p.tlEmail || undefined }))
  const headcount = await qaHeadcount_()
  return { today: qaToday_(), auditors: await qaAuditors_(dir), people, headcount }
}

// =====================================================================
// Queue-log seam (qeSheet_('Queue Log') / read of the old app's log)
// =====================================================================

function qeLogField_(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}
function qeLogRowToValues_(r: Row): unknown[] {
  return QE_LOG_HEADERS.map((h) => (r[qeLogField_(h)] === undefined ? '' : r[qeLogField_(h)]))
}

/** qeQueueValues_: the Queue Log as a values[][] grid (header row + rows). */
async function qeQueueValues_(): Promise<unknown[][]> {
  if (!(await qaEngineLive_())) {
    const tabs = await fetchWorkbookTabs(QE_OLD_DATA_SS_ID, ['Queue Log'])
    return tabs['Queue Log'] || []
  }
  const rows = (await readRows(QE_TBL_LOG, { orderBy: 'queued_date', ascending: false, limit: 60000 }).catch(() => [] as Row[])) as Row[]
  return [QE_LOG_HEADERS.slice() as unknown[]].concat(rows.map(qeLogRowToValues_))
}

/** qeSetLogField_: one Queue Log cell (Key + Queued Date); live mode only. */
async function qeSetLogField_(key: string, queuedDate: string, header: string, value: unknown): Promise<void> {
  if (!(await qaEngineLive_())) return
  const { error } = await db().from(QE_TBL_LOG).update({ [qeLogField_(header)]: value }).eq('key', String(key)).eq('queued_date', String(queuedDate))
  if (error) throw described(error, { table: QE_TBL_LOG })
}

/** qeMarkLogAudited_ verbatim: State='audited' + Audited At + Audited By. */
async function qeMarkLogAudited_(key: string, queuedDate: string, auditedAt: string, auditedBy: string): Promise<boolean> {
  if (!(await qaEngineLive_())) return false
  const { error } = await db()
    .from(QE_TBL_LOG)
    .update({ state: 'audited', audited_at: auditedAt, audited_by: String(auditedBy || 'unknown') })
    .eq('key', String(key))
    .eq('queued_date', String(queuedDate))
  if (error) throw described(error, { table: QE_TBL_LOG })
  return true
}

/** qeReadOutcomes_ verbatim: Build Outcomes rows on/after a week key. */
async function qeReadOutcomes_(fromKey: string): Promise<Row[]> {
  const rows = (await readRows(QE_TBL_OUTCOMES).catch(() => [] as Row[])) as Row[]
  return rows
    .filter((r) => String(r.queued_date || '') >= String(fromKey || ''))
    .map((r) => ({ date: String(r.queued_date || ''), ranAt: String(r.ran_at || ''), mode: String(r.mode || ''), outcomes: qaParse_(r.outcomes, {}) as Row }))
}

/** qeReadRecentBuilds_ verbatim: the n newest Build Log rows, newest first. */
async function qeReadRecentBuilds_(n: number): Promise<Row[]> {
  const rows = (await readRows(QE_TBL_BUILDS, { orderBy: 'ran_at', ascending: false, limit: Math.max(1, n || 10) }).catch(() => [] as Row[])) as Row[]
  return rows.map((r) => ({
    ranAt: String(r.ran_at || ''), by: String(r.by || ''), mode: String(r.mode || ''), agents: Number(r.agents) || 0,
    queued: Number(r.queued) || 0, pool: Number(r.pool) || 0, eligible: Number(r.eligible) || 0, notes: String(r.notes || ''),
  }))
}

/**
 * qePassAndReplace_ verbatim (QaEngine.js): mark the pending row 'passed', then
 * draw one replacement for the same agent+slot from that build's unpicked
 * candidates. Returns { replacement | null, reason, notInLog? }.
 */
async function qePassAndReplace_(key: string, queuedDate: string, reason: string, by: string, now: Date, ticketId: string): Promise<{ replacement: Row | null; reason: string; notInLog?: boolean }> {
  const S = await qeSettings_()
  const all = (await readRows(QE_TBL_LOG).catch(() => [] as Row[])) as Row[]
  const canon = (v: unknown) => qeCanonAgent_(v)
  const tid = String(ticketId || String(key).split('|')[0]).trim()
  const agent = canon(String(key).split('|').slice(1).join('|'))
  let found: Row | null = null
  for (let i = all.length - 1; i >= 0; i--) {
    const r = all[i]
    if (String(r.state) !== 'pending' || String(r.queued_date).slice(0, 10) !== String(queuedDate)) continue
    if (String(r.key) === String(key)) { found = r; break }
    if (!found && String(r.ticket_id).trim() === tid && canon(r.agent) === agent) found = r
  }
  if (!found) return { replacement: null, reason: 'it is no longer pending in the Queue Log (redrawn or expired), so no replacement was drawn', notInLog: true }
  const stamp = qeFmt_(now, 'yyyy-MM-dd HH:mm')
  await db().from(QE_TBL_LOG)
    .update({ state: 'passed', audited_at: stamp, audited_by: by, pass_reason: reason })
    .eq('key', String(found.key)).eq('queued_date', String(found.queued_date))
  // Candidates of that build for this agent.
  const { data: candRows } = await db().from(QE_TBL_CANDIDATES).select('*').eq('queued_date', String(queuedDate)).eq('agent', String(found.agent))
  if (!candRows || !candRows.length) return { replacement: null, reason: 'the candidates of the ' + queuedDate + ' build are gone (a later build replaced them)' }
  let list: Row[] = []
  try { list = JSON.parse(String((candRows[0] as Row).candidates || '[]')) } catch { list = [] }
  // The already-drawn keys of this build block a redraw.
  const blocked: Record<string, boolean> = {}
  const blockedTickets: Record<string, boolean> = {}
  all.forEach((r) => {
    if (String(r.queued_date).slice(0, 10) === String(queuedDate)) {
      blocked[String(r.key)] = true
      blockedTickets[String(r.ticket_id)] = true
    }
  })
  const pool = list.filter((r) => !blocked[String(r.ticketId) + '|' + found.agent] && !blockedTickets[String(r.ticketId)] && String(r.state || 'pending') !== 'passed')
  const channel = String(found.channel)
  const same = pool.filter((r) => String(r.channel) === channel)
  const picked = (same.length ? same : pool).filter((r) => String(r.state || 'pending') !== 'passed')
  if (!picked.length) return { replacement: null, reason: String(found.agent) + ' has no other eligible ticket left in the ' + queuedDate + ' sample' }
  const rec = picked[0]
  const newKey = String(rec.ticketId) + '|' + String(found.agent)
  const row: Row = {}
  QE_LOG_HEADERS.forEach((h) => { row[qeLogField_(h)] = '' })
  row.key = newKey
  row.queued_date = String(queuedDate)
  row.iso_week = String(found.iso_week || '')
  row.slot = found.slot
  row.agent = String(found.agent)
  row.channel = String(rec.channel || '')
  row['group'] = String(rec.group || '')
  row.contact_type = String(rec.contactType || '')
  row.tier = String(rec.tier || '')
  row.ticket_id = String(rec.ticketId)
  row.subject = String(rec.subject || '')
  row.country = String(rec.country || '')
  row.status = String(rec.status || '')
  row.last_touch = rec.lastTouch ? qeFmt_(new Date(rec.lastTouch as string), 'yyyy-MM-dd HH:mm') : ''
  row.touches = Number(rec.touches) || 0
  row.state = 'pending'
  row.audited_at = ''
  row.audited_by = ''
  row.interaction = rec.interactionAt ? qeFmt_(new Date(rec.interactionAt as string), 'yyyy-MM-dd HH:mm') : ''
  row.agent_status = String(rec.agentStatus || '')
  row.passed_to = ''
  row.agent_email = String(found.agent_email || '')
  row.agent_fd_id = String(found.agent_fd_id || '')
  row.action_time = rec.actionAt ? qeFmt_(new Date(rec.actionAt as string), 'yyyy-MM-dd HH:mm') : (rec.lastTouch ? qeFmt_(new Date(rec.lastTouch as string), 'yyyy-MM-dd HH:mm') : '')
  row.agent_status_log = String(rec.statusLog || '')
  row.pass_reason = ''
  const { error: ie } = await db().from(QE_TBL_LOG).insert(row)
  if (ie) throw described(ie, { table: QE_TBL_LOG })
  // Remove the drawn candidate from the build's candidates.
  const next = list.filter((r) => String(r.ticketId) !== String(rec.ticketId))
  await db().from(QE_TBL_CANDIDATES).update({ candidates: JSON.stringify(next) }).eq('id', (candRows[0] as Row).id as number)
  rec.key = newKey
  return { replacement: rec, reason: '' }
}

// =====================================================================
// Access (getQaAccess / setQaAuditorGrant / qaBootFlags_)
// =====================================================================

/** getQaAccess verbatim: every importable person, whether they can audit and why, plus the grant log. */
export async function getQaAccess(): Promise<Row> {
  await qaRequireRole_(['admin'])
  const dir = await pwDirectory()
  const keys = (await qaAuditorPosKeywords_()).map((s) => String(s).toLowerCase().trim()).filter(String)
  const granted = await qaAuditorGrants_()
  const people = qaImportablePeople_(dir)
    .map((p) => ({
      email: p.email, name: p.name, role: p.role, position: p.position || '',
      via: qaAuditorVia_({ email: p.email, role: p.role, position: p.position }, keys, granted),
    }))
    .sort((a, b) => Number(b.via ? 1 : 0) - Number(a.via ? 1 : 0) || a.name.localeCompare(b.name))
  const log = (await readStore(QA_ACCESS_LOG).catch(() => ({ rows: [] as Row[] }))).rows || []
  return {
    people,
    positions: keys,
    log: log
      .slice(-20)
      .reverse()
      .map((r) => ({
        email: normEmail(r.email), name: dir.name(String(r.email)), action: String(r.action),
        by: dir.name(String(r.submitted_by)), at: String(r.submitted_at || ''),
      })),
  }
}

/** setQaAuditorGrant verbatim: grant (on) or remove (off) audit access; logged; returns getQaAccess(). */
export async function setQaAuditorGrant(email: string, on: unknown): Promise<Row> {
  const user = await qaRequireRole_(['admin'])
  await assertWritable()
  const e = normEmail(email)
  const dir = await pwDirectory()
  const p = dir.person(e)
  const ok = !!on && p && qaImportablePeople_({ by: { x: p } }).length > 0
  if (on && !ok) throw new Error('Choose an active agent, specialist or team lead from the list.')
  const list = await qaAuditorGrants_()
  const has = list.indexOf(e) !== -1
  if (!!on === has) return getQaAccess()
  const next = on ? list.concat([e]) : list.filter((x) => x !== e)
  await setConfig('qa_auditor_emails', next, String((QA_SETTINGS['qa_auditor_emails'] || {}).description || ''), user.email)
  try {
    await appendRow(QA_ACCESS_LOG, { email: e, action: on ? 'granted audit access' : 'removed audit access' }, user.email)
  } catch {
    /* table may not exist yet */
  }
  return getQaAccess()
}

/** qaBootFlags_ verbatim: nav flags; never throws. */
export async function qaBootFlags(user: QaUser | null): Promise<Row> {
  try {
    const dir = await pwDirectory()
    return { auditor: await qaIsAuditor_(user, dir), disputeOwner: !!user && user.email === (await qaDisputeOwner_()), kbEditor: await qaIsKbEditor_(user) }
  } catch {
    return { auditor: !!user && user.role === 'admin', disputeOwner: false, kbEditor: !!user && user.role === 'admin' }
  }
}

// =====================================================================
// Audit Desk: the queue page and its actions
// =====================================================================

/** qaUnmatchedAgents_ verbatim: agents with queue items the last import could not match. */
async function qaUnmatchedAgents_(): Promise<{ name: string; items: number }[]> {
  try {
    const v = (await getConfig('qa_queue_unmatched', {})) as Row
    const names = (v && v.names ? v.names : v) as Record<string, number>
    return Object.keys(names || {}).sort().map((n) => ({ name: n, items: Number(names[n]) || 0 }))
  } catch {
    return []
  }
}

/** qaQuotaAgents_ verbatim: active agents/specialists on the roster, less excludeAgents. */
async function qaQuotaAgents_(dir: Directory, S: Row): Promise<{ email: string; name: string }[]> {
  const excluded = ((S.excludeAgents as string[]) || []).map(qeCanonAgent_)
  return qaImportablePeople_(dir)
    .filter((p) => p.role !== 'tl' && excluded.indexOf(qeCanonAgent_(p.name)) === -1)
    .map((p) => ({ email: normEmail(p.email), name: p.name }))
}

/** qaHandledOf_ verbatim: the queue's agent handled date per audit (interaction_at). */
async function qaHandledOf_(): Promise<(a: Row) => string> {
  const at: Record<string, string> = {}
  try {
    const qs = (await readRows('qa_queue', { cols: 16 } as never).catch(() => [] as Row[])) as Row[]
    qs.forEach((q) => {
      const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(q.interaction_at || ''))
      if (m && q.queue_id) at[String(q.queue_id)] = m[1]
    })
  } catch (e) {
    console.log('handled dates not read: ' + ((e as Error)?.message || e))
  }
  return (a) => at[String(a.queue_id)] || ''
}

/** qaQueuePageFor_ verbatim: the desk payload computed as one user. */
async function qaQueuePageFor_(user: QaUser, dir: Directory): Promise<Row> {
  const today = qaToday_()
  const from = dqAddDays_(today, -7)
  const all = await qaRows_('qa_queue')
  const passedFrom = dqAddDays_(today, -30)
  const passed = all
    .filter((q) => q.status === 'passed' && String(q.passed_at || q.queue_date).slice(0, 10) >= passedFrom)
    .sort((a, b) => String(b.passed_at).localeCompare(String(a.passed_at)))
    .slice(0, 300)
    .map((q) => ({
      queueId: String(q.queue_id), date: String(q.queue_date), ticketId: qaItemId_(q), agentName: String(q.agent_name || dir.name(String(q.agent_email))),
      channel: String(q.channel), reason: String(q.pass_reason || q.pass_note || ''), passedByName: dir.name(String(q.passed_by)), passedAt: String(q.passed_at || ''),
    }))
  const live = await qaEngineLive_()
  const rows = all
    .filter((q) => {
      if (q.source === 'request') return false
      if (qaIsNonTicket_(q) || q.source === 'offqueue') return QA_REQUEST_OPEN.indexOf(String(q.status)) !== -1 || String(q.queue_date) >= from
      if (live && q.status === 'open' && !q.started_at && !qaWhen_(q.action_at)) return false
      return q.status !== 'expired' && (q.queue_date === today || (String(q.queue_date) >= from && q.status !== 'done' && q.status !== 'passed'))
    })
    .map((q) => ({
      queueId: String(q.queue_id), date: String(q.queue_date), ticketId: qaItemId_(q), agentEmail: String(q.agent_email),
      auditType: String(q.audit_type || ''), reference: String(q.reference || ''), source: String(q.source || ''),
      note: qaIsNonTicket_(q) || q.source === 'offqueue' ? String(q.request_reason || '') : '',
      createdByName: (qaIsNonTicket_(q) || q.source === 'offqueue') && q.requested_by ? dir.name(String(q.requested_by)) : '',
      createdAt: qaIsNonTicket_(q) || q.source === 'offqueue' ? String(q.requested_at || '') : '',
      interactionAt: qaWhen_(q.interaction_at), actionAt: qaWhen_(q.action_at), agentStatus: String(q.agent_status || ''),
      agentStatusLog: String(q.agent_status_log || ''), ticketStatus: String(q.ticket_status || ''),
      passReason: String(q.pass_reason || ''), passedByName: q.passed_by ? dir.name(String(q.passed_by)) : '', passedAt: String(q.passed_at || ''),
      agentName: String(q.agent_name || dir.name(String(q.agent_email))), tlEmail: String(q.tl_email || ''), tlName: q.tl_email ? dir.name(String(q.tl_email)) : '',
      channel: String(q.channel), contactType: String(q.contact_type || ''), tier: String(q.tier || ''), auditorEmail: String(q.auditor_email),
      auditorName: dir.name(String(q.auditor_email)), status: String(q.status || 'open'), startedAt: String(q.started_at || ''), auditId: String(q.audit_id || ''),
      takenByOther: qaTakenByOther_(q, user),
    }))
    .sort((a, b) => qaQueueClosed_(String(a.status)) - qaQueueClosed_(String(b.status)) || String(a.date).localeCompare(String(b.date)) || String(a.agentName).localeCompare(String(b.agentName)))
  const allForms = qaForms_(await qaRows_('qa_forms'))
  const forms = allForms.list.filter((f) => f.active)
  const S = await qeSettings_()
  const weekStart = String(qeWeekKeyFor_(new Date(), S)).slice(1)
  const agents = await qaQuotaAgents_(dir, S)
  const audits = await qaRows_('qa_audits')
  const quotaWeeks: { weekStart: string; rows: Row[] }[] = []
  for (let wk = 0; wk < 8; wk++) {
    const ws = dqAddDays_(weekStart, -7 * wk)
    quotaWeeks.push({ weekStart: ws, rows: qaWeekQuota_(agents, audits, wk ? [] : all, ws, (n) => qeQuotaFor_(n, S)) as Row[] })
  }
  const handledOf = await qaHandledOf_()
  const memory = qaFailMemory_(audits, await qaRows_('qa_ctls'), allForms as never, today, handledOf)
  const failMemory: Row = {}
  const requests = qaRequestRows_(all, dir as never, user, dqAddDays_(today, -7))
  ;((rows as Row[]).concat(requests as Row[]) as Row[]).forEach((r) => {
    const m = memory[normEmail(r.agentEmail)]
    r.repeatFails = m ? Object.keys(m).filter((k) => (m as Row)[k] && String(((m as Row)[k] as Row).repeat)).length : 0
    if (m) failMemory[normEmail(r.agentEmail)] = m
  })
  return {
    today, rows, forms, failMemory, ticketUrl: await qaTicketUrl_(), isAdmin: user.role === 'admin',
    importedAt: await qaLastRun_('qa_queue_import'), engineLive: live, unmatched: await qaUnmatchedAgents_(), passed, passReasons: QA_PASS_REASONS,
    requests, canRequest: user.role === 'admin' || user.role === 'tl', canWaive: qaCanWaive_(user, await qaWaiverList_()),
    channels: [] as string[], auditTypes: await qaAuditTypes_(), weekStart, quota: quotaWeeks[0].rows, quotaWeeks,
    mine: qaMyAuditCounts_(audits, user.email, weekStart, today),
  }
}

/** getQaQueuePage verbatim: the Audit Desk; an admin may open any auditor's desk read-only. */
export async function getQaQueuePage(auditorEmail: string): Promise<Row> {
  const me = await qaRequireRole_(['admin', 'tl', 'agent'])
  const dir = await pwDirectory()
  if (!(await qaIsAuditor_(me, dir))) throw new Error('The Audit Desk is for quality auditors.')
  let auditors: { email: string; name: string }[] | null = null
  let target = normEmail(auditorEmail === '*' ? '' : auditorEmail)
  if (me.role === 'admin') {
    auditors = (await qaAuditors_(dir))
      .filter((e) => e !== me.email)
      .map((e) => ({ email: e, name: dir.name(e), tl: (dir.person(e) || ({} as DirectoryPerson)).role === 'tl' }))
      .sort((a, b) => Number(a.tl) - Number(b.tl) || a.name.localeCompare(b.name))
      .map((a) => ({ email: a.email, name: a.name }))
    if (auditorEmail === '*' && auditors.length) target = auditors[0].email
  }
  let user: QaUser = me
  if (target && target !== me.email) {
    if (me.role !== 'admin') throw new Error('Only an admin can open another auditor\'s Audit Desk.')
    if ((await qaAuditors_(dir)).indexOf(target) === -1) throw new Error(target + ' is not a quality auditor.')
    const tp = dir.person(target) || ({} as DirectoryPerson)
    user = { email: target, name: dir.name(target), role: tp.role === 'tl' ? 'tl' : 'agent' }
  }
  const page = await qaQueuePageFor_(user, dir)
  page.readOnly = user !== me
  page.viewing = page.readOnly ? { email: user.email, name: user.name } : null
  if (page.readOnly) {
    page.canRequest = false
    page.canWaive = false
  }
  if (auditors) {
    page.auditors = auditors
    page.selfEmail = me.email
  }
  page.channels = await qaChannels_()
  return page
}

/** The audit-channel choices (QA_CHOICES['qa.channel']). */
async function qaChannels_(): Promise<string[]> {
  return (await optionsFor('qa.channel')) as string[]
}

/** startQaAudit verbatim: the first auditor to start takes it; stamps the start once. */
export async function startQaAudit(queueId: string): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  const dir = await pwDirectory()
  if (!(await qaIsAuditor_(user, dir))) throw new Error('The Audit Desk is for quality auditors.')
  await assertWritable()
  return qaTx_(async () => {
    const q = (await qaRows_('qa_queue')).filter((r) => r.queue_id === String(queueId))[0]
    if (!q) throw new Error('That queue item no longer exists. Reload the page.')
    if (qaTakenByOther_(q, user)) throw new Error('Another auditor is already auditing this ticket.')
    if (q.status === 'done') throw new Error('This ticket has been audited already.')
    if (q.status === 'passed' || q.status === 'expired' || q.status === 'waived') throw new Error('This item is no longer in the queue. Reload the page.')
    if (!q.started_at) {
      q.auditor_email = user.email
      q.started_at = qaNowIso_()
      q.status = 'in_progress'
      await qaUpsertIn_('qa_queue', ['queue_id'], [q])
    }
    return { startedAt: String(q.started_at) }
  })
}

/** submitQaAudit verbatim: score + persist, then CTL / queue-log / mail side effects. */
export async function submitQaAudit(input: Row): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  input = input || {}
  const dir = await pwDirectory()
  if (!(await qaIsAuditor_(user, dir))) throw new Error('The Audit Desk is for quality auditors.')
  await assertWritable()
  const forms = qaForms_(await qaRows_('qa_forms'))
  const scored = qaScoreSubmission_(forms, input.formId, input.formVersion, (input.answers || {}) as Record<string, string>)
  const failReasons = qaCleanFailReasons_(scored.answers, input.reasons as Row | undefined)
  const comment = String(input.comment || '').trim().slice(0, 2000)
  const today = qaToday_()
  const markdown = qaNeedsCtl_(scored.form as never, scored.answers, scored.result.score)
  const onShift = markdown ? await qaOnShiftNow_() : []
  const out = await qaTx_(async () => {
    const q = (await qaRows_('qa_queue')).filter((r) => r.queue_id === String(input.queueId))[0]
    if (!q) throw new Error('That queue item no longer exists. Reload the page.')
    if (qaTakenByOther_(q, user)) throw new Error('Another auditor is already auditing this ticket.')
    if (q.status === 'done') throw new Error('This ticket has been audited already.')
    if (q.status === 'passed') throw new Error('This ticket was passed on, so it is no longer in the queue.')
    if (q.status === 'waived') throw new Error('This audit request was waived, so it is no longer in the queue.')
    if (qaIsNonTicket_(q) && String((scored.form as Row).channel) !== String(q.channel)) throw new Error('Use the ' + String(q.audit_type) + ' audit form. Reload the page.')
    const interactionAt = qaCleanInteractionAt_(input.interactionAt)
    const now = qaNowIso_()
    const audit: Row = {
      audit_id: newId('QA'), kind: 'audit', queue_id: q.queue_id, calibration_id: '', ticket_id: q.ticket_id,
      agent_email: normEmail(q.agent_email), tl_email: normEmail(q.tl_email || dir.managerOf(String(q.agent_email)) || ''), auditor_email: user.email,
      channel: q.channel, contact_type: q.contact_type, form_id: (scored.form as Row).formId, form_version: (scored.form as Row).version,
      answers_json: JSON.stringify(scored.answers), comment, score: scored.result.score, fatal: scored.result.fatal, score_final: '',
      started_at: q.started_at || now, submitted_at: now, audit_date: today,
      status: markdown ? 'submitted' : 'acknowledged', ack_due_date: '',
      acknowledged_at: markdown ? '' : now, ack_by: markdown ? '' : 'full_marks', updated_at: now, updated_by: user.email,
      source: q.source === 'request' || q.source === 'offqueue' ? q.source : qaIsNonTicket_(q) ? String(q.source || 'manual') : '',
      fail_reasons_json: JSON.stringify(failReasons), audit_type: String(q.audit_type || ''), reference: String(q.reference || ''), interaction_at: interactionAt,
    }
    audit.sample_basis = qaDeriveBasis_(audit)
    await qaUpsertIn_('qa_audits', ['audit_id'], [audit])
    q.status = 'done'
    q.audit_id = audit.audit_id
    if (!q.started_at) q.started_at = audit.started_at
    await qaUpsertIn_('qa_queue', ['queue_id'], [q])
    if (q.log_key && (await qaEngineLive_())) await qeMarkLogAudited_(String(q.log_key), String(q.queue_date), qeFmt_(new Date(), 'yyyy-MM-dd HH:mm'), user.email)
    const ctl = markdown ? qaNewCtl_(audit, String(audit.tl_email) || (await qaDisputeOwner_()), today, now, user.email, await qaNumSetting_('qa_ctl_days') || 2, await qaNumSetting_('qa_ctl_days_over_weekend') || 3, await qaWorkingFn_(String(audit.tl_email || ''), today), newId) : null
    if (ctl) {
      ctl.shift_tls = onShift.filter((e) => e !== ctl.tl_email).join(',')
      await qaUpsertIn_('qa_ctls', ['ctl_id'], [ctl])
    }
    return { audit, ctl }
  })
  const a = out.audit
  const lost = qaLostQuestions_(scored.form as never, scored.answers).map((qq) => qq.text)
  const popups = out.ctl ? qaCtlPopups_(out.ctl, dir.name(String(a.agent_email)), qaItemRef_(a), dir as never, qaEmailList_(String(out.ctl.shift_tls || ''))) : []
  let msg: { n: NotifyInput | null; skip: string }
  try {
    msg = qaAuditMail_(a, lost, comment, user.name, out.ctl, dir as never, qaBool_(await qaSetting_('qa_audit_email_enabled'))) as never
  } catch (eM) {
    msg = { n: null, skip: 'not built: ' + ((eM as Error)?.message || eM) }
  }
  if (msg.skip) await qaLogMailSkip_('qa_audit', String(a.audit_id), msg.skip)
  const n = (msg.n || { kind: 'qa_audit', ref: String(a.audit_id), to: [], subject: '' }) as NotifyInput
  n.popups = popups as never
  try {
    await notify(n, user.email)
  } catch {
    /* never fails the submit */
  }
  return { auditId: a.audit_id, score: a.score, fatal: a.fatal, settled: !out.ctl, ctlDue: out.ctl ? out.ctl.due_date : '' }
}

/** A MailLog row for a mail that was not (fully) sent. Never throws. */
async function qaLogMailSkip_(kind: string, ref: string, why: string): Promise<void> {
  try {
    await appendRow(MAIL_LOG_TABLE, { sent_at: new Date().toISOString(), to: '', cc: '', subject: '', kind, ref, status: 'skipped', error: why, quota_left: '' }, 'system:quality')
  } catch (e) {
    console.log('MailLog skip row failed: ' + ((e as Error)?.message || e))
  }
}

/** The newest MailLog row for an audit's result email, or null. */
async function qaLastAuditMail_(auditId: string): Promise<Row | null> {
  try {
    const rows = (await readRows(MAIL_LOG_TABLE).catch(() => [] as Row[])) as Row[]
    const mine = rows.filter((r) => r.kind === 'qa_audit' && String(r.ref) === auditId)
    const r = mine[mine.length - 1]
    return r ? { status: String(r.status), at: String(r.sent_at), to: String(r.to || ''), error: String(r.error || '') } : null
  } catch {
    return null
  }
}

/** resendQaAuditEmail verbatim: admin re-sends a dry/skipped/failed audit email (never a sent one silently). */
export async function resendQaAuditEmail(auditId: string, again: unknown): Promise<Row> {
  await qaRequireRole_(['admin'])
  await assertWritable()
  const id = String(auditId || '')
  const a = (await qaRows_('qa_audits')).filter((r) => r.audit_id === id && r.kind === 'audit')[0]
  if (!a) throw new Error('That audit was not found.')
  const last = await qaLastAuditMail_(id)
  if (last && last.status === 'sent' && !again) return { needsConfirm: true, mail: '', reason: '', error: '', last }
  const dir = await pwDirectory()
  const forms = qaForms_(await qaRows_('qa_forms'))
  const f = forms.byKey[String(a.form_id) + '|' + a.form_version]
  const lost = f ? qaLostQuestions_(f as never, qaParse_(a.answers_json, {}) as Record<string, string>).map((q) => q.text) : []
  const ctl = (await qaRows_('qa_ctls')).filter((c) => c.audit_id === id && c.status !== 'cancelled')[0] || null
  const view = Object.assign({}, a, { fatal: qaBool_(a.fatal) })
  const msg = qaAuditMail_(view, lost, String(a.comment || ''), dir.name(String(a.auditor_email)), ctl, dir as never, qaBool_(await qaSetting_('qa_audit_email_enabled'))) as never as { n: NotifyInput | null; skip: string }
  if (msg.skip) await qaLogMailSkip_('qa_audit', id, msg.skip)
  const out = msg.n ? await notify(msg.n, 'system:quality') : ({ mail: 'skipped' } as { mail: string; error?: string })
  return { needsConfirm: false, mail: out.mail, reason: msg.skip || '', error: (out as { error?: string }).error || '', last }
}

/** passQaQueueItem verbatim: the auditor passes a ticket (reason required); the engine replaces it. */
export async function passQaQueueItem(queueId: string, reason: string): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  const dir = await pwDirectory()
  if (!(await qaIsAuditor_(user, dir))) throw new Error('The Audit Desk is for quality auditors.')
  await assertWritable()
  const why = qaCleanPassReason_(reason)
  return qaTx_(async () => {
    const q = (await qaRows_('qa_queue')).filter((r) => r.queue_id === String(queueId))[0]
    if (!q) throw new Error('That queue item no longer exists. Reload the page.')
    if (q.source === 'request') throw new Error('A requested audit cannot be passed. Only an admin or Noha can waive it.')
    if (q.status === 'done') throw new Error('This ticket has been audited already.')
    if (q.status === 'passed') throw new Error('This ticket was passed already.')
    if (q.status === 'expired') throw new Error('This item is no longer in the queue. Reload the page.')
    if (qaTakenByOther_(q, user)) throw new Error('Another auditor is already auditing this ticket.')
    const now = qaNowIso_()
    let rep: Row | null = null
    let noRep = ''
    if (q.log_key && (await qaEngineLive_())) {
      const r = await qePassAndReplace_(String(q.log_key), String(q.queue_date), why, user.email, new Date(), String(q.ticket_id))
      rep = r.replacement
      noRep = r.reason
    } else if (!qaIsNonTicket_(q) && q.source !== 'offqueue') {
      noRep = 'replacements need the queue engine (qa_engine_live); the old app\'s queue is imported as it is'
    }
    q.status = 'passed'
    q.passed_by = user.email
    q.passed_at = now
    q.pass_reason = why
    const upd = [q]
    if (rep) {
      upd.push(
        qaQueueFields_(
          {
            queue_id: String(q.queue_date) + '|' + String(rep.ticketId) + '|' + normEmail(q.agent_email), queue_date: q.queue_date,
            ticket_id: String(rep.ticketId), agent_email: q.agent_email, agent_name: q.agent_name, tl_email: q.tl_email,
            auditor_email: q.auditor_email, status: 'open', started_at: '', audit_id: '', imported_at: now,
          },
          {
            channel: rep.channel, contact_type: rep.contactType, tier: String(rep.tier), log_key: rep.key, ticket_status: rep.status || '',
            interaction_at: qeFmt_(new Date(String(rep.interactionAt || '')), 'yyyy-MM-dd HH:mm'), action_at: qeFmt_(new Date(String(rep.actionAt || rep.lastTouch || '')), 'yyyy-MM-dd HH:mm'),
            agent_status: rep.agentStatus || '', agent_status_log: rep.statusLog || '',
          } as Row
        ) as Row
      )
      qaTimesAsText_(upd[1])
    }
    await qaUpsertIn_('qa_queue', ['queue_id'], upd)
    return { replaced: !!rep, ticketId: rep ? String(rep.ticketId) : '', channel: rep ? rep.channel : '', reason: noRep }
  })
}

// ---- Hand-added audits: request / off-queue / waive / non-ticket ----

/** qaTicketTarget_ verbatim: the ticket, its snapshot detail, the agent and channel. */
async function qaTicketTarget_(input: Row, dir: Directory): Promise<{ ticket: string; detail: Row; agent: DirectoryPerson; channel: string }> {
  const ticket = String(input.ticketId === undefined || input.ticketId === null ? '' : input.ticketId).trim().replace(/^#/, '')
  if (!/^\d{1,12}$/.test(ticket)) throw new Error('Enter the Freshdesk ticket number (digits only).')
  const chosenChannel = String(input.channel || '').trim()
  if (chosenChannel && (await qaChannels_()).indexOf(chosenChannel) === -1) throw new Error('Choose one of the audit channels.')
  const detail = (await qeHubTicketDetail_({ [ticket]: true }))[ticket]
  if (!detail) throw new Error('Ticket #' + ticket + ' is not in the Hub\'s Freshdesk snapshot. Check the number; a ticket created in the last few minutes appears after the next sync.')
  const people = qaImportablePeople_(dir)
  let agent: DirectoryPerson | null = null
  if (input.agentEmail) {
    agent = people.filter((p) => p.email === normEmail(input.agentEmail) && p.role !== 'tl')[0] || null
    if (!agent) throw new Error('That agent is not active on the roster.')
  } else if (detail.responderId) {
    const idx = qaAgentIndex_(people.map((p) => ({ email: p.email, name: p.name, tlEmail: p.tlEmail || undefined })), await qaHeadcount_())
    agent = (idx.byFdId[String(detail.responderId)] as unknown as DirectoryPerson) || null
  }
  if (!agent) throw new Error('Ticket #' + ticket + ' has no assigned agent on the roster. Choose the agent to audit.')
  const channel = chosenChannel || qeGroupToChannel_(await qeSettings_())[String(detail.groupName).toLowerCase()] || ''
  if (!channel) throw new Error('The ticket\'s group (' + (detail.groupName || 'none') + ') maps to no audit channel. Choose the channel.')
  return { ticket, detail: detail as Row, agent, channel }
}

/** qaTicketClash_ verbatim: refuses a ticket already audited or open in the queue. */
async function qaTicketClash_(ticket: string, dir: Directory): Promise<void> {
  const done = (await qaRows_('qa_audits')).filter((a) => String(a.ticket_id) === ticket && a.kind !== 'calibration')[0]
  if (done) throw new Error('Ticket #' + ticket + ' was audited already, on ' + String(done.audit_date).slice(0, 10) + ' by ' + dir.name(String(done.auditor_email)) + '.')
  const open = (await qaRows_('qa_queue')).filter((q) => String(q.ticket_id) === ticket && QA_REQUEST_OPEN.indexOf(String(q.status)) !== -1)[0]
  if (open && open.source === 'request') throw new Error('Ticket #' + ticket + ' was already requested by ' + dir.name(String(open.requested_by)) + ' on ' + String(open.requested_at).slice(0, 10) + '.')
  if (open && open.source === 'offqueue') throw new Error('Ticket #' + ticket + ' was already added off-queue by ' + dir.name(String(open.requested_by)) + ' on ' + String(open.requested_at).slice(0, 10) + '.')
  if (open) throw new Error('Ticket #' + ticket + ' is already in the audit queue (' + open.queue_date + ').')
}

/** requestQaAudit verbatim: TL/admin asks for a ticket audit. */
export async function requestQaAudit(input: Row): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl'])
  await assertWritable()
  input = input || {}
  const why = qaCleanReason_(input.reason, 'requesting this audit')
  const dir = await pwDirectory()
  const t = await qaTicketTarget_(input, dir)
  const row = await qaTx_(async () => {
    await qaTicketClash_(t.ticket, dir)
    const r = qaTicketQueueRow_(t, dir as never, 'QAR', 'request', user.email, qaNowIso_(), why, qaToday_(), newId)
    await qaUpsertIn_('qa_queue', ['queue_id'], [r])
    return r
  })
  return { queueId: row.queue_id, ticketId: t.ticket, agentName: row.agent_name, channel: t.channel }
}

/** createQaOffQueueAudit verbatim: an auditor adds a ticket to audit off-queue. */
export async function createQaOffQueueAudit(input: Row): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  await assertWritable()
  const dir = await pwDirectory()
  if (!(await qaIsAuditor_(user, dir))) throw new Error('Only quality auditors can audit a ticket off-queue.')
  input = input || {}
  const note = qaSquash_(input.note)
  if (note.length > 500) throw new Error('Keep the note under 500 characters.')
  const t = await qaTicketTarget_(input, dir)
  const row = await qaTx_(async () => {
    await qaTicketClash_(t.ticket, dir)
    const r = qaTicketQueueRow_(t, dir as never, 'QAO', 'offqueue', user.email, qaNowIso_(), note, qaToday_(), newId)
    await qaUpsertIn_('qa_queue', ['queue_id'], [r])
    return r
  })
  return { queueId: row.queue_id, ticketId: t.ticket, agentName: row.agent_name, channel: t.channel }
}

/** waiveQaAuditRequest verbatim: admin or qa_request_waiver_emails cancels a request. */
export async function waiveQaAuditRequest(queueId: string, reason: string): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  await assertWritable()
  if (!qaCanWaive_(user, await qaWaiverList_())) throw new Error('Only an admin or the team lead named in qa_request_waiver_emails can waive an audit request.')
  const why = qaCleanReason_(reason, 'waiving this request')
  return qaTx_(async () => {
    const q = (await qaRows_('qa_queue')).filter((r) => r.queue_id === String(queueId))[0]
    if (!q || q.source !== 'request') throw new Error('That audit request no longer exists. Reload the page.')
    if (q.status === 'done') throw new Error('This ticket has been audited already.')
    if (q.status === 'waived') throw new Error('This request was waived already.')
    q.status = 'waived'
    q.waived_by = user.email
    q.waived_at = qaNowIso_()
    q.waive_reason = why
    await qaUpsertIn_('qa_queue', ['queue_id'], [q])
    return { ticketId: String(q.ticket_id) }
  })
}

/** createQaNonTicketAudit verbatim: an auditor adds a non-ticket audit (cash refund, ...). */
export async function createQaNonTicketAudit(input: Row): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  await assertWritable()
  const dir = await pwDirectory()
  if (!(await qaIsAuditor_(user, dir))) throw new Error('Only quality auditors can add a non-ticket audit.')
  input = input || {}
  const want = qaSquash_(input.type).toLowerCase()
  const type = (await qaAuditTypes_()).filter((t) => t.toLowerCase() === want)[0]
  if (!type) throw new Error('Choose one of the audit types.')
  const ref = qaSquash_(input.reference)
  if (ref.length < 3) throw new Error('Enter the reference (at least 3 characters), e.g. the refund form row or the order number.')
  if (ref.length > 200) throw new Error('Keep the reference under 200 characters.')
  const note = qaSquash_(input.note)
  if (note.length > 500) throw new Error('Keep the note under 500 characters.')
  const agent = qaImportablePeople_(dir).filter((p) => p.email === normEmail(input.agentEmail) && p.role !== 'tl')[0]
  if (!agent) throw new Error('Choose the agent to audit (active on the roster).')
  const form = qaForms_(await qaRows_('qa_forms')).list.filter((f) => f.active && f.channel === type)[0]
  if (!form) throw new Error(type + ' has no active audit form. An admin adds one in Admin > Audit forms, with ' + type + ' as its audit type.')
  const row = await qaTx_(async () => {
    const clash = qaNonTicketClash_(await qaRows_('qa_queue'), type, ref)
    if (clash) throw new Error(type + ' "' + ref + '" is ' + (clash.status === 'done' ? 'audited already (' : 'already in the queue (') + String(clash.queue_date) + ').')
    const r = qaNonTicketRow_(type, ref, { email: agent.email, name: agent.name }, String(dir.managerOf(agent.email) || ''), note, user.email, 'manual', qaNowIso_(), qaToday_(), newId)
    await qaUpsertIn_('qa_queue', ['queue_id'], [r])
    return r
  })
  return { queueId: row.queue_id, ticketId: qaItemId_(row), agentName: row.agent_name, channel: type }
}

// =====================================================================
// Agent side: my audits + CTL confirm
// =====================================================================

/** getQaMyAuditsPage verbatim: the agent's audits with their CTL + the counted average. */
export async function getQaMyAuditsPage(): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  const dir = await pwDirectory()
  const forms = qaForms_(await qaRows_('qa_forms'))
  const today = qaToday_()
  const ctls = (await qaRows_('qa_ctls')).filter((c) => normEmail(c.agent_email) === user.email)
  const ctlBy: Record<string, Row> = {}
  ctls.forEach((c) => {
    if (c.status !== 'cancelled' || !ctlBy[String(c.audit_id)]) ctlBy[String(c.audit_id)] = c
  })
  const audits = (await qaRows_('qa_audits'))
    .filter((a) => a.kind === 'audit' && normEmail(a.agent_email) === user.email)
    .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))
    .slice(0, 80)
    .map((a) => {
      const v = qaAuditView_(a, forms, dir as never)
      const c = ctlBy[String(a.audit_id)]
      v.ctl = c
        ? {
            ctlId: String(c.ctl_id), status: String(c.status), dueDate: String(c.due_date), notes: String(c.coaching_notes || ''),
            action: String(c.action || ''), submittedAt: String(c.submitted_at || ''), confirmedAt: String(c.agent_confirmed_at || ''),
            outcome: String(c.outcome || ''), tlName: c.tl_email ? dir.name(String(c.tl_email)) : '',
          }
        : null
      return v
    })
  const counted = qaRollupAudits_(audits.map((v) => ({ kind: 'audit', status: v.status, score: v.score, score_final: v.finalScore })))
  const avg = counted.length ? qaRound1_(counted.reduce((s, a) => s + qaFinalScore_(a), 0) / counted.length) : null
  return { audits, average: avg, today }
}

/** confirmQaCtl verbatim: the agent confirms or denies the coaching session. */
export async function confirmQaCtl(ctlId: string, happened: unknown, note: string): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  await assertWritable()
  note = String(note || '').trim().slice(0, 1000)
  if (!happened && note.length < 5) throw new Error('Write your reason for denying, so Mohamed and the team leads can follow up.')
  const res = await qaTx_(async () => {
    const row = (await qaRows_('qa_ctls')).filter((r) => r.ctl_id === String(ctlId))[0]
    if (!row || normEmail(row.agent_email) !== user.email) throw new Error('That CTL was not found.')
    if (row.status !== 'submitted') throw new Error(row.status === 'open' ? 'Your team lead has not submitted this CTL yet.' : 'This CTL is already ' + String(row.status).replace('_', ' ') + '.')
    const now = qaNowIso_()
    let audit: Row | null = null
    row.agent_confirmed_at = now
    row.agent_note = note
    row.updated_at = now
    row.updated_by = user.email
    if (happened) {
      row.status = 'confirmed'
    } else {
      row.status = 'open'
      row.reopened_at = now
      row.reopen_count = (Number(row.reopen_count) || 0) + 1
      row.submitted_at = ''
      row.submitted_date = ''
      row.sla_met = ''
      if (row.outcome !== 'dispute') {
        row.outcome = ''
        audit = (await qaRows_('qa_audits')).filter((r) => r.audit_id === row.audit_id)[0] || null
        if (audit && audit.status === 'acknowledged' && audit.ack_by === 'ctl') {
          audit.status = 'submitted'
          audit.acknowledged_at = ''
          audit.ack_by = ''
          audit.updated_at = now
          audit.updated_by = user.email
          await qaUpsertIn_('qa_audits', ['audit_id'], [audit])
        }
      }
    }
    await qaUpsertIn_('qa_ctls', ['ctl_id'], [row])
    const a = audit || (await qaRows_('qa_audits')).filter((r) => r.audit_id === row.audit_id)[0] || ({} as Row)
    return { c: row, item: qaItemRef_(a) }
  })
  const c = res.c
  await resolvePopups('qa_ctl_confirm', String(c.ctl_id), user.email)
  if (!happened) {
    const dir = await pwDirectory()
    const others = qaCtlDenyRecipients_(await qaDisputeOwner_(), dir.tls().map((p) => p.email)).filter((e) => e !== normEmail(c.tl_email))
    const tlName = dir.name(String(c.tl_email))
    await notify(
      {
        to: String(c.tl_email), cc: others, kind: 'qa_ctl_not_confirmed', ref: String(c.ctl_id),
        subject: 'CTL denied: ' + user.name + ' says the CTL with ' + tlName + ' did not happen',
        intro: user.name + ' says the CTL for the audit of ' + res.item + ' did not happen. It is open again in ' + tlName + '\'s CTL queue.',
        facts: [
          ['Their reason', note], ['Team lead', tlName], ['Was due', c.due_date],
          ['Outcome kept', c.outcome === 'dispute' ? 'Dispute (the dispute stays as raised)' : ''],
        ],
        where: 'Quality > CTLs',
        popups: [
          { recipient: normEmail(c.tl_email), kind: 'qa_ctl_due', ref: String(c.ctl_id), title: 'Open CTL: ' + user.name, body: 'Go through the audit of ' + res.item + ' with ' + user.name + ' and submit the CTL by ' + c.due_date + '.', link: '#/ctls' },
          ...others.map((e) => ({ recipient: e, kind: 'qa_ctl_denied', ref: String(c.ctl_id), title: 'CTL denied: ' + user.name, body: user.name + ' says the CTL with ' + tlName + ' on ' + res.item + ' did not happen: "' + note.slice(0, 160) + '"', link: '#/ctls' })),
        ],
      },
      user.email
    )
  }
  return { ctlId: String(c.ctl_id), status: String(c.status) }
}

// =====================================================================
// CTLs (team leads)
// =====================================================================

/** getQaCtlPage verbatim: the TL's CTL desk (open + recent + SLA). */
export async function getQaCtlPage(): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl'])
  const dir = await pwDirectory()
  const forms = qaForms_(await qaRows_('qa_forms'))
  const today = qaToday_()
  const auditsBy: Record<string, Row> = {}
  ;(await qaRows_('qa_audits')).forEach((a) => {
    auditsBy[String(a.audit_id)] = a
  })
  const disputesBy: Record<string, Row> = {}
  ;(await qaRows_('qa_disputes')).forEach((d) => {
    disputesBy[String(d.dispute_id)] = d
  })
  const all = await qaRows_('qa_ctls')
  const mine = all.filter((c) => qaCtlVisibleTo_(c, user))
  const rows = mine
    .filter((c) => c.status !== 'cancelled' && (c.status === 'open' || c.status === 'on_hold' || String(c.opened_date) >= dqAddDays_(today, -45)))
    .map((c) => {
      const a = auditsBy[String(c.audit_id)]
      const d = c.dispute_id ? disputesBy[String(c.dispute_id)] : null
      return {
        ctlId: String(c.ctl_id), auditId: String(c.audit_id), status: String(c.status), dueDate: String(c.due_date), openedDate: String(c.opened_date),
        overdue: c.status === 'open' && String(c.due_date) < today, dueToday: c.status === 'open' && String(c.due_date) === today,
        agentName: dir.name(String(c.agent_email)), tlName: dir.name(String(c.tl_email)), closedBy: c.closed_by ? dir.name(String(c.closed_by)) : '',
        own: normEmail(c.tl_email) === user.email, notes: String(c.coaching_notes || ''), action: String(c.action || ''),
        submittedDate: String(c.submitted_date || ''), submittedAt: String(c.submitted_at || ''), slaMet: c.sla_met === '' || c.sla_met === null || c.sla_met === undefined ? null : qaBool_(c.sla_met),
        agentNote: String(c.agent_note || ''), outcome: String(c.outcome || ''), reopenCount: Number(c.reopen_count) || 0,
        dispute: d ? { disputeId: String(d.dispute_id), status: String(d.status), reason: String(d.reason || '') } : null,
        audit: a ? qaAuditView_(a, forms, dir as never) : null,
      }
    })
    .sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || String(a.dueDate).localeCompare(String(b.dueDate)))
  const month = today.slice(0, 7)
  const sla = qaCtlSla_(all, month, today) as Record<string, { total: number; due: number; onTime: number; done: number; slaPct: number | null; donePct: number | null }>
  const slaRows = Object.keys(sla)
    .filter((k) => user.role === 'admin' || k === user.email)
    .map((k) => {
      const s = sla[k]
      return { tlEmail: k, tlName: dir.name(k), total: s.total, due: s.due, onTime: s.onTime, done: s.done, slaPct: s.slaPct, donePct: s.donePct }
    })
  return { today, month, rows, sla: slaRows, slaTarget: Number(await qaSetting_('qa_ctl_sla_target')), ticketUrl: await qaTicketUrl_(), isAdmin: user.role === 'admin' }
}

/** submitQaCtl verbatim: the TL closes a CTL with an outcome + notes. */
export async function submitQaCtl(input: Row): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl'])
  await assertWritable()
  input = input || {}
  let outcome = String(input.outcome || '')
  const notes = String(input.notes || '').trim().slice(0, 3000)
  const action = String(input.action || '').trim().slice(0, 200)
  const reason = String(input.reason || '').trim().slice(0, 2000)
  if (outcome !== 'acknowledged' && outcome !== 'dispute') throw new Error('Choose the outcome: Acknowledged or Dispute.')
  if (notes.length < 10) throw new Error('Write the coaching notes: what you went through with the agent.')
  if (!action) throw new Error('Choose the action taken.')
  const today = qaToday_()
  const onShift = user.role === 'tl' ? await qaOnShiftNow_() : []
  const res = await qaTx_(async () => {
    const ctls = await qaRows_('qa_ctls')
    const auditsBy: Record<string, Row> = {}
    ;(await qaRows_('qa_audits')).forEach((a) => {
      auditsBy[String(a.audit_id)] = a
    })
    let row: Row
    if (input.ctlId) {
      row = ctls.filter((r) => r.ctl_id === String(input.ctlId))[0]
      if (!row) throw new Error('That CTL was not found.')
    } else {
      const hits = qaFindOpenCtls_(ctls, auditsBy, input.ref, user, onShift)
      if (!hits.length) throw new Error('No open CTL of yours for "' + String(input.ref || '').trim() + '". Check the ticket number or audit ID.')
      if (hits.length > 1) throw new Error('Ticket ' + String(input.ref).trim() + ' has ' + hits.length + ' open CTLs: choose one in the list.')
      row = hits[0]
    }
    const dirN = await pwDirectory()
    if (!qaCanCloseCtl_(row, user, onShift)) throw new Error('This CTL belongs to ' + dirN.name(String(row.tl_email)) + '; you can close it only while you are on shift.')
    if (row.status !== 'open') throw new Error(row.status === 'on_hold' ? 'The audit is under dispute; the CTL reopens when the dispute is decided.' : 'This CTL is already ' + String(row.status).replace('_', ' ') + '.')
    const a = auditsBy[String(row.audit_id)]
    if (!a) throw new Error('The audit of this CTL is missing.')
    const now = qaNowIso_()
    let dispute: Row | null = null
    let auditChanged = false
    const keptDispute = row.outcome === 'dispute' && !!row.dispute_id
    if (keptDispute) {
      outcome = 'dispute'
    } else if (outcome === 'dispute') {
      if (reason.length < 10) throw new Error('Write the agent\'s case for the dispute: which question, and what the ticket shows.')
      if (a.status !== 'submitted') throw new Error('This audit is ' + String(a.status).replace('_', ' ') + ' and can no longer be disputed. Submit it as Acknowledged.')
      dispute = {
        dispute_id: newId('DSP'), audit_id: a.audit_id, agent_email: normEmail(a.agent_email), auditor_email: normEmail(a.auditor_email),
        tl_email: normEmail(row.tl_email), reason, raised_at: now, status: 'open', decision: '', decision_note: '', old_score: a.score, new_score: '',
        decided_by: '', decided_at: '', audit_month: String(a.audit_date).slice(0, 7), raised_by: user.email, raised_date: today,
        escalated_by: '', escalated_at: '', escalation_note: '',
      }
      await qaUpsertIn_('qa_disputes', ['dispute_id'], [dispute])
      a.status = 'disputed'
      row.dispute_id = dispute.dispute_id
      auditChanged = true
    } else if (a.status === 'submitted') {
      a.status = 'acknowledged'
      a.acknowledged_at = now
      a.ack_by = 'ctl'
      auditChanged = true
    }
    if (auditChanged) {
      a.updated_at = now
      a.updated_by = user.email
      await qaUpsertIn_('qa_audits', ['audit_id'], [a])
    }
    row.status = 'submitted'
    row.outcome = outcome
    row.coaching_notes = notes
    row.action = action
    row.submitted_at = now
    row.submitted_date = today
    row.sla_met = today <= String(row.due_date)
    row.closed_by = user.email
    row.updated_at = now
    row.updated_by = user.email
    await qaUpsertIn_('qa_ctls', ['ctl_id'], [row])
    return { c: row, a, dispute }
  })
  const c = res.c
  const a = res.a
  const dir = await pwDirectory()
  const agentName = dir.name(String(c.agent_email))
  await resolvePopups('qa_ctl_due', String(c.ctl_id), user.email)
  await resolvePopups('qa_ctl_denied', String(c.ctl_id), user.email)
  await notify(
    {
      to: [c.agent_email, c.tl_email, c.closed_by].map((e) => normEmail(e)).filter(Boolean), kind: 'qa_ctl', ref: String(c.ctl_id),
      subject: 'CTL completed: ' + agentName + ', ' + qaItemRef_(a),
      intro: user.name + ' completed the CTL (close the loop) on the quality audit of ' + qaItemRef_(a) + ' with ' + agentName + '.',
      facts: [
        ['Outcome', outcome === 'dispute' ? 'Dispute: it goes to the weekly Quality and team-lead meeting' : 'Acknowledged'],
        ['Action taken', action], ['Coaching notes', notes], ["Agent's case", res.dispute ? reason : ''], ['Submitted', c.submitted_date],
        ['Owner / closed by', normEmail(c.closed_by) !== normEmail(c.tl_email) ? dir.name(String(c.tl_email)) + ' / ' + dir.name(String(c.closed_by)) : ''],
      ],
      outro: agentName + ': confirm in Quality > My audits (To confirm) that this session happened, or deny it with your reason.',
      where: 'Quality > My audits',
      popups: [{ recipient: normEmail(c.agent_email), kind: 'qa_ctl_confirm', ref: String(c.ctl_id), title: 'Confirm your coaching session', body: user.name + ' logged a CTL with you: ' + action + '. Confirm it happened.', link: '#/my-audits' }],
    },
    user.email
  )
  if (res.dispute) {
    const owner = await qaDisputeOwner_()
    await notify(
      {
        to: owner, cc: [String(res.dispute.auditor_email)], kind: 'qa_dispute', ref: String(res.dispute.dispute_id),
        subject: 'Audit dispute: ' + qaItemRef_(a) + ' (' + agentName + ')',
        intro: user.name + ' raised a dispute on the audit of ' + qaItemRef_(a) + ' (' + a.score + '%) after the CTL with ' + agentName + '.',
        facts: [["Agent's case", reason], ['Auditor', dir.name(String(a.auditor_email))]],
        outro: 'It goes to the weekly Quality and team-lead meeting. The audit counts in no score until it is decided.',
        where: 'Quality > Disputes',
      },
      user.email
    )
  }
  return { ctlId: String(c.ctl_id), status: 'submitted', outcome, slaMet: c.sla_met === true, disputeId: res.dispute ? res.dispute.dispute_id : '' }
}

// =====================================================================
// Disputes
// =====================================================================

/** qaDisputeAccess_ verbatim: TLs, admins and the owner record outcomes. */
async function qaDisputeAccess_(): Promise<{ user: QaUser; owner: string; isOwner: boolean }> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  const owner = await qaDisputeOwner_()
  const isOwner = user.email === owner
  if (!isOwner && user.role !== 'admin' && user.role !== 'tl') throw new Error('Disputes are recorded by team leads and ' + owner + '.')
  return { user, owner, isOwner }
}

/** getQaDisputesPage verbatim: open + escalated + recently decided disputes with audit views. */
export async function getQaDisputesPage(): Promise<Row> {
  const acc = await qaDisputeAccess_()
  const dir = await pwDirectory()
  const forms = qaForms_(await qaRows_('qa_forms'))
  const audits = await qaRows_('qa_audits')
  const disputes = await qaRows_('qa_disputes')
  const auditsBy: Record<string, Row> = {}
  audits.forEach((a) => {
    auditsBy[String(a.audit_id)] = a
  })
  const since = dqAddDays_(qaToday_(), -60)
  const who = (e: unknown) => (e ? dir.name(String(e)) : '')
  const rows = disputes
    .filter((d) => d.status === 'open' || d.status === 'escalated' || String(d.decided_at).slice(0, 10) >= since)
    .map((d) => {
      const a = auditsBy[String(d.audit_id)]
      const view = a ? qaAuditView_(a, forms, dir as never) : null
      const form = a ? forms.byKey[String(a.form_id) + '|' + a.form_version] : null
      return {
        disputeId: String(d.dispute_id), status: String(d.status), reason: String(d.reason), raisedAt: String(d.raised_at),
        raisedByName: who(d.raised_by) || who(d.agent_email), agentName: dir.name(String(d.agent_email)), auditorName: dir.name(String(d.auditor_email)), tlName: who(d.tl_email),
        decision: String(d.decision || ''), decisionNote: String(d.decision_note || ''), oldScore: Number(d.old_score),
        newScore: d.new_score === '' || d.new_score === null || d.new_score === undefined ? null : Number(d.new_score), decidedAt: String(d.decided_at || ''), decidedByName: who(d.decided_by),
        escalatedByName: who(d.escalated_by), escalatedAt: String(d.escalated_at || ''), escalationNote: String(d.escalation_note || ''),
        audit: view, questions: form ? qaQuestions_(form as never) : [],
      }
    })
    .sort((x, y) => {
      const w = (r: { status: string }) => (r.status === 'escalated' ? 2 : r.status === 'open' ? 1 : 0)
      return w(y) - w(x) || String(y.raisedAt).localeCompare(String(x.raisedAt))
    })
  const month = qaToday_().slice(0, 7)
  const stats = qaDisputeStats_(audits, disputes, month) as Record<string, { audits: number; disputes: number; upheld: number; open: number; disputePct?: number | null }>
  return {
    rows, month, target: Number(await qaSetting_('qa_dispute_pass_target')), ticketUrl: await qaTicketUrl_(),
    isOwner: acc.isOwner, ownerName: dir.name(acc.owner),
    auditors: Object.keys(stats).map((k) => {
      const s = stats[k]
      return { auditorEmail: k, auditorName: dir.name(k), audits: s.audits, disputes: s.disputes, upheld: s.upheld, open: s.open, disputePct: s.disputePct }
    }),
  }
}

/** decideQaDispute verbatim: record the meeting outcome; uphold (void|rescore), reject, or escalate. */
export async function decideQaDispute(input: Row): Promise<Row> {
  const acc = await qaDisputeAccess_()
  const user = acc.user
  await assertWritable()
  input = input || {}
  const decision = String(input.decision || '')
  if (['void', 'rescore', 'reject', 'escalate'].indexOf(decision) === -1) throw new Error('Choose uphold (void or re-score), reject, or escalate.')
  if (decision === 'escalate' && acc.isOwner) throw new Error('You are the dispute owner: decide it.')
  const dir0 = await pwDirectory()
  const note = String(input.note || '').trim().slice(0, 2000)
  if (note.length < 5) throw new Error(decision === 'escalate' ? 'Write where the meeting did not align, for ' + dir0.name(acc.owner) + '.' : 'Write a note: the agent, auditor and team lead all receive it.')
  let newScore: number | null = null
  if (decision === 'rescore') {
    newScore = Number(input.newScore)
    if (input.newScore === '' || input.newScore === null || input.newScore === undefined || !isFinite(newScore) || newScore < 0 || newScore > 100) throw new Error('Enter the new score, 0 to 100.')
    newScore = qaRound1_(newScore)
  }
  const today = qaToday_()
  const res = await qaTx_(async () => {
    const d = (await qaRows_('qa_disputes')).filter((r) => r.dispute_id === String(input.disputeId))[0]
    if (!d) throw new Error('That dispute was not found.')
    if (d.status !== 'open' && d.status !== 'escalated') throw new Error('This dispute was decided already.')
    if (d.status === 'escalated' && !acc.isOwner) throw new Error('This dispute was escalated: only ' + acc.owner + ' decides it.')
    if (decision === 'escalate' && d.status !== 'open') throw new Error('This dispute is escalated already.')
    const a = (await qaRows_('qa_audits')).filter((r) => r.audit_id === d.audit_id)[0]
    if (!a) throw new Error('The disputed audit is missing.')
    const now = qaNowIso_()
    if (decision === 'escalate') {
      d.status = 'escalated'
      d.escalated_by = user.email
      d.escalated_at = now
      d.escalation_note = note
      await qaUpsertIn_('qa_disputes', ['dispute_id'], [d])
      return { d, a, ctl: null }
    }
    d.status = decision === 'reject' ? 'rejected' : 'upheld'
    d.decision = decision
    d.decision_note = note
    d.new_score = newScore === null ? '' : newScore
    d.decided_by = user.email
    d.decided_at = now
    await qaUpsertIn_('qa_disputes', ['dispute_id'], [d])
    a.status = decision === 'void' ? 'voided' : decision === 'rescore' ? 'rescored' : 'dispute_rejected'
    if (decision === 'rescore') a.score_final = newScore
    a.updated_at = now
    a.updated_by = user.email
    await qaUpsertIn_('qa_audits', ['audit_id'], [a])
    const c = (await qaRows_('qa_ctls')).filter((r) => r.audit_id === a.audit_id && r.status === 'on_hold')[0]
    if (c) {
      if (decision === 'void') {
        c.status = 'cancelled'
      } else {
        c.status = 'open'
        c.opened_date = today
        c.due_date = qaCtlDue_(today, await qaWorkingFn_(String(c.tl_email), today), (await qaNumSetting_('qa_ctl_days')) || 2, (await qaNumSetting_('qa_ctl_days_over_weekend')) || 3)
      }
      c.updated_at = now
      c.updated_by = user.email
      await qaUpsertIn_('qa_ctls', ['ctl_id'], [c])
    }
    return { d, a, ctl: c || null }
  })
  const dir = await pwDirectory()
  if (decision === 'escalate') {
    await notify(
      {
        to: acc.owner, kind: 'qa_dispute_escalated', ref: String(res.d.dispute_id),
        subject: 'Dispute escalated to you: ' + qaItemRef_(res.a),
        intro: user.name + ' recorded that the weekly meeting did not align on the dispute of ' + qaItemRef_(res.a) + ' (' + res.a.score + '%). You decide it.',
        facts: [['Not aligned on', note], ["Agent's case", res.d.reason], ['Agent', dir.name(String(res.d.agent_email))], ['Auditor', dir.name(String(res.d.auditor_email))]],
        where: 'Quality > Disputes',
        popups: [{ recipient: acc.owner, kind: 'qa_dispute_escalated', ref: String(res.d.dispute_id), title: 'Dispute escalated to you', body: qaItemTag_(res.a) + ', ' + dir.name(String(res.d.agent_email)) + ': ' + note.slice(0, 200), link: '#/disputes' }],
      },
      user.email
    )
    return { disputeId: String(res.d.dispute_id), status: 'escalated', auditStatus: String(res.a.status) }
  }
  await resolvePopups('qa_dispute', String(res.d.dispute_id), user.email)
  await resolvePopups('qa_dispute_escalated', String(res.d.dispute_id), user.email)
  if (res.ctl && res.ctl.status === 'open') {
    await notify({ to: [], subject: '', popups: [{ recipient: normEmail(res.ctl.tl_email), kind: 'qa_ctl_due', ref: String(res.ctl.ctl_id), title: 'Open CTL: ' + dir.name(String(res.ctl.agent_email)), body: 'Go through the audit of ' + qaItemRef_(res.a) + ' with ' + dir.name(String(res.ctl.agent_email)) + ' and submit the CTL by ' + res.ctl.due_date + '.', link: '#/ctls' }] } as unknown as NotifyInput, user.email)
  }
  const words: Record<string, string> = { void: 'upheld: the audit is void and counts nowhere', rescore: 'upheld: the audit is re-scored to ' + newScore + '%', reject: 'rejected: the audit stands at ' + res.a.score + '%' }
  await notify(
    {
      to: String(res.d.agent_email), cc: [res.d.auditor_email, res.d.tl_email].map((e) => normEmail(e)).filter(Boolean), kind: 'qa_dispute_decided', ref: String(res.d.dispute_id),
      subject: 'Dispute decided: ' + qaItemRef_(res.a),
      intro: 'The dispute on the audit of ' + qaItemRef_(res.a) + ' was ' + words[decision] + '.',
      facts: [['Note', note], ['Recorded by', user.name], ['CTL due', res.ctl && res.ctl.status === 'open' ? res.ctl.due_date : '']],
      where: 'Quality > My audits',
    },
    user.email
  )
  return { disputeId: String(res.d.dispute_id), status: String(res.d.status), auditStatus: String(res.a.status) }
}

// =====================================================================
// Calibration
// =====================================================================

/** getQaCalibrationPage verbatim: sessions + the caller's part + the alignment trend. */
export async function getQaCalibrationPage(): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  const dir = await pwDirectory()
  const auditors = await qaAuditors_(dir)
  const isAud = await qaIsAuditor_(user, dir)
  if (user.role === 'agent' && !isAud) throw new Error('Calibration is for auditors, team leads and admins.')
  const forms = qaForms_(await qaRows_('qa_forms'))
  const cals = await qaRows_('qa_calibrations')
  const auditsBy: Record<string, Row> = {}
  ;(await qaRows_('qa_audits')).forEach((a) => {
    if (a.kind === 'calibration') auditsBy[String(a.audit_id)] = a
  })
  const view = (c: Row): Row => {
    const done = c.status === 'done'
    const mineAs = normEmail(c.auditor_email) === user.email ? 'auditor' : normEmail(c.tl_email) === user.email ? 'tl' : ''
    const canSeeResult = done && (user.role !== 'agent' || mineAs === 'auditor')
    const aud = auditsBy[String(c.auditor_audit_id)]
    const ref = auditsBy[String(c.tl_audit_id)]
    const form = forms.byKey[String(c.form_id) + '|' + c.form_version]
    return {
      calibrationId: String(c.calibration_id), ticketId: String(c.ticket_id), channel: String(c.channel), status: String(c.status),
      auditorEmail: String(c.auditor_email), auditorName: dir.name(String(c.auditor_email)), tlEmail: String(c.tl_email), tlName: dir.name(String(c.tl_email)),
      createdAt: String(c.created_at), month: String(c.month || ''), formId: String(c.form_id), formVersion: Number(c.form_version), mineAs,
      myPart: mineAs === 'auditor' ? !c.auditor_audit_id : mineAs === 'tl' ? !c.tl_audit_id : false,
      alignmentPct: canSeeResult && c.alignment_pct !== '' && c.alignment_pct !== null ? Number(c.alignment_pct) : null,
      auditorAnswers: canSeeResult && aud ? (qaParse_(aud.answers_json, {}) as Row) : null,
      referenceAnswers: canSeeResult && ref ? (qaParse_(ref.answers_json, {}) as Row) : null,
      auditorScore: canSeeResult && aud ? Number(aud.score) : null,
      referenceScore: canSeeResult && ref ? Number(ref.score) : null,
      questions: canSeeResult && form ? qaQuestions_(form as never) : [],
    }
  }
  const visible = cals
    .filter((c) => user.role !== 'agent' || normEmail(c.auditor_email) === user.email)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 150)
    .map(view)
  const trend: Record<string, { auditorEmail: string; month: string; sum: number; n: number }> = {}
  cals.forEach((c) => {
    if (c.status !== 'done' || c.alignment_pct === '' || c.alignment_pct === null) return
    if (user.role === 'agent' && normEmail(c.auditor_email) !== user.email) return
    const k = normEmail(c.auditor_email) + '|' + String(c.month)
    const t = (trend[k] = trend[k] || { auditorEmail: normEmail(c.auditor_email), month: String(c.month), sum: 0, n: 0 })
    t.sum += Number(c.alignment_pct)
    t.n++
  })
  const people = Object.keys(dir.by).map((k) => dir.by[k]).filter((p) => p.active)
  return {
    calibrations: visible, forms: forms.list.filter((f) => f.active), canAssign: user.role !== 'agent',
    target: Number(await qaSetting_('qa_alignment_target')), ticketUrl: await qaTicketUrl_(),
    auditors: auditors.map((e) => ({ email: e, name: dir.name(e) })),
    tls: people.filter((p) => p.role === 'tl' || p.role === 'admin').map((p) => ({ email: p.email, name: p.name })),
    agents: people.filter((p) => p.role === 'agent').map((p) => ({ email: p.email, name: p.name })),
    trend: Object.keys(trend)
      .map((k) => {
        const t = trend[k]
        return { auditorEmail: t.auditorEmail, auditorName: dir.name(t.auditorEmail), month: t.month, alignmentPct: qaRound1_(t.sum / t.n), cases: t.n }
      })
      .sort((a, b) => a.month.localeCompare(b.month)),
  }
}

/** createQaCalibration verbatim: admin/TL assigns a blind calibration. */
export async function createQaCalibration(input: Row): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl'])
  await assertWritable()
  input = input || {}
  const dir = await pwDirectory()
  const ticket = String(input.ticketId || '').replace(/[^0-9]/g, '')
  if (!ticket) throw new Error('Enter the Freshdesk ticket number.')
  const channel = String(input.channel || '').trim()
  if (!channel) throw new Error('Choose the channel.')
  const auditor = normEmail(input.auditorEmail)
  if ((await qaAuditors_(dir)).indexOf(auditor) === -1) throw new Error('Choose an auditor from the list.')
  const tl = normEmail(input.tlEmail)
  const tlp = dir.person(tl)
  if (!tlp || (tlp.role !== 'tl' && tlp.role !== 'admin')) throw new Error('Choose the team lead who gives the reference audit.')
  if (tl === auditor) throw new Error('The reference must be a different person from the auditor.')
  const form = qaForms_(await qaRows_('qa_forms')).forChannel(channel)
  if (!form) throw new Error('No active audit form for ' + channel + '. Add one in Audit forms.')
  const today = qaToday_()
  const row: Row = {
    calibration_id: newId('CAL'), ticket_id: ticket, channel, agent_email: normEmail(input.agentEmail || ''),
    form_id: form.formId, form_version: form.version, auditor_email: auditor, tl_email: tl, created_by: user.email, created_at: qaNowIso_(),
    status: 'open', auditor_audit_id: '', tl_audit_id: '', alignment_pct: '', month: today.slice(0, 7), completed_at: '',
  }
  await qaTx_(async () => {
    await qaUpsertIn_('qa_calibrations', ['calibration_id'], [row])
  })
  for (const e of [auditor, tl]) {
    await notify(
      {
        to: e, kind: 'qa_calibration', ref: String(row.calibration_id), subject: 'Calibration audit: ticket #' + ticket,
        intro: user.name + ' asked you to audit ticket #' + ticket + ' for calibration. Audit it on your own: you will not see the other audit until both are in.',
        where: 'Quality > Calibration',
      },
      user.email
    )
  }
  return { calibrationId: row.calibration_id }
}

/** submitQaCalibrationAudit verbatim: an assigned blind score, once each. */
export async function submitQaCalibrationAudit(input: Row): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  await assertWritable()
  input = input || {}
  const forms = qaForms_(await qaRows_('qa_forms'))
  const res = await qaTx_(async () => {
    const c = (await qaRows_('qa_calibrations')).filter((r) => r.calibration_id === String(input.calibrationId))[0]
    if (!c) throw new Error('That calibration was not found.')
    const role = normEmail(c.auditor_email) === user.email ? 'auditor' : normEmail(c.tl_email) === user.email ? 'tl' : ''
    if (!role) throw new Error('This calibration is assigned to someone else.')
    if ((role === 'auditor' && c.auditor_audit_id) || (role === 'tl' && c.tl_audit_id)) throw new Error('You have submitted your audit for this calibration.')
    const scored = qaScoreSubmission_(forms, c.form_id, c.form_version, (input.answers || {}) as Record<string, string>)
    const interactionAt = qaCleanInteractionAt_(input.interactionAt)
    const now = qaNowIso_()
    const a: Row = {
      audit_id: newId('QA'), kind: 'calibration', queue_id: '', calibration_id: c.calibration_id, ticket_id: c.ticket_id,
      agent_email: c.agent_email || '', tl_email: '', auditor_email: user.email, channel: c.channel, contact_type: '', form_id: c.form_id,
      form_version: c.form_version, answers_json: JSON.stringify(scored.answers), comment: String(input.comment || '').slice(0, 2000),
      score: scored.result.score, fatal: scored.result.fatal, score_final: '', started_at: String(input.startedAt || now), submitted_at: now,
      audit_date: qaToday_(), status: 'calibration', ack_due_date: '', acknowledged_at: '', ack_by: '', updated_at: now, updated_by: user.email,
      interaction_at: interactionAt,
    }
    await qaUpsertIn_('qa_audits', ['audit_id'], [a])
    if (role === 'auditor') c.auditor_audit_id = a.audit_id
    else c.tl_audit_id = a.audit_id
    if (c.auditor_audit_id && c.tl_audit_id) {
      const other = (await qaRows_('qa_audits')).filter((r) => r.audit_id === (role === 'auditor' ? c.tl_audit_id : c.auditor_audit_id))[0]
      const mine = scored.answers
      const theirs = qaParse_(other && other.answers_json, {}) as Record<string, string>
      c.alignment_pct = qaAlignment_(scored.form as never, role === 'auditor' ? mine : theirs, role === 'auditor' ? theirs : mine)
      c.status = 'done'
      c.completed_at = now
    }
    await qaUpsertIn_('qa_calibrations', ['calibration_id'], [c])
    return c
  })
  return { calibrationId: String(res.calibration_id), status: String(res.status), alignmentPct: res.status === 'done' ? Number(res.alignment_pct) : null }
}

// =====================================================================
// KB gaps
// =====================================================================

/** getQaKbGapsPage verbatim: auditor entry + the tracker list. */
export async function getQaKbGapsPage(): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  const dir = await pwDirectory()
  const isAud = await qaIsAuditor_(user, dir)
  const isEditor = await qaIsKbEditor_(user)
  if (user.role === 'agent' && !isAud && !isEditor) throw new Error('The KB-gaps tracker is for auditors, team leads, admins and the people who update the knowledge base.')
  const since = dqAddDays_(qaToday_(), -14)
  const myAudits = isAud
    ? (await qaRows_('qa_audits'))
        .filter((a) => a.kind === 'audit' && normEmail(a.auditor_email) === user.email && String(a.audit_date) >= since)
        .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))
        .map((a) => ({ auditId: String(a.audit_id), ticketId: qaItemId_(a), agentName: dir.name(String(a.agent_email)), auditDate: String(a.audit_date), score: Number(a.score) }))
    : []
  const gaps = (await qaRows_('qa_kb_gaps'))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 300)
    .map((g) => ({
      gapId: String(g.gap_id), auditId: String(g.audit_id), ticketId: String(g.ticket_id), auditorName: dir.name(String(g.auditor_email)),
      topic: String(g.topic), description: String(g.description), suggestion: String(g.suggestion || ''), createdDate: String(g.created_date),
      auditDate: String(g.audit_date), sameDay: qaBool_(g.same_day), status: String(g.status || 'open'),
      addedByName: g.added_by ? dir.name(String(g.added_by)) : '', addedAt: String(g.added_at || ''),
    }))
  return { canAdd: isAud, canMarkAdded: isEditor, myAudits, gaps, ticketUrl: await qaTicketUrl_() }
}

/** addQaKbGap verbatim: an auditor logs a KB gap on one of their audits. */
export async function addQaKbGap(input: Row): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  await assertWritable()
  input = input || {}
  if (!(await qaIsAuditor_(user, await pwDirectory()))) throw new Error('Only auditors add KB gaps.')
  const topic = String(input.topic || '').trim().slice(0, 120)
  const description = String(input.description || '').trim().slice(0, 2000)
  if (!topic) throw new Error('Choose the type of gap.')
  if (description.length < 10) throw new Error('Describe the gap: what was missing or wrong in the knowledge base.')
  const today = qaToday_()
  const g = await qaTx_(async () => {
    const a = (await qaRows_('qa_audits')).filter((r) => r.audit_id === String(input.auditId))[0]
    if (!a || a.kind !== 'audit') throw new Error('Choose the audit this gap came from.')
    if (user.role !== 'admin' && normEmail(a.auditor_email) !== user.email) throw new Error('Link the gap to one of your own audits.')
    const row: Row = {
      gap_id: newId('KB'), audit_id: a.audit_id, ticket_id: qaItemId_(a), auditor_email: user.email, topic, description,
      suggestion: String(input.suggestion || '').trim().slice(0, 1000), created_at: qaNowIso_(), created_date: today, audit_date: String(a.audit_date),
      same_day: today === String(a.audit_date), status: 'open', added_by: '', added_at: '',
    }
    await qaUpsertIn_('qa_kb_gaps', ['gap_id'], [row])
    return row
  })
  const list = await qaKbNotifyList_()
  if (list.length) {
    await notify(
      {
        to: list, kind: 'qa_kb_gap', ref: String(g.gap_id), subject: 'KB gap: ' + topic + ' (' + qaKbItem_(g, 'ticket #') + ')',
        intro: user.name + ' found a knowledge-base gap while auditing ' + qaKbItem_(g, 'ticket #') + '.',
        facts: [['Type', topic], ['Gap', description], ['Audited', qaKbItem_(g, '#')], ['Logged', g.created_date]],
        outro: 'Add it to the knowledge base, then mark it "Added to KB".',
        where: 'Quality > KB gaps',
      },
      user.email
    )
  }
  return { gapId: g.gap_id, sameDay: g.same_day, notified: list.length }
}

/** markQaKbGapAdded verbatim: a KB editor marks the gap added. */
export async function markQaKbGapAdded(gapId: string): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  await assertWritable()
  if (!(await qaIsKbEditor_(user))) throw new Error('Only the people on the KB update list (qa_kb_notify_emails) mark gaps added.')
  return qaTx_(async () => {
    const g = (await qaRows_('qa_kb_gaps')).filter((r) => r.gap_id === String(gapId))[0]
    if (!g) throw new Error('That KB gap was not found.')
    if (g.status === 'added') throw new Error('This gap is already marked added.')
    g.status = 'added'
    g.added_by = user.email
    g.added_at = qaNowIso_()
    await qaUpsertIn_('qa_kb_gaps', ['gap_id'], [g])
    return { gapId: String(g.gap_id), status: 'added' }
  })
}

// =====================================================================
// Auditor KPIs / scores / analytics / coverage
// =====================================================================

/** getQaMyAuditorKpis verbatim: the caller's own KPI card for a month. */
export async function getQaMyAuditorKpis(month: string): Promise<Row> {
  const user = await qaRequireRole_(['admin', 'tl', 'agent'])
  const dir = await pwDirectory()
  if (!(await qaIsAuditor_(user, dir))) throw new Error('This page is for quality auditors.')
  const today = qaToday_()
  month = /^\d{4}-\d{2}$/.test(String(month || '')) ? String(month) : today.slice(0, 7)
  const audits = await qaRows_('qa_audits')
  const kpis = qaAuditorKpis_(audits, await qaRows_('qa_disputes'), await qaRows_('qa_calibrations'), await qaRows_('qa_kb_gaps'), month) as Record<string, Row>
  const k = (kpis[user.email] || { audits: 0, disputes: 0, upheld: 0, open: 0, disputePct: null, alignmentPct: null, calibrations: 0, kbGaps: 0, kbSameDay: 0 }) as Row
  let S: Row
  try {
    S = await qeSettings_()
  } catch {
    S = qeMergeSettings_({})
  }
  const weeks: Record<string, number> = {}
  audits.forEach((a) => {
    if (String(a.kind || 'audit') !== 'audit' || normEmail(a.auditor_email) !== user.email || String(a.audit_date).slice(0, 7) !== month) return
    const p = String(a.audit_date).split('-').map(Number)
    const w = String(qeWeekKeyFor_(qeLocal_(p[0], p[1] - 1, p[2], 12), S)).slice(1)
    weeks[w] = (weeks[w] || 0) + 1
  })
  const months: Record<string, boolean> = {}
  audits.forEach((a) => {
    if (normEmail(a.auditor_email) === user.email) months[String(a.audit_date).slice(0, 7)] = true
  })
  months[today.slice(0, 7)] = true
  const since = dqAddDays_(today, -90)
  const dispBy: Record<string, Row> = {}
  ;(await qaRows_('qa_disputes')).forEach((d) => {
    if (normEmail(d.auditor_email) === user.email) dispBy[String(d.audit_id)] = d
  })
  const mine = audits
    .filter((a) => {
      if (String(a.kind || 'audit') !== 'audit' || normEmail(a.auditor_email) !== user.email) return false
      const d = dispBy[String(a.audit_id)]
      return String(a.audit_date) >= since || (!!d && (d.status === 'open' || d.status === 'escalated'))
    })
    .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))
    .slice(0, 300)
    .map((a) => {
      const d = dispBy[String(a.audit_id)]
      return {
        auditId: String(a.audit_id), ticketId: qaItemId_(a), agentName: dir.name(String(a.agent_email)), channel: String(a.channel || ''),
        auditDate: String(a.audit_date), score: Number(a.score), finalScore: qaFinalScore_(a), fatal: qaBool_(a.fatal), status: String(a.status || ''),
        dispute: d
          ? {
              status: String(d.status), decision: String(d.decision || ''), reason: String(d.reason || ''),
              raisedDate: String(d.raised_date || String(d.raised_at || '').slice(0, 10)), decisionNote: String(d.decision_note || ''), decidedAt: String(d.decided_at || '').slice(0, 10),
            }
          : null,
      }
    })
  return {
    myAudits: mine, month, months: Object.keys(months).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort().reverse(), name: user.name,
    audits: k.audits, weeks: Object.keys(weeks).sort().map((w) => ({ weekStart: w, audits: weeks[w] })),
    disputes: k.disputes, disputesUpheld: k.upheld, disputesOpen: k.open, disputePct: k.disputePct,
    alignmentPct: k.alignmentPct, calibrations: k.calibrations, kbGaps: k.kbGaps, kbSameDay: k.kbSameDay,
  }
}

/** getQaScoresPage verbatim: the team scores over a from→to range, cached. */
export async function getQaScoresPage(from: string, to: string, basis: string): Promise<Row> {
  await qaRequireRole_(['admin', 'tl'])
  from = String(from || '')
  to = String(to || '')
  qaCheckRange_(from, to)
  const b = basis === 'audit' ? 'audit' : 'interaction'
  const startsOn = Number((await qeSettings_()).weekStartsOn) === 1 ? 1 : 0
  const key = 'qa_sc1:' + (await qaVersion_()) + ':' + from + ':' + to + ':' + b + ':' + startsOn
  const hit = cacheGet(key)
  if (hit) {
    try {
      const o = JSON.parse(hit) as Row
      o.cached = true
      return o
    } catch {
      /* recompute */
    }
  }
  const dir = await pwDirectory()
  const out = qaScoresRange_(await qaRows_('qa_audits'), from, to, { basis: b, weekStartsOn: startsOn, nameOf: (e: string) => dir.name(e) }) as Row
  out.asOf = qaNowIso_()
  try {
    cachePut(key, JSON.stringify(out), 600)
  } catch {
    /* too big: serve uncached */
  }
  return out
}

/** getQaAnalyticsPage verbatim: the cached period payload + coverage. */
export async function getQaAnalyticsPage(grain: string, period: string, basis: string): Promise<Row> {
  await qaRequireRole_(['admin', 'tl'])
  const g = grain === 'week' ? 'week' : 'month'
  const b = basis === 'audit' ? 'audit' : 'interaction'
  const today = qaToday_()
  const S = await qeSettings_()
  const startsOn = Number(S.weekStartsOn) === 1 ? 1 : 0
  const periods = qaPeriods_(g, today, startsOn)
  const p = periods.indexOf(String(period || '')) !== -1 ? String(period) : periods[0]
  const key = 'qa_an7:' + (await qaVersion_()) + ':' + startsOn + ':' + g + ':' + p + ':' + b
  const hit = cacheGet(key)
  if (hit) {
    try {
      const o = JSON.parse(hit) as Row
      o.cached = true
      o.coverage = await qaCoverageSafe_()
      return o
    } catch {
      /* recompute */
    }
  }
  const dir = await pwDirectory()
  const quota: Row = {}
  try {
    ;(await qaQuotaAgents_(dir, S)).forEach((pp) => {
      const q = qeQuotaFor_(pp.name, S)
      quota[pp.email] = { name: pp.name, perWeek: q.perWeek, perDay: q.perDay }
    })
  } catch (eQ) {
    console.log('quota not read: ' + ((eQ as Error)?.message || eQ))
  }
  const out = qaAnalytics_(
    await qaRows_('qa_audits'), qaForms_(await qaRows_('qa_forms')), await qaRows_('qa_disputes'), await qaRows_('qa_ctls'), await qaRows_('qa_calibrations'), await qaRows_('qa_kb_gaps'),
    g, p, today, (e: string) => dir.name(e),
    { weekStartsOn: startsOn, volume: await qaRows_('qa_volume'), quota: quota as never, handledOf: await qaHandledOf_(), basis: b }
  ) as Row
  out.periods = periods
  out.targets = { alignment: Number(await qaSetting_('qa_alignment_target')), disputePass: Number(await qaSetting_('qa_dispute_pass_target')), ctlSla: Number(await qaSetting_('qa_ctl_sla_target')) }
  out.asOf = qaNowIso_()
  try {
    cachePut(key, JSON.stringify(out), 600)
  } catch {
    /* too big: serve uncached */
  }
  out.coverage = await qaCoverageSafe_()
  return out
}

/** getQaAnalyticsAudits verbatim: the audits behind an analytics row. */
export async function getQaAnalyticsAudits(grain: string, period: string, agentEmail: string, questionKey: string, basis: string): Promise<Row> {
  await qaRequireRole_(['admin', 'tl'])
  const g = grain === 'week' || grain === 'range' ? grain : 'month'
  if (g === 'range') {
    const r = String(period || '').split('..')
    qaCheckRange_(r[0] || '', r[1] || '')
  }
  const S = await qeSettings_()
  const dir = await pwDirectory()
  return qaDrill_(
    await qaRows_('qa_audits'), qaForms_(await qaRows_('qa_forms')), g, String(period || ''), Number(S.weekStartsOn) === 1 ? 1 : 0,
    normEmail(agentEmail || ''), String(questionKey || ''), (e: string) => dir.name(e), await qaTicketUrl_(), basis === 'audit' ? 'audit' : 'interaction'
  ) as Row
}

/** qaCoverageCached_ verbatim: qaCoverage_ from the Queue Log, cached 10 minutes. */
async function qaCoverageCached_(): Promise<Row> {
  const today = qaToday_()
  const key = 'qa_cov3:' + (await qaVersion_()) + ':' + today
  const hit = cacheGet(key)
  if (hit) {
    try {
      return JSON.parse(hit) as Row
    } catch {
      /* recompute */
    }
  }
  const live = await qaEngineLive_()
  const values = await qeQueueValues_()
  const dir = await pwDirectory()
  const people = qaImportablePeople_(dir).map((p) => ({ email: p.email, name: p.name, role: p.role, tlEmail: p.tlEmail }))
  const headcount = await qaHeadcount_()
  let S: Row
  try {
    S = await qeSettings_()
  } catch {
    S = qeMergeSettings_({})
  }
  let hist: { outcomes: { date: string; ranAt: string; outcomes: Row }[]; builds: Record<string, boolean> } | null = null
  if (live) {
    const from = dqAddDays_(today, -(QA_COVERAGE_DAYS - 1))
    const builds: Record<string, boolean> = {}
    ;(await qeReadRecentBuilds_(400)).forEach((b) => {
      builds[String(b.ranAt).slice(0, 10)] = true
    })
    hist = { outcomes: (await qeReadOutcomes_(from)) as { date: string; ranAt: string; outcomes: Row }[], builds }
  }
  const out = qaCoverage_(values, people as never, headcount as never, S, today, QA_COVERAGE_DAYS, hist as never) as Row
  ;(out.agents as Row[]).forEach((a) => {
    a.tlName = a.tlEmail ? dir.name(String(a.tlEmail)) : ''
  })
  out.source = live ? 'engine' : 'old'
  out.asOf = qaNowIso_()
  try {
    cachePut(key, JSON.stringify(out), 600)
  } catch {
    /* too big: serve uncached */
  }
  return out
}

/** qaCoverageSafe_ verbatim: the coverage block never fails the page. */
async function qaCoverageSafe_(): Promise<Row> {
  try {
    return await qaCoverageCached_()
  } catch (e) {
    return { error: String((e as Error)?.message || e), days: [], agents: [], logRows: 0, totals: { audited: [], queued: [], target: [] } }
  }
}

/** getQaCoveragePage: admin view of the coverage block (the analytics page embeds it). */
export async function getQaCoveragePage(): Promise<Row> {
  await qaRequireRole_(['admin'])
  return qaCoverageCached_()
}

// =====================================================================
// Audit forms (admin builder)
// =====================================================================

/** getQaFormsPage verbatim: the form list with version counts + channel/audit-type choices. */
export async function getQaFormsPage(): Promise<Row> {
  await qaRequireRole_(['admin'])
  const f = qaForms_(await qaRows_('qa_forms'))
  const versions: Record<string, number> = {}
  Object.keys(f.byKey).forEach((k) => {
    const id = k.split('|')[0]
    versions[id] = (versions[id] || 0) + 1
  })
  return { forms: f.list.map((x) => ({ ...x, versions: versions[String(x.formId)] || 1 })), channels: await qaChannels_(), auditTypes: await qaAuditTypes_() }
}

/** saveQaForm verbatim: a new form or a new version of an existing one. */
export async function saveQaForm(input: Row): Promise<Row> {
  const user = await qaRequireRole_(['admin'])
  await assertWritable()
  input = input || {}
  const def = qaCleanForm_(input)
  const active = input.active !== false
  const row = await qaTx_(async () => {
    const rows = await qaRows_('qa_forms')
    let formId = String(input.formId || '')
    let version = 1
    if (formId) {
      const mine = rows.filter((r) => r.form_id === formId)
      if (!mine.length) throw new Error('That form was not found.')
      version = mine.reduce((m, r) => Math.max(m, Number(r.version) || 1), 0) + 1
    } else {
      formId = newId('FRM')
    }
    if (active) {
      const clash = qaForms_(rows).list.filter((f) => f.active && f.channel === def.channel && f.formId !== formId)[0]
      if (clash) throw new Error('"' + clash.title + '" is already the active form for ' + String(def.channel) + '. Switch it off first.')
    }
    const r: Row = {
      form_id: formId, version, channel: def.channel, title: def.title, placeholder: def.placeholder, active,
      definition_json: JSON.stringify({ scoring: def.scoring, sections: def.sections }), created_by: user.email, created_at: qaNowIso_(),
    }
    await qaUpsertIn_('qa_forms', ['form_id', 'version'], [r])
    return r
  })
  return { formId: String(row.form_id), version: Number(row.version) }
}

// =====================================================================
// Sampling weights (admin)
// =====================================================================

/** getQaSamplingPage verbatim: the engine's sampling weights against the Catalogue. */
export async function getQaSamplingPage(): Promise<Row> {
  await qaRequireRole_(['admin'])
  const S = await qeSettings_()
  const catRows = (await readRows('qe_catalogue').catch(() => [] as Row[])) as Row[]
  const cat: Record<string, Record<string, number>> = { 'Contact Type': {}, L2: {}, L3: {}, Status: {}, 'Agent Status': {} }
  catRows.forEach((r) => {
    const kind = String(r.kind || '')
    if (cat[kind] && String(r.value || '').trim()) cat[kind][String(r.value).trim()] = Number(r.times_seen) || 0
  })
  const types = cat['Contact Type']
  const typesExact = Object.keys(types).length > 0
  if (!typesExact)
    Object.keys(cat.L2)
      .concat(Object.keys(cat.L3))
      .forEach((k) => {
        types[k] = (cat.L2[k] || 0) + (cat.L3[k] || 0)
      })
  Object.keys((S.contactTypeWeights as Row) || {}).forEach((k) => {
    if (!(k in types)) types[k] = 0
  })
  const ctList = Object.keys(types)
    .map((k) => ({ name: k, seen: types[k], weight: ((S.contactTypeWeights as Row) || {})[k] || 1 }))
    .sort((a, b) => b.seen - a.seen || a.name.localeCompare(b.name))
  const st: Record<string, { name: string; seen: number; agentSeen: number }> = {}
  const addStatus = (name: unknown, seen?: number, agentSeen?: number) => {
    const k = qeStatusKey_(name)
    if (!st[k]) st[k] = { name: String(name).trim(), seen: 0, agentSeen: 0 }
    st[k].seen += seen || 0
    st[k].agentSeen += agentSeen || 0
  }
  Object.keys(QE_FD_STATUS_NAMES).forEach((c) => addStatus(QE_FD_STATUS_NAMES[c]))
  Object.keys(cat.Status).forEach((k) => addStatus(k, cat.Status[k], 0))
  Object.keys(cat['Agent Status']).forEach((k) => addStatus(k, 0, cat['Agent Status'][k]))
  ;((S.excludeStatuses as string[]) || []).forEach((s) => addStatus(s))
  Object.keys((S.statusWeights as Row) || {}).forEach((s) => addStatus(s))
  const ex: Record<string, boolean> = {}
  const exA: Record<string, boolean> = {}
  const sw: Record<string, number> = {}
  ;((S.excludeStatuses as string[]) || []).forEach((s) => {
    ex[qeStatusKey_(s)] = true
  })
  ;((S.excludeAgentStatuses as string[]) || []).forEach((s) => {
    exA[qeStatusKey_(s)] = true
    addStatus(s)
  })
  Object.keys((S.statusWeights as Row) || {}).forEach((s) => {
    sw[qeStatusKey_(s)] = Number(((S.statusWeights as Row) || {})[s]) || 1
  })
  const stList = Object.keys(st)
    .map((k) => ({ name: st[k].name, seen: st[k].seen, agentSeen: st[k].agentSeen, weight: sw[k] || 1, excluded: !!ex[k], excludedAgent: !!exA[k] }))
    .sort((a, b) => b.seen + b.agentSeen - (a.seen + a.agentSeen) || a.name.localeCompare(b.name))
  const builds = await qeReadRecentBuilds_(1)
  return { contactTypes: ctList, typesExact, statuses: stList, lastBuild: builds.length ? builds[0].ranAt : '', engineLive: await qaEngineLive_() }
}

/** saveQaSampling verbatim: persist the sampling weights into qa_engine_settings. */
export async function saveQaSampling(input: Row): Promise<Row> {
  const user = await qaRequireRole_(['admin'])
  await assertWritable()
  const clean = qeCleanSamplingInput_(input)
  const stored = qeWithSampling_(await getConfig('qa_engine_settings', ''), clean)
  await setConfig('qa_engine_settings', JSON.stringify(stored), '', user.email)
  return { contactTypes: Object.keys(clean.contactTypeWeights).length, statuses: Object.keys(clean.statusWeights).length, excluded: clean.excludeStatuses, excludedAgent: clean.excludeAgentStatuses }
}

// =====================================================================
// Queue import + daily job pieces
// =====================================================================

/** qaStartedLogKeys_ verbatim: today's in-progress rows, by log key. */
async function qaStartedLogKeys_(): Promise<Record<string, boolean>> {
  const today = qaToday_()
  const keep: Record<string, boolean> = {}
  ;(await qaRows_('qa_queue')).forEach((q) => {
    if (q.status === 'in_progress' && q.log_key && q.queue_date === today) keep[String(q.log_key)] = true
  })
  return keep
}

/** qaRequestedTaken_ verbatim: this quota week's requests/non-ticket items by engine agent key. */
async function qaRequestedTaken_(): Promise<Record<string, number>> {
  const weekStart = String(qeWeekKeyFor_(new Date(), await qeSettings_())).slice(1)
  const out: Record<string, number> = {}
  ;(await qaRows_('qa_queue')).forEach((q) => {
    if (!(q.source === 'request' || qaIsNonTicket_(q)) || q.status === 'waived' || q.status === 'passed' || String(q.queue_date) < weekStart) return
    const k = qeCanonAgent_(q.agent_name)
    if (k) out[k] = (out[k] || 0) + 1
  })
  return out
}

/** qaImportQueue_ verbatim: the Queue Log -> qa_queue (new rows, refresh, expire). */
async function qaImportQueue_(): Promise<{ added: number; expired: number; noDate?: number; date: string; unmatched: string[]; note: string; build?: Row }> {
  const live = await qaEngineLive_()
  const values = await qeQueueValues_()
  if (!values || !values.length) throw new Error('The old Quality Queue data spreadsheet has no "Queue Log" tab.')
  const dir = await pwDirectory()
  const people = qaImportablePeople_(dir).map((p) => ({ email: p.email, name: p.name, tlEmail: p.tlEmail || undefined }))
  const headcount = await qaHeadcount_()
  const parsed = qaQueueFromSheet_(values, { today: qaToday_(), auditors: await qaAuditors_(dir), people, headcount, map: (await qaSetting_('qa_auditor_map')) as Row }, (d) => qeFmt_(d as Date, 'yyyy-MM-dd')) as never as { date: string; rows: Row[]; unmatched: string[]; unmatchedCounts?: Record<string, number> }
  await setConfig('qa_queue_unmatched', { at: qaNowIso_(), names: parsed.unmatchedCounts || {} }, 'Queue-import agents with no Hub match.', 'system:quality')
  const now = qaNowIso_()
  const res = await qaTx_(async () => {
    const have: Record<string, boolean> = {}
    const all = await qaRows_('qa_queue')
    all.forEach((r) => {
      have[String(r.queue_id)] = true
    })
    const fresh = parsed.rows
      .filter((r) => !have[String(r.queue_id)] && !(live && !r.action_at))
      .map((r) => {
        r.status = 'open'
        r.started_at = ''
        r.audit_id = ''
        r.imported_at = now
        return r
      })
    const byId: Record<string, Row> = {}
    all.forEach((r) => {
      byId[String(r.queue_id)] = r
    })
    const QA_QUEUE_ENGINE_FIELDS = ['channel', 'contact_type', 'tier', 'log_key', 'ticket_status', 'interaction_at', 'action_at', 'agent_status', 'agent_status_log']
    const refreshed = parsed.rows
      .filter((r) => {
        const old = byId[String(r.queue_id)]
        if (!old || old.status !== 'open' || old.started_at) return false
        return QA_QUEUE_ENGINE_FIELDS.some((k) => r[k] !== undefined && String(r[k]) !== qaWhen_(old[k]))
      })
      .map((r) => qaQueueFields_(byId[String(r.queue_id)], r) as Row)
    await qaUpsertIn_('qa_queue', ['queue_id'], fresh.concat(refreshed).map(qaTimesAsText_))
    let gone: Row[] = []
    let noDate: Row[] | null = null
    if (live) {
      const pending: Record<string, boolean> = {}
      parsed.rows.forEach((r) => {
        pending[String(r.queue_id)] = true
      })
      gone = all.filter((r) => r.log_key && r.status === 'open' && !r.started_at && !pending[String(r.queue_id)])
      gone.forEach((r) => {
        r.status = 'expired'
        r.expire_reason = 'not in the Queue Log'
      })
      noDate = all.filter((r) => r.source !== 'request' && r.source !== 'offqueue' && !qaIsNonTicket_(r) && r.status === 'open' && !r.started_at && !qaWhen_(r.action_at))
      noDate.forEach((r) => {
        r.status = 'expired'
        r.expire_reason = 'no action date'
      })
      await qaUpsertIn_('qa_queue', ['queue_id'], gone.concat(noDate).map(qaTimesAsText_))
    }
    return { added: fresh.length, expired: gone.length, noDate: noDate ? noDate.length : 0 }
  })
  const note =
    res.added + ' added' + (res.expired ? ', ' + res.expired + ' no longer in the queue' : '') + (res.noDate ? ', ' + res.noDate + ' without an action date taken off' : '') +
    ' (' + (live ? 'own engine' : 'old app') + ')' + (parsed.unmatched.length ? '; not on the roster: ' + parsed.unmatched.join(', ') : '')
  if (parsed.unmatched.length) hbBeat('qa_queue_import', 'warn', note)
  return { added: res.added, expired: res.expired, noDate: res.noDate, date: parsed.date, unmatched: parsed.unmatched, note }
}

/**
 * dqStep_ verbatim (Stores.js): run one named job step — beat ok (a skipped run
 * is healthy) or error, flush, return null on error so the chain continues.
 */
async function qaDqStep_<T>(job: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const r = await fn()
    hbBeat(job, 'ok', r && typeof r === 'object' && !Array.isArray(r) && (r as Row).skipped ? 'Skipped: ' + String((r as Row).skipped) : '')
    return r
  } catch (e) {
    const msg = (e as Error)?.message || String(e)
    console.log(job + ' failed: ' + msg)
    hbBeat(job, 'error', msg)
    return null
  } finally {
    await hbFlush()
  }
}

/** importQaQueueNow verbatim: the Audit Desk's "Build / import the queue now". */
export async function importQaQueueNow(): Promise<Row> {
  const user = await qaRequireRole_(['admin'])
  await assertWritable()
  try {
    if (await qaEngineLive_()) {
      const { qeBuildQueue } = await import('./engine-live')
      const b = await qeBuildQueue('day', user.email, { keepKeys: await qaStartedLogKeys_(), extraTaken: await qaRequestedTaken_() })
      const imp = await qaImportQueue_()
      hbBeat('qa_queue_import', 'ok', '')
      return { added: imp.added, note: 'Built ' + b.queued + ' for ' + b.agents + ' agents; ' + imp.note }
    }
    return (await qaDqStep_('qa_queue_import', () => qaImportQueue_())) || { added: 0, note: 'Import failed; see the Health tab.' }
  } finally {
    await hbFlush()
  }
}

/** qaQueueStep_ verbatim + the jobQualityDaily dqStep_ wrap: build (when live) then import; used by the cron. */
export async function qaQueueStep_(actor: string): Promise<Row | null> {
  return qaDqStep_('qa_queue_import', async () => {
    if (await qaEngineLive_()) {
      const { qeBuildQueue } = await import('./engine-live')
      const b = await qeBuildQueue('day', actor, { keepKeys: await qaStartedLogKeys_(), extraTaken: await qaRequestedTaken_() })
      const imp = await qaImportQueue_()
      imp.note = 'Built ' + b.queued + ' for ' + b.agents + ' agents (window ' + b.windowFrom + ' to ' + b.windowTo + '); ' + imp.note
      imp.build = b as Row
      return imp as Row
    }
    return qaImportQueue_() as Promise<Row>
  })
}

/** qaCtlReminders_ verbatim: backfill CTL popups + one email a day per due/overdue CTL. */
export async function qaCtlReminders(): Promise<Row> {
  await requireJobCaller() /* jobQualityDaily's requireJobCaller_: sessionless cron or admin — also gates the dispatcher hand-run */
  return hbRun('qa_ctl_reminders', async () => {
    const today = qaToday_()
    const dir = await pwDirectory()
    const open = (await qaRows_('qa_ctls')).filter((c) => c.status === 'open')
    const raised = await qaEnsureCtlPopups_()
    const due = open.filter((c) => String(c.due_date) <= today && String(c.reminded_date) !== today)
    for (const c of due) {
      const late = String(c.due_date) < today
      await notify(
        {
          to: String(c.tl_email), kind: 'qa_ctl_reminder', ref: String(c.ctl_id),
          subject: (late ? 'Overdue CTL: ' : 'CTL due today: ') + dir.name(String(c.agent_email)),
          intro: 'The CTL for ' + dir.name(String(c.agent_email)) + '\'s quality audit is ' + (late ? 'overdue (was due ' + c.due_date + ').' : 'due today.'),
          where: 'Quality > CTLs',
        },
        'system:quality'
      )
    }
    if (due.length) {
      await qaTx_(async () => {
        const ids: Record<string, boolean> = {}
        due.forEach((c) => {
          ids[String(c.ctl_id)] = true
        })
        const fresh = (await qaRows_('qa_ctls')).filter((c) => ids[String(c.ctl_id)])
        fresh.forEach((c) => {
          c.reminded_date = today
        })
        await qaUpsertIn_('qa_ctls', ['ctl_id'], fresh)
      })
    }
    return { reminded: due.length, popups: raised }
  })
}

/** qaEnsureCtlPopups_ verbatim: raise the qa_ctl_due popup for each open CTL that has none. */
async function qaEnsureCtlPopups_(): Promise<number> {
  const openCtls = (await qaRows_('qa_ctls')).filter((c) => c.status === 'open')
  if (!openCtls.length) return 0
  const have: Record<string, boolean> = {}
  try {
    const { data } = await db().from('popups').select('ref').eq('kind', 'qa_ctl_due').is('resolved_at', null)
    ;(data || []).forEach((r) => {
      have[String((r as Row).ref)] = true
    })
  } catch {
    /* popups store absent */
  }
  const auditsBy: Record<string, Row> = {}
  ;(await qaRows_('qa_audits')).forEach((a) => {
    auditsBy[String(a.audit_id)] = a
  })
  const dir = await pwDirectory()
  const missing = openCtls.filter((c) => c.tl_email && !have[String(c.ctl_id)])
  if (missing.length) {
    await notify(
      { to: [], subject: '', popups: missing.map((c) => ({ recipient: normEmail(c.tl_email), kind: 'qa_ctl_due', ref: String(c.ctl_id), title: 'Open CTL: ' + dir.name(String(c.agent_email)), body: 'Go through the audit of ' + qaItemRef_(auditsBy[String(c.audit_id)] || {}) + ' with ' + dir.name(String(c.agent_email)) + ' and submit the CTL by ' + c.due_date + '.', link: '#/ctls' })) } as unknown as NotifyInput,
      'system:quality'
    )
  }
  return missing.length
}

/** qaEnsureCtlPopups export (the job wrapper): requireJobCaller_ — dispatcher hand-run is admin-or-cron only. */
export async function qaEnsureCtlPopups(): Promise<Row> {
  await requireJobCaller()
  return { raised: await qaEnsureCtlPopups_() }
}

// =====================================================================
// Backfills / migration seams (QaMigrate.js)
// =====================================================================

/** backfillQaSampleBasis verbatim: writes sample_basis on every audit that has none. */
export async function backfillQaSampleBasis(): Promise<string> {
  await qaRequireRole_(['admin'])
  await assertWritable()
  const out = await qaTx_(async () => {
    const rows = (await qaRows_('qa_audits')).filter((a) => String(a.kind || 'audit') === 'audit' && !String(a.sample_basis || '').trim())
    const by: Record<string, number> = {}
    for (const a of rows) {
      a.sample_basis = qaDeriveBasis_(a)
      by[String(a.sample_basis)] = (by[String(a.sample_basis)] || 0) + 1
    }
    await qaUpsertIn_('qa_audits', ['audit_id'], rows)
    return by
  })
  const msg = 'Sample basis written: ' + (Object.keys(out).map((k) => k + ' ' + out[k]).join(', ') || 'nothing to do') + '.'
  return msg
}

/** backfillQaInteractionDates verbatim: copies the queue row's interaction_at onto audits that have none. */
export async function backfillQaInteractionDates(): Promise<string> {
  await qaRequireRole_(['admin'])
  await assertWritable()
  const out = await qaTx_(async () => {
    const at: Record<string, string> = {}
    ;(await qaRows_('qa_queue')).forEach((q) => {
      const t = qaTextTime_(q.interaction_at)
      if (t && q.queue_id) at[String(q.queue_id)] = t
    })
    const blank = (await qaRows_('qa_audits')).filter((a) => String(a.queue_id || '') && !qaWhen_(a.interaction_at))
    const rows = blank.filter((a) => at[String(a.queue_id)])
    rows.forEach((a) => {
      a.interaction_at = at[String(a.queue_id)]
    })
    await qaUpsertIn_('qa_audits', ['audit_id'], rows)
    return { written: rows.length, missing: blank.length - rows.length }
  })
  return 'Interaction dates written: ' + out.written + '. Queue row has none: ' + out.missing + '.'
}

/**
 * importQualityAuditHistory (QaMigrate.js): the old workbook's response tabs
 * into qa_audits. requireJobCaller_ verbatim: a sessionless cron run or an
 * admin; the Google-Sheets read itself stays env-gated (GOOGLE_* creds, G5).
 */
export async function qaImportHistory(opts?: { budgetMs?: number; secret?: string }): Promise<Row> {
  await requireJobCaller()
  const { qaImportHistory_ } = await import('./migrate')
  return qaImportHistory_(await actorEmail(), opts)
}

/**
 * qaReconcileQueueLog_ (QaMigrate.js): mark log rows audited / expired from
 * qa_audits. Runs inside jobQualityHistory's qa_history_import step in legacy,
 * so the gate is requireJobCaller_ (the sessionless cron must reach it) and the
 * heartbeat name is the step's.
 */
export async function qaReconcileQueueLog(): Promise<Row> {
  await requireJobCaller()
  return hbRun('qa_history_import', async () => {
    const { qaReconcileQueueLog_ } = await import('./migrate')
    return qaReconcileQueueLog_()
  })
}

/**
 * jobQualityHistory's dqStep_('qa_history_import', …) verbatim: the two
 * Google-Forms response sheets into qa_audits — skipped while the
 * GOOGLE_SERVICE_ACCOUNT_* creds are absent (G5) — then the Queue Log
 * reconcile. Called by the cron; resumable and idempotent like the trigger.
 */
export async function qaHistoryStep_(actor: string): Promise<Row | null> {
  return qaDqStep_('qa_history_import', async () => {
    const { qaImportHistory_, qaReconcileQueueLog_ } = await import('./migrate')
    const h: Row =
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
        ? await qaImportHistory_(actor, { budgetMs: 270000, secret: String((await getConfig('qa_history_secret', '')) || '') })
        : { done: true, imported: 0, skipped: 0, unmatched: {}, notes: ['History sheets not read: GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY are not configured'], note: '' }
    const r = (await qaReconcileQueueLog_()) as Row
    h.note =
      String(h.note || '') +
      (r.skipped ? ' Reconcile skipped: ' + r.skipped + '.' : ' Reconcile: ' + r.updated + ' queue rows marked audited (' + r.revived + ' were expired).')
    if (!h.done) hbBeat('qa_history_import', 'warn', 'History import ran out of time; it resumes tomorrow (or run importQualityAuditHistory).')
    return h
  })
}

/** restartQualityAuditHistory verbatim: forget the history cursors so the next import rescans both sheets. */
export async function restartQualityAuditHistory(): Promise<string> {
  await qaRequireRole_(['admin'])
  await assertWritable()
  const { restartQualityAuditHistory_ } = await import('./migrate')
  return restartQualityAuditHistory_()
}

/** checkQaEngineSettings verbatim: the settings the engine will use (defaults + qa_engine_settings), validated. */
export async function checkQaEngineSettings(): Promise<string> {
  await qaRequireRole_(['admin'])
  const S = await qeSettings_()
  const msg = 'qa_engine_settings OK. Effective: ' + JSON.stringify(S)
  console.log(msg)
  return msg
}
