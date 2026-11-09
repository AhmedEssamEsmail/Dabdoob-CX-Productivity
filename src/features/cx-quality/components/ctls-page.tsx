'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality ctls page
 * (.devin/work/extract/quality/pages/ctls.closure.js):
 *   Rs → CtlsPage, Es → CtlForm, Ds → findOpenCtls, Ls → CtlAuditSide,
 *   Os → ResendMail, fn → mail status texts, Te → ListSelect (qa-shared),
 *   Dt → AuditFails (qa-shared), Mt/Ce → qaIsNum/qaTicketLabel,
 *   P.submitCtl / P.resendAuditMail / P.ctlPage.
 */
import { useRef, useState } from 'react'
import {
  AuditFails,
  ListSelect,
  P,
  Q,
  QA_STATUS,
  QaPage,
  TicketRef,
  qaBand,
  qaPct,
  qaTicketLabel,
  useSe,
} from './qa-shared'
import { Button, Input, Seg, Textarea } from '@/features/shared/components/ui'

const pillCls = (t?: string | null) => `pill${t && t !== 'neutral' ? ` ${t}` : ''}`

function StatusPill({ s }: { s: string }) {
  const t = QA_STATUS[s]
  return <span className={pillCls(t?.[1])}>{t?.[0] ?? s}</span>
}

function ScorePill({ score, fatal }: { score: number | null; fatal?: boolean | null }) {
  return (
    <span className={pillCls(qaBand(score, !!fatal))}>
      {score === null ? '–' : `${score}%${fatal ? ', critical' : ''}`}
    </span>
  )
}

/* --- Ds — find my open CTLs matching a ticket number or audit/CTL id --------- */
function findOpenCtls(t: any[], n: string): any[] {
  const a = n.trim()
  if (!a) return []
  const s = /^#?\s*\d+$/.test(a) ? a.replace(/\D/g, '') : '',
    i = a.toLowerCase()
  return t.filter(
    (c) =>
      c.status === 'open' &&
      (s
        ? c.audit?.ticketId === s
        : c.auditId.toLowerCase() === i || c.ctlId.toLowerCase() === i)
  )
}

/* --- Ls — the audit side panel (the lost marks) ------------------------------ */
function CtlAuditSide({ c, ticketUrl }: { c: any; ticketUrl: string }) {
  if (!c)
    return (
      <p className="cx-muted">
        Enter a ticket number or audit ID: the audit opens here with only the
        questions that lost marks.
      </p>
    )
  const a = c.audit
  return (
    <div className="qa-ctlside__body">
      <div className="qa-card__head">
        {a ? <ScorePill score={a.finalScore} fatal={a.fatal} /> : null}
        <strong>{c.agentName}</strong>
        <span className={pillCls(c.overdue ? 'bad' : c.dueToday ? 'warn' : 'neutral')}>
          {c.overdue ? `Overdue since ${c.dueDate}` : c.dueToday ? 'Due today' : `Due ${c.dueDate}`}
        </span>
      </div>
      {a ? (
        <>
          <dl className="qa-facts">
            <div>
              <dt>Ticket</dt>
              <dd>
                <TicketRef url={ticketUrl} id={a.ticketId} />
              </dd>
            </div>
            <div>
              <dt>Channel</dt>
              <dd>{a.channel}</dd>
            </div>
            <div>
              <dt>Audited</dt>
              <dd>
                {a.auditDate} by {a.auditorName}
              </dd>
            </div>
            <div>
              <dt>Audit ID</dt>
              <dd className="cx-num">{a.auditId}</dd>
            </div>
          </dl>
          <h3 className="qa-ctlside__title">Lost marks on</h3>
          <AuditFails a={a} />
        </>
      ) : (
        <p className="cx-muted">The audit of this CTL is missing.</p>
      )}
      {c.reopenCount ? (
        <p className="cx-note">
          <span>
            Reopened: the agent said the last session did not happen
            {c.agentNote ? `: “${c.agentNote}”` : '.'}
          </span>
        </p>
      ) : null}
    </div>
  )
}

/* --- Es — the submit-a-CTL form ---------------------------------------------- */
function CtlForm({
  rows,
  ticketUrl,
  picked,
  onPick,
  onDone,
}: {
  rows: any[]
  ticketUrl: string
  picked: { ref: string; ctlId: string }
  onPick: (p: { ref: string; ctlId: string }) => void
  onDone: () => void
}) {
  const [c, l] = useState('')
  const [p, m] = useState('')
  const [r, u] = useState('')
  const [d, o] = useState('')
  const [h, b] = useState(false)
  const [x, f] = useState('')
  const g = findOpenCtls(rows, picked.ref)
  const y = g.find((k) => k.ctlId === picked.ctlId) ?? (g.length === 1 ? g[0] : null)
  const _ = !!y && y.outcome === 'dispute' && !!y.dispute
  const T = _ ? 'dispute' : c
  return (
    <div className="qa-ctl">
      <form
        className="qa-ctlform"
        onSubmit={(k) => {
          k.preventDefault()
          if (!y)
            return f(
              picked.ref.trim()
                ? g.length > 1
                  ? 'Choose which CTL of this ticket.'
                  : 'No open CTL of yours matches that. Check the ticket number or audit ID.'
                : 'Enter the ticket number or audit ID.'
            )
          if (!T) return f('Choose the outcome: Acknowledged or Dispute.')
          b(true)
          f('')
          P.submitCtl({
            ctlId: y.ctlId,
            outcome: T,
            notes: p,
            action: r,
            reason: d,
          }).then(
            (C) => {
              b(false)
              m('')
              u('')
              o('')
              l('')
              onPick({ ref: '', ctlId: '' })
              Q(
                `CTL completed${C.slaMet ? ', on time' : ', after its due date'}${C.disputeId ? '; the dispute is raised' : ''}. ${y.agentName} and you were emailed; ${y.agentName} is asked to confirm it.`
              )
              onDone()
            },
            (C) => (b(false), f(C.message))
          )
        }}
      >
        <div className="cx-field">
          <label className="cx-label" htmlFor="ctl-ref">
            Ticket number or audit ID
          </label>
          <Input
            id="ctl-ref"
            value={picked.ref}
            autoComplete="off"
            placeholder="e.g. 701234 or QA-…"
            onInput={(k) => onPick({ ref: k.currentTarget.value, ctlId: '' })}
          />
        </div>
        {g.length > 1 ? (
          <fieldset className="qa-pick">
            <legend className="cx-label">
              This ticket has {g.length} open CTLs: choose one
            </legend>
            {g.map((k) => (
              <label key={k.ctlId}>
                {/* eslint-disable-next-line -- kept raw: fieldset/legend radio pick; Seg has no legend slot */}
                <input
                  type="radio"
                  name="ctl-pick"
                  checked={y?.ctlId === k.ctlId}
                  onChange={() => onPick({ ref: picked.ref, ctlId: k.ctlId })}
                />
                <span>
                  {k.agentName}, audited {k.audit?.auditDate ?? ''} (
                  {k.audit ? `${k.audit.finalScore}%` : '–'}), due {k.dueDate}
                </span>
              </label>
            ))}
          </fieldset>
        ) : picked.ref.trim() && !g.length ? (
          <p className="cx-muted">No open CTL of yours matches “{picked.ref.trim()}”.</p>
        ) : null}
        {_ ? (
          <p className="cx-note">
            <span>
              Outcome stays Dispute: it was raised before the agent reopened this
              CTL ({QA_STATUS[y.dispute.status]?.[0] ?? y.dispute.status}).
              Submitting re-logs the session only.
            </span>
          </p>
        ) : (
          <div className="cx-field">
            <span className="cx-label" id="ctl-out-l">
              Outcome
            </span>
            <Seg
              name="ctl-outcome"
              value={c}
              onChange={l}
              options={[
                { value: 'acknowledged', label: 'Acknowledged' },
                { value: 'dispute', label: 'Dispute' },
              ]}
              aria-labelledby="ctl-out-l"
            />
          </div>
        )}
        {T === 'dispute' && !_ ? (
          <div className="cx-field">
            <label className="cx-label" htmlFor="ctl-reason">
              The agent&apos;s case
            </label>
            <Textarea
              id="ctl-reason"
              value={d}
              onInput={(k) => o(k.currentTarget.value)}
              placeholder="Which question, and what the ticket shows (time, message). It goes to the weekly Quality meeting."
            />
          </div>
        ) : null}
        <ListSelect listKey="qa.ctl_action" label="Action taken" value={r} onChange={u} required />
        <div className="cx-field">
          <label className="cx-label" htmlFor="ctl-notes">
            Coaching notes
          </label>
          <Textarea
            id="ctl-notes"
            value={p}
            onInput={(k) => m(k.currentTarget.value)}
            placeholder="What you went through, what the agent will do differently."
          />
        </div>
        {x ? (
          <p className="cx-error" role="alert">
            {x}
          </p>
        ) : null}
        <div className="qa-actions">
          <Button type="submit" variant="primary" disabled={h}>
            {h ? 'Submitting…' : 'Submit CTL'}
          </Button>
          <span className="cx-faint">The date and time are recorded when you submit.</span>
        </div>
      </form>
      <aside className="card card-pad qa-ctlside" aria-label="The audit">
        <CtlAuditSide c={y} ticketUrl={ticketUrl} />
      </aside>
    </div>
  )
}

/* --- fn/Os — resend the result email ---------------------------------------- */
const MAIL_TEXT: Record<string, string> = {
  sent: 'Result email sent.',
  dry_run: 'Logged as dry run: no email left. mail_dry_run is still on (Admin page).',
  failed: 'The email failed. See MailLog for the error.',
  skipped: 'No email sent',
}

function ResendMail({ auditId, ticketId }: { auditId: string; ticketId: string }) {
  const [a, s] = useState(false)
  const i = (c: boolean) => {
    s(true)
    P.resendAuditMail(auditId, c).then(
      (l) => {
        s(false)
        if (l.needsConfirm) {
          if (
            window.confirm(
              `The result email for ${qaTicketLabel(ticketId)} was already sent${l.last ? ` to ${l.last.to} (${l.last.at})` : ''}. Send it again?`
            )
          )
            i(true)
          return
        }
        const p =
          l.mail === 'skipped' ? `${MAIL_TEXT.skipped}: ${l.reason}.` : `${MAIL_TEXT[l.mail]}${l.error ? ' ' + l.error : ''}`
        Q(p, l.mail === 'sent' || l.mail === 'dry_run' ? 'ok' : 'error')
      },
      (l) => (s(false), Q(l.message, 'error'))
    )
  }
  return (
    <Button size="sm" disabled={a} onClick={() => i(false)}>
      {a ? 'Sending…' : 'Resend result email'}
    </Button>
  )
}

/* --- Rs — CTLs page ----------------------------------------------------------- */
export default function CtlsPage({ route }: { route: { title: string } }) {
  const { data: n, error: a, reload: s } = useSe(P.ctlPage)
  const [i, c] = useState({ ref: '', ctlId: '' })
  const l = useRef<HTMLDivElement | null>(null)
  const p = n ? n.rows.filter((r: any) => r.status === 'open') : []
  const m = (r: any) => {
    c({ ref: r.audit?.ticketId ?? r.auditId, ctlId: r.ctlId })
    l.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    ;(l.current?.querySelector('#ctl-ref') as HTMLElement | null)?.focus({ preventScroll: true })
  }
  return (
    <QaPage
      route={route}
      d={n}
      error={a}
      reload={s}
      sub="Every audit under 100% opens a CTL — whoever is on shift may close it and submit the outcome."
    >
      {n ? (
        <>
          <div ref={l}>
            <section className="card" aria-labelledby="ctlf-h">
              <div className="card-head">
                <div>
                  <div className="card-title" id="ctlf-h">
                    Submit a CTL
                  </div>
                </div>
              </div>
              <div className="card-pad">
                <CtlForm
                  rows={n.rows}
                  ticketUrl={n.ticketUrl}
                  picked={i}
                  onPick={c}
                  onDone={s}
                />
              </div>
            </section>
          </div>
          <section className="card" aria-labelledby="ctl-h">
            <div className="card-head">
              <div>
                <div className="card-title" id="ctl-h">
                  {p.length ? `${p.length} open` : 'CTLs'}
                </div>
              </div>
            </div>
            <div className="card-pad">
              {n.rows.length ? (
                <div className="qa-list">
                  {n.rows.map((r: any) => (
                    <article
                      className="qa-card qa-card--strip"
                      data-late={r.overdue ? 'true' : undefined}
                      data-picked={i.ctlId === r.ctlId ? 'true' : undefined}
                      key={r.ctlId}
                    >
                      {r.audit ? <ScorePill score={r.audit.finalScore} fatal={r.audit.fatal} /> : null}
                      <strong className="qa-name">{r.agentName}</strong>
                      {r.status === 'open' || !r.notes ? (
                        <span className="qa-meta">
                          {r.audit ? (
                            <span>
                              ticket <TicketRef url={n.ticketUrl} id={r.audit.ticketId} />, {r.audit.channel}
                            </span>
                          ) : null}
                          {r.audit ? <span className="qa-sep">·</span> : null}
                          <span>
                            {r.own
                              ? 'Your agent'
                              : `Owner ${r.tlName}; shown to you because you were on shift when it opened`}
                            {r.closedBy && r.closedBy !== r.tlName
                              ? `. Owner ${r.tlName}, closed by ${r.closedBy}`
                              : ''}
                          </span>
                        </span>
                      ) : (
                        <span className="qa-note-txt">
                          {r.action}: {r.notes}
                          {r.agentNote ? ` Agent: “${r.agentNote}”` : ''}
                          {r.closedBy && r.closedBy !== r.tlName
                            ? `. Owner ${r.tlName}, closed by ${r.closedBy}`
                            : ''}
                        </span>
                      )}
                      <StatusPill s={r.status} />
                      {r.status === 'open' ? (
                        <span className={pillCls(r.overdue ? 'bad' : r.dueToday ? 'warn' : 'neutral')}>
                          {r.overdue ? `Overdue since ${r.dueDate}` : r.dueToday ? 'Due today' : `Due ${r.dueDate}`}
                        </span>
                      ) : r.slaMet !== null ? (
                        <span className={pillCls(r.slaMet ? 'ok' : 'bad')}>
                          {r.slaMet ? 'On time' : 'Late'}
                        </span>
                      ) : null}
                      {r.outcome ? (
                        <span className={pillCls(r.outcome === 'dispute' ? 'warn' : 'ok')}>
                          {r.outcome === 'dispute' ? 'Outcome: dispute' : 'Outcome: acknowledged'}
                        </span>
                      ) : null}
                      {r.reopenCount ? <span className="pill bad">Reopened by the agent</span> : null}
                      <span className="qa-acts">
                        {r.status === 'open' ? (
                          <Button size="sm" variant="primary" onClick={() => m(r)}>
                            Open in the form
                          </Button>
                        ) : null}
                        {n.isAdmin && r.audit ? (
                          <ResendMail auditId={r.auditId} ticketId={r.audit.ticketId} />
                        ) : null}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <div className="s">
                    No CTLs. One opens when an audit of your agent loses marks.
                  </div>
                </div>
              )}
            </div>
          </section>
          <section className="card" aria-labelledby="sla-h">
            <div className="card-head">
              <div>
                <div className="card-title" id="sla-h">
                  {`CTL SLA, ${n.month}`}
                </div>
              </div>
            </div>
            <div className="cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Team lead</th>
                    <th scope="col">Due so far</th>
                    <th scope="col">On time</th>
                    <th scope="col">SLA</th>
                    <th scope="col">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {n.sla.length ? (
                    n.sla.map((r: any) => (
                      <tr key={r.tlEmail}>
                        <td>{r.tlName}</td>
                        <td className="cx-num">{r.due}</td>
                        <td className="cx-num">{r.onTime}</td>
                        <td>
                          <span
                            className={pillCls(
                              r.slaPct === null
                                ? 'neutral'
                                : r.slaPct >= n.slaTarget
                                  ? 'ok'
                                  : 'bad'
                            )}
                          >
                            {qaPct(r.slaPct)}
                          </span>
                        </td>
                        <td className="cx-num">
                          {r.done} of {r.total} ({qaPct(r.donePct)})
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>No CTLs due this month yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </QaPage>
  )
}
