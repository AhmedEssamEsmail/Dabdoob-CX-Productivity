'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DECISION_LABELS,
  daysUntil,
  type FlagView,
  type RuleView,
} from '@/lib/prod-validation'

interface SeenStatus {
  status: string
  rows: number
}

interface ReviewPage {
  today: string
  pending: FlagView[]
  decided: FlagView[]
  statuses: string[]
  reasonStatuses: string[]
  rule: RuleView
  ticketUrl: string
  isAdmin: boolean
  source: { statusesSeen: SeenStatus[] } | null
}

interface FlagDetail {
  flag: FlagView
  openedAt: string
}

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuwait',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuwait',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const CHANNEL_LABELS: Record<string, string> = {
  chat: 'chat',
  ticket: 'ticket',
  wa: 'waiting address',
}

function dayLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dayFormat.format(date)
}

function timeLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : timeFormat.format(date)
}

function intervalLabel(flag: FlagView) {
  return `${timeLabel(flag.intervalStart)}–${timeLabel(flag.intervalEnd)}`
}

function minutesLabel(minutes: number) {
  return `${Math.round(minutes)} min`
}

function DecisionChip({ decision }: { decision: string }) {
  const [label, tone] = DECISION_LABELS[decision] || [decision, 'neutral']
  return (
    <span className="legacy-chip" data-status={tone}>
      {label}
    </span>
  )
}

function DueChip({ dueDate, today }: { dueDate: string; today: string }) {
  if (!dueDate) {
    return (
      <span className="legacy-chip" data-status="neutral">
        Waiting for review
      </span>
    )
  }
  const days = daysUntil(dueDate, today)
  const tone = days <= 1 ? 'bad' : days <= 3 ? 'warn' : 'neutral'
  const label = days <= 0 ? 'auto-accepts today' : `${days} ${days === 1 ? 'day' : 'days'} left`
  return (
    <span className="legacy-chip" data-status={tone}>
      {label}
    </span>
  )
}

/** kt: three lanes — as logged, the suggestion, and the reviewed outcome — with the flagged spans. */
function FlagStrip({ flag }: { flag: FlagView }) {
  const start = Date.parse(flag.intervalStart)
  const end = Date.parse(flag.intervalEnd)
  const span = Math.max(end - start, 1)
  const pct = (iso: string) =>
    Math.min(100, Math.max(0, ((Date.parse(iso) - start) / span) * 100))

  const reviewed =
    flag.decision === 'pending' ? '' : flag.validatedStatus || flag.suggestedStatus
  const reviewedKind = reviewed
    ? reviewed === flag.rawStatus
      ? 'reverted'
      : 'reviewed'
    : 'pending'

  const lane = (label: string, status: string, kind: string, showSpans: boolean) => (
    <div className="pv-lane" data-kind={kind}>
      <span className="pv-lane__label">{label}</span>
      <div className="pv-lane__bar" aria-hidden="true">
        {showSpans
          ? flag.spans.map(([from, to]) => (
              <span
                className="pv-lane__span"
                key={`${from}-${to}`}
                style={{
                  insetInlineStart: `${pct(from)}%`,
                  inlineSize: `${Math.max(pct(to) - pct(from), 0.8)}%`,
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
      {lane('Logged', flag.rawStatus, 'raw', false)}
      {lane('Suggested', flag.suggestedStatus, 'suggested', true)}
      {lane('Reviewed', reviewed || 'not yet', reviewedKind, true)}
      <figcaption className="pv-strip__axis">
        <span>{timeLabel(flag.intervalStart)}</span>
        <span>
          {minutesLabel(flag.flaggedMin)} flagged of {minutesLabel(flag.intervalMin)}{' '}
          {flag.rawStatus}
        </span>
        <span>{timeLabel(flag.intervalEnd)}</span>
      </figcaption>
    </figure>
  )
}

/** Mt: the distinct cases (and total events) inside the flagged spans, linked to Freshdesk. */
function CaseList({ flag, ticketUrl }: { flag: FlagView; ticketUrl: string }) {
  return (
    <p className="pv-cases">
      <strong>
        {flag.distinctCases} distinct {flag.distinctCases === 1 ? 'case' : 'cases'}
      </strong>
      <span className="legacy-muted"> ({flag.caseCount} events) in the flagged time: </span>
      {flag.cases.map((c, index) => (
        <span key={c.id}>
          {index ? ', ' : ''}
          <a href={`${ticketUrl}${c.id}`} target="_blank" rel="noopener noreferrer">
            #{c.id}
          </a>
          <span className="legacy-faint"> {CHANNEL_LABELS[c.channel] ?? c.channel}</span>
        </span>
      ))}
    </p>
  )
}

/** Da: the opened flag — strip, cases, and the accept/revert decision form. */
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
  onDone: (message: string) => void
}) {
  const [detail, setDetail] = useState<FlagDetail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [picked, setPicked] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    fetch(`/api/prod/flags/${encodeURIComponent(flagId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load the flag')
        return data as FlagDetail
      })
      .then((data) => {
        if (active) {
          setDetail(data)
          setLoadError('')
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setLoadError(cause instanceof Error ? cause.message : 'Could not load the flag')
      })
    return () => {
      active = false
    }
  }, [flagId, retry])

  if (loadError) {
    return (
      <div className="legacy-panel legacy-panel--error" role="alert">
        <p>
          <strong>This flag could not load.</strong> {loadError}
        </p>
        <button type="button" onClick={() => setRetry((n) => n + 1)}>
          Try again
        </button>
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="pv-detail" aria-label="Loading flag">
        <div className="legacy-flag legacy-flag--skeleton" />
        <div className="legacy-flag legacy-flag--skeleton" />
        <div className="legacy-flag legacy-flag--skeleton" />
      </div>
    )
  }

  const flag = detail.flag
  const choice = picked || flag.suggestedStatus
  const needsReason = reasonStatuses.includes(choice)

  const decide = (action: 'accept' | 'revert') => {
    setSaving(true)
    setFormError('')
    fetch(`/api/prod/flags/${encodeURIComponent(flagId)}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        status: choice,
        reason,
        openedAt: detail.openedAt,
      }),
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not record the decision.')
        return data as { decision: string; validatedStatus: string }
      })
      .then((data) => {
        setSaving(false)
        onDone(
          data.decision === 'reverted'
            ? `Reverted: the time stays ${flag.rawStatus}.`
            : `Accepted as ${data.validatedStatus}. Productivity updates overnight.`
        )
      })
      .catch((cause: unknown) => {
        setSaving(false)
        setFormError(cause instanceof Error ? cause.message : 'Could not record the decision.')
      })
  }

  return (
    <div className="pv-detail">
      <header className="pv-detail__head">
        <strong>{flag.agentName}</strong>
        <span className="legacy-muted">
          {dayLabel(flag.intervalStart)}, {intervalLabel(flag)}
        </span>
        <DecisionChip decision={flag.decision} />
      </header>

      <FlagStrip flag={flag} />
      <CaseList flag={flag} ticketUrl={ticketUrl} />

      {flag.decision !== 'pending' ? (
        <p className="legacy-muted">
          Decided by {flag.decidedBy}
          {flag.decidedAt ? ` on ${flag.decidedAt.slice(0, 10)}` : ''}
          {flag.reason ? `: ${flag.reason}` : '.'}
        </p>
      ) : (
        <form
          className="pv-form"
          onSubmit={(event) => {
            event.preventDefault()
            decide('accept')
          }}
        >
          <fieldset className="pv-fieldset">
            <legend className="legacy-label">
              The flagged {minutesLabel(flag.flaggedMin)} count as
            </legend>
            <div className="pv-seg" role="radiogroup">
              {statuses.map((status) => (
                <label key={status}>
                  <input
                    type="radio"
                    name={`st-${flagId}`}
                    checked={choice === status}
                    onChange={() => setPicked(status)}
                  />
                  <span>
                    {status}
                    {status === flag.suggestedStatus ? ' (suggested)' : ''}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="pv-field">
            <label className="legacy-label" htmlFor={`rs-${flagId}`}>
              Reason{' '}
              {needsReason ? `(needed for ${choice} and for revert)` : '(needed to revert)'}
            </label>
            <textarea
              className="pv-textarea"
              id={`rs-${flagId}`}
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
            />
          </div>

          {formError ? (
            <p className="legacy-error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="pv-actions">
            <button type="submit" className="pv-btn pv-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : `Accept as ${choice}`}
            </button>
            <button
              type="button"
              className="pv-btn"
              disabled={saving}
              onClick={() => decide('revert')}
            >
              Revert to {flag.rawStatus}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/** pv-h: the last 30 days of decisions, newest first. */
function DecidedTable({ decided }: { decided: FlagView[] }) {
  if (!decided.length) return null
  return (
    <section className="legacy-section" aria-labelledby="decided-title">
      <header className="legacy-section__head">
        <h2 id="decided-title">Decided, last 30 days</h2>
      </header>
      <div className="legacy-panel legacy-tablewrap">
        <table className="pv-table">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">When</th>
              <th scope="col">Raw</th>
              <th scope="col">Suggested</th>
              <th scope="col">Reviewed</th>
              <th scope="col" className="pv-num">
                Min
              </th>
              <th scope="col">Decision</th>
              <th scope="col">By</th>
            </tr>
          </thead>
          <tbody>
            {decided.map((flag) => (
              <tr key={flag.flagId}>
                <td>{flag.agentName}</td>
                <td>
                  {dayLabel(flag.intervalStart)}, {intervalLabel(flag)}
                </td>
                <td>{flag.rawStatus}</td>
                <td>{flag.suggestedStatus}</td>
                <td>{flag.validatedStatus}</td>
                <td className="pv-num">{Math.round(flag.flaggedMin)}</td>
                <td>
                  <DecisionChip decision={flag.decision} />
                </td>
                <td>
                  {flag.decidedBy}
                  {flag.reason ? <span className="legacy-faint pv-sub">{flag.reason}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** La: the admin data-source panel — status names seen in the interval store. */
function SourcePanel({ source }: { source: ReviewPage['source'] }) {
  if (!source) return null
  return (
    <section className="legacy-section" aria-labelledby="source-title">
      <header className="legacy-section__head">
        <h2 id="source-title">Data source</h2>
        <p>Admins only</p>
      </header>
      <div className="legacy-panel pv-source">
        {source.statusesSeen.length ? (
          <p className="legacy-muted">
            Status names in the last 14 days:{' '}
            {source.statusesSeen.map((seen, index) => (
              <span key={seen.status}>
                {index ? ', ' : ''}
                {seen.status} ({seen.rows})
              </span>
            ))}
          </p>
        ) : (
          <p className="legacy-muted">No interval data in the last 14 days.</p>
        )}
      </div>
    </section>
  )
}

export default function StatusValidationPage() {
  const [page, setPage] = useState<ReviewPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [toast, setToast] = useState('')
  const mounted = useRef(true)

  const load = useCallback(() => {
    fetch('/api/prod/flags', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load flags')
        return data as ReviewPage
      })
      .then((data) => {
        if (!mounted.current) return
        setPage(data)
        setError('')
      })
      .catch((cause: unknown) => {
        if (!mounted.current) return
        setError(cause instanceof Error ? cause.message : 'Could not load flags')
      })
      .finally(() => {
        if (mounted.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    mounted.current = true
    load()
    return () => {
      mounted.current = false
    }
  }, [load])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  const decided = (message: string) => {
    setSelected('')
    setToast(message)
    load()
  }

  const rule = page?.rule

  return (
    <section className="productivity-page" aria-labelledby="page-title">
      <header className="productivity-page__head">
        <h1 id="page-title">Status validation</h1>
        <p>
          {rule
            ? `IDLE time with ${rule.x} or more distinct cases inside ${rule.windowMin} minutes (intervals of ${rule.minIntervalMin} minutes or more). Until you review a flag, its suggested status counts; on day ${rule.reviewDays} it is accepted automatically.`
            : 'IDLE time flagged for your review.'}
        </p>
      </header>

      <section className="legacy-section" aria-labelledby="pending-title" aria-busy={loading}>
        <header className="legacy-section__head">
          <h2 id="pending-title">
            {loading
              ? 'Loading flags…'
              : page?.pending.length
                ? `${page.pending.length} to review`
                : 'Nothing to review'}
          </h2>
          <p>Open each flag to decide it</p>
        </header>

        {error ? (
          <div className="legacy-panel legacy-panel--error" role="alert">
            <p>Could not load status flags: {error}</p>
            <button type="button" onClick={() => load()}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="pv-list" aria-label="Loading flags">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="pv-item pv-item--skeleton" key={index} />
            ))}
          </div>
        ) : page && page.pending.length === 0 ? (
          <div className="legacy-panel legacy-panel--empty">
            No productivity flags are waiting for review.
          </div>
        ) : page ? (
          <div className={selected ? 'pv-review pv-review--split' : 'pv-review'}>
            <ul className="pv-list" aria-label="Flags to review">
              {page.pending.map((flag) => (
                <li key={flag.flagId}>
                  <button
                    type="button"
                    className="pv-item"
                    aria-pressed={selected === flag.flagId}
                    onClick={() =>
                      setSelected(selected === flag.flagId ? '' : flag.flagId)
                    }
                  >
                    <span className="pv-item__who">
                      <strong>{flag.agentName}</strong>{' '}
                      <span className="legacy-muted">
                        {dayLabel(flag.intervalStart)}, {intervalLabel(flag)}
                      </span>
                    </span>
                    <span className="pv-item__what">
                      {minutesLabel(flag.flaggedMin)} {flag.rawStatus},{' '}
                      {flag.distinctCases} cases, suggested {flag.suggestedStatus}
                    </span>
                    <DueChip dueDate={flag.dueDate} today={page.today} />
                  </button>
                </li>
              ))}
            </ul>

            {selected ? (
              <div className="legacy-panel legacy-panel--pad">
                <FlagDetail
                  key={selected}
                  flagId={selected}
                  statuses={page.statuses}
                  reasonStatuses={page.reasonStatuses}
                  ticketUrl={page.ticketUrl}
                  onDone={decided}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {page ? <DecidedTable decided={page.decided} /> : null}
      {page ? <SourcePanel source={page.source} /> : null}

      {toast ? (
        <p className="pv-toast" role="status">
          {toast}
        </p>
      ) : null}
    </section>
  )
}
