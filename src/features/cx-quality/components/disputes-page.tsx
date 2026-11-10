'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality disputes page
 * (.devin/work/extract/quality/pages/disputes.closure.js):
 *   Fs → DisputesPage, Bs → DecisionForm, Dt → AuditFails (qa-shared),
 *   ae/Ie/ne/U → StatusChip/ScoreChip/TicketRef/qaPct (qa-shared),
 *   P.disputesPage / P.decideDispute.
 */
import { useState } from 'react'
import { Button, Chip, Empty, Input, Seg, Textarea } from '@/features/shared/components/ui'
import {
  AuditFails,
  P,
  Q,
  QaPage,
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
      <Seg
        name={`dec-${disputeId}`}
        value={c}
        onChange={l}
        options={x.map(([f, g]) => ({ value: f, label: g }))}
        aria-label="Meeting outcome"
      />
      {c === 'rescore' ? (
        <div className="cx-field qa-narrow">
          <label className="cx-label" htmlFor={`ns-${disputeId}`}>
            New score, %
          </label>
          <Input
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
        <Textarea
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
      <Button type="submit" variant="primary" disabled={d}>
        {d ? 'Saving…' : c === 'escalate' ? 'Escalate' : 'Record the decision'}
      </Button>
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
      sub={`Disputes raised at the CTL with the agent's case — record the meeting outcome; not aligned escalates to ${n?.ownerName || 'the dispute owner'}.`}
    >
      {n ? (
        <>
          <section className="cx-panel" aria-labelledby="dsp-h">
            <div className="cx-section__head">
              <div>
                <div className="cx-section__title" id="dsp-h">
                  {i.length ? `${i.length} to decide` : 'Nothing to decide'}
                </div>
              </div>
            </div>
            <div className="cx-panel--pad">
              {i.length ? (
                <div className="qa-list">
                  {i.map((l: any) => (
                    <details className="qa-card qa-card--strip" key={l.disputeId}>
                      <summary>
                        <svg className="qa-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
                        <ScoreChip score={l.oldScore} fatal={l.audit?.fatal} />
                        <strong className="qa-name">{l.agentName}</strong>
                        <span className="qa-meta qa-meta--full">
                          {l.audit ? (
                            <span>
                              ticket <TicketRef url={n.ticketUrl} id={l.audit.ticketId} />, audited by{' '}
                              {l.auditorName} on {l.audit.auditDate}
                            </span>
                          ) : null}
                          <span className="qa-sep">·</span>
                          <span>
                            {l.status === 'escalated'
                              ? `escalated by ${l.escalatedByName}, ${l.escalatedAt.slice(0, 10)}`
                              : `raised by ${l.raisedByName}, ${l.raisedAt.slice(0, 10)}`}
                          </span>
                        </span>
                        <StatusChip s={l.status} />
                      </summary>
                      <div className="qa-detail">
                  <p className="qa-reason">
                    <strong>Agent&apos;s case</strong>{' '}
                    <span className="cx-faint">
                      (raised by {l.raisedByName}, {l.raisedAt.slice(0, 10)})
                    </span>
                    : {l.reason}
                  </p>
                  {l.audit ? (
                    <>
                      <div className="qa-cap">Lost marks on</div>
                      <AuditFails a={l.audit} />
                    </>
                  ) : null}
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
                    <>
                      <div className="qa-cap">Meeting outcome</div>
                      <DecisionForm
                        disputeId={l.disputeId}
                        oldScore={l.oldScore}
                        canEscalate={!n.isOwner && l.status === 'open'}
                        ownerName={n.ownerName}
                        onDone={s}
                      />
                    </>
                  )}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <Empty title="No disputes waiting for a meeting decision." />
              )}
            </div>
          </section>
          <section className="cx-panel" aria-labelledby="dspa-h">
            <div className="cx-section__head">
              <div>
                <div className="cx-section__title" id="dspa-h">
                  {`Disputes per auditor, ${n.month}`}
                </div>
              </div>
            </div>
            <div className="cx-tablewrap">
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
          </section>
          {c.length ? (
            <section className="cx-panel" aria-labelledby="dspc-h">
              <div className="cx-section__head">
                <div>
                  <div className="cx-section__title" id="dspc-h">
                    Decided, last 60 days
                  </div>
                </div>
              </div>
              <div className="cx-tablewrap">
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
            </section>
          ) : null}
        </>
      ) : null}
    </QaPage>
  )
}
