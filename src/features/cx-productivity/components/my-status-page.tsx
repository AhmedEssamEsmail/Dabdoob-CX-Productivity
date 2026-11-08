'use client'

import { Fragment, useState, type FormEvent } from 'react'
import {
  LinesSkeleton,
  LoadError,
  Section,
} from '@/features/shared/components/shell/ui'
import { toast } from '@/features/shared/components/shell/Toasts'
import { Button, Textarea } from '@/features/shared/components/ui'
import { fetchJson } from '@/features/shared/lib/fetch-json'
import {
  CasesLine,
  DecisionChip,
  fe,
  FlagStrip,
  G,
  re,
  T,
  useSe,
  type TrendPoint,
} from '@/features/cx-productivity/components/pv-shared'
import { addDays, type FlagView, type RuleView } from '@/features/cx-productivity/lib/prod-validation'

/**
 * My status — verbatim port of the legacy `Ia` page: the mine card (four weekly
 * metrics as a dl), each flag's kt strip + Mt cases + review state + dispute
 * affordance (mechanism disabled upstream), and the mock-10 worklist/right-column
 * cards fed by the weekly trend.
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

/** wi-side pill — mirrors the flag's review state (mock 10). */
function flagPill(f: FlagView): { cls: string; label: string; sub: string } {
  if (f.dispute?.status === 'open') return { cls: 'bad', label: 'disputed', sub: 'open' }
  if (f.decision === 'pending')
    return { cls: 'warn', label: 'under review', sub: f.tlName ? `by ${f.tlName}` : '' }
  if (f.decision === 'accepted')
    return { cls: 'ok', label: 'accepted', sub: f.decidedAt ? re(f.decidedAt) : f.decidedBy }
  return { cls: '', label: f.decision, sub: f.decidedBy }
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
        <Textarea
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
      <Button type="submit" disabled={saving}>
        {saving ? 'Sending…' : 'Send the dispute'}
      </Button>
    </form>
  )
}

/* --- Ia — the page ------------------------------------------------------ */

const ROUTE = { title: 'My status' }

export function MyStatusPage() {
  const { data: n, error, reload } = useSe<MyPage>(ce.myPage)
  const [open, setOpen] = useState('')
  const o = n?.mine
  const waiting = (n?.flags ?? []).filter((f) => f.decision === 'pending').length
  const disputes = (n?.flags ?? []).filter((f) => f.dispute?.status === 'open').length
  const dPp =
    o && o.prodRawPct != null && o.prodEffPct != null
      ? Math.round((o.prodEffPct - o.prodRawPct) * 10) / 10
      : null
  const dCls = dPp === null ? '' : dPp > 0 ? 'up good' : dPp < 0 ? 'up' : 'flat'
  const sparkRaw = (n?.trend ?? []).map((p) => p.idleEffPct)
  const sparkVals = sparkRaw.filter((v): v is number => v != null)
  const sparkLo = sparkVals.length ? Math.min(...sparkVals) : 0
  const sparkHi = sparkVals.length ? Math.max(...sparkVals) : 1
  const spark = sparkRaw.map((v) =>
    v == null ? 12 : 30 + Math.round(((v - sparkLo) / Math.max(sparkHi - sparkLo, 1e-9)) * 70),
  )
  const barW = (v: number | null | undefined) => (v == null ? 0 : Math.min(Math.max(v, 0), 100))
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <header className="page-head">
        <div>
          <h1 id="page-title" className="page-title">
            {ROUTE.title}
          </h1>
          {n ? (
            <p className="page-sub">
              Week of {re(n.week)} – {re(addDays(n.week, 6))} · your flagged IDLE time and what each
              review changed in your productivity.
            </p>
          ) : null}
        </div>
      </header>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!n && !error ? <LinesSkeleton lines={6} /> : null}
      {n ? (
        <Fragment>
          <div className="grid grid-4 mb-3">
            <div className="stat">
              <span className="stat-l">Productivity (raw)</span>
              <span className="stat-v num">{T(o?.prodRawPct, '%')}</span>
              <span className="stat-d">before reviews</span>
            </div>
            <div className="stat" data-tone="ok">
              <span className="stat-l">After reviews</span>
              <span className="stat-v num">{T(o?.prodEffPct, '%')}</span>
              <span className="stat-d">
                {dPp !== null ? (
                  <span className={`delta ${dCls}`}>
                    {dPp > 0 ? '▲' : dPp < 0 ? '▼' : '–'} {Math.abs(dPp).toFixed(1)}
                  </span>
                ) : null}
                accepted flags
              </span>
            </div>
            <div className="stat" data-tone="warn">
              <span className="stat-l">Flags waiting</span>
              <span className="stat-v num">{waiting}</span>
              <span className="stat-d">under review now</span>
            </div>
            <div className="stat">
              <span className="stat-l">Disputes</span>
              <span className="stat-v num">{disputes}</span>
              <span className="stat-d">with your TL, open</span>
            </div>
          </div>
          <Section
            id="pv-me"
            title="This week"
            hint={`When you are in IDLE but handle ${n.rule.x} or more cases inside ${n.rule.windowMin} minutes, that time is flagged as work. Your team lead reviews each flag. You can dispute a flag once, up to ${n.rule.disputeDays} days after the review.`}
          >
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
              <div className="empty">
                <div className="s">No logged time this week yet.</div>
              </div>
            )}
          </Section>
          <div
            className="grid"
            style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}
          >
            <section className="card" aria-labelledby="pv-mf-h">
              <div className="card-head">
                <h2 id="pv-mf-h" className="card-title" style={{ margin: 0 }}>
                  Your flags
                </h2>
                <div className="card-hint">dispute window: {n.rule.disputeDays} days</div>
              </div>
              {n.flags.length ? (
                <div className="pv-cards">
                  {n.flags.map((f) => {
                    const p = flagPill(f)
                    return (
                      <article
                        key={f.flagId}
                        className="workitem"
                        style={{ display: 'flex', alignItems: 'flex-start' }}
                      >
                        <div className="wi-main">
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
                            <p className="cx-muted">
                              Your team lead reviews it by {f.dueDate}.
                            </p>
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
                              <Button onClick={() => setOpen(f.flagId)}>
                                Dispute{f.disputeUntil ? ` (until ${f.disputeUntil})` : ''}
                              </Button>
                            )
                          ) : null}
                        </div>
                        <div className="wi-side">
                          <span className={p.cls ? `pill ${p.cls}` : 'pill'}>{p.label}</span>
                          {p.sub ? <div className="s mt-1">{p.sub}</div> : null}
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="empty">
                  <h2 className="t" style={{ margin: 0, fontSize: 'var(--text-md)' }}>
                    No flags in the last 45 days
                  </h2>
                  <div className="s">Flags appear here once your IDLE time is sent for review.</div>
                </div>
              )}
            </section>
            <div className="grid" style={{ alignContent: 'start' }}>
              <section className="card" aria-labelledby="pv-bva-h">
                <div className="card-head">
                  <h2 id="pv-bva-h" className="card-title" style={{ margin: 0 }}>
                    Before vs after
                  </h2>
                  <div className="card-hint">this week</div>
                </div>
                <div className="card-pad">
                  <div className="hbar-row">
                    <span className="small">Raw</span>
                    <div className="bar warn">
                      <i style={{ width: `${barW(o?.prodRawPct)}%` }} />
                    </div>
                    <b className="num small">{T(o?.prodRawPct, '%')}</b>
                  </div>
                  <div className="hbar-row">
                    <span className="small">Reviewed</span>
                    <div className="bar">
                      <i style={{ width: `${barW(o?.prodEffPct)}%` }} />
                    </div>
                    <b className="num small">{T(o?.prodEffPct, '%')}</b>
                  </div>
                  <hr className="hr" style={{ margin: '.8rem 0' }} />
                  <div className="small faint">How flags moved your score</div>
                  <div className="spark mt-1" style={{ height: '3rem' }}>
                    {spark.map((h, i) => (
                      <i key={i} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="small faint mt-1">Mon → Sun</div>
                </div>
              </section>
              <section className="card" aria-labelledby="pv-wyc-h">
                <div className="card-head">
                  <h2 id="pv-wyc-h" className="card-title" style={{ margin: 0 }}>
                    What you can do
                  </h2>
                </div>
                <div
                  className="card-pad small muted"
                  style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}
                >
                  <div>
                    · Check each flag: the cases listed are what the system saw inside your IDLE
                    window.
                  </div>
                  <div>
                    · Disagree? Hit <b>dispute</b> and say why — your TL sees it with your note.
                  </div>
                  <div>
                    · Accepted flags raise your score if the time really was case work.
                  </div>
                </div>
              </section>
            </div>
          </div>
        </Fragment>
      ) : null}
    </section>
  )
}
