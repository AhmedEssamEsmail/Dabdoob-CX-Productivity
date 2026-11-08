'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality my-audits page
 * (.devin/work/extract/quality/pages/my-audits.closure.js):
 *   Ps → MyAuditsPage, gn → AuditCard, Dt → AuditFails (qa-shared),
 *   te → Count (qa-shared), U → qaPct, Ie → ScoreChip, ae → StatusChip,
 *   Mt → qaIsNum, P.confirmCtl → confirmQaCtl.
 */
import { useState } from 'react'
import { Button, Textarea } from '@/features/shared/components/ui'
import {
  AuditFails,
  Count,
  P,
  Q,
  QaPage,
  QaSection,
  ScoreChip,
  StatusChip,
  qaIsNum,
  qaPct,
  useSe,
} from './qa-shared'

/* --- gn — one audit card (score, fails, CTL box) ----------------------------- */
function AuditCard({ a, onDone }: { a: any; onDone: () => void }) {
  const [deny, s] = useState(false)
  const [i, c] = useState('')
  const [l, p] = useState(false)
  const [m, r] = useState('')
  const u = (o: Promise<any>, h: string) => {
    p(true)
    r('')
    o.then(
      () => (p(false), s(false), c(''), Q(h), onDone()),
      (b) => (p(false), r(b.message))
    )
  }
  const d = a.ctl
  return (
    <article className="card card-pad qa-card">
      <header className="qa-card__head">
        <ScoreChip
          score={a.status === 'rescored' ? a.finalScore : a.score}
          fatal={a.fatal}
        />
        <strong>{qaIsNum(a.ticketId) ? `Ticket #${a.ticketId}` : a.ticketId}</strong>
        <span className="cx-muted">
          {a.channel}, audited {a.auditDate} by {a.auditorName}
        </span>
        <StatusChip s={a.status} />
      </header>
      <AuditFails a={a} />
      {d && d.status === 'submitted' ? (
        <div className="qa-ctlbox">
          <p>
            <strong>Coaching (CTL) logged by {d.tlName || 'your team lead'}:</strong>{' '}
            {d.action}. {d.notes}
          </p>
          {d.outcome === 'dispute' ? (
            <p className="cx-muted">
              Your team lead raised a dispute on this audit; it is decided at the
              weekly Quality meeting.
            </p>
          ) : null}
          <div className="qa-actions">
            <Button
              variant="primary"
              disabled={l}
              onClick={() => u(P.confirmCtl(d.ctlId, true, ''), 'Confirmed: the CTL is done.')}
            >
              Confirm, it was done with {d.tlName || 'my team lead'}
            </Button>
            <Button
              variant="quiet"
              disabled={l}
              aria-expanded={deny}
              onClick={() => s(!deny)}
            >
              Deny
            </Button>
          </div>
          {deny ? (
            <div className="cx-field">
              <label className="cx-label" htmlFor={`nh-${a.auditId}`}>
                Why you deny it (Mohamed and the team leads read this)
              </label>
              <Textarea
                id={`nh-${a.auditId}`}
                value={i}
                onInput={(o) => c(o.currentTarget.value)}
              />
              <Button
                disabled={l || i.trim().length < 5}
                onClick={() =>
                  u(
                    P.confirmCtl(d.ctlId, false, i),
                    'Denied: Mohamed and the team leads were told, and the CTL is open again.'
                  )
                }
              >
                Send denial
              </Button>
            </div>
          ) : null}
        </div>
      ) : d && d.status === 'open' ? (
        <p className="cx-faint">
          {d.tlName || 'Your team lead'} will go through this audit with you (CTL)
          by {d.dueDate}. If you disagree with it, say so then: your team lead
          raises the dispute.
        </p>
      ) : d ? (
        <p className="cx-faint">
          CTL: <StatusChip s={d.status} />
        </p>
      ) : null}
      {m ? (
        <p className="cx-error" role="alert">
          {m}
        </p>
      ) : null}
    </article>
  )
}

/* --- Ps — My audits ---------------------------------------------------------- */
export default function MyAuditsPage({ route }: { route: { title: string } }) {
  const { data: n, error: a, reload: s } = useSe(P.myAuditsPage)
  const i = n ? n.audits.filter((l: any) => l.ctl?.status === 'submitted') : []
  const c = n ? n.audits.filter((l: any) => l.ctl?.status !== 'submitted') : []
  return (
    <QaPage
      route={route}
      d={n}
      error={a}
      reload={s}
      sub="Your quality audits and what lost marks; confirm the CTLs your team lead closed with you."
    >
      {n ? (
        <>
          <QaSection
            id="qa-confirm-h"
            title={i.length ? `To confirm, ${i.length}` : 'To confirm'}
            hint="CTLs your team lead closed with you. Denying one tells Mohamed and the team leads."
          >
            <div className="qa-cards">
              {i.length ? (
                i.map((l: any) => <AuditCard a={l} onDone={s} key={l.auditId} />)
              ) : (
                <div className="empty">
                  <div className="s">Nothing to confirm.</div>
                </div>
              )}
            </div>
          </QaSection>
          <p className="qa-avg">
            Average{' '}
            <strong className="cx-num">
              <Count v={qaPct(n.average)} />
            </strong>{' '}
            <span className="cx-faint">
              over your counted audits (disputed ones are left out until decided)
            </span>
          </p>
          <div className="qa-cards">
            {c.length ? (
              c.map((l: any) => <AuditCard a={l} onDone={s} key={l.auditId} />)
            ) : (
              <div className="empty">
                <div className="s">No other audits.</div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </QaPage>
  )
}
