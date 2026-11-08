'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'
import {
  Chip,
  LinesSkeleton,
  LoadError,
  Section,
} from '@/features/shared/components/shell/ui'
import { toast } from '@/features/shared/components/shell/Toasts'
import { Button, Seg, Select, Textarea } from '@/features/shared/components/ui'
import { fetchJson } from '@/features/shared/lib/fetch-json'
import {
  CasesLine,
  CHANNEL_LABELS,
  DecisionChip,
  Ea,
  fe,
  FlagStrip,
  G,
  re,
  ue,
  useSe,
} from '@/features/cx-productivity/components/pv-shared'
import type { FlagView, RuleView } from '@/features/cx-productivity/lib/prod-validation'

/**
 * Status validation — verbatim port of the legacy `Ra` page (and its parts
 * Ue/Da/qa/La): pending flags, per-flag strip + cases + decide form, disputes
 * (mechanism disabled upstream, rendered for parity), the decided table and
 * the admin-only data-source section. kt/Mt/be/Se live in pv-shared.
 */

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

/* --- Ue — the dq-page shell -------------------------------------------- */

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

export function Page({
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
  d: unknown
  error: string
  reload: () => void
  aside?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!d && !error}>
      <header className="page-head">
        <div>
          <h1 id="page-title" className="page-title">
            {route.title}
          </h1>
          <p className="page-sub">{sub}</p>
        </div>
        {aside ? <div className="page-actions">{aside}</div> : null}
      </header>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!d && !error ? <LinesSkeleton lines={6} /> : d ? children : null}
    </section>
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
  const { data: r, error, reload } = useSe<{ flag: FlagView; openedAt: string; scoreEffect: number | null }>(() => ce.flag(flagId))
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
    <div className="pv-detail card">
      <div className="card-head">
        <div>
          <div className="card-title">
            {f.agentName} — {re(f.intervalStart)}, {fe(f)}
          </div>
          <div className="card-hint">
            {G(f.flaggedMin)} flagged of {G(f.intervalMin)} {f.rawStatus}
          </div>
        </div>
        <DecisionChip d={f.decision} />
      </div>
      <div className="card-pad">
        <div className="grid grid-3" style={{ marginBlock: '0 1rem' }}>
          <div className="stat">
            <span className="stat-l">Suggested status</span>
            <span className="stat-v">{f.suggestedStatus}</span>
            <span className="stat-d">
              {G(f.flaggedMin)} of {G(f.intervalMin)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-l">Cases inside window</span>
            <span className="stat-v">{f.distinctCases}</span>
            <span className="stat-d">
              {f.caseCount !== f.distinctCases ? `${f.caseCount} touches logged` : `${f.cases.length} cases logged`}
            </span>
          </div>
          <div className="stat">
            <span className="stat-l">Score effect</span>
            <span className="stat-v">{r.scoreEffect != null ? `${r.scoreEffect}%` : '–'}</span>
            <span className="stat-d">of the day&apos;s logged minutes</span>
          </div>
        </div>
        <FlagStrip f={f} />
        {/* PARITY: H7b divergence — the mock's per-case TOUCHES/DUR./EVIDENCE
            columns are not persisted (prod_flags.case_ids_json stores only
            [id, channel] pairs; prod_tph_cases holds hour-level counts, not
            per-case touches), so the 2-column table keeps only what exists. */}
        <div className="card" style={{ boxShadow: 'none', marginBlockEnd: '1rem' }}>
          <div className="card-head">
            <div className="card-title">Inside the window</div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Case</th>
                <th scope="col">Channel</th>
              </tr>
            </thead>
            <tbody>
              {f.cases.map((c) => (
                <tr key={c.id}>
                  <td className="rowlink">
                    <a href={ticketUrl + c.id} target="_blank" rel="noopener noreferrer">
                      #{c.id}
                    </a>
                  </td>
                  <td>{CHANNEL_LABELS[c.channel] ?? c.channel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
              <Seg
                name={`st-${flagId}`}
                className="pv-seg"
                value={v}
                onChange={setPicked}
                options={statuses.map((s) => ({
                  value: s,
                  label: (
                    <>
                      {s}
                      {s === f.suggestedStatus ? ' (suggested)' : ''}
                    </>
                  ),
                }))}
              />
            </fieldset>
            <div className="cx-field">
              <label className="cx-label" htmlFor={`rs-${flagId}`}>
                Reason {y ? `(needed for ${v} and for revert)` : '(needed to revert)'}
              </label>
              <Textarea
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
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : `Accept as ${v}`}
              </Button>
              <Button disabled={saving} onClick={() => decide('revert')}>
                Revert to {f.rawStatus}
              </Button>
            </div>
          </form>
        )}
      </div>
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
      <Seg
        name={`o-${g.disputeId}`}
        value={outcome}
        onChange={setOutcome}
        aria-label="Outcome"
        options={[
          { value: 'upheld', label: 'Uphold' },
          { value: 'rejected', label: 'Do not uphold' },
        ]}
      />
      {outcome === 'upheld' ? (
        <div className="cx-field">
          <label className="cx-label" htmlFor={`ds-${g.disputeId}`}>
            The flagged time counts as
          </label>
          <Select
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
          </Select>
        </div>
      ) : null}
      <div className="cx-field">
        <label className="cx-label" htmlFor={`dn-${g.disputeId}`}>
          Note to the agent
        </label>
        <Textarea
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
      <Button type="submit" variant="primary" disabled={saving}>
        {saving ? 'Saving…' : 'Record the decision'}
      </Button>
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

const WI_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.9rem',
  inlineSize: '100%',
  padding: '0.8rem 1.25rem',
  border: 0,
  borderBottom: '1px solid var(--cx-line)',
  borderRadius: 0,
  background: 'transparent',
  textAlign: 'start',
}

type PvView = 'open' | 'reviewed' | 'disputed'

const pvInitials = (f: FlagView) => {
  const words = f.agentName.trim().split(/\s+/).filter(Boolean)
  const letters = words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return letters || (f.agentEmail[0] ?? '').toUpperCase()
}

export function StatusValidationPage() {
  const { data: n, error, reload } = useSe<ReviewPage>(ce.reviewPage)
  const [selected, setSelected] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [view, setView] = useState<PvView>('open')
  const changeView = (v: PvView) => {
    setView(v)
    setSelected('')
  }
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
      aside={
        n ? (
          <div className="seg" role="group" aria-label="Flag views">
            {(
              [
                ['open', 'Open', n.pending.length],
                ['reviewed', 'Reviewed', n.decided.length],
                ['disputed', 'Disputed', n.disputes.length],
              ] as const
            ).map(([v, label, count]) => (
              <button
                key={v}
                type="button"
                className={view === v ? 'on' : undefined}
                aria-pressed={view === v}
                onClick={() => changeView(v)}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {n ? (
        <>
          {view === 'open' ? (
          <Section
            id="pv-q"
            title={n.pending.length ? `${n.pending.length} to review` : 'Nothing to review'}
            hint="Open each flag to decide it"
          >
            <div className="md">
              <section className="card">
                <div className="card-head">
                  <div className="card-title">Flags</div>
                  <input
                    className="input"
                    type="search"
                    placeholder="Agent…"
                    aria-label="Filter flags by agent"
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.currentTarget.value)}
                  />
                </div>
                <div className="worklist">
                  {n.pending
                    .filter(
                      (f) =>
                        !agentFilter.trim() ||
                        f.agentName.toLowerCase().includes(agentFilter.trim().toLowerCase()),
                    )
                    .map((f, i, rows) => {
                      const h = Ea(f.dueDate, n.today)
                      const sel = selected === f.flagId
                      return (
                        <Button
                          key={f.flagId}
                          className="workitem pv-item"
                          aria-pressed={sel}
                          style={
                            sel || i === rows.length - 1
                              ? {
                                  ...WI_ROW,
                                  ...(sel ? { background: 'var(--cx-accent-soft)' } : {}),
                                  ...(i === rows.length - 1 ? { borderBottom: 0 } : {}),
                                }
                              : WI_ROW
                          }
                          onClick={() => setSelected(f.flagId)}
                        >
                          <span className="avatar" aria-hidden="true">
                            {pvInitials(f)}
                          </span>
                          <span className="wi-main">
                            <span className="wi-t pv-item__who">
                              <strong>{f.agentName}</strong>{' '}
                              <span className="cx-muted">
                                {re(f.intervalStart)}, {fe(f)}
                              </span>
                            </span>
                            <span className="wi-s pv-item__what">
                              {G(f.flaggedMin)} {f.rawStatus}, {f.distinctCases} cases, suggested{' '}
                              {f.suggestedStatus}
                            </span>
                          </span>
                          <span className="wi-side">
                            <Chip status={h <= 1 ? 'bad' : h <= 3 ? 'warn' : 'neutral'}>
                              {h <= 0
                                ? 'auto-accepts today'
                                : `${h} ${h === 1 ? 'day' : 'days'} left`}
                            </Chip>
                          </span>
                        </Button>
                      )
                    })}
                </div>
              </section>
              {selected ? (
                <FlagDetail
                  key={selected}
                  flagId={selected}
                  statuses={n.statuses}
                  reasonStatuses={n.reasonStatuses}
                  ticketUrl={n.ticketUrl}
                  onDone={done}
                />
              ) : null}
            </div>
          </Section>
          ) : null}
          {view === 'disputed' ? (
            <Section
              id="pv-d"
              title={
                n.disputes.length
                  ? `${n.disputes.length} ${n.disputes.length === 1 ? 'dispute' : 'disputes'} to decide`
                  : 'No disputes'
              }
            >
              {n.disputes.length ? (
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
              ) : (
                <p className="cx-muted">No disputes to decide.</p>
              )}
            </Section>
          ) : null}
          {view === 'reviewed' ? (
            <Section id="pv-h" title="Decided, last 30 days">
              {n.decided.length ? (
              <div className="card cx-tablewrap">
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
              ) : (
                <p className="cx-muted">Nothing reviewed yet.</p>
              )}
            </Section>
          ) : null}
          <DataSource d={n} />
        </>
      ) : null}
    </Page>
  )
}
