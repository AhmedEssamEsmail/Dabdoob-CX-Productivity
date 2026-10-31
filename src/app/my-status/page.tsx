'use client'

import { Fragment, useState, type FormEvent } from 'react'
import {
  LinesSkeleton,
  LoadError,
  PageHead,
  Section,
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
  Tn,
  useSe,
  type TrendPoint,
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
