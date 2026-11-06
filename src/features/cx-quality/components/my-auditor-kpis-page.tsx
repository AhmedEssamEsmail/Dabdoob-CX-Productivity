'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality My auditor work page
 * (my-auditor-kpis.closure.js symbol js).
 */
import { useRef } from 'react'
import {
  P,
  QaPage,
  QaSection,
  StatusChip,
  qaTicketLabel,
  useSe,
} from './qa-shared'

export function MyAuditorKpisPage({ route }: { route: { title: string } }) {
  const n = useRef('')
  const { data: a, error: s, reload: i } = useSe(() =>
    P.myAuditorKpis(n.current)
  )
  const c = (l: number | null) => (l === null ? '–' : `${l}%`)

  return (
    <QaPage
      route={route}
      d={a}
      error={s}
      reload={i}
      sub="Your own auditor KPIs for the month, from your audits, the disputes raised against them, your calibrations and your KB gaps; then the audits you did."
    >
      {a ? (
        <>
          <div className="cx-filters">
            <div className="cx-field">
              <label className="cx-label" htmlFor="mak-m">
                Month
              </label>
              <select
                className="cx-select"
                id="mak-m"
                value={a.month}
                onChange={(l) => {
                  n.current = l.currentTarget.value
                  i()
                }}
              >
                {a.months.map((l: string) => (
                  <option value={l} key={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <QaSection id="mak-h" title={`${a.name}, ${a.month}`}>
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">KPI</th>
                    <th scope="col">This month</th>
                    <th scope="col">How it is counted</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Audits</td>
                    <td className="cx-num">{a.audits}</td>
                    <td className="cx-muted">
                      Audits you submitted, by audit date.
                      {a.weeks.length
                        ? ` By week (from Sunday): ${a.weeks.map((l: any) => `${l.weekStart}: ${l.audits}`).join(', ')}.`
                        : ''}
                    </td>
                  </tr>
                  <tr>
                    <td>Disputes</td>
                    <td className="cx-num">{c(a.disputePct)}</td>
                    <td className="cx-muted">
                      {a.disputes} raised this month against your audits (
                      {a.disputesUpheld} upheld, {a.disputesOpen} undecided), as
                      a share of your audits.
                    </td>
                  </tr>
                  <tr>
                    <td>Calibration alignment</td>
                    <td className="cx-num">{c(a.alignmentPct)}</td>
                    <td className="cx-muted">
                      Your agreement with the team lead reference, averaged over{' '}
                      {a.calibrations} completed calibration
                      {a.calibrations === 1 ? '' : 's'} this month.
                    </td>
                  </tr>
                  <tr>
                    <td>KB gaps</td>
                    <td className="cx-num">{a.kbGaps}</td>
                    <td className="cx-muted">
                      {a.kbSameDay} of them logged the same day as the audit.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </QaSection>
          <QaSection
            id="mak-a"
            title="Audits you did"
            hint={`Last 90 days, and any older audit with an undecided dispute. ${a.myAudits.filter((l: any) => l.dispute && (l.dispute.status === 'open' || l.dispute.status === 'escalated')).length} with a dispute waiting.`}
          >
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Audited</th>
                    <th scope="col">Ticket</th>
                    <th scope="col">Agent</th>
                    <th scope="col">Channel</th>
                    <th scope="col">Score</th>
                    <th scope="col">Dispute</th>
                  </tr>
                </thead>
                <tbody>
                  {a.myAudits.length ? (
                    a.myAudits.map((l: any) => (
                      <tr key={l.auditId}>
                        <td className="cx-num">{l.auditDate}</td>
                        <td>{qaTicketLabel(l.ticketId)}</td>
                        <td>{l.agentName}</td>
                        <td>{l.channel}</td>
                        <td className="cx-num">
                          {l.finalScore !== l.score ? (
                            <>
                              {l.finalScore}%
                              <span className="cx-faint qa-sub">
                                was {l.score}%
                              </span>
                            </>
                          ) : (
                            `${l.score}%`
                          )}
                          {l.fatal ? (
                            <span className="cx-faint qa-sub">
                              critical fail
                            </span>
                          ) : null}
                        </td>
                        <td>
                          {l.dispute ? (
                            <>
                              <StatusChip s={l.dispute.status} />
                              <span className="cx-faint qa-sub">
                                Raised {l.dispute.raisedDate}:{' '}
                                {l.dispute.reason}
                              </span>
                              {l.dispute.decisionNote ? (
                                <span className="cx-faint qa-sub">
                                  Decision {l.dispute.decidedAt}:{' '}
                                  {l.dispute.decisionNote}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="cx-muted">–</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>No audits in the last 90 days.</td>
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
