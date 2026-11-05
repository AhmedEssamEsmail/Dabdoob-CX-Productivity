'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality disputes page
 * (.devin/work/extract/quality/pages/disputes.closure.js):
 *   Fs → DisputesPage, Bs → DecisionForm, Dt → AuditFails (qa-shared),
 *   ae/Ie/ne/U → StatusChip/ScoreChip/TicketRef/qaPct (qa-shared),
 *   P.disputesPage / P.decideDispute.
 */
import { useState } from 'react'
import { Chip } from '@/features/shared/components/shell/ui'
import {
  AuditFails,
  P,
  Q,
  QaPage,
  QaSection,
  ScoreChip,
  StatusChip,
  TicketRef,
  qaPct,
  useSe,
} from './qa-shared'

/* --- Bs — the meeting-decision form ------------------------------------------ */
function DecisionForm({
  disputeId,
  oldScore,
  canEscalate,
  ownerName,
  onDone,
}: {
  disputeId: string
  oldScore: number
  canEscalate: boolean
  ownerName: string
  onDone: () => void
}) {
  const [c, l] = useState('')
  const [p, m] = useState(String(oldScore))
  const [r, u] = useState('')
  const [d, o] = useState(false)
  const [h, b] = useState('')
  const x: [string, string][] = [
    ['void', 'Uphold: void the audit'],
    ['rescore', 'Uphold: re-score'],
    ['reject', 'Reject'],
  ]
  if (canEscalate) x.push(['escalate', `Not aligned: escalate to ${ownerName}`])
  return (
    <form
      className="qa-ctlform"
      onSubmit={(f) => {
        f.preventDefault()
        if (!c) return b('Choose the meeting outcome.')
        o(true)
        b('')
        P.decideDispute({
          disputeId,
          decision: c,
          newScore: c === 'rescore' ? Number(p) : undefined,
          note: r,
        }).then(
          () => (
            o(false),
            Q(
              c === 'escalate'
                ? `Escalated. ${ownerName} was emailed and decides it.`
                : 'Recorded. The agent, auditor and team lead were emailed.'
            ),
            onDone()
          ),
          (g) => (o(false), b(g.message))
        )
      }}
    >
      <div className="cx-seg" role="radiogroup" aria-label="Meeting outcome">
        {x.map(([f, g]) => (
          <label key={f}>
            <input
              type="radio"
              name={`dec-${disputeId}`}
              checked={c === f}
              onChange={() => l(f)}
            />
            <span>{g}</span>
          </label>
        ))}
      </div>
      {c === 'rescore' ? (
        <div className="cx-field qa-narrow">
          <label className="cx-label" htmlFor={`ns-${disputeId}`}>
            New score, %
          </label>
          <input
            className="cx-input"
            id={`ns-${disputeId}`}
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={p}
            onInput={(f) => m(f.currentTarget.value)}
          />
        </div>
      ) : null}
      <div className="cx-field">
        <label className="cx-label" htmlFor={`dn-${disputeId}`}>
          {c === 'escalate'
            ? `Where the meeting did not align, for ${ownerName}`
            : 'Note to the agent, auditor and team lead'}
        </label>
        <textarea
          className="cx-textarea"
          id={`dn-${disputeId}`}
          value={r}
          onInput={(f) => u(f.currentTarget.value)}
        />
      </div>
      {h ? (
        <p className="cx-error" role="alert">
          {h}
        </p>
      ) : null}
      <button type="submit" className="cx-btn cx-btn--primary" disabled={d}>
        {d ? 'Saving…' : c === 'escalate' ? 'Escalate' : 'Record the decision'}
      </button>
    </form>
  )
}

/* --- Fs — Disputes page ------------------------------------------------------- */
export default function DisputesPage({ route }: { route: { title: string } }) {
  const { data: n, error: a, reload: s } = useSe(P.disputesPage)
  const i = n ? n.rows.filter((l: any) => l.status === 'open' || l.status === 'escalated') : []
  const c = n ? n.rows.filter((l: any) => l.status !== 'open' && l.status !== 'escalated') : []
  return (
    <QaPage
      route={route}
      d={n}
      error={a}
      reload={s}
      sub={`Disputes team leads raise at the CTL, with the agent's case. Record the weekly Quality and team-lead meeting outcome: aligned, the decision; not aligned, escalate to ${n?.ownerName || 'the dispute owner'}. A disputed audit counts in no score until it is decided.`}
    >
      {n ? (
        <>
          <QaSection id="dsp-h" title={i.length ? `${i.length} to decide` : 'Nothing to decide'}>
            <div className="qa-cards">
              {i.map((l: any) => (
                <article className="cx-panel cx-panel--pad qa-card" key={l.disputeId}>
                  <header className="qa-card__head">
                    <ScoreChip score={l.oldScore} fatal={l.audit?.fatal} />
                    <strong>{l.agentName}</strong>
                    {l.audit ? (
                      <span className="cx-muted">
                        ticket <TicketRef url={n.ticketUrl} id={l.audit.ticketId} />, audited by{' '}
                        {l.auditorName} on {l.audit.auditDate}
                      </span>
                    ) : null}
                    <StatusChip s={l.status} />
                  </header>
                  <p className="qa-reason">
                    <strong>Agent&apos;s case</strong>{' '}
                    <span className="cx-faint">
                      (raised by {l.raisedByName}, {l.raisedAt.slice(0, 10)})
                    </span>
                    : {l.reason}
                  </p>
                  {l.audit ? <AuditFails a={l.audit} /> : null}
                  {l.status === 'escalated' ? (
                    <p className="qa-reason">
                      <strong>Not aligned</strong>{' '}
                      <span className="cx-faint">
                        (escalated by {l.escalatedByName}, {l.escalatedAt.slice(0, 10)})
                      </span>
                      : {l.escalationNote}
                    </p>
                  ) : null}
                  {l.status === 'escalated' && !n.isOwner ? (
                    <p className="cx-muted">Waiting for {n.ownerName} to decide.</p>
                  ) : (
                    <DecisionForm
                      disputeId={l.disputeId}
                      oldScore={l.oldScore}
                      canEscalate={!n.isOwner && l.status === 'open'}
                      ownerName={n.ownerName}
                      onDone={s}
                    />
                  )}
                </article>
              ))}
            </div>
          </QaSection>
          <QaSection id="dspa-h" title={`Disputes per auditor, ${n.month}`}>
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Auditor</th>
                    <th scope="col">Audits</th>
                    <th scope="col">Disputes raised</th>
                    <th scope="col">Upheld</th>
                    <th scope="col">Dispute rate</th>
                  </tr>
                </thead>
                <tbody>
                  {n.auditors.length ? (
                    n.auditors.map((l: any) => (
                      <tr key={l.auditorEmail}>
                        <td>{l.auditorName}</td>
                        <td className="cx-num">{l.audits}</td>
                        <td className="cx-num">
                          {l.disputes}
                          {l.open ? ` (${l.open} undecided)` : ''}
                        </td>
                        <td className="cx-num">{l.upheld}</td>
                        <td>
                          <Chip
                            status={
                              l.disputePct === null
                                ? 'neutral'
                                : l.disputePct < n.target
                                  ? 'ok'
                                  : 'bad'
                            }
                          >
                            {qaPct(l.disputePct)}
                          </Chip>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>No audits this month yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </QaSection>
          {c.length ? (
            <QaSection id="dspc-h" title="Decided, last 60 days">
              <div className="cx-panel cx-tablewrap">
                <table className="cx-table">
                  <thead>
                    <tr>
                      <th scope="col">Agent</th>
                      <th scope="col">Auditor</th>
                      <th scope="col">Decision</th>
                      <th scope="col">Score</th>
                      <th scope="col">Recorded by</th>
                      <th scope="col">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.map((l: any) => (
                      <tr key={l.disputeId}>
                        <td>{l.agentName}</td>
                        <td>{l.auditorName}</td>
                        <td>
                          <StatusChip s={l.status} />
                        </td>
                        <td className="cx-num">
                          {l.decision === 'void'
                            ? 'void'
                            : l.newScore !== null
                              ? `${l.oldScore}% → ${l.newScore}%`
                              : `${l.oldScore}%`}
                        </td>
                        <td>
                          {l.decidedByName}
                          {l.escalatedByName ? (
                            <span className="cx-faint qa-sub">escalated by {l.escalatedByName}</span>
                          ) : null}
                        </td>
                        <td className="cx-muted">{l.decisionNote}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </QaSection>
          ) : null}
        </>
      ) : null}
    </QaPage>
  )
}
