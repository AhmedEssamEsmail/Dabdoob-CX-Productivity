'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Chip,
  LinesSkeleton,
  LoadError,
  PageHead,
  Section,
} from '@/components/shell/ui'
import { toast } from '@/components/shell/Toasts'
import { daysUntil, type FlagView, type RuleView } from '@/lib/prod-validation'

/**
 * Status validation — verbatim port of the legacy `Ra` page (and its parts
 * Ue/Da/kt/Mt/qa/La/Ha): pending flags, per-flag strip + cases + decide form,
 * disputes (mechanism disabled upstream, rendered for parity), the decided
 * table and the admin-only data-source section.
 */

/* --- Ta/Aa/ue/re/fe/G/Ea — Kuwait formatters -------------------------- */

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuwait',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const dayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuwait',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const ue = (t: string) => (t ? timeFmt.format(new Date(t)) : '')
const re = (t: string) => (t ? dayFmt.format(new Date(t)) : '')
const fe = (f: FlagView) => `${ue(f.intervalStart)}–${ue(f.intervalEnd)}`
const G = (t: number) => `${Math.round(t)} min`
const Ea = (due: string, today: string) => daysUntil(due, today)

/* --- zt/be — decision chip ------------------------------------------- */

const DECISIONS: Record<string, [string, string]> = {
  pending: ['Waiting for review', 'warn'],
  accepted: ['Accepted', 'ok'],
  reverted: ['Reverted to raw', 'neutral'],
  auto: ['Auto-accepted (not reviewed)', 'bad'],
  void: ['No longer applies', 'neutral'],
  open: ['Dispute open', 'warn'],
  upheld: ['Dispute upheld', 'ok'],
  rejected: ['Dispute not upheld', 'neutral'],
}

function DecisionChip({ d }: { d: string }) {
  return <Chip status={DECISIONS[d]?.[1] ?? 'neutral'}>{DECISIONS[d]?.[0] ?? d}</Chip>
}

const CHANNEL_LABELS: Record<string, string> = { chat: 'chat', ticket: 'ticket', wa: 'waiting address' }

/* --- ce — the page's API surface (getProdReviewPage / getProdFlag /
        decideProdFlag / decideProdDispute) ------------------------------ */

const ce = {
  reviewPage: () => fetchJson('/api/prod/flags'),
  flag: (flagId: string) => fetchJson(`/api/prod/flags/${encodeURIComponent(flagId)}`),
  decide: (flagId: string, input: { action: string; status: string; reason: string; openedAt: string }) =>
    fetchJson(`/api/prod/flags/${encodeURIComponent(flagId)}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  decideDispute: (flagId: string, input: { disputeId: string; outcome: string; status: string; note: string }) =>
    fetchJson(`/api/prod/disputes/${encodeURIComponent(input.disputeId)}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flagId, ...input }),
    }),
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed')
  return data
}

/** Se — data fetch with error + reload. */
function useSe<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    queueMicrotask(() => live && setError(''))
    fn().then(
      (d) => live && setData(d),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, reload, setData }
}

/* --- Ue — the dq-page shell ------------------------------------------- */

interface ReviewPage {
  today: string
  pending: FlagView[]
  decided: FlagView[]
  disputes: FlagView[]
  statuses: string[]
  reasonStatuses: string[]
  rule: RuleView
  ticketUrl: string
  isAdmin: boolean
  ready: boolean
  source: {
    query: string
    lastMailAt: string
    lastSnapshot: string
    statusesSeen: { status: string; rows: number; engine: boolean }[]
  } | null
}

function Page({
  route,
  sub,
  d,
  error,
  reload,
  aside,
  children,
}: {
  route: { title: string }
  sub: string
  d: ReviewPage | null
  error: string
  reload: () => void
  aside?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!d && !error}>
      <PageHead title={route.title} sub={sub} aside={aside} />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!d && !error ? <LinesSkeleton lines={6} /> : d ? children : null}
    </section>
  )
}

/* --- kt — the three-lane strip ---------------------------------------- */

function FlagStrip({ f }: { f: FlagView }) {
  const n = Date.parse(f.intervalStart)
  const a = Date.parse(f.intervalEnd)
  const s = Math.max(a - n, 1)
  const l = (i: string) => Math.min(100, Math.max(0, ((Date.parse(i) - n) / s) * 100))
  const r = f.decision === 'pending' ? '' : f.validatedStatus || f.suggestedStatus
  const lane = (label: string, status: string, kind: string) => (
    <div className="pv-lane" data-kind={kind}>
      <span className="pv-lane__label">{label}</span>
      <div className="pv-lane__bar" aria-hidden="true">
        {kind !== 'raw'
          ? f.spans.map(([from, to]) => (
              <span
                key={from}
                className="pv-lane__span"
                style={{
                  insetInlineStart: `${l(from)}%`,
                  inlineSize: `${Math.max(l(to) - l(from), 0.8)}%`,
                }}
              />
            ))
          : null}
      </div>
      <span className="pv-lane__status">{status}</span>
    </div>
  )
  return (
    <figure className="pv-strip">
      {lane('Logged', f.rawStatus, 'raw')}
      {lane('Suggested', f.suggestedStatus, 'suggested')}
      {lane('Reviewed', r || 'not yet', r ? (r === f.rawStatus ? 'reverted' : 'reviewed') : 'pending')}
      <figcaption className="pv-strip__axis">
        <span>{ue(f.intervalStart)}</span>
        <span>
          {G(f.flaggedMin)} flagged of {G(f.intervalMin)} {f.rawStatus}
        </span>
        <span>{ue(f.intervalEnd)}</span>
      </figcaption>
    </figure>
  )
}

/* --- Mt — the cases line ----------------------------------------------- */

function CasesLine({ f, ticketUrl }: { f: FlagView; ticketUrl: string }) {
  return (
    <p className="pv-cases">
      <strong>
        {f.distinctCases} distinct {f.distinctCases === 1 ? 'case' : 'cases'}
      </strong>
      <span className="cx-muted"> ({f.caseCount} events) in the flagged time: </span>
      {f.cases.map((c, i) => (
        <span key={c.id}>
          {i ? ', ' : ''}
          <a href={ticketUrl + c.id} target="_blank" rel="noopener noreferrer">
            #{c.id}
          </a>
          <span className="cx-faint"> {CHANNEL_LABELS[c.channel] ?? c.channel}</span>
        </span>
      ))}
    </p>
  )
}

/* --- Da — the opened flag's decide form -------------------------------- */

function FlagDetail({
  flagId,
  statuses,
  reasonStatuses,
  ticketUrl,
  onDone,
}: {
  flagId: string
  statuses: string[]
  reasonStatuses: string[]
  ticketUrl: string
  onDone: () => void
}) {
  const { data: r, error, reload } = useSe<{ flag: FlagView; openedAt: string }>(() => ce.flag(flagId))
  const [picked, setPicked] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  if (error) return <LoadError message={error} onRetry={reload} />
  if (!r) return <LinesSkeleton lines={5} />

  const f = r.flag
  const v = picked || f.suggestedStatus
  const y = reasonStatuses.includes(v)

  const decide = (action: string) => {
    setSaving(true)
    setFormError('')
    ce.decide(flagId, { action, status: v, reason, openedAt: r.openedAt }).then(
      (k: { decision: string; validatedStatus: string }) => {
        setSaving(false)
        toast(
          k.decision === 'reverted'
            ? `Reverted: the time stays ${f.rawStatus}.`
            : `Accepted as ${k.validatedStatus}. Productivity updates overnight.`,
        )
        onDone()
      },
      (k: unknown) => {
        setSaving(false)
        setFormError(k instanceof Error ? k.message : String(k))
      },
    )
  }

  return (
    <div className="pv-detail">
      <header className="pv-detail__head">
        <strong>{f.agentName}</strong>
        <span className="cx-muted">
          {re(f.intervalStart)}, {fe(f)}
        </span>
        <DecisionChip d={f.decision} />
      </header>
      <FlagStrip f={f} />
      <CasesLine f={f} ticketUrl={ticketUrl} />
      {f.decision !== 'pending' ? (
        <p className="cx-muted">
          Decided by {f.decidedBy} {f.decidedAt ? `on ${f.decidedAt.slice(0, 10)}` : ''}
          {f.reason ? `: ${f.reason}` : '.'}
        </p>
      ) : (
        <form
          className="pv-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            decide('accept')
          }}
        >
          <fieldset className="pv-fieldset">
            <legend className="cx-label">The flagged {G(f.flaggedMin)} count as</legend>
            <div className="cx-seg pv-seg" role="radiogroup">
              {statuses.map((s) => (
                <label key={s}>
                  <input
                    type="radio"
                    name={`st-${flagId}`}
                    checked={v === s}
                    onChange={() => setPicked(s)}
                  />
                  <span>
                    {s}
                    {s === f.suggestedStatus ? ' (suggested)' : ''}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="cx-field">
            <label className="cx-label" htmlFor={`rs-${flagId}`}>
              Reason {y ? `(needed for ${v} and for revert)` : '(needed to revert)'}
            </label>
            <textarea
              className="cx-textarea"
              id={`rs-${flagId}`}
              value={reason}
              onInput={(e) => setReason(e.currentTarget.value)}
            />
          </div>
          {formError ? (
            <p className="cx-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="pv-actions">
            <button type="submit" className="cx-btn cx-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : `Accept as ${v}`}
            </button>
            <button type="button" className="cx-btn" disabled={saving} onClick={() => decide('revert')}>
              Revert to {f.rawStatus}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/* --- qa — the TL's decision on an agent dispute (mechanism disabled
        upstream; rendered only if a dispute row ever appears) ------------- */

function DisputeForm({ f, statuses, onDone }: { f: FlagView; statuses: string[]; onDone: () => void }) {
  const [outcome, setOutcome] = useState('')
  const [status, setStatus] = useState(f.rawStatus)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const g = f.dispute
  if (!g) return null
  return (
    <form
      className="pv-form"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        if (!outcome) {
          setFormError('Choose upheld or not upheld.')
          return
        }
        setSaving(true)
        setFormError('')
        ce.decideDispute(f.flagId, { disputeId: g.disputeId, outcome, status, note }).then(
          () => {
            setSaving(false)
            toast('Recorded. The agent was emailed.')
            onDone()
          },
          (m: unknown) => {
            setSaving(false)
            setFormError(m instanceof Error ? m.message : String(m))
          },
        )
      }}
    >
      <p className="pv-quote">
        <strong>{f.agentName}</strong>{' '}
        <span className="cx-faint">({g.raisedAt.slice(0, 10)})</span>: {g.reason}
      </p>
      <div className="cx-seg" role="radiogroup" aria-label="Outcome">
        <label>
          <input
            type="radio"
            name={`o-${g.disputeId}`}
            checked={outcome === 'upheld'}
            onChange={() => setOutcome('upheld')}
          />
          <span>Uphold</span>
        </label>
        <label>
          <input
            type="radio"
            name={`o-${g.disputeId}`}
            checked={outcome === 'rejected'}
            onChange={() => setOutcome('rejected')}
          />
          <span>Do not uphold</span>
        </label>
      </div>
      {outcome === 'upheld' ? (
        <div className="cx-field">
          <label className="cx-label" htmlFor={`ds-${g.disputeId}`}>
            The flagged time counts as
          </label>
          <select
            className="cx-select"
            id={`ds-${g.disputeId}`}
            value={status}
            onChange={(e) => setStatus(e.currentTarget.value)}
          >
            <option value={f.rawStatus}>{f.rawStatus} (raw: revert)</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="cx-field">
        <label className="cx-label" htmlFor={`dn-${g.disputeId}`}>
          Note to the agent
        </label>
        <textarea
          className="cx-textarea"
          id={`dn-${g.disputeId}`}
          value={note}
          onInput={(e) => setNote(e.currentTarget.value)}
        />
      </div>
      {formError ? (
        <p className="cx-error" role="alert">
          {formError}
        </p>
      ) : null}
      <button type="submit" className="cx-btn cx-btn--primary" disabled={saving}>
        {saving ? 'Saving…' : 'Record the decision'}
      </button>
    </form>
  )
}

/* --- La — the admin-only data-source section ---------------------------- */

function DataSource({ d }: { d: ReviewPage }) {
  const n = d.source
  if (!n) return null
  return (
    <Section id="pv-src" title="Data source" hint="Admins only">
      <div className="cx-panel cx-panel--pad pv-source">
        {d.ready ? null : (
          <p className="cx-error">
            CC2 Productivity is not set up: run setupProductivity in the Productivity project.
          </p>
        )}
        <p>
          Agents Activity email from Gmail (<code>{n.query}</code>): last imported email{' '}
          {n.lastMailAt ? `${re(n.lastMailAt)} ${ue(n.lastMailAt)}` : 'none yet'}, last import run{' '}
          {n.lastSnapshot ? `${re(n.lastSnapshot)} ${ue(n.lastSnapshot)}` : 'never'}.
        </p>
        {n.statusesSeen.length ? (
          <p className="cx-muted">
            Status names in the last 14 days:{' '}
            {n.statusesSeen.map((s, i) => (
              <span key={s.status}>
                {i ? ', ' : ''}
                {s.status} ({s.rows}
                {s.engine ? '' : ', not in Productivity %'})
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </Section>
  )
}

/* --- Ra — the page ------------------------------------------------------ */

const ROUTE = { title: 'Status validation' }

export default function StatusValidationPage() {
  const { data: n, error, reload } = useSe<ReviewPage>(ce.reviewPage)
  const [selected, setSelected] = useState('')
  const done = () => {
    setSelected('')
    reload()
  }
  return (
    <Page
      route={ROUTE}
      d={n}
      error={error}
      reload={reload}
      sub={
        n
          ? `IDLE time with ${n.rule.x} or more distinct cases inside ${n.rule.windowMin} minutes (intervals of ${n.rule.minIntervalMin} minutes or more). Until you review a flag, its suggested status counts; on day ${n.rule.reviewDays} it is accepted automatically.`
          : ''
      }
    >
      {n ? (
        <>
          <Section
            id="pv-q"
            title={n.pending.length ? `${n.pending.length} to review` : 'Nothing to review'}
            hint="Open each flag to decide it"
          >
            <div className={selected ? 'cx-grid-2 pv-review' : 'pv-review'}>
              <ul className="pv-list" aria-label="Flags to review">
                {n.pending.map((f) => {
                  const h = Ea(f.dueDate, n.today)
                  return (
                    <li key={f.flagId}>
                      <button
                        type="button"
                        className="pv-item"
                        aria-pressed={selected === f.flagId}
                        onClick={() => setSelected(f.flagId)}
                      >
                        <span className="pv-item__who">
                          <strong>{f.agentName}</strong>{' '}
                          <span className="cx-muted">
                            {re(f.intervalStart)}, {fe(f)}
                          </span>
                        </span>
                        <span className="pv-item__what">
                          {G(f.flaggedMin)} {f.rawStatus}, {f.distinctCases} cases, suggested{' '}
                          {f.suggestedStatus}
                        </span>
                        <Chip status={h <= 1 ? 'bad' : h <= 3 ? 'warn' : 'neutral'}>
                          {h <= 0 ? 'auto-accepts today' : `${h} ${h === 1 ? 'day' : 'days'} left`}
                        </Chip>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {selected ? (
                <div className="cx-panel cx-panel--pad" key={selected}>
                  <FlagDetail
                    flagId={selected}
                    statuses={n.statuses}
                    reasonStatuses={n.reasonStatuses}
                    ticketUrl={n.ticketUrl}
                    onDone={done}
                  />
                </div>
              ) : null}
            </div>
          </Section>
          {n.disputes.length ? (
            <Section
              id="pv-d"
              title={`${n.disputes.length} ${n.disputes.length === 1 ? 'dispute' : 'disputes'} to decide`}
            >
              <div className="pv-cards">
                {n.disputes.map((f) => (
                  <article key={f.flagId} className="cx-panel cx-panel--pad">
                    <header className="pv-detail__head">
                      <strong>{f.agentName}</strong>
                      <span className="cx-muted">
                        {re(f.intervalStart)}, {fe(f)}
                      </span>
                      <DecisionChip d={f.decision} />
                    </header>
                    <FlagStrip f={f} />
                    <CasesLine f={f} ticketUrl={n.ticketUrl} />
                    <DisputeForm f={f} statuses={n.statuses} onDone={reload} />
                  </article>
                ))}
              </div>
            </Section>
          ) : null}
          {n.decided.length ? (
            <Section id="pv-h" title="Decided, last 30 days">
              <div className="cx-panel cx-tablewrap">
                <table className="cx-table">
                  <thead>
                    <tr>
                      <th scope="col">Agent</th>
                      <th scope="col">When</th>
                      <th scope="col">Raw</th>
                      <th scope="col">Suggested</th>
                      <th scope="col">Reviewed</th>
                      <th scope="col">Min</th>
                      <th scope="col">Decision</th>
                      <th scope="col">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {n.decided.map((f) => (
                      <tr key={f.flagId}>
                        <td>{f.agentName}</td>
                        <td>
                          {re(f.intervalStart)}, {fe(f)}
                        </td>
                        <td>{f.rawStatus}</td>
                        <td>{f.suggestedStatus}</td>
                        <td>{f.validatedStatus}</td>
                        <td className="cx-num">{Math.round(f.flaggedMin)}</td>
                        <td>
                          <DecisionChip d={f.dispute ? f.dispute.status : f.decision} />
                        </td>
                        <td>
                          {f.decidedBy}
                          {f.reason ? <span className="cx-faint pv-sub">{f.reason}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}
          <DataSource d={n} />
        </>
      ) : null}
    </Page>
  )
}
