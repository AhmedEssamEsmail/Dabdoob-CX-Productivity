/**
 * migrate.ts — the Postgres port of QaMigrate.js.
 *
 * What it covers:
 *   - qaImportHistory_ : reads the two Google-Forms response sheets ("Voice QA
 *     Form V1 (Responses)", "Texting QA Form V1 (Responses)") and upserts mapped
 *     rows into qa_audits. Deterministic audit ids => safe to re-run. A cursor
 *     per sheet lives in app config (QE_HIST_*), resuming where the last run
 *     stopped — exactly the legacy Script-Properties behaviour.
 *   - qaReconcileQueueLog_ : marks engine Queue Log rows audited when a matching
 *     qa_audits row exists (ticket + first-two-names agent + submitted >= queued).
 *   - The derived forms constants (QA_FORM_QUESTIONS / QA_DERIVED_FORMS /
 *     qaDerivedDefinition_) verbatim, so historical answers map to the same ids.
 *
 * History import is admin-only (the server layer requires it) AND gated by the
 * `qa_history_secret` config when set — POST /api/qa/importHistory {secret}.
 */
import { db, readRows, sanitizeInput } from '@/features/shared/platform/repo'
import { getConfig, setConfig } from '@/features/shared/platform/settings'
import { normEmail, pwDirectory } from '@/features/shared/platform/identity'
import { described } from '@/features/shared/lib/errors'
import { qaBool_ } from './core'
import {
  qeFmt_,
  qeLocal_,
  qeParseTouchDate_,
  qeNormAgent_,
  qeCanonAgent_,
} from './engine'

type Row = Record<string, unknown>

const QA_HIST_CHUNK = 1200 // the voice sheet is ~140 columns wide (old SCORE_CHUNK_ROWS)

// =====================================================================
// Derived forms (verbatim QA_FORM_QUESTIONS / QA_DERIVED_FORMS)
// =====================================================================

/** [question id, pillar, deduction % when failed, question text as the header]. */
export const QA_FORM_QUESTIONS: Record<string, [string, string, number, string][]> = {
  voice: [
    ['v01', 'Greeting', 20, 'Opening: Did the agent start the call with positive greeting in an active, clear and attentive voice following the opening standards?'],
    ['v02', 'Greeting', 20, 'Did the agent asked the customer if the time of the call is suitable?'],
    ['v03', 'Greeting', 20, 'Entity Name : Did the agent mention the name of the company?'],
    ['v04', 'Listen & Understand your customer', 100, "Acknowledgement: Did the agent acknowledge and cover all customer's concerns during the call?"],
    ['v05', 'Clear & Effective Communication', 20, 'Did the customer avoid repeating their questions or not correct the agent?'],
    ['v06', 'Listen & Understand your customer', 100, 'Did the agent avoid asking unnecessary questions during the interaction?'],
    ['v07', 'Right Resolution', 100, 'Is the solution communicated does follow documented logic for the correct issue?'],
    ['v08', 'Right Resolution', 100, 'Did the agent communicate a logical and complete solution to the customer?'],
    ['v09', 'Right Resolution', 0, 'Did the agent submit the undocumented/outdated logic form'],
    ['v10', 'Actions & Documentation', 20, "Did the agent address the customer's issue clearly and ensure duplicate tickets were cross-linked to maintain a single point of contact?"],
    ['v11', 'Actions & Documentation', 50, 'Did the agent select the correct contact type?'],
    ['v12', 'Actions & Documentation', 100, 'Internal Action: Did the agent accurately complete all required customer requests and account actions using the appropriate tools?'],
    ['v13', 'Actions & Documentation', 100, 'External Actions: Did the agent perform all necessary customer-facing actions accurately, ensuring clarity and visibility for the customer?'],
    ['v14', 'Professionalism', 100, 'Did the agent maintain a polite and professional tone throughout the call, without any rudeness, sarcasm, or foul language?'],
    ['v15', 'Professionalism', 100, 'Did the agent avoid using over-promising phrases or absolute commitments during the conversation?'],
    ['v16', 'Professionalism', 100, "Did the agent show empathy whenever it's required?"],
    ['v17', 'Professionalism', 100, 'Did the agent stay on the call until proper wrap-up and avoid intentionally disconnecting early?'],
    ['v18', 'Professionalism', 100, 'Did the agent allow the customer to speak without unnecessary interruptions?'],
    ['v19', 'Call Control', 20, 'Did the agent maintained less than 20 secs of dead Air?'],
    ['v20', 'Call Control', 20, 'Did the agent set a proper hold time expectations for the customer?'],
    ['v21', 'Call Control', 20, 'Did the agent explain the reason for hold before and/or after (outcome of action done while on hold)?'],
    ['v22', 'Call Control', 20, 'Did the agent thank customer when refreshing hold and/or returning from hold?'],
    ['v23', 'Call Control', 20, 'Did the agent avoid unnecessary use of hold?'],
    ['v24', 'Closure', 50, 'Did the agent use proper closing as prescribed by agreed standards?'],
    ['v25', 'Closure', 20, 'Did the agent recapped all inquiries before ending the call?'],
    ['v26', 'Closure', 20, 'Did the agent ask the caller if he/she had additional inquiries?'],
    ['v27', 'Company Policy & Procedures', 50, 'Did the agent inform the customer at the beginning of the outbound call that the call is being recorded for quality and training purposes?'],
    ['v28', 'Company Policy & Procedures', 100, 'Did the agent avoid disclosing Dabdoob’s internal policies or tool names to the customer, in line with confidentiality guidelines?'],
    ['v29', 'Clear & Effective Communication', 20, "Did the agent pace match customer's pace (too slow, too fast)?"],
    ['v30', 'Clear & Effective Communication', 20, 'Did the agent avoid repeating himself within the same reply?'],
    ['v31', 'Clear & Effective Communication', 20, 'Did the agent use proper pronunciation during the calls?'],
    ['v32', 'Professionalism', 0, 'Did the agent follow the correct procedure when the customer could not be heard — by repeating the greeting three times, informing of call closure, ending the call, and attempting one callback?'],
    ['v33', 'Call Control', 20, 'Is the agent completely restricted from using the mute function at any time during the call?'],
  ],
  text: [
    ['t01', 'Greeting', 20, 'Did the agent send the opening (within 5 secs) when the chat/comment came in?'],
    ['t02', 'Greeting', 20, 'Did the agent start the chat/comment by greeting the customer by name and identifying self?'],
    ['t03', 'Greeting', 20, 'Dabdoob Branding - Did the agent mention the name of the entity?'],
    ['t04', 'Greeting', 20, 'Did the agent offered to Assist the customer?'],
    ['t05', 'Professionalism', 20, 'In outbound call, Did the agent ask the customer if the time of the call is suitable?'],
    ['t06', 'Listen & Understand your customer', 100, 'Did the agent acknowledge and cover all customer\'s concerns?'],
    ['t07', 'Listen & Understand your customer', 100, 'Did the agent ask only the necessary questions?'],
    ['t08', 'Listen & Understand your customer', 100, 'Did the customer ask each question only once and not need to correct the agent?'],
    ['t09', 'Right Resolution', 100, 'Is the solution communicated follow documented logic for the correct issue?'],
    ['t10', 'Right Resolution', 100, 'Was the solution communicated logical and complete?'],
    ['t11', 'Right Resolution', 100, 'Did the agent shared documented up-to-date logic?'],
    ['t12', 'Actions & Documentation', 50, 'Is the contact type selected is correct?'],
    ['t13', 'Actions & Documentation', 100, 'Did the agent took the right Internal actions (Creating Ticket/Sending Emails/Account actions)'],
    ['t14', 'Actions & Documentation', 100, 'Did the agent took the right External or process action (customer facing)?'],
    ['t15', 'Actions & Documentation', 50, 'Did the agent address any duplicate tickets and merged both cases?'],
    ['t16', 'Actions & Documentation', 100, 'If the ticket/chat required an outbound call, did the agent make the call as needed?'],
    ['t17', 'Professionalism', 100, 'Did the agent remain polite, professional, and use appropriate language?'],
    ['t18', 'Professionalism', 100, 'Did the agent avoid over-promising and absolutes, and set realistic expectations?'],
    ['t19', 'Professionalism', 100, 'Did the agent show empathy whenever it\'s required?'],
    ['t20', 'Closure', 100, 'Did the agent properly close the chat without disconnecting prematurely?'],
    ['t21', 'Professionalism', 100, 'Did the agent avoid any interruption to the customer?'],
    ['t22', 'Body & Concise', 20, 'Did the agent provide clear and non-repetitive responses without reusing the same body of text?'],
    ['t23', 'Body & Concise', 20, 'Did the agent use correct spelling and grammar throughout the chat?'],
    ['t24', 'Closure', 50, 'Did the agent use proper closing as prescribed by agreed standards?'],
    ['t25', 'Closure', 20, 'Did the agent ask the customer if he/she had additional inquiries?'],
    ['t26', 'Company Policy & Procedures', 100, 'Did the agent maintain the organization’s confidentiality in all communication and actions?'],
    ['t27', 'Company Policy & Procedures', 100, 'Did the agent avoid unapproved legal or regulatory language and use only compliant communication?'],
    ['t28', 'Company Policy & Procedures', 50, 'Did the Agent mention the brand name correctly (Dabdoob) ?'],
    ['t29', 'Right Resolution', 50, 'Did the agent follow the correct inactivity procedure for Live Chat and Social Media — by sending timely prompts, closure notices, and the closure script as per channel guidelines?'],
  ],
}

/** The four seeded forms (one per V2 channel). */
export const QA_DERIVED_FORMS = [
  { formId: 'FRM-VOICE-IN', set: 'voice', channel: 'Inbound Calls', title: 'Voice QA (inbound calls)' },
  { formId: 'FRM-VOICE-OUT', set: 'voice', channel: 'Waiting Address', title: 'Voice QA (outbound calls, waiting address)' },
  { formId: 'FRM-TEXT-CHAT', set: 'text', channel: 'Chats', title: 'Texting QA (chats, comments, email)' },
  { formId: 'FRM-TEXT-INT', set: 'text', channel: 'Internal Tickets', title: 'Texting QA (internal tickets)' },
]

/** qaTextCallControlSection_ verbatim (tc19.. ids never collide with t01-t29). */
export function qaTextCallControlSection_(): Row {
  const qs = QA_FORM_QUESTIONS.voice.filter((q) => q[1] === 'Call Control')
  return {
    id: 'scc', title: 'Call Control', optional: true,
    questions: qs.map((q) => ({ id: 'tc' + q[0].slice(1), text: q[3], weight: q[2], fatal: q[2] >= 100, hint: '' })),
  }
}

/** qaDerivedDefinition_ verbatim: sections = pillars in order of first appearance. */
export function qaDerivedDefinition_(set: string): Row {
  const sections: Row[] = []
  const byPillar: Record<string, Row> = {}
  QA_FORM_QUESTIONS[set].forEach((q) => {
    let s = byPillar[q[1]]
    if (!s) {
      s = byPillar[q[1]] = { id: 's' + (sections.length + 1), title: q[1], questions: [] }
      sections.push(s)
    }
    ;(s.questions as Row[]).push({ id: q[0], text: q[3], weight: q[2], fatal: q[2] >= 100, hint: '' })
  })
  if (set === 'text') sections.push(qaTextCallControlSection_())
  return { scoring: 'deduction', sections }
}

// =====================================================================
// Audit history from the response sheets
// =====================================================================

/** QA_HIST_SOURCES verbatim (+ the response tab names, needed to fetch). */
export const QA_HIST_SOURCES: Record<string, { ssId: string; label: string; idHeader: string; dateHeader: string; segHeader: string; formOf: (seg: string) => string }> = {
  voice: { ssId: '1bna3_kNAxdaS2dPJUMTTw75NKQiwAN6NJVbxRxPKeqA', label: 'Voice', idHeader: 'Call ID', dateHeader: 'Call Date', segHeader: 'Call Type',
    formOf: (seg: string) => (/^outbound$/i.test(seg) ? 'FRM-VOICE-OUT' : 'FRM-VOICE-IN') },
  text: { ssId: '1BNzinvWZ_1qm5QZX-Thqk0oR3CvfkNMnJ7TPi1_wy6k', label: 'Texting', idHeader: 'Chat ID', dateHeader: 'Chat Date', segHeader: 'Modality',
    formOf: (seg: string) => (/^internal/i.test(seg) ? 'FRM-TEXT-INT' : 'FRM-TEXT-CHAT') },
}

/** qaHdr_ verbatim: header text compared ignoring case, spaces and trailing "?". */
export function qaHdr_(s: unknown): string {
  return String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim().replace(/\?+$/, '').trim().toLowerCase()
}

/** qaParsePct_ verbatim: "80%" -> 80, 0.8 -> 80, 80 -> 80. */
export function qaParsePct_(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v <= 1 ? v * 100 : v
  const s = String(v).trim()
  if (!s) return null
  const pct = s.indexOf('%') >= 0
  const n = Number(s.replace('%', '').trim())
  if (!isFinite(n)) return null
  return pct ? n : n <= 1 ? n * 100 : n
}

/** qaParseAuditDate_ verbatim: M/D/YYYY (Riyadh) or a Date cell. */
export function qaParseAuditDate_(v: unknown): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const s = String(v === null || v === undefined ? '' : v).trim()
  if (!s) return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return qeLocal_(+m[3], +m[1] - 1, +m[2])
  return qeParseTouchDate_(s)
}

/** qaHash_ verbatim. */
export function qaHash_(s: string): string {
  let h1 = 5381
  let h2 = 52711
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = (h1 * 33) ^ c
    h2 = (h2 * 33) ^ c
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)
}

/** qaHistorySince_ verbatim: Config qa_history_since, default 2026-06-01. */
async function qaHistorySince_(): Promise<Date> {
  const d = String((await getConfig('qa_history_since', '')) || '').trim()
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? qeLocal_(+m[1], +m[2] - 1, +m[3]) : qeLocal_(2026, 5, 1)
}

/**
 * qaHistoryRows_ verbatim: response-sheet rows -> qa_audits rows. Pure apart
 * from inputs. ctx: { key, since, people: [{email,name}], managerOf }.
 */
export function qaHistoryRows_(head: unknown[], rows: unknown[][], ctx: Row): { audits: Row[]; skipped: number; unmatched: Record<string, number> } {
  const src = QA_HIST_SOURCES[String(ctx.key)]
  const col: Record<string, number> = {}
  const byText: Record<string, number[]> = {}
  head.forEach((h, i) => {
    const k = String(h).trim().toLowerCase()
    if (k && col[k] === undefined) col[k] = i
    const n = qaHdr_(h)
    ;(byText[n] = byText[n] || []).push(i)
  })
  const c = (n: string) => col[String(n).toLowerCase()]
  const val = (row: unknown[], i?: number) => (i === undefined ? '' : String(row[i] === null || row[i] === undefined ? '' : row[i]).trim())
  const nameIx: Record<string, string[]> = {}
  const emails: Record<string, boolean> = {}
  ;((ctx.people as { email: string; name: string }[]) || []).forEach((p) => {
    emails[normEmail(p.email)] = true
    const k = qeNormAgent_(p.name)
    if (k) (nameIx[k] = nameIx[k] || []).push(normEmail(p.email))
  })
  const def = qaDerivedDefinition_(String(ctx.key)) as { sections: { questions: { id: string; text: string; fatal: boolean }[] }[] }
  const out: Row[] = []
  let skipped = 0
  const unmatched: Record<string, number> = {}
  rows.forEach((row) => {
    const agentRaw = val(row, c('Agent Name'))
    const agent = qeNormAgent_(agentRaw)
    const when = qeParseTouchDate_(c('Timestamp') === undefined ? '' : row[c('Timestamp')])
    if (!agent || !when) {
      skipped++
      return
    }
    const final = qaParsePct_(c('Final Score') === undefined ? '' : row[c('Final Score')])
    if (final === null) {
      skipped++
      return
    }
    const parsedCall = qaParseAuditDate_(c(src.dateHeader) === undefined ? '' : row[c(src.dateHeader)])
    const callDate = parsedCall || when
    if (callDate < (ctx.since as Date)) {
      skipped++
      return
    }
    const formEmail = normEmail(val(row, c('Agent Email')))
    const hits = nameIx[agent] || []
    let email = hits.length === 1 ? hits[0] : emails[formEmail] ? formEmail : ''
    if (!email) {
      unmatched[agentRaw] = (unmatched[agentRaw] || 0) + 1
      email = formEmail
    }
    const formId = src.formOf(val(row, c(src.segHeader)))
    const answers: Record<string, string> = {}
    let fatal = false
    def.sections.forEach((s) => {
      s.questions.forEach((q) => {
        let a = ''
        ;(byText[qaHdr_(q.text)] || []).some((i) => {
          a = val(row, i)
          return a !== ''
        })
        const ans = /^no$/i.test(a) ? 'fail' : /^yes$/i.test(a) ? 'pass' : 'na'
        answers[q.id] = ans
        if (ans === 'fail' && q.fatal) fatal = true
      })
    })
    const ticket = val(row, c(src.idHeader)).replace(/\.0$/, '')
    const auditor = normEmail(val(row, c('Email Address')))
    const comments = val(row, c('Merged Comments')).split('|||').map((x) => x.trim()).filter(String).join('\n')
    const channel = QA_DERIVED_FORMS.filter((f) => f.formId === formId)[0].channel
    const submittedAt = when.toISOString()
    out.push({
      audit_id: 'QAH-' + String(ctx.key).charAt(0).toUpperCase() + '-' + qaHash_(when.getTime() + '|' + ticket + '|' + agent + '|' + auditor),
      kind: 'audit', queue_id: '', calibration_id: '', ticket_id: ticket, agent_email: email,
      tl_email: ctx.managerOf ? (ctx.managerOf as (e: string) => string | null)(email) || '' : '',
      auditor_email: auditor, channel, contact_type: '', form_id: formId, form_version: 1, answers_json: JSON.stringify(answers),
      comment: comments.slice(0, 2000), score: Math.round(final * 10) / 10, fatal, score_final: '', started_at: '', submitted_at: submittedAt,
      audit_date: qeFmt_(when, 'yyyy-MM-dd'), status: 'historical', ack_due_date: '', acknowledged_at: '', ack_by: '',
      updated_at: submittedAt, updated_by: 'history import', source: src.label + ' form', source_agent: agentRaw, sample_basis: 'historical',
      interaction_at: parsedCall ? "'" + qeFmt_(parsedCall, 'yyyy-MM-dd') : '',
    })
  })
  return { audits: out, skipped, unmatched }
}

/** First sheet of a workbook -> grid (legacy openFn: getSheets()[0]). */
async function qaFirstSheetRows_(ssId: string): Promise<unknown[][]> {
  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY
  if (!client_email || !key) throw new Error('Google Sheets credentials are not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).')
  const { google } = await import('googleapis')
  const auth = new google.auth.GoogleAuth({ credentials: { client_email, private_key: key.replace(/\\n/g, '\n') }, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] })
  const sheets = google.sheets({ version: 'v4', auth })
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ssId, fields: 'sheets.properties.title' })
  const first = ((meta.data.sheets || [])[0] || {}).properties?.title
  if (!first) throw new Error('The history spreadsheet ' + ssId + ' has no sheets.')
  let rows: unknown[][] = []
  const PAGE = 50000
  for (let p = 0; p < 10; p++) {
    const from = p * PAGE + 1
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: ssId, range: `'${String(first).replace(/'/g, "\\'")}'!A${from}:ZZ${from + PAGE - 1}` })
    const page = (res.data.values || []) as unknown[][]
    rows = rows.concat(page)
    if (page.length < PAGE) break
  }
  return rows
}

/**
 * qaImportHistory_ verbatim: imports new response rows from both sheets, a row
 * cursor per sheet in config (QE_HIST_*). Idempotent (deterministic audit ids,
 * upserted). opts.budgetMs stops inside the time budget; opts.secret must match
 * the qa_history_secret config when one is set.
 */
export async function qaImportHistory_(actor: string, opts?: { budgetMs?: number; secret?: string }): Promise<Row> {
  void actor
  const wantSecret = String((await getConfig('qa_history_secret', '')) || '')
  if (wantSecret && String(opts?.secret || '') !== wantSecret) throw new Error('History import secret missing or wrong.')
  const deadline = Date.now() + (opts?.budgetMs || 240000)
  const dir = await pwDirectory()
  const people = Object.keys(dir.by).map((k) => dir.by[k])
  const since = await qaHistorySince_()
  const report: Row = { done: true, imported: 0, skipped: 0, unmatched: {}, notes: [] }
  for (const key of Object.keys(QA_HIST_SOURCES)) {
    if (!report.done) break
    const src = QA_HIST_SOURCES[key]
    const grid = await qaFirstSheetRows_(src.ssId)
    const lastRow = grid.length
    const curKey = 'QE_HIST_' + key.toUpperCase()
    let cur = Number((await getConfig(curKey, 2)) || 2)
    if (lastRow < 2 || cur > lastRow) {
      ;(report.notes as string[]).push(src.label + ': nothing new')
      continue
    }
    const head = grid[0] || []
    const tsCol = head.map((h) => String(h).trim().toLowerCase()).indexOf('timestamp')
    let blankFrom: number | null = null
    while (cur <= lastRow) {
      if (Date.now() > deadline) {
        report.done = false
        ;(report.notes as string[]).push(src.label + ': stopped at row ' + cur + ' (time); run again')
        break
      }
      const n = Math.min(QA_HIST_CHUNK, lastRow - cur + 1)
      const rows = grid.slice(cur - 1, cur - 1 + n)
      const res = qaHistoryRows_(head, rows, { key, since, people, managerOf: dir.managerOf })
      if (res.audits.length) {
        const clean = res.audits.map((a) => sanitizeInput(a))
        for (let i = 0; i < clean.length; i += 500) {
          const { error } = await db().from('qa_audits').upsert(clean.slice(i, i + 500), { onConflict: 'audit_id' })
          if (error) throw described(error, { table: 'qa_audits' })
        }
      }
      report.imported = (report.imported as number) + res.audits.length
      report.skipped = (report.skipped as number) + res.skipped
      Object.keys(res.unmatched).forEach((k) => {
        ;(report.unmatched as Record<string, number>)[k] = ((report.unmatched as Record<string, number>)[k] || 0) + res.unmatched[k]
      })
      for (let i = 0; i < rows.length; i++) {
        const has = tsCol !== -1 && rows[i][tsCol] !== '' && rows[i][tsCol] !== null && rows[i][tsCol] !== undefined
        if (has) blankFrom = null
        else if (blankFrom === null) blankFrom = cur + i
      }
      cur += n
      await setConfig(curKey, blankFrom !== null ? blankFrom : cur)
    }
    ;(report.notes as string[]).push(src.label + ': read to row ' + (cur - 1) + ' of ' + lastRow + (blankFrom !== null ? ' (resumes at row ' + blankFrom + ')' : ''))
  }
  const un = Object.keys(report.unmatched as Record<string, number>)
  if (un.length) (report.notes as string[]).push('Agents not matched to the roster by name (kept with the form\'s Agent Email): ' + un.slice(0, 8).join(', ') + (un.length > 8 ? ' and ' + (un.length - 8) + ' more' : ''))
  report.note = (report.imported as number) + ' audits imported or refreshed, ' + (report.skipped as number) + ' rows skipped. ' + (report.notes as string[]).join('. ')
  return report
}

// =====================================================================
// Queue-log reconcile
// =====================================================================

/** qeShouldMarkAudited_ verbatim. */
function qeShouldMarkAudited_(state: string, queuedDay: string, auditDay: string): boolean {
  if (state === 'audited') return false
  if (!auditDay) return false
  if (queuedDay && auditDay < queuedDay) return false
  return true
}

/** qaParseIso_ verbatim. */
function qaParseIso_(s: unknown): Date | null {
  if (s instanceof Date) return s
  const d = new Date(String(s || ''))
  return isNaN(d.getTime()) ? null : d
}

/**
 * qaReconcileQueueLog_ verbatim: pending/expired qe_queue_log rows whose
 * ticket+agent has a qa_audits row submitted on/after the queued date become
 * audited. Requires qa_engine_live and autoMarkFromBackend.
 */
export async function qaReconcileQueueLog_(): Promise<Row> {
  if (!qaBool_(await getConfig('qa_engine_live', false))) return { skipped: 'qa_engine_live is false: the old app still owns the queue' }
  const S = (await getConfig('qa_engine_settings', {})) as Row
  if (S.autoMarkFromBackend === false) return { skipped: 'autoMarkFromBackend is off in qa_engine_settings' }
  const dir = await pwDirectory()
  const audits = ((await readRows('qa_audits').catch(() => [] as Row[])) as Row[])
    .filter((a) => a.kind === 'audit' && a.status !== 'voided' && a.source !== 'offqueue')
    .map((a) => {
      const sub = qaParseIso_(a.submitted_at)
      return { ticket: String(a.ticket_id), agentName: String(a.source_agent || dir.name(String(a.agent_email))), submitted: sub ? qeFmt_(sub, 'yyyy-MM-dd HH:mm') : '', auditor: String(a.auditor_email || '') }
    })
  const rows = (await readRows('qe_queue_log').catch(() => [] as Row[])) as Row[]
  const byKey: Record<string, { submitted: string; auditor: string }> = {}
  audits.forEach((a) => {
    const tid = String(a.ticket || '').trim()
    const ag = qeCanonAgent_(a.agentName)
    if (!tid || !ag) return
    const k = tid + '|' + ag
    if (!byKey[k] || (a.submitted && a.submitted < byKey[k].submitted)) byKey[k] = { submitted: a.submitted, auditor: a.auditor || '' }
  })
  let updated = 0
  let revived = 0
  const changed: Row[] = []
  rows.forEach((r) => {
    const state = String(r.state || '')
    if (state === 'audited') return
    const hit = byKey[String(r.ticket_id) + '|' + qeCanonAgent_(r.agent)]
    if (!hit) return
    const queuedDay = String(r.queued_date || '').slice(0, 10)
    const auditDay = String(hit.submitted || '').slice(0, 10)
    if (!qeShouldMarkAudited_(state, queuedDay, auditDay)) return
    if (state === 'expired') revived++
    changed.push({ key: r.key, queued_date: r.queued_date, audited_at: hit.submitted, audited_by: hit.auditor || 'scoring form' })
    updated++
  })
  for (const c of changed) {
    const { error } = await db().from('qe_queue_log')
      .update({ state: 'audited', audited_at: c.audited_at, audited_by: c.audited_by })
      .eq('key', String(c.key)).eq('queued_date', String(c.queued_date))
    if (error) throw described(error, { table: 'qe_queue_log' })
  }
  return { updated, revived }
}

/** restartQualityAuditHistory verbatim: forget the cursors, rescan all. */
export async function restartQualityAuditHistory_(): Promise<string> {
  for (const k of Object.keys(QA_HIST_SOURCES)) await setConfig('QE_HIST_' + k.toUpperCase(), null)
  return 'History cursors cleared. Run importQualityAuditHistory.'
}
