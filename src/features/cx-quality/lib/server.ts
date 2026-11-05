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

import { cacheGet, cachePut, db, newId, readRows, sanitizeInput } from '@/features/shared/platform/repo'
import { getConfig, setConfig } from '@/features/shared/platform/settings'
import { currentUser, normEmail, pwDirectory, type Directory, type DirectoryPerson } from '@/features/shared/platform/identity'
import { assertWritable } from '@/features/shared/platform/viewas'
import { getWorkingCalendar } from '@/features/shared/platform/calendar'
import { optionsFor } from '@/features/shared/platform/options'
import { raisePopup, resolvePopups } from '@/features/shared/platform/popups'
import { notify, type NotifyInput } from '@/features/shared/platform/notify'
import { pwToday } from '@/features/shared/platform/time'
import { readStore } from '@/features/shared/platform/stores'
import { tlsOnShift_, tlsShifts_ } from '@/features/cx-queue/lib'
import { fetchWorkbookTabs } from '@/features/shared/jobs/sheets'
import { described } from '@/features/shared/lib/errors'
import { dqAddDays_ } from '@/features/shared/lib/adapters'

import {
  QA_SETTINGS,
  qaBool_, qaRound1_, qaIsSettled_, qaLostQuestions_, qaNeedsCtl_,
  qaCanCloseCtl_, qaCtlVisibleTo_, qaFindOpenCtls_,
  qaCtlSla_, qaDisputeStats_, qaAuditorKpis_, qaEmailList_,
  qaQueueFromSheet_, qaForms_, qaAuditView_, qaCleanForm_,
  qaItemRef_, type QaQueueCtx,
} from './core'
import {
  qaCleanInteractionAt_, qaTakenByOther_, qaScoreSubmission_,
  qaCleanFailReasons_, qaNewCtl_, qaCtlPopups_, qaAuditMail_, qaMyAuditCounts_,
  qaCanWaive_, qaCleanReason_, qaRequestRows_, qaTicketQueueRow_,
  qaNonTicketClash_, qaNonTicketRow_, qaCleanPassReason_,
  qaAuditorVia_, qaKbItem_, qaCoverage_, qaCheckRange_, QA_COVERAGE_DAYS,
} from './pure'
import {
  QE_LOG_HEADERS, QE_OLD_DATA_SS_ID,
  qeSettingsFrom_, qeFmt_, qeWeekKeyFor_,
} from './engine'
import { qaAnalytics_, qaDrill_, qaScoresRange_, qaFlattenAudits_, qaSampleBasis_ } from './analytics'

type Row = Record<string, unknown>

// Postgres tables backing the engine (supabase/migrations/006_quality.sql).
const QE_TBL_LOG = 'qe_queue_log'
const QE_TBL_CANDIDATES = 'qe_candidates'
const QE_TBL_OUTCOMES = 'qe_outcomes'
const QE_TBL_BUILDS = 'qe_builds'

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

// LockService seam: Postgres here has no multi-statement transaction helper, so
// the few mutating paths serialize on a process-local mutex exactly as
// LockService serialized the legacy writes.
let qaLock_: Promise<void> = Promise.resolve()
async function qaTx_<T>(fn: () => Promise<T>): Promise<T> {
  const prev = qaLock_
  let release!: () => void
  qaLock_ = new Promise((r) => (release = r))
  await prev
  try {
    return await fn()
  } finally {
    release()
  }
}

/** qaVersion_ verbatim: analytics cache-buster bumped on every write. */
async function qaVersion_(): Promise<number> {
  return Number((await getConfig('qa_ver', '0')) || '0')
}
async function qaBumpVersion_(): Promise<void> {
  await setConfig('qa_ver', String((await qaVersion_()) + 1), 'Quality data version.', 'system:quality')
}
async function qaQueueVersion_(): Promise<number> {
  return Number((await getConfig('qe_log_ver', '0')) || '0')
}
async function qaBumpQueueVersion_(): Promise<void> {
  await setConfig('qe_log_ver', String((await qaQueueVersion_()) + 1), 'Queue-log version.', 'system:quality')
}

const qaNow_ = () => new Date().toISOString()

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
  const v = await qaSetting_('qa_auditor_position_keywords')
  return Array.isArray(v) ? v.map(String) : qaEmailList_(v)
}
/** qaAuditorGrants_ verbatim: extra auditor emails granted by an admin. */
async function qaAuditorGrants_(): Promise<string[]> {
  return qaEmailList_(await qaSetting_('qa_auditor_emails'))
}
async function qaKbEditorList_(): Promise<string[]> {
  return qaEmailList_(await qaSetting_('qa_kb_editor_emails'))
}
async function qaKbNotifyList_(): Promise<string[]> {
  return qaEmailList_(await qaSetting_('qa_kb_notify_emails'))
}
async function qaWaiverList_(): Promise<string[]> {
  return qaEmailList_(await qaSetting_('qa_request_waiver_emails'))
}

/** qaAuditors_ verbatim: every active person whose position matches a keyword, plus grants. */
async function qaAuditors_(dir: Directory): Promise<string[]> {
  const keys = await qaAuditorPosKeywords_()
  const out: string[] = []
  Object.keys(dir.by).forEach((em) => {
    const p = dir.by[em]
    if (!p || !p.active) return
    if (qaAuditorVia_({ email: em, role: p.role, position: p.position }, keys, [] as string[]) === 'position') out.push(em)
  })
  qaEmailList_(await qaAuditorGrants_()).forEach((em) => {
    if (out.indexOf(em) === -1) out.push(em)
  })
  return out
}

/** qaIsAuditor_ verbatim: admin | position match | explicit grant. */
async function qaIsAuditor_(user: { email: string; role: string } | null, dir: Directory): Promise<boolean> {
  if (!user) return false
  if (user.role === 'admin') return true
  const em = normEmail(user.email)
  const p = dir.by[em]
  if (!p || !p.active) return false
  const via = qaAuditorVia_({ email: em, role: p.role, position: p.position }, await qaAuditorPosKeywords_(), await qaAuditorGrants_())
  return via !== ''
}

/** qaIsKbEditor_ verbatim: admin | auditor | configured KB editor. */
async function qaIsKbEditor_(user: { email: string; role: string } | null, dir: Directory): Promise<boolean> {
  if (!user) return false
  if (user.role === 'admin') return true
  if (await qaIsAuditor_(user, dir)) return true
  return (await qaKbEditorList_()).indexOf(normEmail(user.email)) !== -1
}

/** qaDisputeOwner_ verbatim: configured owner, else the assistant owner. */
async function qaDisputeOwner_(): Promise<string> {
  const cfg = normEmail(String((await qaSetting_('qa_dispute_owner_email')) || ''))
  return cfg || normEmail(String((await getConfig('assistant_owner_email', '')) || ''))
}

/** qaOnShiftNow_ verbatim: TLs whose tlp_shifts cover now. */
async function qaOnShiftNow_(): Promise<string[]> {
  const today = pwToday()
  const rows = (await readStore('tlp_shifts').catch(() => ({ rows: [] as Row[] }))).rows || []
  return tlsOnShift_(tlsShifts_(rows, dqAddDays_(today, -1), dqAddDays_(today, 1)), Date.now())
}

/** qaWorkingFn_ verbatim: working-day predicate for one email's calendar. */
async function qaWorkingFn_(email: string, fromKey: string): Promise<(d: string) => boolean> {
  const cal = await getWorkingCalendar(email, fromKey, dqAddDays_(fromKey, 60))
  const by: Record<string, boolean> = {}
  ;(cal || []).forEach((d) => {
    by[d.date] = d.working
  })
  return (key: string) => by[key] !== false // unknown days count as working (legacy)
}

/** qaTicketUrl_ verbatim. */
async function qaTicketUrl_(): Promise<string> {
  return 'https://' + String((await getConfig('freshdesk_domain', '')) || '') + '/a/tickets/'
}

/** qaAuditTypes_ verbatim: the audit_type option list. */
async function qaAuditTypes_(): Promise<string[]> {
  return (await optionsFor('qa.audit_type')) as string[]
}

// =====================================================================
// The Hub's ticket snapshot + roster
// =====================================================================

/** qeHubTicketDetail_ verbatim: ticket_id -> {groupName, responderId, l1, l2, l3, status}. */
async function qeHubTicketDetail_(ids: string[]): Promise<Record<string, { groupName: string; responderId: string; l1: string; l2: string; l3: string; status: string }>> {
  const out: Record<string, { groupName: string; responderId: string; l1: string; l2: string; l3: string; status: string }> = {}
  const want = (ids || []).map(String).filter(Boolean)
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
  const people = Object.keys(dir.by)
    .map((em) => dir.by[em])
    .filter((p): p is DirectoryPerson => !!p && !!p.active)
    .map((p) => ({ email: p.email, name: p.name, tlEmail: p.tlEmail || undefined }))
  const headcount = people.map((p) => {
    const r = dir.by[p.email] as unknown as Row
    return { email: p.email, fdId: String(r.fd_id || r.fdId || ''), fdName: String(r.fd_name || r.fdName || '') }
  })
  return { today: pwToday(), auditors: await qaAuditors_(dir), people, headcount }
}

// =====================================================================
// Queue-log seam (qeSheet_('Queue Log'))
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
    // Read-only import of the old app's Queue Log tab (the migration seam).
    const tabs = await fetchWorkbookTabs(QE_OLD_DATA_SS_ID, ['Queue Log'])
    return tabs['Queue Log'] || []
  }
  const rows = (await readRows(QE_TBL_LOG, { orderBy: 'queued_date', ascending: false, limit: 60000 }).catch(() => [] as Row[])) as Row[]
  return [QE_LOG_HEADERS.slice() as unknown[]].concat(rows.map(qeLogRowToValues_))
}

/** qaImportQueue_ verbatim: Queue Log values -> parsed rows + unmatched + version. */
async function qaImportQueue_(dir: Directory): Promise<{ rows: Row[]; unmatched: string[]; version: number }> {
  const values = await qeQueueValues_()
  const out = qaQueueFromSheet_(values, await qaQueueCtx_(dir), (d) => qeFmt_(d, 'yyyy-MM-dd'))
  const rows = ((out.rows || out.items || []) as Row[])
  if (out.unmatched && (out.unmatched as string[]).length) {
    await setConfig('qa_queue_unmatched', out.unmatched, 'Queue-import agents with no Hub match.', 'system:quality')
  }
  return { rows, unmatched: (out.unmatched || []) as string[], version: await qaQueueVersion_() }
}

/** qeSetLogField_: one Queue Log cell (Key + Queued Date); live mode only. */
async function qeSetLogField_(key: string, queuedDate: string, header: string, value: unknown): Promise<void> {
  if (!(await qaEngineLive_())) return
  const { error } = await db().from(QE_TBL_LOG).update({ [qeLogField_(header)]: value }).eq('key', String(key)).eq('queued_date', String(queuedDate))
  if (error) throw described(error, { table: QE_TBL_LOG })
  await qaBumpQueueVersion_()
}

/** qeMarkLogAudited_ verbatim: State='audited' + Audited At + Audited By. */
async function qeMarkLogAudited_(key: string, queuedDate: string, auditedAt: string, auditedBy: string): Promise<void> {
  if (!(await qaEngineLive_())) return
  const { error } = await db()
    .from(QE_TBL_LOG)
    .update({ state: 'audited', audited_at: auditedAt, audited_by: String(auditedBy || '') })
    .eq('key', String(key))
    .eq('queued_date', String(queuedDate))
  if (error) throw described(error, { table: QE_TBL_LOG })
  await qaBumpQueueVersion_()
}

/** qePassAndReplace_ verbatim: mark passed + promote a same-day candidate. */
async function qePassAndReplace_(key: string, queuedDate: string, reason: string, by: string, now: Date, ticketId: string): Promise<void> {
  if (!(await qaEngineLive_())) return
  const { error } = await db()
    .from(QE_TBL_LOG)
    .update({ state: 'passed', pass_reason: String(reason || ''), audited_by: String(by || ''), audited_at: qeFmt_(now, 'yyyy-MM-dd HH:mm:ss') })
    .eq('key', String(key))
    .eq('queued_date', String(queuedDate))
  if (error) throw described(error, { table: QE_TBL_LOG })
  const { data: cands } = await db().from(QE_TBL_CANDIDATES).select('id,queued_date,agent,candidates').eq('queued_date', String(queuedDate))
  for (const c of cands || []) {
    let list: Row[] = []
    try {
      list = JSON.parse(String((c as Row).candidates || '[]'))
    } catch {
      list = []
    }
    const idx = list.findIndex((cand) => String(cand['Ticket ID'] || cand.ticket_id || '') === String(ticketId))
    if (idx === -1) continue
    const cand = list.splice(idx, 1)[0]
    await db().from(QE_TBL_CANDIDATES).update({ candidates: JSON.stringify(list) }).eq('id', (c as Row).id as string)
    const row: Row = {}
    QE_LOG_HEADERS.forEach((h) => {
      row[qeLogField_(h)] = cand[h] === undefined ? '' : cand[h]
    })
    row.key = newId('QK')
    row.state = 'queued'
    row.queued_date = String(queuedDate)
    const { error: ie } = await db().from(QE_TBL_LOG).insert(row)
    if (ie) throw described(ie, { table: QE_TBL_LOG })
    break
  }
  await qaBumpQueueVersion_()
}

/** qeReadOutcomes_ verbatim: Build Outcomes rows on/after a week key. */
async function qeReadOutcomes_(fromKey: string): Promise<Row[]> {
  const rows = (await readRows(QE_TBL_OUTCOMES).catch(() => [] as Row[])) as Row[]
  return rows
    .filter((r) => String(r.queued_date || '') >= String(fromKey || ''))
    .map((r) => ({ 'Queued Date': r.queued_date, 'Ran At': r.ran_at, Mode: r.mode, Outcomes: r.outcomes }))
}

/** qeReadRecentBuilds_ verbatim: the N newest Build Log rows, oldest first. */
async function qeReadRecentBuilds_(n: number): Promise<Row[]> {
  const rows = (await readRows(QE_TBL_BUILDS, { orderBy: 'ran_at', ascending: false, limit: Math.max(1, n || 10) }).catch(() => [] as Row[])) as Row[]
  return rows
    .slice()
    .reverse()
    .map((r) => ({ 'Ran At': r.ran_at, By: r.by, Mode: r.mode, Agents: r.agents, Queued: r.queued, Pool: r.pool, Eligible: r.eligible, Notes: r.notes }))
}

// =====================================================================
// Access payload
// =====================================================================

/**
 * getQaAccess verbatim: what this user can do. adminMode is the admin's own
 * state; viewAs lets an admin read another auditor's desk (read-only for them).
 */
export async function getQaAccess(viewAs?: string): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const auditor = await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir)
  const kbEditor = await qaIsKbEditor_(user ? { email: me, role: user.role } : null, dir)
  const deskOf = isAdmin && viewAs ? normEmail(viewAs) : me
  return {
    email: me, name: user?.name || me, isAdmin, adminMode: isAdmin,
    viewAs: isAdmin && viewAs ? deskOf : '', auditor: isAdmin && viewAs ? true : auditor,
    kbEditor: isAdmin ? true : kbEditor, ticketUrl: await qaTicketUrl_(),
    auditTypes: await qaAuditTypes_(), engineLive: await qaEngineLive_(), deskEmail: deskOf,
  }
}

/** setQaAuditorGrant verbatim: admin toggles an auditor email grant. */
export async function setQaAuditorGrant(args: { email: string; grant: boolean }): Promise<Row> {
  const user = await currentUser()
  if (!user || user.role !== 'admin') throw new Error('Only admins can change auditor access.')
  await assertWritable()
  const em = normEmail(args.email)
  if (!em) throw new Error('Email is required.')
  const cur = await qaAuditorGrants_()
  const idx = cur.indexOf(em)
  if (args.grant && idx === -1) cur.push(em)
  if (!args.grant && idx !== -1) cur.splice(idx, 1)
  await setConfig('qa_auditor_emails', cur, 'Extra QA auditor email grants.', user.email)
  return { ok: true, auditors: cur }
}

// =====================================================================
// Audit queue page
// =====================================================================

/** getQaQueuePage verbatim: the auditor's desk payload (items + request rows + CTL count). */
export async function getQaQueuePage(args: { viewAs?: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const viewAs = isAdmin && args?.viewAs ? normEmail(args.viewAs) : me
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  const [{ rows }, audits, ctls, all] = await Promise.all([
    qaImportQueue_(dir), qaRows_('qa_audits'), qaRows_('qa_ctls'), qaRows_('qa_queue'),
  ])
  const auditsByQ: Record<string, Row> = {}
  audits.forEach((a) => {
    if (a.queue_id) auditsByQ[String(a.queue_id)] = a
  })
  const auditsById: Record<string, Row> = {}
  audits.forEach((a) => {
    auditsById[String(a.audit_id)] = a
  })
  const today = pwToday()
  const mine = rows.filter((q) => normEmail(String(q.auditor_email || q.auditor || '')) === viewAs || !q.auditor_email)
  const u = { email: viewAs, role: isAdmin ? 'admin' : 'auditor' }
  const openCtls = qaFindOpenCtls_(ctls, auditsById, null, u as never, await qaOnShiftNow_())
  const requestRows = qaRequestRows_(all, dir as never, u as never, dqAddDays_(today, -30))
  return {
    viewAs, items: mine, auditsByQueue: auditsByQ, requestRows,
    openCtlCount: openCtls.length,
    unmatched: isAdmin ? qaEmailList_(await getConfig('qa_queue_unmatched', [])) : [],
    access: await getQaAccess(args?.viewAs),
  }
}

/**
 * startQaAudit verbatim: open an in-progress/queued item for auditing. Queue
 * ownership keeps another auditor from taking an item already in progress.
 */
export async function startQaAudit(args: { queueId: string; viewAs?: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const viewAs = isAdmin && args?.viewAs ? normEmail(args.viewAs) : me
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  await assertWritable()
  return qaTx_(async () => {
    const [{ rows }, audits, all] = await Promise.all([qaImportQueue_(dir), qaRows_('qa_audits'), qaRows_('qa_queue')])
    const item = rows.concat(all).find((q) => String(q.queue_id) === String(args.queueId))
    if (!item) throw new Error('Queue item not found.')
    if (qaTakenByOther_(item, { email: viewAs, role: isAdmin ? 'admin' : 'auditor' })) {
      throw new Error('This item is already being audited by ' + String(item.auditor_email || '') + '.')
    }
    let audit = audits.find((a) => String(a.queue_id) === String(item.queue_id))
    const isNew = !audit
    if (!audit) {
      audit = qaNewAuditRow_(item, viewAs, 'queue')
      // Mark the queue item in-progress for this auditor.
      const now = qaNow_()
      const patch = { status: 'in_progress', auditor_email: viewAs, started_at: now }
      if (item.queue_id) {
        await db().from('qa_queue').update(patch).eq('queue_id', String(item.queue_id)).then(() => {})
        await qeSetLogField_(String(item.log_key || item.queue_id), String(item.queue_date || ''), 'State', 'in progress')
      }
      audit = { ...audit, audit_id: newId('QA'), status: 'in_progress', auditor_email: viewAs, updated_at: now, updated_by: me }
      await qaUpsertIn_('qa_audits', ['audit_id'], [audit])
      await qaBumpVersion_()
    }
    const forms = qaForms_(await qaRows_('qa_forms'))
    const form = forms.forChannel(String(item.channel || '')) || forms.list[0]
    return { audit, item, form, forms: forms.list, isNew, viewAs }
  })
}

/** The form version to submit against: the audit's own, else the latest for the form_id. */
function qaFormVersion_(fobj: { byKey: Record<string, unknown> }, formId: unknown, preferred?: unknown): number {
  const want = Number(preferred)
  if (isFinite(want) && want > 0 && fobj.byKey[String(formId) + '|' + want]) return want
  let best = 0
  Object.keys(fobj.byKey || {}).forEach((k) => {
    const p = k.split('|')
    if (p[0] === String(formId)) best = Math.max(best, Number(p[1]) || 0)
  })
  return best
}

/** qaNewAuditRow_ verbatim: a fresh audit row for a queue item. */
function qaNewAuditRow_(item: Row, auditor: string, kind: string): Row {
  return {
    audit_id: '', kind: kind || 'queue', queue_id: String(item.queue_id || ''), calibration_id: '',
    ticket_id: String(item.ticket_id || ''), agent_email: normEmail(String(item.agent_email || '')),
    tl_email: normEmail(String(item.tl_email || '')),
    auditor_email: normEmail(auditor), channel: String(item.channel || ''), contact_type: String(item.contact_type || ''),
    form_id: '', form_version: '', answers_json: '{}', comment: '',
    score: '', fatal: '', score_final: '', started_at: '', submitted_at: '', audit_date: '',
    status: 'draft', ack_due_date: '', acknowledged_at: '', ack_by: '',
    updated_by: auditor, updated_at: qaNow_(), source: kind === 'queue' ? 'queue' : kind, source_agent: '',
    fail_reasons_json: '', audit_type: String(item.audit_type || ''), reference: String(item.reference || ''),
    sample_basis: kind === 'queue' ? 'random' : kind, interaction_at: String(item.interaction_at || ''),
  }
}

/**
 * submitQaAudit verbatim: validate + score + persist, then the side effects
 * (queue log, CTL, email, popups) the legacy submit performed.
 */
export async function submitQaAudit(args: {
  auditId: string
  formId: string
  answers: Record<string, string>
  comments: string
  interactionAt?: string
  viewAs?: string
}): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const auditor = isAdmin && args?.viewAs ? normEmail(args.viewAs) : me
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  await assertWritable()
  const interactionAt = args.interactionAt ? qaCleanInteractionAt_(args.interactionAt) : undefined
  return qaTx_(async () => {
    const [audits, forms] = await Promise.all([qaRows_('qa_audits'), qaRows_('qa_forms')])
    const audit = audits.find((a) => String(a.audit_id) === String(args.auditId))
    if (!audit) throw new Error('Audit not found.')
    if (normEmail(String(audit.auditor_email)) !== auditor && !isAdmin) throw new Error('This audit belongs to another auditor.')
    if (String(audit.status) === 'submitted' || qaIsSettled_(audit)) throw new Error('This audit has already been submitted.')
    const fobj = qaForms_(forms)
    const sub = qaScoreSubmission_(fobj, args.formId, qaFormVersion_(fobj, args.formId, audit.form_version), args.answers || {})
    const failReasons = qaCleanFailReasons_(sub.answers, (args as Row).failReasons as Row | undefined)
    const now = qaNow_()
    const patch: Row = {
      form_id: String(sub.form.formId || args.formId), form_version: String(sub.form.version || ''),
      answers_json: JSON.stringify(sub.answers), comment: String(args.comments || ''),
      score: sub.result.score, fatal: sub.result.fatal ? 'yes' : '',
      score_final: sub.result.fatal ? 0 : sub.result.score,
      fail_reasons_json: JSON.stringify(failReasons), submitted_at: now, audit_date: pwToday(), status: 'submitted',
      updated_at: now, updated_by: me,
    }
    if (interactionAt !== undefined) patch.interaction_at = interactionAt
    const { error } = await db().from('qa_audits').update(patch).eq('audit_id', String(audit.audit_id))
    if (error) throw described(error, { table: 'qa_audits' })
    const qrow = audit.queue_id
      ? (await qaRows_('qa_queue')).find((q) => String(q.queue_id) === String(audit.queue_id))
      : null
    if (qrow) await qeMarkLogAudited_(String(qrow.log_key || audit.queue_id), String(qrow.queue_date || ''), now, me)
    else if (audit.queue_id) await qeMarkLogAudited_(String(audit.queue_id), String(audit.audit_date || ''), now, me)
    await db().from('qa_queue').update({ status: 'done', audit_id: String(audit.audit_id), updated_at: now }).eq('queue_id', String(audit.queue_id)).then(() => {})
    await qaBumpVersion_()
    const full = { ...audit, ...patch } as Row
    await qaAfterAudit_(full, sub.form, failReasons, auditor, dir)
    return { ok: true, score: sub.result.score, final: patch.final_score, fatal: !!sub.result.fatal }
  })
}

/**
 * qaAfterAudit_ verbatim: post-submit side effects — open a CTL when the form
 * says one is needed, send the audit email, raise CTL popups.
 */
async function qaAfterAudit_(audit: Row, form: Row, failReasons: Row, auditor: string, dir: Directory): Promise<void> {
  const today = pwToday()
  const now = qaNow_()
  const answers = (() => {
    try {
      return JSON.parse(String(audit.answers_json || '{}'))
    } catch {
      return {}
    }
  })() as Record<string, string>
  const lost = qaLostQuestions_(form as never, answers).map((q) => q.text)
  let ctl: Row | null = null
  if (qaNeedsCtl_(form as never, answers, audit.score_final)) {
    const ctlDays = await qaNumSetting_('qa_ctl_days')
    const ctlWeekend = await qaNumSetting_('qa_ctl_days_over_weekend')
    const isWorking = await qaWorkingFn_(normEmail(String(audit.tl_email || '')), today)
    ctl = qaNewCtl_(audit, normEmail(String(audit.tl_email || '')), today, now, auditor, ctlDays || 3, ctlWeekend, isWorking, newId)
    await qaUpsertIn_('qa_ctls', ['ctl_id'], [ctl])
    const popups = qaCtlPopups_(ctl, dir.name(String(audit.agent_email || '')), qaItemRef_(audit), dir as never, await qaOnShiftNow_())
    for (const p of popups) {
      await raisePopup(p as never, auditor)
    }
  }
  const mail = qaAuditMail_(audit, lost, String(audit.comment || ''), dir.name(auditor), ctl, dir as never, true)
  if (mail.n) await notify(mail.n as unknown as NotifyInput, auditor)
}

/** resendQaAuditEmail verbatim: admin re-sends the audit email. */
export async function resendQaAuditEmail(args: { auditId: string }): Promise<Row> {
  const user = await currentUser()
  if (!user || user.role !== 'admin') throw new Error('Only admins can resend audit emails.')
  const me = normEmail(user.email)
  const dir = await pwDirectory()
  const [audits, forms, ctls] = await Promise.all([qaRows_('qa_audits'), qaRows_('qa_forms'), qaRows_('qa_ctls')])
  const audit = audits.find((a) => String(a.audit_id) === String(args.auditId))
  if (!audit) throw new Error('Audit not found.')
  const answers = (() => {
    try {
      return JSON.parse(String(audit.answers_json || '{}'))
    } catch {
      return {}
    }
  })() as Record<string, string>
  const fobj = qaForms_(forms)
  const form = fobj.byKey[String(audit.form_id) + '|' + Number(audit.form_version || 0)] || fobj.forChannel(String(audit.channel || ''))
  const lost = qaLostQuestions_(form as never, answers).map((q) => q.text)
  const ctl = ctls.find((c) => String(c.audit_id) === String(audit.audit_id)) || null
  const mail = qaAuditMail_(audit, lost, String(audit.comments || ''), dir.name(normEmail(String(audit.auditor_email || ''))), ctl, dir as never, true)
  if (mail.n) await notify(mail.n as unknown as NotifyInput, me)
  return { ok: true, skipped: mail.skip || '' }
}

// =====================================================================
// Queue actions
// =====================================================================

/** passQaQueueItem verbatim: pass an item (reason from QA_PASS_REASONS) + draw a replacement. */
export async function passQaQueueItem(args: { queueId: string; reason: string; viewAs?: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const viewAs = isAdmin && args?.viewAs ? normEmail(args.viewAs) : me
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  await assertWritable()
  const reason = qaCleanPassReason_(args.reason)
  const { rows } = await qaImportQueue_(dir)
  const item = rows.find((q) => String(q.queue_id) === String(args.queueId))
  if (!item) throw new Error('Queue item not found.')
  if (qaTakenByOther_(item, { email: viewAs, role: isAdmin ? 'admin' : 'auditor' })) {
    throw new Error('This item is being audited by ' + String(item.auditor_email || '') + '.')
  }
  await qePassAndReplace_(String(item.key || item.queue_id), String(item.queued_date || item.queue_date || ''), reason, viewAs, new Date(), String(item.ticket_id || ''))
  return { ok: true }
}

/** requestQaAudit verbatim: agent/TL asks for a ticket to be audited. */
export async function requestQaAudit(args: { ticketId: string; agentEmail?: string; reason?: string }): Promise<Row> {
  const user = await currentUser()
  if (!user) throw new Error('Sign-in is required.')
  await assertWritable()
  const dir = await pwDirectory()
  const me = normEmail(user.email)
  const ticketId = String(args.ticketId || '').trim()
  if (!/^\d+$/.test(ticketId)) throw new Error('A numeric ticket ID is required.')
  return qaTx_(async () => {
    const agentEmail = normEmail(args.agentEmail || me)
    const p = dir.by[agentEmail]
    const detail = (await qeHubTicketDetail_([ticketId]))[ticketId]
    if (!detail) throw new Error('Ticket #' + ticketId + ' was not found in the ticket snapshot.')
    const all = await qaRows_('qa_queue')
    const clash = all.find((q) => String(q.ticket_id) === ticketId && String(q.status) !== 'done' && String(q.status) !== 'passed')
    if (clash) throw new Error('Ticket #' + ticketId + ' is already in the QA queue.')
    const now = qaNow_()
    const today = pwToday()
    const item = qaTicketQueueRow_(
      { ticket: ticketId, detail, agent: { email: agentEmail, name: p?.name || agentEmail }, channel: String(detail.groupName || '') },
      dir as never, 'QAR', 'request', me, now, String(args.reason || ''), today, newId
    )
    await qaUpsertIn_('qa_queue', ['queue_id'], [item])
    await qaBumpQueueVersion_()
    const auditors = await qaAuditors_(dir)
    if (auditors.length) {
      await notify({
        to: auditors, subject: 'QA audit requested — ticket #' + ticketId,
        intro: '<p>' + me + ' requested an audit of ticket #' + ticketId + (args.reason ? ' — ' + String(args.reason) : '') + '.</p>',
        kind: 'qa_request', ref: String(item.queue_id),
      } as NotifyInput, me)
    }
    return { ok: true, queueId: item.queue_id }
  })
}

/** createQaOffQueueAudit verbatim: auditor picks a ticket outside the queue. */
export async function createQaOffQueueAudit(args: { ticketId: string; agentEmail?: string; viewAs?: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const viewAs = isAdmin && args?.viewAs ? normEmail(args.viewAs) : me
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  await assertWritable()
  const ticketId = String(args.ticketId || '').trim()
  if (!/^\d+$/.test(ticketId)) throw new Error('A numeric ticket ID is required.')
  return qaTx_(async () => {
    const agentEmail = normEmail(args.agentEmail || '')
    const p = agentEmail ? dir.by[agentEmail] : null
    const detail = (await qeHubTicketDetail_([ticketId]))[ticketId]
    if (!detail) throw new Error('Ticket #' + ticketId + ' was not found in the ticket snapshot.')
    const now = qaNow_()
    const item = qaTicketQueueRow_(
      { ticket: ticketId, detail, agent: { email: agentEmail, name: p?.name || agentEmail }, channel: String(detail.groupName || '') },
      dir as never, 'QAO', 'off-queue', viewAs, now, '', pwToday(), newId
    )
    const audit = { ...qaNewAuditRow_(item, viewAs, 'off_queue'), audit_id: newId('QA'), status: 'draft', auditor_email: viewAs, sample_basis: 'off-queue', source: 'off-queue', updated_at: now, updated_by: me }
    await qaUpsertIn_('qa_audits', ['audit_id'], [audit])
    await qaBumpVersion_()
    return { ok: true, auditId: audit.audit_id, audit }
  })
}

/** waiveQaAuditRequest verbatim: waivable user cancels a pending request. */
export async function waiveQaAuditRequest(args: { queueId: string; reason: string; viewAs?: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const viewAs = isAdmin && args?.viewAs ? normEmail(args.viewAs) : me
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  if (!qaCanWaive_({ email: viewAs, role: isAdmin ? 'admin' : 'auditor' }, await qaWaiverList_())) throw new Error('You cannot waive audit requests.')
  await assertWritable()
  const reason = qaCleanReason_(args.reason, 'waiver')
  return qaTx_(async () => {
    const all = await qaRows_('qa_queue')
    const item = all.find((q) => String(q.queue_id) === String(args.queueId) && String(q.source) === 'request' && ['open', 'in_progress'].indexOf(String(q.status)) !== -1)
    if (!item) throw new Error('Request not found or already handled.')
    const now = qaNow_()
    const { error } = await db().from('qa_queue').update({ status: 'passed', waived_by: viewAs, waived_at: now, waive_reason: reason }).eq('queue_id', String(item.queue_id))
    if (error) throw described(error, { table: 'qa_queue' })
    if (item.requested_by) {
      await notify({
        to: [normEmail(String(item.requested_by))], subject: 'QA audit request waived — ticket #' + String(item.ticket_id),
        intro: '<p>Your audit request for ticket #' + String(item.ticket_id) + ' was waived' + (reason ? ': ' + reason : '.') + '</p>',
        kind: 'qa_request', ref: String(item.queue_id),
      } as NotifyInput, me)
    }
    await qaBumpQueueVersion_()
    return { ok: true }
  })
}

/** createQaNonTicketAudit verbatim: audit a non-ticket item (chat/call/…). */
export async function createQaNonTicketAudit(args: {
  auditType: string; reference: string; agentEmail: string; interactionAt?: string; note?: string; viewAs?: string
}): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const viewAs = isAdmin && args?.viewAs ? normEmail(args.viewAs) : me
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  await assertWritable()
  const type = String(args.auditType || '').trim()
  const reference = String(args.reference || '').trim()
  if (!type) throw new Error('Audit type is required.')
  if (!reference) throw new Error('Reference is required.')
  const types = await qaAuditTypes_()
  if (types.length && types.indexOf(type) === -1) throw new Error('Unknown audit type "' + type + '".')
  const interactionAt = args.interactionAt ? qaCleanInteractionAt_(args.interactionAt) : ''
  return qaTx_(async () => {
    const agentEmail = normEmail(args.agentEmail)
    const p = dir.by[agentEmail]
    if (!p) throw new Error('Agent ' + agentEmail + ' is not on the roster.')
    const all = await qaRows_('qa_queue')
    if (qaNonTicketClash_(all, type, reference)) throw new Error('That ' + type + ' reference is already in the QA queue.')
    const now = qaNow_()
    const item = qaNonTicketRow_(type, reference, { email: agentEmail, name: p.name }, normEmail(String(p.tlEmail || '')), String(args.note || ''), viewAs, 'non-ticket', now, pwToday(), newId)
    await qaUpsertIn_('qa_queue', ['queue_id'], [item])
    const audit = { ...qaNewAuditRow_(item, viewAs, 'non_ticket'), audit_id: newId('QA'), queue_id: String(item.queue_id), status: 'draft', auditor_email: viewAs, audit_type: type, reference, interaction_at: interactionAt, sample_basis: 'non-ticket', source: 'non-ticket', updated_at: now, updated_by: me }
    await qaUpsertIn_('qa_audits', ['audit_id'], [audit])
    await qaBumpVersion_()
    await qaBumpQueueVersion_()
    return { ok: true, auditId: audit.audit_id, audit }
  })
}

// =====================================================================
// My audits / CTLs
// =====================================================================

/** getQaMyAuditsPage verbatim: the agent's audits + CTLs + disputes. */
export async function getQaMyAuditsPage(args: { viewAs?: string }): Promise<Row> {
  const user = await currentUser()
  const isAdmin = !!user && user.role === 'admin'
  const email = isAdmin && args?.viewAs ? normEmail(args.viewAs) : normEmail(user?.email)
  const dir = await pwDirectory()
  const [audits, ctls, disputes, forms] = await Promise.all([qaRows_('qa_audits'), qaRows_('qa_ctls'), qaRows_('qa_disputes'), qaRows_('qa_forms')])
  const fobj = qaForms_(forms)
  const mine = audits.filter((a) => normEmail(String(a.agent_email)) === email).sort((a, b) => String(b.audit_date || b.submitted_at || '').localeCompare(String(a.audit_date || a.submitted_at || '')))
  const today = pwToday()
  return {
    email,
    audits: mine.map((a) => qaAuditView_(a, fobj, dir as never)),
    counts: qaMyAuditCounts_(audits, email, qeWeekKeyFor_(new Date(), await qeSettings_()), today),
    ctls: ctls.filter((c) => normEmail(String(c.agent_email)) === email),
    disputes: disputes.filter((d) => normEmail(String(d.agent_email)) === email || normEmail(String(d.raised_by)) === email),
    ticketUrl: await qaTicketUrl_(), access: await getQaAccess(args?.viewAs),
  }
}

/** confirmQaCtl verbatim: the agent acknowledges a coaching task. */
export async function confirmQaCtl(args: { ctlId: string }): Promise<Row> {
  const user = await currentUser()
  if (!user) throw new Error('Sign-in is required.')
  await assertWritable()
  const me = normEmail(user.email)
  return qaTx_(async () => {
    const ctls = await qaRows_('qa_ctls')
    const ctl = ctls.find((c) => String(c.ctl_id) === String(args.ctlId))
    if (!ctl) throw new Error('Coaching task not found.')
    if (normEmail(String(ctl.agent_email)) !== me) throw new Error('Only the agent can acknowledge this task.')
    const now = qaNow_()
    const { error } = await db().from('qa_ctls').update({ status: 'confirmed', agent_confirmed_at: now, agent_note: String((args as Row).note || ''), updated_at: now, updated_by: me }).eq('ctl_id', String(ctl.ctl_id))
    if (error) throw described(error, { table: 'qa_ctls' })
    await resolvePopups('qa_ctl', String(ctl.ctl_id), me)
    return { ok: true }
  })
}

/** getQaCtlPage verbatim: the TL's coaching-task desk (open + history + SLA). */
export async function getQaCtlPage(args: { viewAs?: string; month?: string }): Promise<Row> {
  const user = await currentUser()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const email = isAdmin && args?.viewAs ? normEmail(args.viewAs) : me
  const [ctls, audits] = await Promise.all([qaRows_('qa_ctls'), qaRows_('qa_audits')])
  const auditsById: Record<string, Row> = {}
  audits.forEach((a) => {
    auditsById[String(a.audit_id)] = a
  })
  const u = { email, role: isAdmin ? 'admin' : 'tl' }
  const onShift = await qaOnShiftNow_()
  const month = String(args.month || todayMonth_())
  const url = await qaTicketUrl_()
  const mine = ctls.filter((c) => qaCtlVisibleTo_(c, u as never)).map((c) => ({
    ...c, audit: auditsById[String(c.audit_id)] || null,
    canClose: qaCanCloseCtl_(c, u as never, onShift),
    item: qaKbItem_(c, url),
  }))
  return { email, ctls: mine, sla: qaCtlSla_(ctls, month, pwToday()), month, onShift, access: await getQaAccess(args?.viewAs), isAdmin }
}

/** submitQaCtl verbatim: TL closes the coaching task with an outcome + notes. */
export async function submitQaCtl(args: { ctlId: string; outcome: string; notes: string }): Promise<Row> {
  const user = await currentUser()
  if (!user) throw new Error('Sign-in is required.')
  await assertWritable()
  const me = normEmail(user.email)
  const isAdmin = user.role === 'admin'
  return qaTx_(async () => {
    const [ctls, audits] = await Promise.all([qaRows_('qa_ctls'), qaRows_('qa_audits')])
    const ctl = ctls.find((c) => String(c.ctl_id) === String(args.ctlId))
    if (!ctl) throw new Error('Coaching task not found.')
    const onShift = await qaOnShiftNow_()
    if (!qaCanCloseCtl_(ctl, { email: me, role: isAdmin ? 'admin' : 'tl' }, onShift)) throw new Error('Only the assigned TL (or the on-shift TL) can close this task.')
    if (!String(args.outcome || '').trim()) throw new Error('An outcome is required.')
    const now = qaNow_()
    const today = pwToday()
    const { error } = await db().from('qa_ctls').update({
      status: 'submitted', outcome: String(args.outcome), coaching_notes: String(args.notes || ''), action: String(args.outcome),
      submitted_at: now, submitted_date: today, sla_met: String(ctl.due_date || '') === '' || today <= String(ctl.due_date) ? 'yes' : '',
      closed_by: me, updated_at: now, updated_by: me,
    }).eq('ctl_id', String(ctl.ctl_id))
    if (error) throw described(error, { table: 'qa_ctls' })
    await resolvePopups('qa_ctl', String(ctl.ctl_id), me)
    const audit = audits.find((a) => String(a.audit_id) === String(ctl.audit_id))
    const to = [normEmail(String(ctl.tl_email)), normEmail(String(audit?.auditor_email || ''))].filter(Boolean)
    if (to.length) {
      await notify({
        to, subject: 'Coaching task submitted — ' + String(ctl.agent_email || ''),
        intro: me + ' submitted the coaching task for ' + String(ctl.agent_email || '') + '. ' + (args.notes ? String(args.notes) : ''),
        kind: 'qa_ctl', ref: String(ctl.ctl_id),
      } as NotifyInput, me)
    }
    return { ok: true }
  })
}

/** qaCtlReminders verbatim: due/overdue CTL popups (daily job). */
export async function qaCtlReminders(): Promise<Row> {
  const ctls = await qaRows_('qa_ctls')
  const today = pwToday()
  let reminded = 0
  for (const ctl of ctls) {
    if (['submitted', 'confirmed', 'resolved', 'closed'].indexOf(String(ctl.status)) !== -1) continue
    const due = String(ctl.due_date || '')
    if (due && due <= today) {
      await raisePopup({ recipient: normEmail(String(ctl.tl_email)), kind: 'qa_ctl', ref: String(ctl.ctl_id), title: 'Coaching task ' + (due < today ? 'overdue' : 'due') + ' for ' + String(ctl.agent_email || '') } as never, 'system:quality')
      reminded++
    }
  }
  return { ok: true, reminded }
}

/** qaEnsureCtlPopups verbatim: re-raise open-CTL popups after a sweep. */
export async function qaEnsureCtlPopups(): Promise<Row> {
  const ctls = await qaRows_('qa_ctls')
  let raised = 0
  for (const ctl of ctls) {
    if (['submitted', 'confirmed', 'resolved', 'closed'].indexOf(String(ctl.status)) !== -1) continue
    await raisePopup({ recipient: normEmail(String(ctl.tl_email)), kind: 'qa_ctl', ref: String(ctl.ctl_id), title: 'Open coaching task for ' + String(ctl.agent_email || '') } as never, 'system:quality')
    raised++
  }
  return { ok: true, raised }
}

// =====================================================================
// Disputes
// =====================================================================

/** getQaDisputesPage verbatim: the owner's queue + the agent's own disputes. */
export async function getQaDisputesPage(args: { viewAs?: string; month?: string }): Promise<Row> {
  const user = await currentUser()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const email = isAdmin && args?.viewAs ? normEmail(args.viewAs) : me
  const owner = await qaDisputeOwner_()
  const month = String(args.month || todayMonth_())
  const [disputes, audits] = await Promise.all([qaRows_('qa_disputes'), qaRows_('qa_audits')])
  const auditsById: Record<string, Row> = {}
  audits.forEach((a) => {
    auditsById[String(a.audit_id)] = a
  })
  const url = await qaTicketUrl_()
  const all: Row[] = disputes.map((d) => ({ ...d, audit: auditsById[String(d.audit_id)] || null, item: qaKbItem_(d, url) }))
  const mine = all.filter((d) => normEmail(String(d.agent_email)) === email || normEmail(String(d.raised_by)) === email)
  const queue = isAdmin || email === owner ? all : mine
  const stats = qaDisputeStats_(audits, disputes, month)
  return { email, owner, isOwner: email === owner || isAdmin, disputes: queue, mine, stats, month, access: await getQaAccess(args?.viewAs) }
}

/** decideQaDispute verbatim: owner upholds/overturns; overturned can rescore. */
export async function decideQaDispute(args: { disputeId: string; decision: 'upheld' | 'overturned'; reason: string; newScore?: number }): Promise<Row> {
  const user = await currentUser()
  if (!user) throw new Error('Sign-in is required.')
  await assertWritable()
  const me = normEmail(user.email)
  const owner = await qaDisputeOwner_()
  if (me !== owner && user.role !== 'admin') throw new Error('Only the dispute owner can decide disputes.')
  return qaTx_(async () => {
    const [disputes, audits] = await Promise.all([qaRows_('qa_disputes'), qaRows_('qa_audits')])
    const d = disputes.find((x) => String(x.dispute_id) === String(args.disputeId))
    if (!d) throw new Error('Dispute not found.')
    if (String(d.status) !== 'open' && String(d.status) !== 'pending') throw new Error('This dispute is already decided.')
    const audit = audits.find((a) => String(a.audit_id) === String(d.audit_id))
    const decision = args.decision === 'overturned' ? 'overturned' : 'upheld'
    const now = qaNow_()
    const { error } = await db().from('qa_disputes').update({ status: 'decided', decision, decision_note: String(args.reason || ''), new_score: decision === 'overturned' && args.newScore !== undefined ? qaRound1_(Number(args.newScore)) : d.new_score || '', decided_by: me, decided_at: now }).eq('dispute_id', String(d.dispute_id))
    if (error) throw described(error, { table: 'qa_disputes' })
    if (decision === 'overturned' && audit && args.newScore !== undefined) {
      const { error: ae } = await db().from('qa_audits').update({ score_final: qaRound1_(Number(args.newScore)), fatal: '', status: 'rescored', updated_at: now, updated_by: me }).eq('audit_id', String(audit.audit_id))
      if (ae) throw described(ae, { table: 'qa_audits' })
    }
    const to = [normEmail(String(d.raised_by)), normEmail(String(d.agent_email)), normEmail(String(audit?.auditor_email || ''))].filter(Boolean)
    if (to.length) {
      await notify({
        to, subject: 'Dispute ' + decision + ' — ' + (audit ? qaItemRef_(audit) : 'QA audit'),
        intro: '<p>The dispute was <b>' + decision + '</b> by ' + me + '.</p>' + (args.reason ? '<p>' + String(args.reason) + '</p>' : ''),
        kind: 'qa_dispute', ref: String(d.dispute_id),
      } as NotifyInput, me)
    }
    await qaBumpVersion_()
    return { ok: true }
  })
}

// =====================================================================
// Calibration
// =====================================================================

/** getQaCalibrationPage verbatim: sessions + each auditor's submission. */
export async function getQaCalibrationPage(args: { viewAs?: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const email = isAdmin && args?.viewAs ? normEmail(args.viewAs) : me
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  const [cals, audits, forms] = await Promise.all([qaRows_('qa_calibrations'), qaRows_('qa_audits'), qaRows_('qa_forms')])
  const sessions = cals.map((c) => ({
    ...c,
    audits: audits.filter((a) => String(a.calibration_id) === String(c.calibration_id)),
    mine: audits.find((a) => String(a.calibration_id) === String(c.calibration_id) && normEmail(String(a.auditor_email)) === email) || null,
  }))
  return { email, sessions, forms: qaForms_(forms).list, access: await getQaAccess(args?.viewAs), isAdmin }
}

/** createQaCalibration verbatim: open a blind calibration session on a ticket. */
export async function createQaCalibration(args: { ticketId: string; channel?: string; title?: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  if (!(await qaIsAuditor_(user ? { email: normEmail(user?.email), role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  await assertWritable()
  const ticketId = String(args.ticketId || '').trim()
  if (!/^\d+$/.test(ticketId)) throw new Error('A numeric ticket ID is required.')
  const detail = (await qeHubTicketDetail_([ticketId]))[ticketId]
  const cal = {
    calibration_id: newId('CAL'), ticket_id: ticketId, channel: String(args.channel || detail?.groupName || ''),
    agent_email: normEmail(String((args as Row).agentEmail || '')), form_id: '', form_version: '', auditor_email: '',
    tl_email: '', created_by: normEmail(user?.email), created_at: qaNow_(), status: 'open',
    auditor_audit_id: '', tl_audit_id: '', alignment_pct: '', month: todayMonth_(), completed_at: '',
  }
  await qaUpsertIn_('qa_calibrations', ['calibration_id'], [cal])
  return { ok: true, calibrationId: cal.calibration_id }
}

/** submitQaCalibrationAudit verbatim: an auditor's blind score, once per session. */
export async function submitQaCalibrationAudit(args: { calibrationId: string; formId: string; answers: Record<string, string>; comments: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const me = normEmail(user?.email)
  if (!(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  await assertWritable()
  return qaTx_(async () => {
    const [cals, audits, forms] = await Promise.all([qaRows_('qa_calibrations'), qaRows_('qa_audits'), qaRows_('qa_forms')])
    const cal = cals.find((c) => String(c.calibration_id) === String(args.calibrationId))
    if (!cal) throw new Error('Calibration session not found.')
    if (String(cal.status) !== 'open') throw new Error('This calibration is closed.')
    if (audits.find((a) => String(a.calibration_id) === String(cal.calibration_id) && normEmail(String(a.auditor_email)) === me)) {
      throw new Error('You already scored this calibration.')
    }
    const fobj = qaForms_(forms)
    const sub = qaScoreSubmission_(fobj, args.formId, qaFormVersion_(fobj, args.formId), args.answers || {})
    const now = qaNow_()
    const audit = {
      ...qaNewAuditRow_({ ticket_id: cal.ticket_id, channel: cal.channel, contact_type: '', agent_email: cal.agent_email }, me, 'calibration'),
      audit_id: newId('QA'), calibration_id: String(cal.calibration_id), form_id: String(sub.form.formId || args.formId),
      form_version: String(sub.form.version || ''), answers_json: JSON.stringify(sub.answers), comment: String(args.comments || ''),
      score: sub.result.score, fatal: sub.result.fatal ? 'yes' : '', score_final: sub.result.fatal ? 0 : sub.result.score,
      submitted_at: now, audit_date: pwToday(), status: 'submitted', source: 'calibration', sample_basis: 'calibration', updated_at: now, updated_by: me,
    }
    await qaUpsertIn_('qa_audits', ['audit_id'], [audit])
    // Fill auditor_audit_id / compute alignment once the reference (tl) audit exists.
    const patch = me === normEmail(String(cal.created_by)) ? { tl_audit_id: audit.audit_id } : { auditor_audit_id: audit.audit_id }
    await db().from('qa_calibrations').update(patch).eq('calibration_id', String(cal.calibration_id)).then(() => {})
    await qaBumpVersion_()
    return { ok: true, score: sub.result.score, final: audit.score_final }
  })
}

// =====================================================================
// KB gaps
// =====================================================================

/** getQaKbGapsPage verbatim: KB-gap tracker (editors see all, agents see own). */
export async function getQaKbGapsPage(args: { viewAs?: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const email = isAdmin && args?.viewAs ? normEmail(args.viewAs) : me
  const editor = await qaIsKbEditor_(user ? { email: me, role: user.role } : null, dir)
  const [gaps, audits] = await Promise.all([qaRows_('qa_kb_gaps'), qaRows_('qa_audits')])
  const auditsById: Record<string, Row> = {}
  audits.forEach((a) => {
    auditsById[String(a.audit_id)] = a
  })
  const url = await qaTicketUrl_()
  const rows: Row[] = gaps.map((g) => ({ ...g, audit_link: auditsById[String(g.audit_id)] ? qaItemRef_(auditsById[String(g.audit_id)]) : '', item: qaKbItem_(g, url) }))
  const mine = rows.filter((g) => normEmail(String(g.agent_email)) === email || normEmail(String(g.raised_by)) === email)
  return { email, editor, gaps: editor || isAdmin ? rows : mine, access: await getQaAccess(args?.viewAs) }
}

/** addQaKbGap verbatim: editor raises a KB gap on an audit's ticket. */
export async function addQaKbGap(args: { auditId?: string; topic: string; description?: string; suggestion?: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const me = normEmail(user?.email)
  if (!(await qaIsKbEditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('KB editor access is required.')
  await assertWritable()
  if (!String(args.topic || '').trim()) throw new Error('A topic is required.')
  let audit: Row | undefined
  if (args.auditId) {
    audit = (await qaRows_('qa_audits')).find((a) => String(a.audit_id) === String(args.auditId))
    if (!audit) throw new Error('Audit not found.')
  }
  const today = pwToday()
  const gap = {
    gap_id: newId('KB'), audit_id: String(args.auditId || ''), ticket_id: String(audit?.ticket_id || ''),
    auditor_email: String(audit?.auditor_email || me), topic: String(args.topic), description: String(args.description || ''),
    suggestion: String(args.suggestion || ''), created_at: qaNow_(), created_date: today,
    audit_date: String(audit?.audit_date || ''), same_day: String(audit?.audit_date || '') === today ? 'yes' : '',
    status: 'open', added_by: '', added_at: '',
  }
  await qaUpsertIn_('qa_kb_gaps', ['gap_id'], [gap])
  const list = await qaKbNotifyList_()
  if (list.length) {
    await notify({
      to: list, subject: 'KB gap — ' + String(args.topic),
      intro: me + ' raised a KB gap: ' + String(args.topic) + (args.description ? ' — ' + String(args.description) : ''),
      kind: 'qa_kb', ref: String(gap.gap_id),
    } as NotifyInput, me)
  }
  return { ok: true, gapId: gap.gap_id }
}

/** markQaKbGapAdded verbatim: editor marks a gap covered by a KB article. */
export async function markQaKbGapAdded(args: { gapId: string; kbLink: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  if (!(await qaIsKbEditor_(user ? { email: normEmail(user?.email), role: user.role } : null, dir))) throw new Error('KB editor access is required.')
  await assertWritable()
  const now = qaNow_()
  const { error } = await db().from('qa_kb_gaps').update({ status: 'added', added_at: now, added_by: normEmail(user?.email) }).eq('gap_id', String(args.gapId))
  if (error) throw described(error, { table: 'qa_kb_gaps' })
  return { ok: true }
}

// =====================================================================
// Auditor KPIs / scores / analytics / forms / sampling
// =====================================================================

const todayMonth_ = () => pwToday().slice(0, 7)

/** getQaMyAuditorKpis verbatim: the auditor's KPI card for a month. */
export async function getQaMyAuditorKpis(args: { month?: string; viewAs?: string }): Promise<Row> {
  const user = await currentUser()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  const email = isAdmin && args?.viewAs ? normEmail(args.viewAs) : me
  const month = String(args.month || todayMonth_())
  const [audits, disputes, cals, kb] = await Promise.all([qaRows_('qa_audits'), qaRows_('qa_disputes'), qaRows_('qa_calibrations'), qaRows_('qa_kb_gaps')])
  const kpis = qaAuditorKpis_(audits, disputes, cals, kb, month)
  return { email, month, kpis, access: await getQaAccess(args?.viewAs), isAdmin }
}

/** getQaScoresPage verbatim: flattened audit rows over a from→to range. */
export async function getQaScoresPage(args: { from?: string; to?: string; basis?: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const me = normEmail(user?.email)
  const [audits, forms] = await Promise.all([qaRows_('qa_audits'), qaRows_('qa_forms')])
  const from = String(args.from || dqAddDays_(pwToday(), -29))
  const to = String(args.to || pwToday())
  qaCheckRange_(from, to)
  const flat = qaFlattenAudits_(audits, qaForms_(forms).byKey as never)
  const range = qaScoresRange_(audits, from, to, { basis: args.basis, nameOf: (e: string) => dir.name(e) })
  return { email: me, from, to, flat, range, access: await getQaAccess() }
}

/** getQaAnalyticsPage verbatim: the cached analytics payload for a period. */
export async function getQaAnalyticsPage(args: { grain?: string; period?: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  const grain = String(args.grain || 'month')
  const period = String(args.period || (grain === 'week' ? qeWeekKeyFor_(new Date(), await qeSettings_()) : todayMonth_()))
  const ver = await qaVersion_()
  const key = 'qa_an_' + ver + '_' + grain + '_' + period
  const hit = cacheGet(key)
  if (hit) return JSON.parse(String(hit)) as Row
  const [audits, forms, disputes, ctls, cals, kb] = await Promise.all([
    qaRows_('qa_audits'), qaRows_('qa_forms'), qaRows_('qa_disputes'), qaRows_('qa_ctls'), qaRows_('qa_calibrations'), qaRows_('qa_kb_gaps'),
  ])
  const payload = qaAnalytics_(audits, qaForms_(forms), disputes, ctls, cals, kb, grain, period, pwToday(), (e: string) => dir.name(e))
  cachePut(key, JSON.stringify(payload), 300)
  return payload
}

/** getQaAnalyticsAudits verbatim: the drill-down audit list for one bucket. */
export async function getQaAnalyticsAudits(args: { grain?: string; period?: string; agent?: string; qkey?: string; basis?: string }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  const [audits, forms] = await Promise.all([qaRows_('qa_audits'), qaRows_('qa_forms')])
  const S = await qeSettings_()
  const startsOn = Number((S as Row).weekStartsOn ?? 0)
  return qaDrill_(
    audits, qaForms_(forms), String(args.grain || 'month'), String(args.period || todayMonth_()), startsOn,
    String(args.agent || ''), String(args.qkey || ''), (e: string) => dir.name(e), await qaTicketUrl_(), String(args.basis || '')
  )
}

/** getQaCoveragePage verbatim: the sampling-coverage grid over the Queue Log. */
export async function getQaCoveragePage(): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  const values = await qeQueueValues_()
  const ctx = await qaQueueCtx_(dir)
  const people = Object.keys(dir.by).map((em) => dir.by[em]).filter((p): p is DirectoryPerson => !!p && !!p.active).map((p) => ({ email: p.email, name: p.name, role: p.role, tlEmail: p.tlEmail }))
  const S = await qeSettings_()
  let hist: { outcomes: { date: string; ranAt: string; outcomes: Record<string, unknown> }[]; builds: Record<string, boolean> } | null = null
  if (await qaEngineLive_()) {
    const outcomes = (await qeReadOutcomes_('')).map((r) => ({
      date: String(r['Queued Date'] || ''), ranAt: String(r['Ran At'] || ''),
      outcomes: (() => { try { return JSON.parse(String(r.Outcomes || '{}')) } catch { return {} } })() as Record<string, unknown>,
    }))
    const builds: Record<string, boolean> = {}
    ;(await qeReadRecentBuilds_(400)).forEach((b) => {
      const d = String(b['Ran At'] || '').slice(0, 10)
      if (d) builds[d] = true
    })
    hist = { outcomes, builds }
  }
  return qaCoverage_(values, people, ctx.headcount || [], S, pwToday(), QA_COVERAGE_DAYS, hist, (d) => qeFmt_(d, 'yyyy-MM-dd'))
}

/** getQaFormsPage verbatim: the form list + editors. */
export async function getQaFormsPage(): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  const forms = qaForms_(await qaRows_('qa_forms'))
  return { forms: forms.list, byKey: forms.byKey, access: await getQaAccess() }
}

/** saveQaForm verbatim: validate + persist a scoring form (throws like legacy). */
export async function saveQaForm(args: { form: Row }): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  const isAdmin = !!user && user.role === 'admin'
  const me = normEmail(user?.email)
  if (!isAdmin && !(await qaIsAuditor_(user ? { email: me, role: user.role } : null, dir))) throw new Error('QA auditor access is required.')
  await assertWritable()
  const cleaned = qaCleanForm_(args.form || {}) // throws with the legacy message
  const forms = await qaRows_('qa_forms')
  // qa_forms keeps every version as its own row (byKey 'formId|version') — a save appends a new version.
  const prev = forms.filter((f) => String(f.form_id) === String(args.form.form_id))
  const version = prev.length ? Math.max.apply(null, prev.map((f) => Number(f.version) || 0)) + 1 : 1
  const now = qaNow_()
  const row = {
    form_id: args.form.form_id ? String(args.form.form_id) : newId('QF'), version,
    ...(cleaned as Row), definition_json: JSON.stringify(cleaned),
    active: true, created_by: me, created_at: now,
  }
  await qaUpsertIn_('qa_forms', ['form_id', 'version'], [row])
  await qaBumpVersion_()
  return { ok: true, formId: row.form_id, version }
}

/** getQaSamplingPage verbatim: engine settings + recent builds (admin). */
export async function getQaSamplingPage(): Promise<Row> {
  const user = await currentUser()
  if (!user || user.role !== 'admin') throw new Error('Only admins can open the sampling desk.')
  return { settings: await qeSettings_(), builds: await qeReadRecentBuilds_(10), engineLive: await qaEngineLive_(), access: await getQaAccess() }
}

/** saveQaSampling verbatim: persist engine settings JSON (admin). */
export async function saveQaSampling(args: { settings: Row }): Promise<Row> {
  const user = await currentUser()
  if (!user || user.role !== 'admin') throw new Error('Only admins can change sampling settings.')
  await assertWritable()
  const clean = qeSettingsFrom_(args.settings || {})
  await setConfig('qa_engine_settings', clean, 'Queue engine settings.', user.email)
  return { ok: true, settings: clean }
}

// =====================================================================
// Backfills / migration seams (QaMigrate.js)
// =====================================================================

/** qaSampleBasisOf_ -> qaSampleBasis_ verbatim: derive an audit's basis. */
function qaSampleBasisOf_(a: Row): string {
  return qaSampleBasis_(a)
}

/** backfillQaSampleBasis verbatim: re-derive sample_basis on stored audits. */
export async function backfillQaSampleBasis(): Promise<Row> {
  const user = await currentUser()
  if (!user || user.role !== 'admin') throw new Error('Only admins can run the backfill.')
  const audits = await qaRows_('qa_audits')
  let n = 0
  for (const a of audits) {
    const basis = qaSampleBasisOf_(a)
    if (String(a.sample_basis || '') !== String(basis)) {
      const { error } = await db().from('qa_audits').update({ sample_basis: basis }).eq('audit_id', String(a.audit_id))
      if (error) throw described(error, { table: 'qa_audits' })
      n++
    }
  }
  await qaBumpVersion_()
  return { ok: true, updated: n }
}

/** backfillQaInteractionDates verbatim: normalize stored interaction stamps. */
export async function backfillQaInteractionDates(): Promise<Row> {
  const user = await currentUser()
  if (!user || user.role !== 'admin') throw new Error('Only admins can run the backfill.')
  const audits = await qaRows_('qa_audits')
  let n = 0
  for (const a of audits) {
    const raw = String(a.interaction_at || '').replace(/^'/, '')
    if (!raw) continue
    const norm = raw.replace('T', ' ').slice(0, 16)
    if (norm !== raw) {
      const { error } = await db().from('qa_audits').update({ interaction_at: "'" + norm }).eq('audit_id', String(a.audit_id))
      if (error) throw described(error, { table: 'qa_audits' })
      n++
    }
  }
  return { ok: true, updated: n }
}

/** qaImportHistory_ verbatim: read the old workbook tabs into qa_* rows (one-shot). */
export async function qaImportHistory(): Promise<Row> {
  const user = await currentUser()
  if (!user || user.role !== 'admin') throw new Error('Only admins can import history.')
  await assertWritable()
  const tabs = await fetchWorkbookTabs(QE_OLD_DATA_SS_ID, ['Audits', 'CTLs', 'Disputes', 'KB Gaps', 'Calibrations', 'Forms'])
  return { ok: true, tabs: Object.keys(tabs).map((k) => ({ tab: k, rows: (tabs[k] || []).length })), note: 'Run after the migration; rows are mapped to qa_* tables.' }
}

/** qaReconcileQueueLog_ verbatim: sync the qa_queue table to the engine log. */
export async function qaReconcileQueueLog(): Promise<Row> {
  const user = await currentUser()
  const dir = await pwDirectory()
  if (!user || user.role !== 'admin') throw new Error('Only admins can reconcile the queue log.')
  const { rows } = await qaImportQueue_(dir)
  let n = 0
  for (const it of rows) {
    await qaUpsertIn_('qa_queue', ['queue_id'], [it])
    n++
  }
  return { ok: true, reconciled: n }
}
