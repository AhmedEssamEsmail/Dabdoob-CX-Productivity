'use client'

import { Fragment, useState, type FormEvent } from 'react'
import {
  LinesSkeleton,
  LoadError,
  PageHead,
  Section,
  useTip,
  vsPrev,
} from '@/components/shell/ui'
import { toast } from '@/components/shell/Toasts'
import {
  CasesLine,
  DecisionChip,
  fe,
  fetchJson,
  FlagStrip,
  G,
  re,
  T,
  useSe,
} from '@/components/prod/pv-shared'
import type { FlagView, RuleView } from '@/lib/prod-validation'

/**
 * My status — verbatim port of the legacy `Ia` page: the mine card (four weekly
 * metrics as a dl), each flag's kt strip + Mt cases + review state + dispute
 * affordance (mechanism disabled upstream), and `Tn`'s three `Xe` sparklines.
 */

const ce = {
  myPage: () => fetchJson('/api/prod/my-page'),
  dispute: (input: { flagId: string; reason: string }) =>
    fetchJson('/api/prod/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
}

interface Mine {
  idleRawMin: number | null
  idleEffMin: number | null
  idleEffPct: number | null
  prodRawPct: number | null
  prodEffPct: number | null
  bandChange: string
}

interface TrendPoint {
  week: string
  partial: boolean
  idleEffPct: number | null
  flagsPer100h: number | null
  precisionPct: number | null
}

interface MyPage {
  today: string
  rule: RuleView
  ticketUrl: string
  flags: FlagView[]
  mine: Mine | null
  trend: TrendPoint[]
  week: string
}

/* --- the dispute form (Nt in the bundle) — unreachable while canDispute is
        always false, ported for parity ----------------------------------- */

function DisputeRaise({ f, onDone }: { f: FlagView; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  return (
    <form
      className="pv-form"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setFormError('')
        ce.dispute({ flagId: f.flagId, reason }).then(
          () => {
            setSaving(false)
            toast('Dispute sent to your team lead.')
            onDone()
          },
          (p: unknown) => {
            setSaving(false)
            setFormError(p instanceof Error ? p.message : String(p))
          },
        )
      }}
    >
      <div className="cx-field">
        <label className="cx-label" htmlFor={`dr-${f.flagId}`}>
          What were you doing in this time?
        </label>
        <textarea
          className="cx-textarea"
          id={`dr-${f.flagId}`}
          value={reason}
          onInput={(e) => setReason(e.currentTarget.value)}
        />
      </div>
      {formError ? (
        <p className="cx-error" role="alert">
          {formError}
        </p>
      ) : null}
      <button type="submit" className="cx-btn" disabled={saving}>
        {saving ? 'Sending…' : 'Send the dispute'}
      </button>
    </form>
  )
}

/* --- Xe — one SVG sparkline (polyline + hoverable points + Ca tooltip) --- */

function Xe({
  title,
  unit,
  points,
  pick,
}: {
  title: string
  unit: string
  points: TrendPoint[]
  pick: (p: TrendPoint) => number | null
}) {
  const { ref, tipFor, tipEl } = useTip<HTMLElement>()
  const i = points.map(pick)
  const h = i.filter((d) => d !== null)
  const p = Math.max(...h, 1)
  const lo = Math.min(...h, 0)
  const u = (m: number) => 12 + (m * 176) / Math.max(points.length - 1, 1)
  const c = (d: number) => 60 - ((d - lo) / Math.max(p - lo, 1e-9)) * 48
  const g = i
    .map((d, m) => (d === null ? '' : `${u(m)},${c(d)}`))
    .filter(Boolean)
    .join(' ')
  return (
    <figure ref={ref} className="pv-spark cx-panel cx-panel--pad cc-chart">
      {tipEl}
      <figcaption>{title}</figcaption>
      <svg
        viewBox="0 0 200 72"
        role="group"
        aria-label={`${title}: ${i.map((d, m) => `${points[m].week} ${T(d, unit)}`).join(', ')}`}
      >
        <polyline className="cc-sweep-line" pathLength={1} points={g} />
        {i.map((d, m) =>
          d === null ? null : (
            <circle
              key={m}
              className="cc-sweep-fade"
              cx={u(m)}
              cy={c(d)}
              r={3}
              data-partial={points[m].partial ? 'true' : undefined}
              tabIndex={0}
              role="img"
              {...tipFor(
                [
                  `Week of ${points[m].week}: ${T(d, unit)}${points[m].partial ? ' so far' : ''}`,
                  points[m].partial ? '' : vsPrev(d, i[m - 1]),
                ]
                  .filter(Boolean)
                  .join(', ')
              )}
            />
          )
        )}
      </svg>
      <div className="pv-spark__vals">
        {i.map((d, m) => (
          <span key={m}>
            {T(d, unit)}
            {points[m].partial ? '*' : ''}
          </span>
        ))}
      </div>
    </figure>
  )
}

/* --- Tn — the three sparklines + footnote ------------------------------- */

function Tn({ points }: { points: TrendPoint[] }) {
  return (
    <Fragment>
      <div className="pv-sparks">
        <Xe title="Idle after review, % of logged" unit="%" points={points} pick={(n) => n.idleEffPct} />
        <Xe title="Flags per 100 logged hours" unit="" points={points} pick={(n) => n.flagsPer100h} />
        <Xe
          title="Flag precision (accepted of reviewed)"
          unit="%"
          points={points}
          pick={(n) => n.precisionPct}
        />
      </div>
      <p className="cx-faint">Weeks start on Sunday; * marks the week in progress.</p>
    </Fragment>
  )
}

/* --- Ia — the page ------------------------------------------------------ */

const ROUTE = { title: 'My status' }

export default function MyStatusPage() {
  const { data: n, error, reload } = useSe<MyPage>(ce.myPage)
  const [open, setOpen] = useState('')
  const o = n?.mine
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <PageHead
        title={ROUTE.title}
        sub={
          n
            ? `When you are in IDLE but handle ${n.rule.x} or more cases inside ${n.rule.windowMin} minutes, that time is flagged as work. Your team lead reviews each flag. You can dispute a flag once, up to ${n.rule.disputeDays} days after the review.`
            : ''
        }
      />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!n && !error ? <LinesSkeleton lines={6} /> : null}
      {n ? (
        <Fragment>
          <Section id="pv-me" title="This week">
            {o ? (
              <dl className="pv-facts cx-panel cx-panel--pad">
                <div>
                  <dt>Idle as logged</dt>
                  <dd>{G(o.idleRawMin ?? 0)}</dd>
                </div>
                <div>
                  <dt>Idle after review</dt>
                  <dd>
                    {G(o.idleEffMin ?? 0)}{' '}
                    <span className="cx-faint">({T(o.idleEffPct, '%')} of logged time)</span>
                  </dd>
                </div>
                <div>
                  <dt>Productivity as logged</dt>
                  <dd>{T(o.prodRawPct, '%')}</dd>
                </div>
                <div>
                  <dt>Productivity after review</dt>
                  <dd>
                    {T(o.prodEffPct, '%')}
                    {o.bandChange ? <span className="cx-faint"> (band {o.bandChange})</span> : null}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="cx-muted">No logged time this week yet.</p>
            )}
          </Section>
          <Section
            id="pv-mf"
            title={n.flags.length ? 'Your flags, last 45 days' : 'No flags in the last 45 days'}
          >
            <div className="pv-cards">
              {n.flags.map((f) => (
                <article key={f.flagId} className="cx-panel cx-panel--pad">
                  <header className="pv-detail__head">
                    <strong>
                      {re(f.intervalStart)}, {fe(f)}
                    </strong>
                    <DecisionChip d={f.decision} />
                    {f.dispute ? <DecisionChip d={f.dispute.status} /> : null}
                  </header>
                  <FlagStrip f={f} />
                  <CasesLine f={f} ticketUrl={n.ticketUrl} />
                  {f.decision !== 'pending' ? (
                    <p className="cx-muted">
                      Reviewed by {f.decidedBy}
                      {f.reason ? `: ${f.reason}` : '.'}
                    </p>
                  ) : (
                    <p className="cx-muted">Your team lead reviews it by {f.dueDate}.</p>
                  )}
                  {f.dispute ? (
                    <p className="pv-quote">
                      Your dispute: {f.dispute.reason}
                      {f.dispute.decisionNote ? (
                        <Fragment>
                          <br />
                          {f.dispute.decidedBy}: {f.dispute.decisionNote}
                        </Fragment>
                      ) : null}
                    </p>
                  ) : null}
                  {f.canDispute ? (
                    open === f.flagId ? (
                      <DisputeRaise
                        f={f}
                        onDone={() => {
                          setOpen('')
                          reload()
                        }}
                      />
                    ) : (
                      <button type="button" className="cx-btn" onClick={() => setOpen(f.flagId)}>
                        Dispute{f.disputeUntil ? ` (until ${f.disputeUntil})` : ''}
                      </button>
                    )
                  ) : null}
                </article>
              ))}
            </div>
          </Section>
          <Section id="pv-mt" title="Last 4 weeks">
            <Tn points={n.trend} />
          </Section>
        </Fragment>
      ) : null}
    </section>
  )
}
