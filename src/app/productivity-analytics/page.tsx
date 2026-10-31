'use client'

import { Fragment, useState } from 'react'
import {
  Chip,
  LinesSkeleton,
  LoadError,
  PageHead,
  Section,
} from '@/components/shell/ui'
import {
  Ba,
  CalibrationChart,
  fetchJson,
  G,
  HeatGrid,
  T,
  Tn,
  useSe,
} from '@/components/prod/pv-shared'

/**
 * Productivity analytics — verbatim port of the legacy `Fa` page: agents table,
 * per-TL flag review medians, disputes, 4-week Tn trend, Na heatmap and ja
 * calibration histogram (admin only; the API omits them for TLs).
 */

const ce = {
  analytics: (week: string) =>
    fetchJson(`/api/prod/analytics${week ? `?week=${week}` : ''}`),
}

interface Analytics {
  week: string
  weeks: string[]
  thisWeek: string
  isAdmin: boolean
  rule: { x: number; windowMin: number }
  agents: {
    email: string
    name: string
    loggedMin: number
    idleRawMin: number
    idleEffMin: number
    idleDeltaMin: number
    idleEffPct: number | null
    prodRawPct: number | null
    prodEffPct: number | null
    deltaPp: number | null
    bandChange: string
  }[]
  tls: {
    tlEmail: string
    name: string
    raised: number
    acceptedPct: number | null
    revertedPct: number | null
    autoPct: number | null
    pendingPct: number | null
    disputesPct: number | null
    medianHoursToDecision: number | null
    medianOpenSec: number | null
    mix: Record<string, number>
    channelMatchPct: number | null
  }[]
  tlMedian: {
    raised: number
    acceptedPct: number | null
    revertedPct: number | null
    autoPct: number | null
    pendingPct: number | null
    disputesPct: number | null
    medianHoursToDecision: number | null
    medianOpenSec: number | null
    channelMatchPct: number | null
  } | null
  disputes: {
    email: string
    name: string
    tlName: string
    raised: number
    upheldPct: number | null
    medianDaysToResolve: number | null
  }[]
  trend: import('@/components/prod/pv-shared').TrendPoint[]
  heatmap?: (number | null)[][]
  calibration?: { idle: Record<string, number>; working: Record<string, number> }
}

const ROUTE = { title: 'Productivity analytics' }

export default function ProductivityAnalyticsPage() {
  const [week, setWeek] = useState('')
  const { data: s, error, reload } = useSe<Analytics>(() => ce.analytics(week))
  const shift = (d: number) => {
    if (!s) return
    const p = new Date(`${s.week}T00:00:00Z`)
    p.setUTCDate(p.getUTCDate() + d * 7)
    setWeek(p.toISOString().slice(0, 10))
    setTimeout(reload, 0)
  }
  const aside = s ? (
    <div className="pv-week">
      <button type="button" className="cx-btn" onClick={() => shift(-1)}>
        Previous week
      </button>
      <span>Week of {s.week}</span>
      <button
        type="button"
        className="cx-btn"
        disabled={s.week >= s.thisWeek}
        onClick={() => shift(1)}
      >
        Next week
      </button>
    </div>
  ) : null
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!s && !error}>
      <PageHead
        title={ROUTE.title}
        aside={aside}
        sub="Raw is the status as logged; after review is the suggested status until a team lead reviews, then the reviewed one. Reclassifying IDLE time adds it to the time Productivity % divides by, so % can go down."
      />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!s && !error ? <LinesSkeleton lines={6} /> : null}
      {s ? (
        <Fragment>
          <Section id="pa-a" title="Idle and productivity, as logged and after review">
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Agent</th>
                    <th scope="col">Logged</th>
                    <th scope="col">Idle as logged</th>
                    <th scope="col">Idle after review</th>
                    <th scope="col">Difference</th>
                    <th scope="col">Idle % of logged</th>
                    <th scope="col">Productivity as logged</th>
                    <th scope="col">After review</th>
                    <th scope="col">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {s.agents.length ? (
                    s.agents.map((h) => (
                      <tr key={h.email}>
                        <td>{h.name}</td>
                        <td className="cx-num">{G(h.loggedMin)}</td>
                        <td className="cx-num">{G(h.idleRawMin)}</td>
                        <td className="cx-num">{G(h.idleEffMin)}</td>
                        <td className="cx-num">{G(h.idleDeltaMin)}</td>
                        <td className="cx-num">{T(h.idleEffPct, '%')}</td>
                        <td className="cx-num">{T(h.prodRawPct, '%')}</td>
                        <td className="cx-num">{T(h.prodEffPct, '%')}</td>
                        <td>
                          {h.deltaPp === null ? '–' : `${h.deltaPp > 0 ? '+' : ''}${h.deltaPp} pp`}
                          {h.bandChange ? (
                            <span className="pv-sub">
                              <Chip status="warn">{h.bandChange}</Chip>
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9}>No logged time in this week.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
          <Section
            id="pa-t"
            title="How flags were reviewed, by team lead"
            hint="Flags raised in the week"
          >
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Team lead</th>
                    <th scope="col">Raised</th>
                    <th scope="col">Accepted</th>
                    <th scope="col">Reverted</th>
                    <th scope="col">Auto (missed)</th>
                    <th scope="col">Pending</th>
                    <th scope="col">Disputed</th>
                    <th scope="col">Hours to decide</th>
                    <th scope="col">Seconds open</th>
                    <th scope="col">Statuses picked</th>
                    <th scope="col">Matches channel</th>
                  </tr>
                </thead>
                <tbody>
                  {s.tls.length ? (
                    s.tls.map((h) => (
                      <tr key={h.tlEmail}>
                        <td>{h.name}</td>
                        <td className="cx-num">{h.raised}</td>
                        <td className="cx-num">{T(h.acceptedPct, '%')}</td>
                        <td className="cx-num">{T(h.revertedPct, '%')}</td>
                        <td className="cx-num">{T(h.autoPct, '%')}</td>
                        <td className="cx-num">{T(h.pendingPct, '%')}</td>
                        <td className="cx-num">{T(h.disputesPct, '%')}</td>
                        <td className="cx-num">{T(h.medianHoursToDecision)}</td>
                        <td className="cx-num">{T(h.medianOpenSec)}</td>
                        <td>{Ba(h.mix)}</td>
                        <td className="cx-num">{T(h.channelMatchPct, '%')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11}>No flags in this week.</td>
                    </tr>
                  )}
                  {s.tlMedian ? (
                    <tr className="pv-median">
                      <td>Median of team leads</td>
                      <td className="cx-num">{T(s.tlMedian.raised)}</td>
                      <td className="cx-num">{T(s.tlMedian.acceptedPct, '%')}</td>
                      <td className="cx-num">{T(s.tlMedian.revertedPct, '%')}</td>
                      <td className="cx-num">{T(s.tlMedian.autoPct, '%')}</td>
                      <td className="cx-num">{T(s.tlMedian.pendingPct, '%')}</td>
                      <td className="cx-num">{T(s.tlMedian.disputesPct, '%')}</td>
                      <td className="cx-num">{T(s.tlMedian.medianHoursToDecision)}</td>
                      <td className="cx-num">{T(s.tlMedian.medianOpenSec)}</td>
                      <td />
                      <td className="cx-num">{T(s.tlMedian.channelMatchPct, '%')}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Section>
          <Section id="pa-d" title="Disputes, last 4 weeks">
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Agent</th>
                    <th scope="col">Team lead</th>
                    <th scope="col">Raised</th>
                    <th scope="col">Upheld</th>
                    <th scope="col">Days to resolve</th>
                  </tr>
                </thead>
                <tbody>
                  {s.disputes.length ? (
                    s.disputes.map((h) => (
                      <tr key={h.email}>
                        <td>{h.name}</td>
                        <td>{h.tlName}</td>
                        <td className="cx-num">{h.raised}</td>
                        <td className="cx-num">{T(h.upheldPct, '%')}</td>
                        <td className="cx-num">{T(h.medianDaysToResolve)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>No disputes.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
          <Section id="pa-w" title="Last 4 weeks">
            <Tn points={s.trend} />
          </Section>
          {s.heatmap ? (
            <Section
              id="pa-h"
              title="Idle after review by hour and weekday"
              hint="Quiet-hour idle is roster slack; busy-hour idle is behaviour"
            >
              <HeatGrid grid={s.heatmap} />
            </Section>
          ) : null}
          {s.calibration ? (
            <Section
              id="pa-c"
              title={`Calibration of X (now ${s.rule.x} in ${s.rule.windowMin} minutes)`}
            >
              <CalibrationChart cal={s.calibration} windowMin={s.rule.windowMin} />
            </Section>
          ) : null}
        </Fragment>
      ) : null}
    </section>
  )
}
