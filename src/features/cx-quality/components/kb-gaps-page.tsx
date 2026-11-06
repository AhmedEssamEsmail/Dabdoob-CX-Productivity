'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality KB gaps page
 * (kb-gaps.closure.js symbol Vs).
 */
import { useState } from 'react'
import {
  Chip,
  ListSelect,
  P,
  QaPage,
  QaSection,
  StatusChip,
  TicketRef,
  qaTicketLabel,
  useSe,
} from './qa-shared'
import { toast } from '@/features/shared/components/shell/Toasts'

export function KbGapsPage({ route }: { route: { title: string } }) {
  const { data: n, error: a, reload: s } = useSe(P.kbGapsPage)
  const [i, c] = useState('')
  const [l, p] = useState('')
  const [m, r] = useState('')
  const [u, d] = useState(false)
  const [o, h] = useState('')
  const [b, x] = useState('')

  const f = (g: string) => {
    h(g)
    P.markKbGapAdded(g).then(
      () => {
        h('')
        toast('Marked added to the knowledge base.')
        s()
      },
      (y) => {
        h('')
        toast(y.message, 'error')
      }
    )
  }

  return (
    <QaPage
      route={route}
      d={n}
      error={a}
      reload={s}
      sub="Knowledge-base gaps found while auditing, each linked to its audit and dated when logged. The KB update list is emailed about each one and marks it added. A gap logged the same day as the audit counts towards the auditor's KPI."
    >
      {n ? (
        <>
          {n.canAdd && !n.myAudits.length ? (
            <p className="cx-note" role="status">
              <span>
                A gap is logged from one of your own audits, and you have none
                in the last 14 days. Audit a ticket from the Audit Desk, then
                log the gap here the same day.
              </span>
            </p>
          ) : n.canAdd ? (
            <form
              className="cx-panel cx-panel--pad qa-grid"
              onSubmit={(g) => {
                g.preventDefault()
                d(true)
                x('')
                P.addKbGap({
                  auditId: i,
                  topic: l,
                  description: m,
                }).then(
                  (y) => {
                    d(false)
                    r('')
                    toast(
                      `Logged${y.sameDay ? ', same day as the audit' : '; not the same day as the audit'}.${y.notified ? ` ${y.notified} on the KB update list were emailed.` : ''}`
                    )
                    s()
                  },
                  (y) => {
                    d(false)
                    x(y.message)
                  }
                )
              }}
            >
              <div className="cx-field">
                <label className="cx-label" htmlFor="kb-a">
                  From audit (ticket)
                </label>
                <select
                  className="cx-select"
                  id="kb-a"
                  value={i}
                  onChange={(g) => c(g.currentTarget.value)}
                >
                  <option value="">Choose one of your audits</option>
                  {n.myAudits.map((g: any) => (
                    <option value={g.auditId} key={g.auditId}>
                      {qaTicketLabel(g.ticketId)}, {g.agentName}, {g.auditDate} (
                      {g.score}%)
                    </option>
                  ))}
                </select>
              </div>
              <ListSelect
                listKey="qa.kb_gap_type"
                label="Type of gap"
                value={l}
                onChange={p}
                required
              />
              <div className="cx-field cx-field--wide">
                <label className="cx-label" htmlFor="kb-d">
                  What is missing or wrong
                </label>
                <textarea
                  className="cx-textarea"
                  id="kb-d"
                  value={m}
                  required
                  onInput={(g) => r(g.currentTarget.value)}
                />
              </div>
              {b ? (
                <p className="cx-error" role="alert">
                  {b}
                </p>
              ) : null}
              <button
                type="submit"
                className="cx-btn cx-btn--primary"
                disabled={u}
              >
                {u ? 'Saving…' : 'Log the gap'}
              </button>
            </form>
          ) : null}
          <QaSection
            id="kb-h"
            title="Gaps"
            hint={`${n.gaps.filter((g: any) => g.status !== 'added').length} not yet in the KB`}
          >
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Logged</th>
                    <th scope="col">Type</th>
                    <th scope="col">Gap</th>
                    <th scope="col">Ticket</th>
                    <th scope="col">Auditor</th>
                    <th scope="col">Same day</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {n.gaps.length ? (
                    n.gaps.map((g: any) => (
                      <tr key={g.gapId}>
                        <td className="cx-num">{g.createdDate}</td>
                        <td>{g.topic}</td>
                        <td>
                          {g.description}
                          {g.suggestion ? (
                            <span className="cx-faint qa-sub">
                              Fix: {g.suggestion}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <TicketRef url={n.ticketUrl} id={g.ticketId} />
                        </td>
                        <td>{g.auditorName}</td>
                        <td>
                          <Chip status={g.sameDay ? 'ok' : 'neutral'}>
                            {g.sameDay ? 'Yes' : `No (audit ${g.auditDate})`}
                          </Chip>
                        </td>
                        <td>
                          {g.status === 'added' ? (
                            <>
                              <StatusChip s="added" />
                              <span className="cx-faint qa-sub">
                                {g.addedByName}, {g.addedAt.slice(0, 10)}
                              </span>
                            </>
                          ) : n.canMarkAdded ? (
                            <button
                              type="button"
                              className="cx-btn"
                              disabled={!!o}
                              onClick={() => f(g.gapId)}
                            >
                              {o === g.gapId ? 'Saving…' : 'Mark added to KB'}
                            </button>
                          ) : (
                            <StatusChip s="open" />
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>No gaps logged yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </QaSection>
        </>
      ) : null}
    </QaPage>
  )
}
