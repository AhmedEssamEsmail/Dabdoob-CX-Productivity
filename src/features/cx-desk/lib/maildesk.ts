/**
 * Mail desk — verbatim port of Desk_deprecated/MailDesk.js (+ the tlsShifts_ /
 * tlsMailDue_ snapshot readers of TlSnapshots.js).
 *
 *   mailDeskPage / mailDeskRefresh / mailApprovalDecide / mailApprovalReset
 *   jobMailDesk / mdSyncSla_ / mdSyncApprovals_
 *
 * Datastore notes: the Gmail pieces are adapter seams, never stubbed data —
 *   mdThreads_    -> the platform GmailReadAdapter (listMessages + getMessage,
 *                    grouped by thread). Absent Gmail credentials the job half
 *                    throws "Gmail is not configured" (B2/G2 in BLOCKED_TASKS);
 *                    the page still reads stored rows.
 *   sendGmailReply_ -> platform/mail sendGmailReply (dry-run safe; logs mail_log).
 * Approvals keep the legacy claim-under-token idempotency and the 5-minute
 * stuck-'sending' reset.
 */

import { db, newId } from '@/features/shared/platform/repo'
import { readStore, dqLastRun } from '@/features/shared/platform/stores'
import { getConfig } from '@/features/shared/platform/settings'
import { normEmail, pwDirectory, requireJobCaller, requireRole, type Directory } from '@/features/shared/platform/identity'
import { assertWritable } from '@/features/shared/platform/viewas'
import { pwKwDate, pwKwTime, pwToday, dqAddDays } from '@/features/shared/platform/time'
import { getGmailAdapter, getGmailReadAdapter, sendGmailReply } from '@/features/shared/platform/mail'
import { hbBeat, hbRun } from '@/features/shared/platform/health'
import { raisePopup, resolvePopups } from '@/features/shared/platform/popups'
import { dqMarkRun_ } from './jobshared'

type Row = Record<string, unknown>

export const MD_HEADERS: Record<string, string[]> = {
  mail_sla: [
    'message_id', 'thread_id', 'kind', 'subject', 'from_email', 'received_at', 'expected_tls', 'status', 'replied_at',
    'replied_by', 'minutes_to_reply', 'breached', 'by_expected', 'covering_missed', 'snippet', 'updated_at', 'due_at', 'next_shift',
  ],
  mail_approvals: [
    'thread_id', 'message_id', 'rfc_message_id', 'type', 'mobile', 'order_id', 'subject', 'requester', 'reply_to', 'cc',
    'received_at', 'excerpt', 'status', 'decision_text', 'decided_by', 'decided_at', 'sent_status', 'sent_message_id', 'client_token', 'updated_at',
  ],
  mail_approval_log: ['log_id', 'thread_id', 'action', 'decision', 'text', 'by', 'at', 'sent_status', 'to', 'cc', 'error'],
}

export const MD_SETTINGS: Record<string, { value: unknown; description: string }> = {
  mail_sla_query: {
    value: 'newer_than:7d (subject:"refund status update" OR subject:chargeback OR subject:chargebacks)',
    description: 'Gmail search for the response-tracked threads (the rules in MailDesk.js then decide which messages need a reply).',
  },
  mail_sla_partner_domain: { value: 'myfatoorah.com', description: 'On a "Refund Status Update" thread, every message from this domain needs our feedback.' },
  mail_sla_our_senders: { value: [] as string[], description: 'Extra addresses whose reply counts as ours (e.g. a shared CX mailbox). Everyone on the Roster and every admin already counts.' },
  mail_approval_query: {
    value: 'newer_than:14d (subject:"refund approval" OR subject:"operational loss")',
    description: 'Gmail search for approval requests ("Refund approval - mobile - order ID", "Operational loss - mobile - order ID").',
  },
  mail_approver_emails: {
    value: ['mohamed.nabil@dabdoob.com', 'k.elnaggar@dabdoob.com'],
    description: "Who may approve, reject or answer approval mails (Mohamed and his manager, 2026-10-11). The reply is sent from the Desk project owner's mailbox, signed with the approver's name.",
  },
  mail_approval_dry_run: {
    value: true,
    description: 'true: a decision is recorded and logged but no reply is sent (first rollout). false: the reply is sent in the original thread (needs the gmail.send scope).',
  },
}

export const MD_MAX_THREADS = 50
export const MD_STUCK_MS = 5 * 60000

async function mdSetting_(key: string): Promise<unknown> {
  const d = MD_SETTINGS[key]
  return getConfig(key, d ? d.value : '')
}

async function rowsOf(name: string): Promise<Row[]> {
  const { rows } = await readStore(name)
  return rows
}

// =====================================================================
// TlSnapshots.js — shared snapshot readers
// =====================================================================

export interface TlShift {
  tl: string
  date: string
  startMs: number
  endMs: number
  queue: { startMs: number; endMs: number }[]
}

function tlsShiftOf_(r: Row): TlShift {
  let q: unknown[] = []
  try {
    q = JSON.parse(String(r.queue_json || '[]'))
  } catch {
    q = []
  }
  return {
    tl: normEmail(r.tl_email),
    date: String(r.date),
    startMs: Number(r.shift_start),
    endMs: Number(r.shift_end),
    queue: (q as [number, number][]).map((w) => ({ startMs: Number(w[0]), endMs: Number(w[1]) })),
  }
}

/** tlp_shifts rows between two Kuwait dates as { tl, date, startMs, endMs, queue: [{ startMs, endMs }] }. */
export async function tlsShifts_(fromKey: string, toKey: string): Promise<TlShift[]> {
  return (await rowsOf('tlp_shifts'))
    .filter((r) => String(r.date) >= fromKey && String(r.date) <= toKey)
    .map(tlsShiftOf_)
}

/** Team leads on QUEUE-MANAGEMENT hours at ms. */
export function tlsOnQueue_(shifts: TlShift[], ms: number): string[] {
  const out: string[] = []
  shifts.forEach((s) => {
    if (s.queue.some((w) => ms >= w.startMs && ms < w.endMs) && out.indexOf(s.tl) === -1) out.push(s.tl)
  })
  return out
}

/**
 * Who must answer a mail received at ms, and by when (Mohamed 2026-10-11: "the rest of his/her shift").
 *   on queue    expected = the TLs on queue-management hours at ms; due = the latest END OF SHIFT among them
 *   no one      the next queue window to start after ms: expected = its TL(s), due = the end of their shift
 * Returns { expected: [emails], dueMs (NaN when the schedule has nothing), nextShift }.
 */
export function tlsMailDue_(shifts: TlShift[], ms: number): { expected: string[]; dueMs: number; nextShift: boolean } {
  const on = tlsOnQueue_(shifts, ms)
  const endOf = (tls: string[], atMs: number) => {
    const ends = shifts.filter((s) => tls.indexOf(s.tl) !== -1 && atMs >= s.startMs && atMs < s.endMs).map((s) => s.endMs)
    return ends.length ? Math.max.apply(null, ends) : NaN
  }
  if (on.length) return { expected: on, dueMs: endOf(on, ms), nextShift: false }
  let next = Infinity
  shifts.forEach((s) => {
    s.queue.forEach((w) => {
      if (w.startMs > ms && w.startMs < next) next = w.startMs
    })
  })
  if (next === Infinity) return { expected: [], dueMs: NaN, nextShift: true }
  const tls = tlsOnQueue_(shifts, next)
  return { expected: tls, dueMs: endOf(tls, next), nextShift: true }
}

// =====================================================================
// Pure rules
// =====================================================================

/** Bare lower-case address from a header value ("Name <a@b.com>" or "a@b.com"). */
export function mdAddr_(v: unknown): string {
  const s = String(v || '')
  const m = s.match(/<([^>]+)>/)
  return normEmail(m ? m[1] : s)
}

/** Every address in a To/Cc header, lower case. */
export function mdAddrList_(v: unknown): string[] {
  return (String(v || '').match(/[^\s<>,;"']+@[^\s<>,;"']+/g) || []).map(normEmail)
}

/** 'refund_status' | 'chargeback' | '' for one message. */
export function mdKind_(subject: string, fromEmail: string, partnerDomain: string, fromIsOurs: boolean): string {
  const s = String(subject || '').toLowerCase()
  const dom = String(fromEmail || '').split('@')[1] || ''
  const partner = String(partnerDomain || '').toLowerCase()
  if (s.indexOf('refund status update') !== -1 && partner && (dom === partner || dom.slice(-(partner.length + 1)) === '.' + partner)) return 'refund_status'
  if (s.indexOf('chargeback') !== -1 && !fromIsOurs) return 'chargeback'
  return ''
}

/** breached / by_expected / covering_missed for a record (expected_tls is a comma list; due_at ISO or ''). */
export function mdSlaFlags_(r: Row, nowMs: number): Row {
  const expected = String(r.expected_tls || '').split(',').filter(String)
  const replied = !!r.replied_at
  const due = r.due_at ? Date.parse(String(r.due_at)) : NaN
  r.status = replied ? 'replied' : 'open'
  r.breached = isFinite(due) && (replied ? Date.parse(String(r.replied_at)) > due : nowMs > due)
  r.by_expected = replied && expected.indexOf(normEmail(r.replied_by)) !== -1
  r.covering_missed = replied && expected.length > 0 && !r.by_expected
  return r
}

export interface MdMsg {
  id: string
  threadId: string
  ms: number
  from: string
  subject: string
  snippet: string
  to?: string
  cc?: string
  replyTo?: string
  rfcId?: string
}

export interface MdSlaCtx {
  isOurs: (e: string) => boolean
  partnerDomain: string
  shifts: TlShift[]
  nowMs: number
}

/** Records for one thread. msgs: [{ id, threadId, ms, from, subject, snippet }] in any order. */
export function mdSlaRecords_(msgs: MdMsg[], ctx: MdSlaCtx): Row[] {
  const list = msgs.slice().sort((a, b) => a.ms - b.ms)
  const first = list.length ? String(list[0].subject || '') : ''
  const out: Row[] = []
  list.forEach((m, i) => {
    const from = mdAddr_(m.from)
    const kind = mdKind_(String(m.subject || '') + ' ' + first, from, ctx.partnerDomain, ctx.isOurs(from))
    if (!kind) return
    let reply: MdMsg | null = null
    for (let j = i + 1; j < list.length && !reply; j++) {
      if (list[j].ms > m.ms && ctx.isOurs(mdAddr_(list[j].from))) reply = list[j]
    }
    const due = tlsMailDue_(ctx.shifts || [], m.ms)
    out.push(
      mdSlaFlags_(
        {
          message_id: String(m.id),
          thread_id: String(m.threadId),
          kind,
          subject: String(m.subject || first).slice(0, 300),
          from_email: from,
          received_at: new Date(m.ms).toISOString(),
          expected_tls: due.expected.join(','),
          due_at: isFinite(due.dueMs) ? new Date(due.dueMs).toISOString() : '',
          next_shift: due.nextShift,
          replied_at: reply ? new Date(reply.ms).toISOString() : '',
          replied_by: reply ? mdAddr_(reply.from) : '',
          minutes_to_reply: reply ? Math.round((reply.ms - m.ms) / 60000) : '',
          snippet: String(m.snippet || '').slice(0, 300),
        },
        ctx.nowMs,
      ),
    )
  })
  return out
}

/** Keeps the expected TLs and deadline first recorded for a message, then re-derives the flags. */
export function mdMergeSla_(fresh: Row, old: Row | undefined, nowMs: number): Row {
  if (old && String(old.expected_tls || '') !== '') {
    fresh.expected_tls = String(old.expected_tls)
    fresh.due_at = String(old.due_at || '')
    fresh.next_shift = mdBool_(old.next_shift)
  }
  return mdSlaFlags_(fresh, nowMs)
}

/** "Refund approval - 0501234567 - ORD-1" (Re:/Fwd: allowed) -> { type, mobile, orderId }, else null. */
export function mdParseApprovalSubject_(subject: unknown): { type: string; mobile: string; orderId: string } | null {
  const s = String(subject || '').replace(/^\s*((re|fw|fwd|aw)\s*:\s*)+/i, '').trim()
  const m = s.match(/^(refund approval|operational loss)\s*[-–—:]\s*(.+)$/i)
  if (!m) return null
  const parts = m[2].split(/\s*[-–—]\s*/)
  if (parts.length < 2 || !parts[0] || !parts.slice(1).join('-').trim()) return null
  return { type: /refund/i.test(m[1]) ? 'refund' : 'operational_loss', mobile: parts[0].trim(), orderId: parts.slice(1).join('-').trim() }
}

/** The reply text for a decision. */
export function mdDecisionBody_(decision: string, text: string, byName: string): string {
  const head = decision === 'approved' ? 'Approved.' : decision === 'rejected' ? 'Rejected.' : ''
  const body = [head, String(text || '').trim()].filter(String).join('\n\n')
  return body + '\n\n' + byName + ' (via CX Helm)'
}

/** One header value with no line breaks (header injection), RFC 2047-encoded when not plain ASCII. */
export function mdHeaderValue_(s: unknown): string {
  const v = String(s || '').replace(/[\r\n]+/g, ' ').trim()
  return /^[\x20-\x7e]*$/.test(v) ? v : '=?UTF-8?B?' + Buffer.from(v, 'utf8').toString('base64') + '?='
}

/** RFC 2822 reply: To the original sender, the original Cc kept, threaded on the request's Message-ID. */
export function mdReplyMime_(r: { to: string; cc?: string[]; subject: string; inReplyTo?: string; body: string }): string {
  const lines = ['To: ' + mdHeaderValue_(r.to)]
  if (r.cc && r.cc.length) lines.push('Cc: ' + mdHeaderValue_(r.cc.join(', ')))
  lines.push('Subject: ' + mdHeaderValue_(/^re:/i.test(String(r.subject)) ? r.subject : 'Re: ' + r.subject))
  if (r.inReplyTo) {
    lines.push('In-Reply-To: ' + mdHeaderValue_(r.inReplyTo))
    lines.push('References: ' + mdHeaderValue_(r.inReplyTo))
  }
  lines.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '')
  const b64 = Buffer.from(String(r.body || ''), 'utf8').toString('base64')
  return lines.join('\r\n') + '\r\n' + (b64.match(/.{1,76}/g) || []).join('\r\n')
}

/** Who the reply goes to: the request's Reply-To, else its sender; Cc = its Cc minus us and the To. */
export function mdReplyAddresses_(row: Row, me: string): { to: string; cc: string[] } {
  const to = normEmail(row.reply_to) || normEmail(row.requester)
  const cc = String(row.cc || '')
    .split(',')
    .map(normEmail)
    .filter((e, i, all) => e && e !== me && e !== to && all.indexOf(e) === i)
  return { to, cc }
}

export function mdBool_(v: unknown): boolean {
  return v === true || String(v).toLowerCase() === 'true'
}

// =====================================================================
// Gmail seams
// =====================================================================

export type GmailThreadMsg = MdMsg

/**
 * mdThreads_: threads for a query, each message's id/time/headers/snippet.
 * Backed by the platform GmailReadAdapter (message-level: listMessages +
 * getMessage, grouped by threadId). No adapter -> throws; nothing is faked.
 */
export async function mdThreads_(query: unknown): Promise<MdMsg[][]> {
  const gmail = getGmailReadAdapter()
  if (!gmail) throw new Error('Gmail is not configured for Mail desk (B2/G2). The job runs once credentials are granted.')
  const stubs = await gmail.listMessages(String(query), MD_MAX_THREADS * 5)
  const byThread = new Map<string, MdMsg[]>()
  for (const s of stubs.slice(0, MD_MAX_THREADS * 5)) {
    const m = await gmail.getMessage(s.id)
    const payload = (m as { payload?: { headers?: { name: string; value: string }[] } }).payload
    const hs = (payload && payload.headers) || []
    const h = (n: string) => {
      const hit = hs.filter((x) => String(x.name).toLowerCase() === n.toLowerCase())[0]
      return hit ? String(hit.value || '') : ''
    }
    const msg: MdMsg = {
      id: String(m.id),
      threadId: String((m as { threadId?: string }).threadId || m.id),
      ms: Number(m.internalDate),
      from: h('From'),
      subject: h('Subject'),
      to: h('To'),
      cc: h('Cc'),
      replyTo: h('Reply-To'),
      rfcId: h('Message-ID'),
      snippet: String((m as { snippet?: string }).snippet || ''),
    }
    // Threads.list capped at MD_MAX_THREADS threads: a 51st distinct thread is out.
    let arr = byThread.get(msg.threadId)
    if (!arr) {
      if (byThread.size >= MD_MAX_THREADS) break
      arr = []
      byThread.set(msg.threadId, arr)
    }
    arr.push(msg)
  }
  return [...byThread.values()]
}

/** Is this address one of us (a reply from CX)? Roster people, admins, mail_sla_our_senders. */
async function mdOurs_(dir: Directory): Promise<(e: string) => boolean> {
  const extra = ([] as string[]).concat((await mdSetting_('mail_sla_our_senders')) as string[]).map(normEmail)
  return (e: string) => {
    const x = normEmail(e)
    return !!x && (!!dir.person(x) || dir.admins.indexOf(x) !== -1 || extra.indexOf(x) !== -1)
  }
}

// =====================================================================
// The 10-minute job
// =====================================================================

/** Polls the response-tracked threads into mail_sla; pops up new open ones for the TL(s) on queue. */
export async function mdSyncSla_(): Promise<string> {
  const dir = await pwDirectory()
  const isOurs = await mdOurs_(dir)
  const nowMs = Date.now()
  const threads = await mdThreads_(await mdSetting_('mail_sla_query'))
  const today = pwToday()
  const shifts = await tlsShifts_(dqAddDays(today, -14), dqAddDays(today, 2))
  const ctx: MdSlaCtx = { isOurs, partnerDomain: String(await mdSetting_('mail_sla_partner_domain')), shifts, nowMs }
  let fresh: Row[] = []
  threads.forEach((msgs) => {
    fresh = fresh.concat(mdSlaRecords_(msgs, ctx))
  })
  const old: Record<string, Row> = {}
  ;(await rowsOf('mail_sla')).forEach((r) => {
    old[String(r.message_id)] = r
  })
  const stamp = new Date().toISOString()
  const rows = fresh.map((r) => {
    r.updated_at = stamp
    return mdMergeSla_(r, old[String(r.message_id)], nowMs)
  })
  if (rows.length) {
    const { error } = await db().from('mail_sla').upsert(rows, { onConflict: 'message_id' })
    if (error) throw new Error(error.message)
  }
  for (const r of rows) {
    const was = old[String(r.message_id)]
    if (r.status === 'open' && !was && nowMs - Date.parse(String(r.received_at)) < 6 * 3600000) {
      for (const tl of String(r.expected_tls || '').split(',').filter(String)) {
        await raisePopup(
          {
            recipient: tl,
            kind: 'mail_sla_due',
            ref: String(r.message_id),
            link: '#/mail-desk',
            title: (r.kind === 'chargeback' ? 'Chargeback mail' : 'MyFatoorah refund update') + ': reply needed',
            body:
              'From ' + r.from_email + ': "' + r.subject + '". Reply in the thread' +
              (r.due_at ? ' by ' + pwKwTime(r.due_at) + ' (end of your shift)' : '') + '.',
          },
          'system:mail_desk',
        )
      }
    }
    if (r.status === 'replied' && (!was || was.status !== 'replied')) await resolvePopups('mail_sla_due', String(r.message_id), 'system:mail_desk')
  }
  return rows.length + ' response-tracked messages from ' + threads.length + ' threads.'
}

async function mdApprovers_(): Promise<string[]> {
  return ([] as string[]).concat((await mdSetting_('mail_approver_emails')) as string[]).map(normEmail).filter(String)
}

/** Polls approval threads into mail_approvals. A request answered by an approver straight in Gmail is marked so. */
export async function mdSyncApprovals_(): Promise<string> {
  const approvers = await mdApprovers_()
  const threads = await mdThreads_(await mdSetting_('mail_approval_query'))
  const stamp = new Date().toISOString()
  const old: Record<string, Row> = {}
  ;(await rowsOf('mail_approvals')).forEach((r) => {
    old[String(r.thread_id)] = r
  })
  const rows: Row[] = []
  threads.forEach((msgs) => {
    const list = msgs.slice().sort((a, b) => a.ms - b.ms)
    let req: MdMsg | null = null
    let parsed: { type: string; mobile: string; orderId: string } | null = null
    for (let i = 0; i < list.length && !req; i++) {
      const p = mdParseApprovalSubject_(list[i].subject)
      if (p && approvers.indexOf(mdAddr_(list[i].from)) === -1) {
        req = list[i]
        parsed = p
      }
    }
    if (!req || !parsed) return
    const was = old[req.threadId]
    const row: Row = was
      ? Object.assign({}, was)
      : {
          thread_id: req.threadId,
          message_id: req.id,
          rfc_message_id: req.rfcId || '',
          type: parsed.type,
          mobile: parsed.mobile,
          order_id: parsed.orderId,
          subject: String(req.subject).slice(0, 300),
          requester: mdAddr_(req.from),
          reply_to: mdAddr_(req.replyTo),
          cc: mdAddrList_(req.cc).join(','),
          received_at: new Date(req.ms).toISOString(),
          excerpt: String(req.snippet || '').slice(0, 500),
          status: 'pending',
          decision_text: '',
          decided_by: '',
          decided_at: '',
          sent_status: '',
          sent_message_id: '',
          client_token: '',
        }
    if (row.status === 'pending') {
      const answered = list.filter((m) => m.ms > req!.ms && approvers.indexOf(mdAddr_(m.from)) !== -1)[0]
      if (answered) {
        row.status = 'answered_in_gmail'
        row.decided_by = mdAddr_(answered.from)
        row.decided_at = new Date(answered.ms).toISOString()
      }
    }
    row.updated_at = stamp
    rows.push(row)
  })
  if (rows.length) {
    const { error } = await db().from('mail_approvals').upsert(rows, { onConflict: 'thread_id' })
    if (error) throw new Error(error.message)
  }
  return rows.length + ' approval threads.'
}

/** The job (10-minute trigger in legacy; 15-min pg_cron per D-SCHED). A failed half is a warning on the Health board. */
export async function jobMailDesk(): Promise<{ note: string }> {
  await requireJobCaller() // cron entry: admin-only hand-run; View as refuses
  return hbRun(
    'mail_desk',
    async () => {
      const out: string[] = []
      let bad = false
      try {
        out.push(await mdSyncSla_())
      } catch (x) {
        bad = true
        out.push('Response tracking failed: ' + ((x as Error)?.message || x))
      }
      try {
        out.push(await mdSyncApprovals_())
      } catch (x2) {
        bad = true
        out.push('Approvals failed: ' + ((x2 as Error)?.message || x2))
      }
      await dqMarkRun_('mail_desk')
      if (bad) hbBeat('mail_desk', 'warn', out.join(' '))
      return { note: out.join(' ') }
    },
    (r) => r.note,
  )
}

// =====================================================================
// Pages and actions
// =====================================================================

export function mdSlaOut_(r: Row, dir: Directory) {
  const expected = String(r.expected_tls || '').split(',').filter(String)
  return {
    messageId: String(r.message_id),
    threadId: String(r.thread_id),
    kind: String(r.kind),
    subject: String(r.subject),
    from: String(r.from_email),
    receivedAt: String(r.received_at),
    expected: expected.map((e) => dir.name(e)),
    expectedEmails: expected,
    status: String(r.status),
    repliedAt: String(r.replied_at || ''),
    repliedBy: r.replied_by ? dir.name(String(r.replied_by)) : '',
    repliedByEmail: normEmail(r.replied_by),
    minutes: r.minutes_to_reply === '' || r.minutes_to_reply === null ? null : Number(r.minutes_to_reply),
    dueAt: String(r.due_at || ''),
    nextShift: mdBool_(r.next_shift),
    breached: mdBool_(r.breached),
    byExpected: mdBool_(r.by_expected),
    coveringMissed: mdBool_(r.covering_missed),
    snippet: String(r.snippet || ''),
    gmailUrl: 'https://mail.google.com/mail/u/0/#all/' + String(r.thread_id),
  }
}

/** Response-tracked mails a TL was expected to answer, or answered, between two Kuwait dates (for the 1:1). */
export async function mdForTl_(tlEmail: string, from: string, to: string, dir: Directory) {
  const rows = (await rowsOf('mail_sla'))
    .filter((r) => {
      const d = pwKwDate(r.received_at)
      const exp = String(r.expected_tls || '').split(',')
      return d >= from && d <= to && (exp.indexOf(tlEmail) !== -1 || normEmail(r.replied_by) === tlEmail)
    })
    .map((r) => mdSlaOut_(r, dir))
    .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
  const expected = rows.filter((r) => r.expectedEmails.indexOf(tlEmail) !== -1)
  return {
    expected: expected.length,
    repliedByThem: expected.filter((r) => r.repliedByEmail === tlEmail).length,
    coveredByOther: expected.filter((r) => r.coveringMissed).length,
    open: expected.filter((r) => r.status === 'open').length,
    breached: expected.filter((r) => r.breached).length,
    items: rows.slice(0, 30),
  }
}

export function mdApprovalOut_(r: Row, dir: Directory) {
  return {
    threadId: String(r.thread_id),
    type: String(r.type),
    mobile: String(r.mobile),
    orderId: String(r.order_id),
    subject: String(r.subject),
    requester: String(r.requester),
    requesterName: dir.person(String(r.requester)) ? dir.name(String(r.requester)) : String(r.requester),
    receivedAt: String(r.received_at),
    excerpt: String(r.excerpt || ''),
    status: String(r.status),
    decisionText: String(r.decision_text || ''),
    decidedBy: r.decided_by ? dir.name(String(r.decided_by)) : '',
    decidedAt: String(r.decided_at || ''),
    sentStatus: String(r.sent_status || ''),
    cc: String(r.cc || ''),
    replyTo: String(r.reply_to || ''),
    gmailUrl: 'https://mail.google.com/mail/u/0/#all/' + String(r.thread_id),
    stuck: String(r.status) === 'sending' && Date.now() - Date.parse(String(r.updated_at || '')) > MD_STUCK_MS,
  }
}

/** The Mail desk page: response tracking for leads, approvals for approvers only. */
export async function mailDeskPage() {
  const user = await requireRole(['admin', 'tl'])
  const dir = await pwDirectory()
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const sla = (await rowsOf('mail_sla'))
    .filter((r) => String(r.received_at) >= since)
    .map((r) => mdSlaOut_(r, dir))
    .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
  const isApprover = (await mdApprovers_()).indexOf(user.email) !== -1
  let approvals = null
  if (isApprover) {
    const cut = new Date(Date.now() - 14 * 86400000).toISOString()
    approvals = (await rowsOf('mail_approvals'))
      .filter((r) => r.status === 'pending' || r.status === 'sending' || String(r.decided_at) >= cut)
      .map((r) => mdApprovalOut_(r, dir))
      .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || (a.receivedAt < b.receivedAt ? 1 : -1))
  }
  const drySetting = await mdSetting_('mail_approval_dry_run')
  return {
    sla,
    asOf: await dqLastRun('mail_desk'),
    isApprover,
    approvals,
    dryRun: drySetting !== false && String(drySetting) !== 'false',
  }
}

/** "Check Gmail now": admin or an approver. */
export async function mailDeskRefresh() {
  const user = await requireRole(['admin', 'tl'])
  if (user.role !== 'admin' && (await mdApprovers_()).indexOf(user.email) === -1) {
    throw new Error('Gmail is checked every 10 minutes; ask Mohamed for a check now.')
  }
  await jobMailDesk()
  return mailDeskPage()
}

/**
 * An approver's decision on one approval thread. decision: 'approved' | 'rejected' | 'reply' (free text).
 * clientToken: one per click; the same token again returns the first result — a retried call never sends twice.
 */
export async function mailApprovalDecide(threadId: string, decision: string, text: string, clientToken: string) {
  const user = await requireRole(['admin', 'tl', 'agent'])
  if ((await mdApprovers_()).indexOf(user.email) === -1) {
    throw new Error('Only the approvers (Admin: mail_approver_emails) can answer approval mails.')
  }
  await assertWritable()
  decision = String(decision || '')
  if (['approved', 'rejected', 'reply'].indexOf(decision) === -1) throw new Error('Choose Approved, Rejected or write a reply.')
  text = String(text || '').trim().slice(0, 3000)
  if (decision === 'reply' && text.length < 2) throw new Error('Write the reply first.')
  clientToken = String(clientToken || '').slice(0, 64)
  if (!clientToken) throw new Error('Reload the page and try again.')
  const dir = await pwDirectory()
  const drySetting = await mdSetting_('mail_approval_dry_run')
  const dry = drySetting !== false && String(drySetting) !== 'false'
  const me = '' // the mailbox identity lives with the Gmail adapter (D-GOOGLE)
  const log = async (row: Row, action: string, sent: string, addr: { to: string; cc: string[] } | null, err: string) => {
    await db().from('mail_approval_log').insert({
      log_id: newId('MAL'),
      thread_id: row.thread_id,
      action,
      decision,
      text,
      by: user.email,
      at: new Date().toISOString(),
      sent_status: sent,
      to: addr ? addr.to : '',
      cc: addr ? addr.cc.join(',') : '',
      error: err || '',
    })
  }
  const find = async () =>
    (await rowsOf('mail_approvals')).filter((r) => String(r.thread_id) === String(threadId))[0]

  // 1. Claim it: status 'sending' + this click's token. A second click finds it claimed.
  // A crash between claim and record leaves the row 'sending': after 5 minutes approvers see Reset.
  const row = await find()
  if (!row) throw new Error('That approval mail is no longer in the queue. Reload the page.')
  if (row.status !== 'pending') {
    if (row.client_token && row.client_token === clientToken) return mdApprovalOut_(row, dir)
    throw new Error('Already ' + String(row.status).replace(/_/g, ' ') + (row.decided_by ? ' by ' + dir.name(String(row.decided_by)) : '') + '. Nothing was sent.')
  }
  {
    const { error } = await db()
      .from('mail_approvals')
      .update({ status: 'sending', client_token: clientToken, decided_by: user.email, updated_at: new Date().toISOString() })
      .eq('thread_id', String(threadId))
      .eq('status', 'pending') // optimistic claim: only one pending->sending transition wins
    if (error) throw new Error(error.message)
  }
  const claimed = await find()
  if (!claimed || claimed.client_token !== clientToken) {
    throw new Error('Already ' + String(claimed ? claimed.status : '').replace(/_/g, ' ') + '. Nothing was sent.')
  }
  const addr = mdReplyAddresses_(claimed, me)
  const body = mdDecisionBody_(decision, text, user.name)
  // 2. Send outside the claim (the send path writes mail_log).
  let sentId = ''
  let err = ''
  if (!dry) {
    // sendGmailReply_ had no dry-run switch: an unconfigured send must fail, not record 'sent'.
    if (!getGmailAdapter()) {
      err = 'Gmail send is not configured (GMAIL_SEND_ENABLED + GMAIL_API_URL/GMAIL_API_KEY).'
    } else {
      try {
        const mime = mdReplyMime_({ to: addr.to, cc: addr.cc, subject: String(claimed.subject), inReplyTo: String(claimed.rfc_message_id), body })
        sentId = await sendGmailReply(mime, String(claimed.thread_id), {
          to: addr.to,
          cc: addr.cc.join(','),
          subject: String(claimed.subject),
          kind: 'mail_approval',
          ref: String(claimed.thread_id),
        }, user.email)
      } catch (e) {
        err = String((e as Error)?.message || e)
      }
    }
  }
  // 3. Record the outcome; a failed send puts it back to pending.
  const cur = (await find()) || claimed
  if (err) {
    await db()
      .from('mail_approvals')
      .update({ status: 'pending', client_token: '', decided_by: '', updated_at: new Date().toISOString() })
      .eq('thread_id', String(threadId))
    await log(cur, 'send_failed', 'failed', addr, err)
    throw new Error('The reply was not sent (' + err + '). The mail is still pending.')
  }
  const decidedAt = new Date().toISOString()
  const final: Row = {
    ...cur,
    status: decision === 'reply' ? 'replied' : decision,
    decision_text: text,
    decided_by: user.email,
    decided_at: decidedAt,
    sent_status: dry ? 'dry_run' : 'sent',
    sent_message_id: sentId,
    client_token: clientToken,
    updated_at: decidedAt,
  }
  const { error: uerr } = await db()
    .from('mail_approvals')
    .update({
      status: final.status,
      decision_text: text,
      decided_by: user.email,
      decided_at: decidedAt,
      sent_status: final.sent_status,
      sent_message_id: sentId,
      client_token: clientToken,
      updated_at: decidedAt,
    })
    .eq('thread_id', String(threadId))
  if (uerr) throw new Error(uerr.message)
  await log(final, 'decide', String(final.sent_status), addr, '')
  return mdApprovalOut_(final, dir)
}

/** Puts an approval stuck in 'sending' for over 5 minutes back to pending. Nothing is sent. */
export async function mailApprovalReset(threadId: string) {
  const user = await requireRole(['admin', 'tl', 'agent'])
  if ((await mdApprovers_()).indexOf(user.email) === -1) throw new Error('Only the approvers can reset an approval mail.')
  await assertWritable()
  const dir = await pwDirectory()
  const row = (await rowsOf('mail_approvals')).filter((r) => String(r.thread_id) === String(threadId))[0]
  if (!row) throw new Error('That approval mail is no longer in the queue. Reload the page.')
  if (row.status !== 'sending') throw new Error('It is ' + String(row.status).replace(/_/g, ' ') + ', not stuck.')
  if (Date.now() - Date.parse(String(row.updated_at || '')) <= MD_STUCK_MS) throw new Error('It is still sending. Try again in a few minutes.')
  const stamp = new Date().toISOString()
  const { error } = await db()
    .from('mail_approvals')
    .update({ status: 'pending', client_token: '', decided_by: '', updated_at: stamp })
    .eq('thread_id', String(threadId))
  if (error) throw new Error(error.message)
  await db()
    .from('mail_approval_log')
    .insert({
      log_id: newId('MAL'),
      thread_id: row.thread_id,
      action: 'reset',
      decision: '',
      text: 'Reset from sending to pending',
      by: user.email,
      at: stamp,
      sent_status: '',
      to: '',
      cc: '',
      error: '',
    })
  return mdApprovalOut_({ ...row, status: 'pending', client_token: '', decided_by: '', updated_at: stamp }, dir)
}
