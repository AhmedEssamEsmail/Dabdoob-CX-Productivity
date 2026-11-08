'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchJson } from '@/features/cx-productivity/components/pv-shared'
import { toast } from '@/features/shared/components/shell/Toasts'
import { Button, Textarea } from '@/features/shared/components/ui'

/* ------------------------------------------------------------------ *
 * Mail Desk — port of the legacy Google Apps Script page.
 * Reads stored mail_sla + mail_approvals only; Gmail is queried by the
 * "Check Gmail now" action which calls the server-side refresh.
 * ------------------------------------------------------------------ */

interface SlaRow {
  messageId: string
  threadId: string
  gmailUrl: string
  subject: string
  from: string
  kind: string
  receivedAt: string
  dueAt: string
  nextShift: boolean
  expected: string[]
  status: string
  repliedBy: string
  repliedAt: string
  minutes: number | null
  breached: boolean
  byExpected: boolean
  coveringMissed: boolean
}

interface Approval {
  threadId: string
  gmailUrl: string
  type: string
  orderId: string
  mobile: string
  requester: string
  requesterName: string
  replyTo: string
  cc: string
  excerpt: string
  receivedAt: string
  status: string
  stuck: boolean
  decision: string
  decisionText: string
  decidedBy: string
  decidedAt: string
  sentStatus: string
}

interface MailData {
  isApprover: boolean
  dryRun: boolean
  asOf: string
  sla: SlaRow[]
  approvals: Approval[] | null
}

const api = {
  mailPage: () => fetchJson('/api/mail-desk') as Promise<MailData>,
  mailRefresh: () =>
    fetchJson('/api/mail-desk', { method: 'POST', body: JSON.stringify({ action: 'refresh' }) }) as Promise<MailData>,
  decide: (threadId: string, decision: string, text: string, tok: string) =>
    fetchJson('/api/mail-desk', {
      method: 'POST',
      body: JSON.stringify({ action: 'decide', threadId, decision, text, clientToken: tok }),
    }) as Promise<Approval>,
  reset: (threadId: string) =>
    fetchJson('/api/mail-desk', {
      method: 'POST',
      body: JSON.stringify({ action: 'reset', threadId }),
    }) as Promise<Approval>,
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const utc3 = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3600 * 1000)
const dayFmt = (v: string) => {
  if (!v) return ''
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00Z') : utc3(v)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}
const timeFmt = (iso: string) => (iso ? utc3(iso).toISOString().slice(11, 16) : '')
const V = (iso: string) => (iso ? `${dayFmt(iso)}, ${timeFmt(iso)}` : '')
const minsFmt = (m: number | null) => (m === null ? '' : m >= 90 ? `${Math.round(m / 6) / 10} h` : `${m} min`)
const token = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const TYPE_LABEL: Record<string, string> = {
  refund: 'Refund approval',
  operational_loss: 'Operational loss',
}
const DECIDE_LABEL: Record<string, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  reply: 'your reply',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting',
  sending: 'Sending',
  approved: 'Approved',
  rejected: 'Rejected',
  replied: 'Replied',
  answered_in_gmail: 'Answered in Gmail',
}

/* Toasts come from the shared shell emitter (the legacy `ne`). */

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="dk-skel">
      {[92, 70, 84, 60, 76].map((w) => (
        <span key={w} className="skeleton" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

function Failed({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="dk-failed" role="alert">
      <p>This page could not load: {message}</p>
      <Button variant="primary" onClick={retry}>
        Try again
      </Button>
    </div>
  )
}

function Shell({ route, aside, children }: { route: { title: string; purpose: string }; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="page dk" aria-labelledby="page-title">
      <header className="page-head">
        <h1 id="page-title" className="page-title">
          {route.title}
        </h1>
        <p className="page-purpose">{route.purpose}</p>
        {aside}
      </header>
      {children}
    </section>
  )
}

function Badge({ tone, children }: { tone?: string; children: ReactNode }) {
  return (
    <span className="dk-badge" data-tone={tone}>
      {children}
    </span>
  )
}

function ErrMsg({ message }: { message: string }) {
  return message ? (
    <p className="dk-error" role="alert">
      {message}
    </p>
  ) : null
}

function useLoaded<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const reload = useCallback(() => {
    setError('')
    load().then(setData, (e) => setError(e instanceof Error ? e.message : String(e)))
  }, [load])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload() only clears a stale error, then sets state in the async .then
    reload()
  }, [reload])
  return { data, setData, error, reload }
}

function useRun() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const running = useRef(false)
  return {
    busy,
    error,
    run: async (fn: () => Promise<void>) => {
      if (running.current) return
      running.current = true
      setBusy(true)
      setError('')
      try {
        await fn()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        running.current = false
        setBusy(false)
      }
    },
  }
}

function SlaTr({ m }: { m: SlaRow }) {
  return (
    <tr>
      <td className="md-when">{V(m.receivedAt)}</td>
      <td>
        <a href={m.gmailUrl} target="_blank" rel="noopener noreferrer">
          {m.subject}
        </a>
        <span className="dk-fine">
          {m.kind === 'chargeback' ? 'Chargeback' : 'MyFatoorah refund update'}, {m.from}
        </span>
      </td>
      <td>
        {m.expected.length ? (
          m.expected.join(', ')
        ) : (
          <span className="dk-muted">Nobody on the schedule</span>
        )}
        <span className="dk-fine">
          {m.dueAt
            ? `due ${V(m.dueAt)}${m.nextShift ? ' (arrived outside queue hours: end of the next shift)' : ' (end of shift)'}`
            : 'no shift found'}
        </span>
      </td>
      <td>
        {m.status === 'replied' ? (
          <>
            {m.repliedBy}
            <span className="dk-fine">
              at {timeFmt(m.repliedAt)}, after {minsFmt(m.minutes)}
            </span>
          </>
        ) : (
          <span className="dk-muted">No reply yet</span>
        )}
      </td>
      <td className="md-flags">
        {m.status === 'open' ? (
          <Badge tone={m.breached ? 'bad' : 'warn'}>{m.breached ? 'Open past due' : 'Open'}</Badge>
        ) : null}
        {m.coveringMissed ? <Badge tone="bad">On-queue TL did not reply</Badge> : null}
        {m.status === 'replied' && m.breached ? <Badge tone="warn">Replied after the shift ended</Badge> : null}
        {m.byExpected && !m.breached ? <Badge tone="ok">On time</Badge> : null}
      </td>
    </tr>
  )
}

function ApprovalCard({ a, dryRun, onDone }: { a: Approval; dryRun: boolean; onDone: (u: Approval) => void }) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<{ decision: string; tok: string } | null>(null)
  const run = useRun()
  const to = a.replyTo || a.requester
  const confirm = () =>
    run.run(async () => {
      const res = await api.decide(a.threadId, pending!.decision, text, pending!.tok)
      toast(
        res.sentStatus === 'dry_run'
          ? `${STATUS_LABEL[res.status]}: recorded, not sent (dry run).`
          : `${STATUS_LABEL[res.status]}: sent in the thread.`,
      )
      onDone(res)
    })
  return (
    <article className="md-card">
      <header className="md-card__head">
        <Badge tone={a.type === 'refund' ? undefined : 'warn'}>{TYPE_LABEL[a.type]}</Badge>
        <span className="md-order">Order {a.orderId}</span>
        <span className="md-mobile">{a.mobile}</span>
      </header>
      <p className="md-meta">
        From {a.requesterName}, {V(a.receivedAt)}.{' '}
        <a href={a.gmailUrl} target="_blank" rel="noopener noreferrer">
          Open in Gmail
        </a>
      </p>
      {a.excerpt ? <p className="md-excerpt">{a.excerpt}</p> : null}
      {a.status === 'pending' ? (
        <>
          <label className="md-label" htmlFor={`md-text-${a.threadId}`}>
            Reply text (added under Approved or Rejected, or sent on its own)
          </label>
          <Textarea
            id={`md-text-${a.threadId}`}
            className="input dk-note"
            rows={2}
            value={text}
            disabled={!!pending || run.busy}
            onInput={(e) => setText(e.currentTarget.value)}
          />
        </>
      ) : null}
      {a.status === 'sending' ? (
        <div className="md-confirm">
          <p>
            {a.stuck
              ? 'This reply started sending over 5 minutes ago and never finished. Check the Gmail thread first: if no reply is there, put it back.'
              : 'Sending…'}
          </p>
          {a.stuck ? (
            <Button
              variant="quiet"
              className="dk-sm"
              disabled={run.busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Put this approval back to waiting? Check the Gmail thread first: if a reply was sent, resetting lets someone send a second one.',
                  )
                ) {
                  void run.run(async () => {
                    onDone(await api.reset(a.threadId))
                    toast('Back to waiting.')
                  })
                }
              }}
            >
              Reset to pending
            </Button>
          ) : null}
        </div>
      ) : pending ? (
        <div className="md-confirm" role="alertdialog" aria-label="Confirm the reply">
          <p>
            {dryRun ? 'Record' : 'Send'} <b>{DECIDE_LABEL[pending.decision]}</b>
            {pending.decision !== 'reply' && text.trim() ? ' with your text' : ''} to {to}
            {a.cc ? `, cc ${a.cc.split(',').join(', ')}` : ''}, in the original thread?
            {dryRun ? ' Dry run is on: nothing is emailed.' : ''}
          </p>
          <div className="md-actions">
            <Button variant="primary" className="dk-sm" disabled={run.busy} onClick={() => void confirm()}>
              {run.busy ? 'Sending…' : dryRun ? 'Record decision' : 'Send now'}
            </Button>
            <Button variant="quiet" className="dk-sm" disabled={run.busy} onClick={() => setPending(null)}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="md-actions">
          <Button variant="primary" className="dk-sm" onClick={() => setPending({ decision: 'approved', tok: token() })}>
            Approved
          </Button>
          <Button
            variant="quiet"
            className="dk-sm md-reject"
            onClick={() => setPending({ decision: 'rejected', tok: token() })}
          >
            Rejected
          </Button>
          <Button
            variant="quiet"
            className="dk-sm"
            disabled={text.trim().length < 2}
            onClick={() => setPending({ decision: 'reply', tok: token() })}
          >
            Send reply only
          </Button>
        </div>
      )}
      {run.error ? <ErrMsg message={run.error} /> : null}
    </article>
  )
}

const ROUTE = {
  title: 'Mail desk',
  purpose: 'Approval mails to answer in their thread, and MyFatoorah refund updates and chargebacks: who was on queue, who replied and when.',
}

export default function MailDeskPage() {
  const { data, setData, error, reload } = useLoaded(api.mailPage)
  const [filter, setFilter] = useState('all')
  const run = useRun()
  const aside = data?.isApprover ? (
    <div className="md-aside">
      <Button
        variant="quiet"
        className="dk-sm"
        disabled={run.busy}
        onClick={() =>
          void run.run(async () => {
            setData(await api.mailRefresh())
          })
        }
      >
        {run.busy ? 'Checking Gmail…' : 'Check Gmail now'}
      </Button>
      {run.error ? <ErrMsg message={run.error} /> : null}
    </div>
  ) : null
  if (error) {
    return (
      <Shell route={ROUTE}>
        <Failed message={error} retry={() => void reload()} />
      </Shell>
    )
  }
  if (!data) {
    return (
      <Shell route={ROUTE}>
        <Skeleton />
      </Shell>
    )
  }
  const waiting = data.approvals?.filter((a) => a.status === 'pending' || a.status === 'sending') ?? []
  const decided = data.approvals?.filter((a) => a.status !== 'pending' && a.status !== 'sending') ?? []
  const rows = data.sla.filter((m) =>
    filter === 'open' ? m.status === 'open' : filter === 'missed' ? m.coveringMissed || m.breached : true,
  )
  const onDone = (u: Approval) =>
    setData((d) =>
      d
        ? { ...d, approvals: (d.approvals ?? []).map((a) => (a.threadId === u.threadId ? u : a)) }
        : d,
    )
  return (
    <Shell route={ROUTE} aside={aside}>
      <p className="dk-fine md-asof">
        Gmail checked every 10 minutes{data.asOf ? `, last ${V(data.asOf)}` : ''}.
      </p>
      {data.approvals ? (
        <section className="md-section" aria-labelledby="md-appr-h">
          <h2 id="md-appr-h" className="md-h">
            Approvals waiting, {waiting.length}
          </h2>
          {data.dryRun ? (
            <p className="md-dry">
              Dry run is on: decisions are recorded but no reply is emailed. Turn off mail_approval_dry_run in
              Admin to send.
            </p>
          ) : null}
          {waiting.length ? (
            <div className="md-cards">
              {waiting.map((a) => (
                <ApprovalCard key={a.threadId} a={a} dryRun={data.dryRun} onDone={onDone} />
              ))}
            </div>
          ) : (
            <p className="dk-none">No approval mails waiting.</p>
          )}
          {decided.length ? (
            <details className="md-decided">
              <summary>Decided in the last 14 days, {decided.length}</summary>
              <ul>
                {decided.map((a) => (
                  <li key={a.threadId}>
                    <b>{STATUS_LABEL[a.status]}</b> {TYPE_LABEL[a.type]}, order {a.orderId}, by{' '}
                    {a.decidedBy || 'unknown'} {V(a.decidedAt)}
                    {a.sentStatus === 'dry_run' ? ' (not sent, dry run)' : ''}
                    {a.decisionText ? `: ${a.decisionText}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
      <section className="md-section" aria-labelledby="md-sla-h">
        <h2 id="md-sla-h" className="md-h">
          Mails to answer by the end of the shift
        </h2>
        <div className="md-filter" role="group" aria-label="Show">
          {(['all', 'open', 'missed'] as const).map((f) => (
            <Button
              key={f}
              variant="quiet"
              className="dk-sm"
              aria-pressed={filter === f}
              data-on={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === 'all'
                ? `Last 7 days, ${data.sla.length}`
                : f === 'open'
                  ? `Open, ${data.sla.filter((m) => m.status === 'open').length}`
                  : 'Late or covered by another TL'}
            </Button>
          ))}
        </div>
        {rows.length ? (
          <div className="dk-scroll">
            <table className="dk-table md-table">
              <thead>
                <tr>
                  <th scope="col">Received</th>
                  <th scope="col">Mail</th>
                  <th scope="col">On queue</th>
                  <th scope="col">Reply</th>
                  <th scope="col">
                    <span className="sr-only">Flags</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <SlaTr key={m.messageId} m={m} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dk-none">Nothing here for this filter.</p>
        )}
      </section>
    </Shell>
  )
}
