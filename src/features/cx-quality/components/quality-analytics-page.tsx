'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality analytics page
 * (quality-analytics.closure.js — symbols: gl page; sections Ys health,
 * Gs attention, cl agents, sl columns, zs questions, Js by-channel, rl
 * non-ticket, details.qa-more(Xs coaching, el team leads, ll spread, Zs
 * outside), ol extras (+pl coverage, +ml totals, +_n columns); ea drill
 * drawer; ta basis seg; Count te machinery (is/rn/on/cs/Nt); constants
 * Ke/xt/ye/Me/Ge/Et/Pe/bn/Ks/Ot/yn/vn; helpers tl/nl/al/dl/he/ul/Rt/hl).
 */
import { useState } from 'react'
import {
  Chip,
  Count,
  P,
  QA_BASIS_LABELS,
  QA_CONF,
  QA_CONF_TONE,
  QA_FLAG_LABELS,
  QA_REASON_LABELS,
  QA_TREND_ARROW,
  QaLink,
  QaPage,
  QaSection,
  ScoreChip,
  qaBand,
  qaBasisNote,
  qaCi,
  qaMargin,
  qaPct,
  qaPeriodLabel,
  qaReasonMix,
  qaVerdictTone,
  useSe,
} from './qa-shared'
import { Columns, Coverage, SparkChart, Spread } from './quality-analytics-charts'
import { LoadError } from '@/features/shared/components/shell/ui'
import { Button, Seg, Select, TableScroll } from '@/features/shared/components/ui'

/* --- Ys — the health/bases head ------------------------------------------ */
function HealthHead({ d: t }: { d: any }) {
  const n = t.health
  const a = t.bases.filter((s: any) => s.basis !== 'random')
  return (
    <section className="cx-panel" aria-labelledby="qa-health-h">
      <div className="cx-section__head">
        <div>
          <div className="cx-section__title" id="qa-health-h">
            Team health
          </div>
          <div className="cx-section__hint">{qaPeriodLabel(t)}</div>
        </div>
      </div>
      <div className="cx-panel--pad">
      <dl className="cx-totals">
        <div
          className="cx-totals__item"
          data-status={
            n.score !== null && n.badge !== 'low' ? qaBand(n.score, false) : undefined
          }
        >
          <dt>Team score</dt>
          <dd className="cx-num">
            <Count v={qaPct(n.score)} />{' '}
            <span className="qa-range">
              {n.score === null ? '' : qaMargin(n.margin)}
            </span>
            {n.trend ? (
              <span
                className="qa-range"
                title={`${n.trend === 'up' ? 'Up' : 'Down'} from ${n.prevScore}%, beyond both ranges`}
              >
                {' '}
                {QA_TREND_ARROW[n.trend]}
              </span>
            ) : null}
          </dd>
          <span className="cx-faint qa-sub">
            {n.score === null
              ? 'No agent has 10 random audits yet'
              : `${n.agents} agents, each counted once; ${QA_CONF[n.badge].toLowerCase()} confidence`}
          </span>
        </div>
        <div className="cx-totals__item">
          <dt>Without critical fails</dt>
          <dd className="cx-num">
            <Count v={qaPct(n.scoreNoCritical)} />
          </dd>
        </div>
        <div
          className="cx-totals__item"
          data-status={n.critical ? 'bad' : undefined}
        >
          <dt>Critical fails</dt>
          <dd className="cx-num">
            <Count v={n.critical} />
          </dd>
          <span className="cx-faint qa-sub">
            {n.criticalRate ? `${qaCi(n.criticalRate)} of ${t.audits}` : 'no random audits'}
          </span>
        </div>
        <div className="cx-totals__item">
          <dt>Agents with a verdict</dt>
          <dd className="cx-num">
            <Count v={n.agentsVerdict} /> of <Count v={n.agentsAudited} />
          </dd>
          <span className="cx-faint qa-sub">16 or more audits</span>
        </div>
        <div className="cx-totals__item">
          <dt>Weighted to the ticket mix</dt>
          <dd className="cx-num">
            <Count v={n.weighted ? `${n.weighted.mean}%` : '–'} />
          </dd>
          <span className="cx-faint qa-sub">
            {n.weighted
              ? `audited reasons hold ${n.weighted.coverage}% of tickets`
              : 'no ticket volumes recorded yet'}
          </span>
        </div>
        <div className="cx-totals__item">
          <dt>Audited against quota</dt>
          <dd className="cx-num">
            <Count v={qaPct(n.quotaPct)} />
          </dd>
          <span className="cx-faint qa-sub">
            {n.quotaDone} of {n.quotaExpected} so far
          </span>
        </div>
        <div
          className="cx-totals__item"
          data-status={n.notFinal ? 'warn' : undefined}
        >
          <dt>Pending disputes</dt>
          <dd className="cx-num">
            <Count v={n.pendingDisputes} />
          </dd>
          <span className="cx-faint qa-sub">
            {n.notFinal ? 'Not final: these return when decided' : 'Final'}
          </span>
        </div>
      </dl>
      {a.length || t.blankScores ? (
        <p className="cx-muted qa-bases">
          Not in the score:{' '}
          {a.map((s: any) => `${QA_BASIS_LABELS[s.basis]} ${s.audits} (average ${qaPct(s.avg)})`).join(', ')}
          {t.blankScores
            ? `${a.length ? '; ' : ''}${t.blankScores} with no score`
            : ''}
          .
          {a.some((s: any) => s.basis === 'unknown')
            ? ' Unknown basis: audits from before the basis was recorded, until the one-off backfill runs.'
            : ''}
        </p>
      ) : null}
      </div>
    </section>
  )
}

/* --- Gs — who needs a look ------------------------------------------------ */
function Attention({
  d: t,
  open: n,
}: {
  d: any
  open: (pick: any) => void
}) {
  const [a, s] = useState(false)
  const i = a ? t.attention : t.attention.slice(0, 10)
  return (
    <QaSection
      id="qa-att-h"
      title="Who needs a look"
      hint="One row per agent, with every rule that fired: a critical fail, a repeat after a CTL, a score whose whole range sits under the middle agent, two falling periods, or fewer audits than the quota so far."
    >
      <TableScroll label="Agents needing a look" className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Why</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {i.length ? (
              i.map((c: any) => (
                <tr key={c.email}>
                  <td>
                    <QaLink
                      label={c.name}
                      onClick={() =>
                        n({ agent: c.email, agentName: c.name })
                      }
                    />
                    <span className="cx-faint qa-sub">{c.tlName}</span>
                  </td>
                  <td>
                    <ul className="qa-whylist">
                      {c.reasons.map((l: any, p: number) => (
                        <li key={p}>
                          <Chip status={QA_FLAG_LABELS[l.rule][1]}>{QA_FLAG_LABELS[l.rule][0]}</Chip>{' '}
                          <span className="cx-muted">{l.text}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="cx-num">
                    {c.avg === null ? '–' : `${c.avg}%`}
                    <span className="cx-faint qa-sub">{c.audits} random</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>
                  Nobody this period: no critical fail, repeat after coaching,
                  low verdict, fall or audit gap.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
      {t.attention.length > 10 ? (
        <Button
          variant="quiet"
          onClick={() => s(!a)}
        >
          {a ? 'Show the first 10' : `Show all ${t.attention.length}`}
        </Button>
      ) : null}
    </QaSection>
  )
}

/* --- Js — by channel and contact reason ---------------------------------- */
function ByChannel({ d: t }: { d: any }) {
  const n = (a: any) => (
    <>
      <Chip status={qaVerdictTone(a)}>{qaPct(a.avg)}</Chip>{' '}
      <span className="qa-range cx-num">
        {a.other ? 'not ranked' : qaMargin(a.margin)}
      </span>
      {a.trend ? (
        <span
          className="qa-range"
          title={`${a.trend === 'up' ? 'Up' : 'Down'} from ${a.prevAvg}%, beyond both ranges`}
        >
          {' '}
          {QA_TREND_ARROW[a.trend]}
        </span>
      ) : null}
    </>
  )
  return (
    <QaSection
      id="qa-seg-h"
      title="By channel and contact reason"
      hint="Each agent counts once in a channel's score (the plain audit average is beside it). Weighted: re-weighted to how many tickets each contact reason had, undoing the queue's prioritisation."
    >
      <TableScroll label="Scores by channel" className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Channel</th>
              <th scope="col">Score</th>
              <th scope="col">Weighted</th>
              <th scope="col">Audits</th>
              <th scope="col">Confidence</th>
              <th scope="col">Critical</th>
            </tr>
          </thead>
          <tbody>
            {t.byChannel.length ? (
              t.byChannel.map((a: any) => (
                <tr className={a.badge === 'low' ? 'qa-low' : undefined} key={a.key}>
                  <td>{a.label}</td>
                  <td>
                    {n(a)}
                    <span className="cx-faint qa-sub">
                      audit average {qaPct(a.auditAvg)}
                    </span>
                  </td>
                  <td className="cx-num">
                    {a.weighted ? `${a.weighted.mean}%` : '–'}
                  </td>
                  <td className="cx-num">
                    {a.audits}
                    <span className="cx-faint qa-sub">{a.agents} agents</span>
                  </td>
                  <td>
                    <Chip status={QA_CONF_TONE[a.badge]}>{QA_CONF[a.badge]}</Chip>
                  </td>
                  <td className="cx-num">{a.fatal || ''}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No random audits in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
      <TableScroll label="Scores by contact reason" className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Contact reason</th>
              <th scope="col">Channel</th>
              <th scope="col">Score</th>
              <th scope="col">Audits</th>
              <th scope="col">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {t.byContactType.length ? (
              t.byContactType.map((a: any) => (
                <tr className={a.badge === 'low' ? 'qa-low' : undefined} key={a.key}>
                  <td>
                    {a.label}
                    {a.other ? (
                      <span className="cx-faint qa-sub">{a.reasons} reasons</span>
                    ) : null}
                  </td>
                  <td>{a.channel}</td>
                  <td>{n(a)}</td>
                  <td className="cx-num">{a.audits}</td>
                  <td>
                    <Chip status={QA_CONF_TONE[a.badge]}>{QA_CONF[a.badge]}</Chip>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No random audits in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
    </QaSection>
  )
}

/* --- cl — the agents table ------------------------------------------------ */
function Agents({ d: t, open: n }: { d: any; open: (pick: any) => void }) {
  const a = t.grain === 'month'
  return (
    <QaSection
      id="qa-ag-h"
      title="Agents"
      hint="Random audits only. Agents with 16 or more audits first, lowest score first; under 16 the score is not coloured. Channels are shown apart."
    >
      <TableScroll label="Agent quality scores" className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Score</th>
              <th scope="col">Trend</th>
              <th scope="col">Confidence</th>
              <th scope="col">Critical</th>
              <th scope="col">Channels</th>
              <th scope="col">Fails: agent / other</th>
              {a ? (
                <>
                  <th scope="col">Full marks</th>
                  <th scope="col">Critical rate</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {t.byAgent.length ? (
              t.byAgent.map((s: any) => (
                <tr className={s.badge === 'low' ? 'qa-low' : undefined} key={s.key}>
                  <td>
                    <QaLink
                      label={s.label}
                      onClick={() => n({ agent: s.key, agentName: s.label })}
                    />
                    <span className="cx-faint qa-sub">{s.tlName}</span>
                  </td>
                  <td>
                    <Chip status={qaVerdictTone(s)}>{qaPct(s.avg)}</Chip>{' '}
                    <span className="qa-range cx-num">{qaMargin(s.margin)}</span>
                    {s.trend ? (
                      <span
                        className="qa-range"
                        title={`${s.trend === 'up' ? 'Up' : 'Down'} from ${s.prevAvg}%, beyond both ranges`}
                      >
                        {' '}
                        {QA_TREND_ARROW[s.trend]}
                      </span>
                    ) : null}
                    <span className="cx-faint qa-sub">{s.audits} audits</span>
                  </td>
                  <td>
                    <SparkChart d={t} h={s.history} name={s.label} />
                  </td>
                  <td>
                    <Chip status={QA_CONF_TONE[s.badge]}>{QA_CONF[s.badge]}</Chip>
                  </td>
                  <td className="cx-num">{s.fatal || ''}</td>
                  <td>
                    {s.channels.length ? (
                      s.channels.map((i: any) => (
                        <span className="qa-sub" key={i.channel}>
                          {i.channel} {qaPct(i.avg)} ({i.audits})
                        </span>
                      ))
                    ) : (
                      '–'
                    )}
                  </td>
                  <td className="cx-num">
                    {s.reasons.agent} / {s.reasons.other}
                    {s.reasons.untagged ? (
                      <span className="cx-faint qa-sub">
                        {s.reasons.untagged} untagged
                      </span>
                    ) : null}
                  </td>
                  {a ? (
                    <>
                      <td className="cx-num">{qaCi(s.fullMarks)}</td>
                      <td className="cx-num">{qaCi(s.fatalRate)}</td>
                    </>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={a ? 9 : 7}>No random audits in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
    </QaSection>
  )
}

/* --- zs — where points are lost ------------------------------------------- */
function Questions({ d: t, open: n }: { d: any; open: (pick: any) => void }) {
  const [a, s] = useState(false)
  const i = a ? t.questions : t.questions.slice(0, 15)
  return (
    <QaSection
      id="qa-q-h"
      title="Where points are lost"
      hint={`Points each question costs per 100 audits of its form. Questions asked fewer than 10 times are listed after the rest. Reasons are shares of tagged fails: ${t.reasonCoveragePct === null ? 'none' : `${t.reasonCoveragePct}%`} of fails are tagged.`}
    >
      <TableScroll label="Where points are lost" className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Points lost per 100 audits</th>
              <th scope="col">Failed</th>
              <th scope="col">N/A</th>
              <th scope="col">Why</th>
            </tr>
          </thead>
          <tbody>
            {i.length ? (
              i.map((c: any) => (
                <tr className={c.gated ? 'qa-low' : undefined} key={c.key}>
                  <td>
                    <QaLink
                      label={c.text}
                      onClick={() =>
                        n({ question: c.key, questionText: c.text })
                      }
                    />
                    <span className="cx-faint qa-sub">
                      {c.channel}, {c.section}
                      {c.fatal ? ', critical' : ''}
                      {c.gated ? ', too few to rank' : ''}
                    </span>
                  </td>
                  <td className="cx-num">{c.lossPer100}</td>
                  <td className="cx-num">
                    {c.failed} of {c.asked}
                    <span className="cx-faint qa-sub">
                      {qaPct(c.failPct)}, {c.agentsFailed}{' '}
                      {c.agentsFailed === 1 ? 'agent' : 'agents'}
                    </span>
                  </td>
                  <td className="cx-num">{qaPct(c.naPct)}</td>
                  <td>{qaReasonMix(c.reasons)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No failed questions in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
      {t.questions.length > 15 ? (
        <Button
          variant="quiet"
          onClick={() => s(!a)}
        >
          {a ? 'Show the top 15' : `Show all ${t.questions.length}`}
        </Button>
      ) : null}
      {t.rescoredSkipped ? (
        <p className="cx-faint">
          {t.rescoredSkipped} re-scored{' '}
          {t.rescoredSkipped === 1 ? 'audit is' : 'audits are'} left out here:
          a re-score keeps the old answers.
        </p>
      ) : null}
    </QaSection>
  )
}

/* --- rl — non-ticket types -------------------------------------------------- */
function NonTicket({ d: t }: { d: any }) {
  return t.nonTicket.length ? (
    <>
      {t.nonTicket.map((n: any) => (
        <QaSection
          id={`qa-nt-${n.type.replace(/\W+/g, '-')}`}
          title={n.type}
          hint={`Its own form and scale, kept out of the ticket scores. ${n.audits} audits, ${qaPct(n.avg)} ${qaMargin(n.margin)}.`}
          key={n.type}
        >
          <TableScroll label={`${n.type} audits by agent`} className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Agent</th>
                  <th scope="col">Audits</th>
                  <th scope="col">Average</th>
                  <th scope="col">Critical</th>
                </tr>
              </thead>
              <tbody>
                {n.agents.length ? (
                  n.agents.map((a: any) => (
                    <tr key={a.email}>
                      <td>{a.name}</td>
                      <td className="cx-num">{a.audits}</td>
                      <td className="cx-num">{qaPct(a.avg)}</td>
                      <td className="cx-num">{a.fatal || ''}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No audits for this type.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
        </QaSection>
      ))}
    </>
  ) : null
}

/* --- Xs — coaching loop ----------------------------------------------------- */
function Coaching({ d: t, open: n }: { d: any; open: (pick: any) => void }) {
  const a = t.coaching
  const [s, i] = useState(false)
  const c = s ? t.repeats : t.repeats.slice(0, 10)
  return (
    <QaSection
      id="qa-rep-h"
      title="Coaching loop"
      hint={`Repeat failures in the 30 days to ${t.periodEnd}: the same question failed twice, or again on a ticket handled after the CTL on it.`}
    >
      <dl className="cx-totals">
        <div className="cx-totals__item">
          <dt>CTLs open</dt>
          <dd className="cx-num">
            <Count v={a.ctlOpen} />
          </dd>
        </div>
        <div
          className="cx-totals__item"
          data-status={a.ctlOverdue ? 'bad' : undefined}
        >
          <dt>Overdue</dt>
          <dd className="cx-num">
            <Count v={a.ctlOverdue} />
          </dd>
        </div>
        <div className="cx-totals__item">
          <dt>Failed again after coaching</dt>
          <dd className="cx-num">
            <Count v={a.postCtl ? qaCi(a.postCtl) : '–'} />
          </dd>
          <span className="cx-faint qa-sub">
            {a.postCtlFails} of {a.postCtlAsked} later answers on coached
            questions
          </span>
        </div>
      </dl>
      <TableScroll label="Repeat failures after coaching" className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Question</th>
              <th scope="col">Failed</th>
              <th scope="col">Why</th>
              <th scope="col">After CTL</th>
            </tr>
          </thead>
          <tbody>
            {c.length ? (
              c.map((l: any) => (
                <tr key={l.agentEmail + l.key}>
                  <td>
                    <QaLink
                      label={l.agentName}
                      onClick={() =>
                        n({
                          agent: l.agentEmail,
                          agentName: l.agentName,
                          question: l.key,
                          questionText: l.text,
                        })
                      }
                    />
                    <span className="cx-faint qa-sub">{l.tlName}</span>
                  </td>
                  <td>{l.text}</td>
                  <td className="cx-num">
                    {l.fails} of {l.asked}
                    <span className="cx-faint qa-sub">last {l.last}</span>
                  </td>
                  <td>{l.reason ? QA_REASON_LABELS[l.reason] : '–'}</td>
                  <td>
                    {l.afterCtl ? (
                      <>
                        <Chip status="bad">CTL {l.afterCtl}</Chip>
                        <span className="cx-faint qa-sub">
                          {l.afterFails} of {l.afterAsked} since failed
                        </span>
                      </>
                    ) : (
                      '–'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No repeat failures in these 30 days.</td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
      {t.repeats.length > 10 ? (
        <Button
          variant="quiet"
          onClick={() => i(!s)}
        >
          {s ? 'Show the first 10' : `Show all ${t.repeats.length}`}
        </Button>
      ) : null}
    </QaSection>
  )
}

/* --- el — team leads ---------------------------------------------------------- */
function TeamLeads({ d: t }: { d: any }) {
  return (
    <QaSection
      id="qa-tl-h"
      title="Team leads"
      hint="How many of each lead's agents are on the list above, and their open CTLs. CTL on-time rate in the month view."
    >
      <TableScroll label="Team leads" className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Team lead</th>
              <th scope="col">Agents needing a look</th>
              <th scope="col">CTLs open</th>
              <th scope="col">Overdue</th>
              {t.grain === 'month' ? <th scope="col">CTL on time</th> : null}
            </tr>
          </thead>
          <tbody>
            {t.byTl.length ? (
              t.byTl.map((n: any) => (
                <tr key={n.tlEmail}>
                  <td>{n.tlName}</td>
                  <td className="cx-num">
                    {n.attention} of {n.agents}
                    {n.attentionPct !== null ? ` (${n.attentionPct}%)` : ''}
                  </td>
                  <td className="cx-num">{n.ctlOpen}</td>
                  <td className="cx-num">
                    {n.ctlOverdue ? (
                      <Chip status="bad">{n.ctlOverdue}</Chip>
                    ) : (
                      0
                    )}
                  </td>
                  {t.grain === 'month' ? (
                    <td>
                      <Chip
                        status={
                          n.slaPct === null
                            ? 'neutral'
                            : n.slaPct >= t.targets.ctlSla
                              ? 'ok'
                              : 'bad'
                        }
                      >
                        {qaPct(n.slaPct)}
                      </Chip>
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  No team leads with audited agents in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
    </QaSection>
  )
}

/* --- Zs — fix outside the team ------------------------------------------------- */
function Outside({ d: t }: { d: any }) {
  return t.outside.length ? (
    <QaSection
      id="qa-out-h"
      title="Fix outside the team"
      hint="Questions where most tagged fails (60% or more of at least 10) are Process, Product or KB: a fix for their owner, not coaching."
    >
      <TableScroll label="Fixes outside the team" className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Outside the agent</th>
              <th scope="col">Process</th>
              <th scope="col">Product</th>
              <th scope="col">KB</th>
              <th scope="col">KB gaps logged</th>
            </tr>
          </thead>
          <tbody>
            {t.outside.map((n: any) => (
              <tr key={n.key}>
                <td>
                  {n.text}
                  <span className="cx-faint qa-sub">{n.channel}</span>
                </td>
                <td className="cx-num">
                  {n.outside} of {n.tagged} ({n.sharePct}%)
                </td>
                <td className="cx-num">{n.process}</td>
                <td className="cx-num">{n.product}</td>
                <td className="cx-num">{n.kb}</td>
                <td className="cx-num">{n.kbGaps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </QaSection>
  ) : null
}

/* --- ol — the extras (month auditors, coverage, form rules) -------------------- */
function Extras({ d: t }: { d: any }) {
  return (
    <>
      {t.grain === 'month' ? (
        <details className="qa-more">
          <summary>Auditors and CTL timeliness this month</summary>
          <TableScroll label="Auditors this month" className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Auditor</th>
                  <th scope="col">Audits</th>
                  <th scope="col">Dispute rate</th>
                  <th scope="col">Alignment</th>
                  <th scope="col">KB gaps (same day)</th>
                </tr>
              </thead>
              <tbody>
                {t.auditors.length ? (
                  t.auditors.map((n: any) => (
                    <tr key={n.email}>
                      <td>{n.name}</td>
                      <td className="cx-num">{n.audits}</td>
                      <td>
                        <Chip
                          status={
                            n.disputePct === null
                              ? 'neutral'
                              : n.disputePct < t.targets.disputePass
                                ? 'ok'
                                : 'bad'
                          }
                        >
                          {qaPct(n.disputePct)}
                        </Chip>
                        {n.disputes ? (
                          <span className="cx-faint qa-sub">
                            {n.disputes} raised
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <Chip
                          status={
                            n.alignmentPct === null
                              ? 'neutral'
                              : n.alignmentPct >= t.targets.alignment
                                ? 'ok'
                                : 'bad'
                          }
                        >
                          {qaPct(n.alignmentPct)}
                        </Chip>
                      </td>
                      <td className="cx-num">
                        {n.kbGaps} ({n.kbSameDay})
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>No auditor activity this month.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
          <TableScroll label="Team leads this month" className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Team lead</th>
                  <th scope="col">On time</th>
                  <th scope="col">SLA</th>
                  <th scope="col">Done</th>
                </tr>
              </thead>
              <tbody>
                {t.ctlSla.length ? (
                  t.ctlSla.map((n: any) => (
                    <tr key={n.tlEmail}>
                      <td>{n.tlName}</td>
                      <td className="cx-num">
                        {n.onTime} of {n.due}
                      </td>
                      <td>
                        <Chip
                          status={
                            n.slaPct === null
                              ? 'neutral'
                              : n.slaPct >= t.targets.ctlSla
                                ? 'ok'
                                : 'bad'
                          }
                        >
                          {qaPct(n.slaPct)}
                        </Chip>
                      </td>
                      <td className="cx-num">{qaPct(n.donePct)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No CTLs due this month.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
        </details>
      ) : null}
      {t.coverage ? (
        <details className="qa-more">
          <summary>Audit coverage, last 30 days</summary>
          <Coverage c={t.coverage} />
        </details>
      ) : null}
      {t.formRules.length ? (
        <details className="qa-more">
          <summary>What a critical fail does on each form</summary>
          <TableScroll label="Form rules" className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Form</th>
                  <th scope="col">Scoring</th>
                  <th scope="col">Critical questions</th>
                  <th scope="col">A critical fail</th>
                </tr>
              </thead>
              <tbody>
                {t.formRules.map((n: any) => (
                  <tr key={n.formId}>
                    <td>
                      {n.title}
                      <span className="cx-faint qa-sub">{n.channel}</span>
                    </td>
                    <td>{n.scoring === 'deduction' ? 'Deduction' : 'Weighted'}</td>
                    <td className="cx-num">{n.critical}</td>
                    <td>
                      {n.critical === 0 ? (
                        '–'
                      ) : n.zeroes ? (
                        'Sets the audit to 0'
                      ) : (
                        <Chip status="warn">Deducts less than 100%</Chip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </details>
      ) : null}
    </>
  )
}

/* --- ea — the drill drawer ----------------------------------------------------- */
function Drill({
  scope: t,
  pick: n,
  open: a,
  close: s,
}: {
  scope: any
  pick: any
  open: (pick: any) => void
  close: () => void
}) {
  const { data: i, error: c, reload: l } = useSe(() =>
    P.analyticsAudits(
      t.grain,
      t.period,
      n.agent ?? '',
      n.question ?? '',
      t.basis
    )
  )
  const m = [n.agentName, n.questionText ? `“${n.questionText.slice(0, 80)}”` : '']
    .filter(Boolean)
    .join(': ')

  return (
    <section className="cx-section qa-drill" aria-labelledby="qa-drill-h">
      <div className="cx-section__head">
        <h2 className="cx-section__title" id="qa-drill-h" tabIndex={-1}>
          {m}
        </h2>
        <span className="cx-section__hint">
          {t.label}. Every counted audit of the period, whatever its basis.
        </span>
        <Button variant="quiet" onClick={s}>
          Close
        </Button>
      </div>
      {c ? (
        <LoadError message={c} onRetry={l} />
      ) : i ? (
        <>
          {n.agent && !n.question && i.questions.length ? (
            <TableScroll label="Questions failed" className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Question failed</th>
                    <th scope="col">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {i.questions.map((r: any) => (
                    <tr key={r.key}>
                      <td>
                        <QaLink
                          label={r.text}
                          onClick={() =>
                            a({ ...n, question: r.key, questionText: r.text })
                          }
                        />
                        <span className="cx-faint qa-sub">{r.channel}</span>
                      </td>
                      <td className="cx-num">
                        {r.fails} of {r.asked}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          ) : null}
          {n.question && !n.agent && i.agents.length ? (
            <TableScroll label="Agents who failed it" className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Agent who failed it</th>
                    <th scope="col">Fails</th>
                  </tr>
                </thead>
                <tbody>
                  {i.agents.map((r: any) => (
                    <tr key={r.email}>
                      <td>
                        <QaLink
                          label={r.name}
                          onClick={() =>
                            a({ ...n, agent: r.email, agentName: r.name })
                          }
                        />
                      </td>
                      <td className="cx-num">{r.fails}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          ) : null}
          <TableScroll label="Audits in this period" className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Audit</th>
                  <th scope="col">Score</th>
                  <th scope="col">Failed</th>
                  <th scope="col">Auditor&apos;s note</th>
                </tr>
              </thead>
              <tbody>
                {i.audits.length ? (
                  i.audits.map((r: any) => (
                    <tr key={r.auditId}>
                      <td>
                        {r.ticketUrl ? (
                          <a
                            href={r.ticketUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            #{r.ticketId}
                          </a>
                        ) : (
                          <span className="qa-ref">{r.ticketId}</span>
                        )}
                        <span className="cx-faint qa-sub">
                          {r.date}, {r.agentName}, {r.channel},{' '}
                          {QA_BASIS_LABELS[r.basis].toLowerCase()}
                        </span>
                      </td>
                      <td>
                        <ScoreChip score={r.score} fatal={r.critical} />
                        {r.rescored ? (
                          <span className="cx-faint qa-sub">re-scored</span>
                        ) : null}
                      </td>
                      <td>
                        {r.failed.length
                          ? r.failed.map((u: any) => (
                              <span className="qa-sub" key={u.key}>
                                {u.text}
                                {u.reason
                                  ? ` (${QA_REASON_LABELS[u.reason] ?? u.reason})`
                                  : ''}
                              </span>
                            ))
                          : '–'}
                      </td>
                      <td className="qa-note">
                        {r.comment || '–'}
                        <span className="cx-faint qa-sub">{r.auditorName}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No audits match in this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
        </>
      ) : (
        <p className="cx-muted">Loading the audits…</p>
      )}
    </section>
  )
}

/* --- ta — the basis toggle ------------------------------------------------------ */
function BasisSeg({
  basis: t,
  onChange: n,
}: {
  basis: string
  onChange: (basis: string) => void
}) {
  return (
    <Seg
      name="qa-basis"
      value={t}
      onChange={n}
      options={[
        { value: 'interaction', label: 'By interaction date' },
        { value: 'audit', label: 'Audited in period' },
      ]}
      aria-label="Count audits by"
    />
  )
}

/* --- gl — the page -------------------------------------------------------------- */
export function QualityAnalyticsPage({ route }: { route: { title: string } }) {
  const [n, setScope] = useState({ grain: 'week', period: '', basis: 'interaction' })
  const { data: a, error: s, reload: i } = useSe(() =>
    P.analyticsPage(n.grain, n.period, n.basis)
  )
  const [c, l] = useState<any>(null)
  const [p, m] = useState(false)

  const r = (o: string, h: string, b = n.basis) => {
    setScope({ grain: o, period: h, basis: b })
    l(null)
    i()
  }
  const u = (o: any) => {
    l(o)
    requestAnimationFrame(() =>
      document.getElementById('qa-drill-h')?.focus()
    )
  }
  const d = a?.grain ?? n.grain

  return (
    <QaPage
      route={route}
      d={a}
      error={s}
      reload={i}
      sub="Scores use the random daily sample, each agent counted once; other bases are shown apart, and disputed audits return when decided."
    >
      {a ? (
        <>
          <div className="cx-filters">
            <Seg
              name="qa-grain"
              value={d}
              onChange={(o) => r(o, '')}
              options={[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
              aria-label="Period length"
            />
            <Select
              className="qa-narrow"
              aria-label="Period"
              value={a.period}
              onChange={(o) => r(d, o.currentTarget.value)}
            >
              {a.periods.map((o: string) => (
                <option value={o} key={o}>
                  {qaPeriodLabel(a, o)}
                </option>
              ))}
            </Select>
            <BasisSeg
              basis={a.basis ?? 'interaction'}
              onChange={(o) => r(d, a.period, o)}
            />
            <Button
              variant="quiet"
              aria-expanded={p}
              onClick={() => m(!p)}
            >
              How scores work
            </Button>
            <a className="cx-btn cx-btn--quiet" href="#/quality-scores">
              Team scores for any dates
            </a>
          </div>
          <p className="cx-faint qa-basisnote">
            {qaBasisNote(a.basis ?? 'interaction', a.fallbackDates ?? 0)}
            {a.grain === 'week'
              ? ` Weeks run ${a.weekStartsOn === 1 ? 'Monday to Sunday' : 'Sunday to Saturday'}, like the audit quota.`
              : ''}
          </p>
          {p ? (
            <p className="cx-muted">
              Each score has a 95% range from its audits. Low confidence (under
              10 audits, or wider than ±5) is greyed; a score is coloured from
              16 audits; an arrow only when the change beats both ranges. A run
              of identical scores gets a cautious range, not ±0.
            </p>
          ) : null}
          {c ? (
            <Drill
              key={`${c.agent ?? ''}|${c.question ?? ''}`}
              scope={{
                grain: a.grain,
                period: a.period,
                basis: a.basis,
                label: qaPeriodLabel(a),
              }}
              pick={c}
              open={u}
              close={() => l(null)}
            />
          ) : null}
          <div className={p ? undefined : 'qa-hints-off'}>
            <HealthHead d={a} />
            <Attention d={a} open={u} />
            <Agents d={a} open={u} />
            <Columns d={a} />
            <Questions d={a} open={u} />
            <ByChannel d={a} />
            <NonTicket d={a} />
            <details className="qa-more">
              <summary>
                Coaching loop, team leads, agent spread and questions failed
                for outside reasons
              </summary>
              <Coaching d={a} open={u} />
              <TeamLeads d={a} />
              <Spread d={a} />
              <Outside d={a} />
            </details>
          </div>
          <Extras d={a} />
        </>
      ) : null}
    </QaPage>
  )
}
