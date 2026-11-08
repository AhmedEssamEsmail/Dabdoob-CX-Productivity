/**
 * Email wrapper — port of original_deprecated/Mailer.js.
 *
 * MailApp/GmailApp are replaced by adapter interfaces:
 *   MailAdapter  - sendMail() path. With no SMTP creds configured (MAIL_API_URL /
 *                  MAIL_API_KEY), getMailAdapter() returns null and every attempt
 *                  returns 'dry_run' — nothing ever leaves the building.
 *   GmailAdapter - sendGmailReply() path, additionally gated by the
 *                  GMAIL_SEND_ENABLED flag. Stubbed until wired.
 *
 * Every attempt — sent, dry-run, blocked or failed — is written to `mail_log`
 * so reminders can be audited. mail_dry_run defaults to true.
 */

import 'server-only'

import { appendRow } from './repo'
import { getConfig } from './settings'
import { normEmail } from './identity'
import { assertWritable } from './viewas'

export const MAIL_LOG_TABLE = 'mail_log'

export interface MailMessage {
  to: string | string[]
  cc?: string | string[]
  subject: string
  htmlBody?: string
  /** What triggered it: 'missed_1on1' | 'task_reminder' | 'qa_*' | ... */
  kind?: string
  /** The id of the record it is about, for tracing. */
  ref?: string
}

export interface NormalizedMail {
  to: string
  cc?: string
  subject: string
  htmlBody: string
  replyTo?: string
  name?: string
}

export interface MailAdapter {
  send(msg: NormalizedMail): Promise<{ id?: string; quotaLeft?: string | number }>
}

export interface GmailAdapter {
  sendReply(mime: string, threadId: string): Promise<{ id?: string }>
}

/**
 * The read side of Gmail (Gmail.Users.Messages.* in legacy Apps Script), used by the
 * daily "Agents Activity" CSV import. One search + one message + one attachment get
 * per run. No Gmail creds are wired in this project yet: the job registers an
 * adapter (setGmailReadAdapter) or an external endpoint is provided through
 * GMAIL_READ_API_URL / GMAIL_READ_API_KEY. Absent both: the job reports
 * { skipped: 'gmail adapter not configured' }.
 */
export interface GmailReadAdapter {
  /** Gmail.Users.Messages.list('me', { q, maxResults }) -> the message stubs. */
  listMessages(q: string, maxResults: number): Promise<{ id: string }[]>
  /** Gmail.Users.Messages.get('me', id, { format: 'full' }) -> { id, internalDate, payload }. */
  getMessage(id: string): Promise<{ id: string; internalDate: string | number; payload?: unknown }>
  /** Gmail.Users.Messages.Attachments.get('me', msgId, attId) -> { data } (base64url). */
  getAttachment(messageId: string, attachmentId: string): Promise<{ data: string }>
}

let GMAIL_READ_STUB: GmailReadAdapter | null = null

/** Registers the read adapter (job wiring or tests). null clears it. */
export function setGmailReadAdapter(adapter: GmailReadAdapter | null): void {
  GMAIL_READ_STUB = adapter
}

/**
 * The configured read adapter: a registered one first, else a generic HTTPS endpoint
 * (GMAIL_READ_API_URL + GMAIL_READ_API_KEY) that accepts
 * { action: 'list' | 'get' | 'attachment', ... } and answers the shapes above.
 */
export function getGmailReadAdapter(): GmailReadAdapter | null {
  if (GMAIL_READ_STUB) return GMAIL_READ_STUB
  const url = process.env.GMAIL_READ_API_URL
  const key = process.env.GMAIL_READ_API_KEY
  if (!url || !key) return null
  const call = async (body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Gmail read adapter failed: HTTP ' + res.status)
    return res.json()
  }
  return {
    async listMessages(q, maxResults) {
      const body = (await call({ action: 'list', q, maxResults })) as { messages?: { id: string }[] }
      return body.messages || []
    },
    async getMessage(id) {
      return (await call({ action: 'get', id })) as { id: string; internalDate: string | number; payload?: unknown }
    },
    async getAttachment(messageId, attachmentId) {
      return (await call({ action: 'attachment', messageId, attachmentId })) as { data: string }
    },
  }
}

export type SendStatus = 'sent' | 'dry_run' | 'blocked' | 'failed'
export interface SendResult {
  status: SendStatus
  error?: string
}

/**
 * The configured mail adapter, or null when no SMTP creds exist. Convention:
 * MAIL_API_URL + MAIL_API_KEY — a generic HTTPS endpoint that accepts
 * { to, cc, subject, htmlBody, replyTo, name } and returns { id, quotaLeft }.
 */
export function getMailAdapter(): MailAdapter | null {
  const url = process.env.MAIL_API_URL
  const key = process.env.MAIL_API_KEY
  if (!url || !key) return null
  return {
    async send(msg) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify(msg),
      })
      if (!res.ok) throw new Error('Mail adapter failed: HTTP ' + res.status)
      const body = (await res.json().catch(() => ({}))) as { id?: string; quotaLeft?: number }
      return { id: body.id, quotaLeft: body.quotaLeft }
    },
  }
}

/**
 * The Gmail reply adapter — requires BOTH the kill-switch flag and creds
 * (GMAIL_API_URL + GMAIL_API_KEY). Absent either: sendGmailReply stays a dry-run stub.
 */
export function getGmailAdapter(): GmailAdapter | null {
  if (String(process.env.GMAIL_SEND_ENABLED || '').toLowerCase() !== 'true') return null
  const url = process.env.GMAIL_API_URL
  const key = process.env.GMAIL_API_KEY
  if (!url || !key) return null
  return {
    async sendReply(mime, threadId) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ raw: mime, threadId: String(threadId) }),
      })
      if (!res.ok) throw new Error('Gmail adapter failed: HTTP ' + res.status)
      const body = (await res.json().catch(() => ({}))) as { id?: string }
      return { id: body.id }
    },
  }
}

/** Mail policy (2026-10-20): only Quality/CTL mail (kind qa_*) and mail addressed solely to admins leave the tool. */
export async function mailAllowed(msg: MailMessage, to: string): Promise<boolean> {
  if (/^qa_/.test(String(msg.kind || ''))) return true
  const admins = String((await getConfig('admin_emails', '')) || '')
    .split(',')
    .map(normEmail)
    .filter(String)
  return !!to && to.split(',').every((e) => admins.indexOf(e) !== -1)
}

/**
 * sendMail_: msg { to, cc?, subject, htmlBody, kind, ref? }.
 * Returns { status: 'sent' | 'dry_run' | 'blocked' | 'failed', error? }.
 * 'blocked' = the policy refused it (dry-run logged); 'dry_run' when
 * mail_dry_run is on OR no SMTP creds are configured.
 */
export async function sendMail(msg: MailMessage, actor: string): Promise<SendResult> {
  if (!msg || !msg.to || !msg.subject) throw new Error('sendMail_ needs to and subject.')
  await assertWritable()
  const to = ([] as unknown[])
    .concat(msg.to as unknown[])
    .map(normEmail)
    .filter(String)
    .join(',')
  const cc = msg.cc
    ? ([] as unknown[])
        .concat(msg.cc as unknown[])
        .map(normEmail)
        .filter(String)
        .join(',')
    : ''
  let dryRun = (await getConfig('mail_dry_run', true)) !== false
  let status: SendStatus = 'dry_run'
  if (!dryRun && !(await mailAllowed(msg, to))) {
    dryRun = true
    status = 'blocked'
  }
  let error = ''
  let quota: string | number = ''
  if (!dryRun) {
    const adapter = getMailAdapter()
    if (!adapter) {
      status = 'dry_run' // no SMTP creds: nothing ever leaves the building
    } else {
      try {
        const opts: NormalizedMail = { to, subject: msg.subject, htmlBody: msg.htmlBody || '', name: 'CX Helm' }
        if (cc) opts.cc = cc
        const replyTo = String((await getConfig('mail_reply_to', '')) || '')
        if (replyTo) opts.replyTo = replyTo
        const sent = await adapter.send(opts)
        status = 'sent'
        if (sent.quotaLeft !== undefined && sent.quotaLeft !== null) quota = sent.quotaLeft
      } catch (e) {
        status = 'failed'
        error = String((e as Error)?.message || e)
      }
    }
  }
  // The mail_log write is best effort (like dqLogRun_): a missing table or a
  // transient failure must not turn a sent / dry-run mail into a job error.
  try {
    await appendRow(
      MAIL_LOG_TABLE,
      {
        sent_at: new Date().toISOString(),
        to,
        cc,
        subject: msg.subject,
        kind: msg.kind || '',
        ref: msg.ref || '',
        status,
        error,
        quota_left: quota === '' ? '' : String(quota),
      },
      actor
    )
  } catch (e) {
    console.log('mail_log append failed: ' + ((e as Error)?.message || e))
  }
  return error ? { status, error } : { status }
}

/**
 * A reply IN an existing Gmail thread (sendGmailReply_): raw RFC 2822 text sent
 * through the Gmail API with the thread id. No dry-run flag in legacy — here the
 * adapter + GMAIL_SEND_ENABLED decide; while unconfigured it logs a dry_run row
 * and returns ''. Throws on adapter failure, like the legacy send.
 */
export async function sendGmailReply(
  mime: string,
  threadId: string,
  meta: { to?: string; cc?: string; subject?: string; kind?: string; ref?: string } | undefined,
  actor: string
): Promise<string> {
  await assertWritable()
  const m = meta || {}
  const adapter = getGmailAdapter()
  let status: SendStatus = 'sent'
  let error = ''
  let id = ''
  if (!adapter) {
    status = 'dry_run' // stub: real Gmail send stays behind the adapter + flag
  } else {
    try {
      const sent = await adapter.sendReply(mime, String(threadId))
      id = String(sent?.id || '')
    } catch (e) {
      status = 'failed'
      error = String((e as Error)?.message || e)
    }
  }
  await appendRow(
    MAIL_LOG_TABLE,
    {
      sent_at: new Date().toISOString(),
      to: m.to || '',
      cc: m.cc || '',
      subject: m.subject || '',
      kind: m.kind || 'gmail_reply',
      ref: m.ref || '',
      status,
      error,
      quota_left: '',
    },
    actor
  )
  if (error) throw new Error(error)
  return id
}

/** Escapes text before it is placed in an email's HTML body (escapeHtml_). */
export function escapeHtml(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
