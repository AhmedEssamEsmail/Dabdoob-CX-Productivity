'use client'

import { useRef, useState, type ReactNode } from 'react'
import { fetchJson } from '@/features/shared/lib/fetch-json'
import { usePageData } from '@/features/shared/lib/use-page-data'
import { toast } from '@/features/shared/components/shell/Toasts'
import { Button, Chip, ConfirmInline, Empty, ErrMsg, Failed, PageShell, Skeleton, TableScroll, Textarea } from '@/features/shared/components/ui'
import type { ChipStatus } from '@/features/shared/components/ui/Chip'

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
const STATUS_TONE: Record<string, ChipStatus> = {
  pending: 'warn',
  sending: 'warn',
  approved: 'ok',
  rejected: 'bad',
  replied: 'info',
  answered_in_gmail: 'info',
}

/* Toasts come from the shared shell emitter (the legacy `ne`). */

function Badge({ tone, children }: { tone?: ChipStatus; children: ReactNode }) {
  return <Chip tone={tone}>{children}</Chip>
}

function Shell({ route, aside, children }: { route: { title: string; purpose: string }; aside?: ReactNode; children: ReactNode }) {
  return (
    <PageShell
      title={route.title}
      purpose={route.purpose}
      aside={aside ? <div className="page-actions">{aside}</div> : undefined}
      id="page-title"
      className="dk"
    >
      {children}
    </PageShell>
  )
}

function useLoaded<T>(load: () => Promise<T>) {
  return usePageData<T>(null, load, { cache: false })
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
        <div className="md-flags__in">
        {m.status === 'open' ? (
          <Badge tone={m.breached ? 'bad' : 'warn'}>{m.breached ? 'Open past due' : 'Open'}</Badge>
        ) : null}
        {m.coveringMissed ? <Badge tone="bad">On-queue TL did not reply</Badge> : null}
        {m.status === 'replied' && m.breached ? <Badge tone="warn">Replied after the shift ended</Badge> : null}
        {m.byExpected && !m.breached ? <Badge tone="ok">On time</Badge> : null}
        </div>
      </td>
    </tr>
  )
}

function ApprovalCard({ a, dryRun, onDone }: { a: Approval; dryRun: boolean; onDone: (u: Approval) => void }) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<{ decision: string; tok: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
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
            confirmReset ? (
              <ConfirmInline
                label="Put this approval back to waiting?"
                detail="Check the Gmail thread first: if a reply was sent, resetting lets someone send a second one."
                confirmLabel={run.busy ? 'Resetting…' : 'Reset to pending'}
                onConfirm={() => {
                  void run.run(async () => {
                    onDone(await api.reset(a.threadId))
                    setConfirmReset(false)
                    toast('Back to waiting.')
                  })
                }}
                onCancel={() => setConfirmReset(false)}
              />
            ) : (
              <Button variant="danger-quiet" size="sm" disabled={run.busy} onClick={() => setConfirmReset(true)}>
                Reset to pending
              </Button>
            )
          ) : null}
        </div>
      ) : pending ? (
        <ConfirmInline
          className="md-confirm"
          label={
            <>
              {dryRun ? 'Record' : 'Send'} <b>{DECIDE_LABEL[pending.decision]}</b>
              {pending.decision !== 'reply' && text.trim() ? ' with your text' : ''} to {to}
              {a.cc ? `, cc ${a.cc.split(',').join(', ')}` : ''}, in the original thread?
            </>
          }
          detail={dryRun ? 'Dry run is on: nothing is emailed.' : undefined}
          confirmLabel={run.busy ? 'Sending…' : dryRun ? 'Record decision' : 'Send now'}
          onConfirm={() => void confirm()}
          onCancel={() => {
            if (!run.busy) setPending(null)
          }}
        />
      ) : (
        <div className="md-actions">
          <Button variant="primary" size="sm" onClick={() => setPending({ decision: 'approved', tok: token() })}>
            Approved
          </Button>
          <Button
            variant="danger-quiet"
            size="sm"
            onClick={() => setPending({ decision: 'rejected', tok: token() })}
          >
            Rejected
          </Button>
          <Button
            variant="quiet"
            size="sm"
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
        size="sm"
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
        <Skeleton shape="rows" n={5} />
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
            <div className="cx-panel">
              <Empty title="No approval mails waiting." />
            </div>
          )}
          {decided.length ? (
            <div className="cx-panel cx-panel--pad">
            <details className="md-decided">
              <summary>Decided in the last 14 days, {decided.length}</summary>
              <ul>
                {decided.map((a) => (
                  <li key={a.threadId}>
                    <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge> {TYPE_LABEL[a.type]}, order {a.orderId}, by{' '}
                    {a.decidedBy || 'unknown'} {V(a.decidedAt)}
                    {a.sentStatus === 'dry_run' ? ' (not sent, dry run)' : ''}
                    {a.decisionText ? `: ${a.decisionText}` : ''}
                  </li>
                ))}
              </ul>
            </details>
            </div>
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
              size="sm"
              aria-pressed={filter === f}
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
          <div className="cx-panel cx-panel--pad">
            <TableScroll label="Mails needing a reply" minWidth="44rem">
            <table className="dk-table md-table">
              <thead>
                <tr>
                  <th scope="col">Received</th>
                  <th scope="col">Mail</th>
                  <th scope="col">On queue</th>
                  <th scope="col">Reply</th>
                  <th scope="col">
                    <span className="cx-sr">Flags</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <SlaTr key={m.messageId} m={m} />
                ))}
              </tbody>
            </table>
            </TableScroll>
          </div>
        ) : (
          <div className="cx-panel">
            <Empty title="Nothing here for this filter." />
          </div>
        )}
      </section>
    </Shell>
  )
}
