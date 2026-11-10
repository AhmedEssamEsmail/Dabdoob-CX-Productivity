'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* extracted from quality-analytics-page.tsx: the chart/trend renderers
 * (il sparkline, _n columns chart, sl score-over-time, ll agent spread)
 * and the coverage machinery (ml totals, xn status line, pl coverage).
 */
import { useState } from 'react'
import {
  Chip,
  QaSection,
  qaBand,
  qaCovTone,
  qaDayName,
  qaDeltaSentence,
  qaMonthLabel,
  qaVerdictTone,
  qaWeekKeyLabel,
} from './qa-shared'
import { useTip } from '@/features/shared/components/shell/ui'
import { Empty, Seg, Select } from '@/features/shared/components/ui'
import type { ChipStatus } from '@/features/shared/components/ui/Chip'

const qaPerDay = (t: any, n: string): number =>
  n === 'queued' ? t.offerPerDay : t.perDay

/* --- il — the agent sparkline ------------------------------------------- */
export function SparkChart({
  d: t,
  h: n,
  name: a,
}: {
  d: any
  h: any[] | undefined
  name: string
}) {
  const s = (n ?? [])
    .map((d: any, o: number) => (d.avg == null ? null : { i: o, v: d.avg }))
    .filter((d: any) => d !== null) as { i: number; v: number }[]
  if (s.length < 2) return <span className="cx-faint">–</span>
  const i = 84,
    c = 24,
    l = Math.min(60, ...s.map((d) => d.v)),
    p = (d: number) => 3 + (d * (i - 6)) / Math.max(1, (n ?? []).length - 1),
    m = (d: number) => 3 + ((100 - d) * (c - 6)) / (100 - l),
    r = s[s.length - 1],
    u = `${a} by ${t.grain}: ${(n ?? [])
      .map(
        (d: any, o: number) =>
          `${qaWeekKeyLabel(t, t.history[o]?.period ?? '')} ${
            d.avg == null ? 'none' : `${d.avg}% (${d.audits})`
          }`
      )
      .join(', ')}`
  return (
    <svg
      className="qa-spark"
      viewBox={`0 0 ${i} ${c}`}
      role="img"
      aria-label={u}
    >
      <title>{u}</title>
      <polyline
        points={s.map((d) => `${p(d.i)},${m(d.v)}`).join(' ')}
        fill="none"
      />
      <circle cx={p(r.i)} cy={m(r.v)} r={2.5} />
    </svg>
  )
}

/* --- _n — a columns chart -------------------------------------------------- */
function ColsChart({
  title: t,
  grain: n,
  cols: a,
  cells: s,
}: {
  title: string
  grain: string
  cols: any
  cells: any[]
}) {
  const { ref: i, tipFor: c, tipEl: l } = useTip<HTMLElement>()
  const p = 560,
    m = 210,
    r = 32,
    u = 8,
    d = 20,
    o = 40,
    h = a.periods.length,
    b = (p - r - u) / h,
    x = Math.min(44, b * 0.6),
    f = (_: number) =>
      d + ((100 - Math.max(0, Math.min(100, _))) * (m - d - o)) / 100,
    g = (_: string) => (n === 'week' ? _.slice(5) : qaMonthLabel(_)),
    y = s.some((_) => _?.avg != null && _.audits > 0)

  return (
    <figure className="qa-trend qa-cols cc-chart" ref={i as any}>
      <figcaption className="qa-cols__title">{t}</figcaption>
      {l}
      <div className="qa-trend__scroll">
        <svg viewBox={`0 0 ${p} ${m}`} role="group" aria-label={t}>
          {[0, 50, 100].map((_) => (
            <g key={_}>
              <line
                x1={r}
                x2={p - u}
                y1={f(_)}
                y2={f(_)}
                className="qa-trend__grid"
              />
              <text
                x={r - 6}
                y={f(_) + 4}
                textAnchor="end"
                className="qa-trend__lbl"
              >
                {_}
              </text>
            </g>
          ))}
          {a.periods.map((_: string, T: number) => {
            const k = s[T]
            const C = r + b * T + b / 2
            const O = k != null && k.avg != null && k.audits > 0
            return (
              <g key={_}>
                {O ? (
                  <>
                    <rect
                      className={`cc-sweep-col qa-dot--${qaBand(k.avg, false)}${k.history * 2 > k.audits ? ' qa-cols__hist' : ''}`}
                      x={C - x / 2}
                      y={f(k.avg)}
                      width={x}
                      height={f(0) - f(k.avg)}
                      rx={2}
                      tabIndex={0}
                      role="img"
                      {...c(
                        `${n === 'week' ? `Week of ${_}` : _}: ${k.avg}% from ${k.audits} audits (${k.history} old-form history, ${k.audits - k.history} random)`
                      )}
                    />
                    <text
                      x={C}
                      y={f(k.avg) - 5}
                      textAnchor="middle"
                      className="qa-trend__lbl qa-cols__val"
                    >
                      {Math.round(k.avg)}
                    </text>
                  </>
                ) : null}
                <text
                  x={C}
                  y={m - 22}
                  textAnchor="middle"
                  className="qa-trend__lbl"
                >
                  {g(_)}
                </text>
                <text
                  x={C}
                  y={m - 6}
                  textAnchor="middle"
                  className="qa-trend__lbl qa-trend__n"
                >
                  {O ? k.audits : '–'}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      {y ? null : (
        <Empty
          className="qa-cols__none"
          title={`No audits in these ${n === 'week' ? 'weeks' : 'months'}.`}
        />
      )}
    </figure>
  )
}

/* --- sl — score over time -------------------------------------------------- */
export function Columns({ d: t }: { d: any }) {
  const [n, a] = useState('')
  const s = t.columns
  if (!s) return null
  const i = new Map<string, string>()
  ;[...s.week.agents, ...s.month.agents].forEach((p: any) =>
    i.set(p.key, p.label)
  )
  const c = (p: any) =>
    n
      ? p.agents.find((m: any) => m.key === n)?.cells ??
        p.periods.map(() => null)
      : p.team
  const l = n ? i.get(n) ?? n : 'Team'

  return (
    <QaSection
      id="qa-cols-h"
      title="Score over time"
      hint="Plain average score of the audits in each period; under each column, how many audits. No column means no audits that period."
    >
      <div className="qa-cols__pick">
        <label className="cx-label" htmlFor="qa-cols-agent">
          Show
        </label>
        <Select
          id="qa-cols-agent"
          value={n}
          onChange={(p) => a(p.currentTarget.value)}
        >
          <option value="">Whole team</option>
          {[...i]
            .sort((p, m) => p[1].localeCompare(m[1]))
            .map(([p, m]) => (
              <option value={p} key={p}>
                {m}
              </option>
            ))}
        </Select>
      </div>
      <div className="qa-cols__grid">
        <ColsChart
          title={`${l} score, week over week`}
          grain="week"
          cols={s.week}
          cells={c(s.week)}
        />
        <ColsChart
          title={`${l} score, month over month`}
          grain="month"
          cols={s.month}
          cells={c(s.month)}
        />
      </div>
      <p className="qa-trend__legend">
        Includes old-form history audits (pale column: mostly history). Not the
        team score above: every audit counts once, no 10-audit rule.
      </p>
    </QaSection>
  )
}

/* --- ll — agents against the team (spread) ------------------------------------- */
export function Spread({ d: t }: { d: any }) {
  const { ref: n, tipFor: a, tipEl: s } = useTip<HTMLElement>()
  const i = t.byAgent.filter((g: any) => g.avg !== null)
  if (!i.length) return null
  const c = t.health.score
  const l = 22,
    p = 150,
    m = 76,
    r = 560,
    u = 20,
    d = u + i.length * l + 22,
    o = Math.max(
      0,
      Math.floor(
        Math.min(...i.map((g: any) => g.avg - (g.margin ?? 0)), c ?? 100) / 10
      ) * 10
    ),
    h = 100,
    b = (g: number) =>
      p + ((Math.min(h, Math.max(o, g)) - o) * (r - p - m)) / (h - o)
  const x: Record<string, number> = { ok: 0, warn: 0, bad: 0 }
  i.forEach((g: any) => {
    if (g.verdict) x[qaBand(g.avg, false)]++
  })
  const f = x.ok + x.warn + x.bad

  return (
    <QaSection
      id="qa-spread-h"
      title="Agents against the team"
      hint={`Each agent's random-audit score with its 95% range, lowest first; the dashed line is the team score. Grey dot: under 16 audits, no verdict yet. ${f ? `Of the ${f} agents with a verdict: ${x.ok} green, ${x.warn} amber, ${x.bad} red.` : 'No agent has 16 audits yet.'}`}
    >
      <figure className="qa-trend qa-spread cc-chart" ref={n as any}>
        {s}
        <svg
          viewBox={`0 0 ${r} ${d}`}
          role="group"
          aria-label="Agent quality scores against the team score"
        >
          {[o, Math.round((o + h) / 2), h].map((g) => (
            <g key={g}>
              <line
                x1={b(g)}
                x2={b(g)}
                y1={u - 4}
                y2={d - 18}
                className="qa-trend__grid"
              />
              <text
                x={b(g)}
                y={d - 4}
                textAnchor="middle"
                className="qa-trend__lbl"
              >
                {g}
              </text>
            </g>
          ))}
          {c !== null ? (
            <g>
              <line
                x1={b(c)}
                x2={b(c)}
                y1={u - 4}
                y2={d - 18}
                className="qa-spread__team"
              />
              <text
                x={b(c)}
                y={u - 8}
                textAnchor="middle"
                className="qa-trend__lbl"
              >
                Team {c}%
              </text>
            </g>
          ) : null}
          {i.map((g: any, y: number) => {
            const _ = u + y * l + l / 2
            const T = qaVerdictTone(g)
            return (
              <g className={g.verdict ? undefined : 'qa-spread__thin'} key={g.key}>
                <text
                  x={p - 8}
                  y={_ + 4}
                  textAnchor="end"
                  className="qa-trend__lbl"
                >
                  {g.label.length > 20 ? g.label.slice(0, 19) + '…' : g.label}
                </text>
                {g.margin !== null ? (
                  <line
                    className="qa-spread__ci"
                    x1={b(g.avg - g.margin)}
                    x2={b(g.avg + g.margin)}
                    y1={_}
                    y2={_}
                  />
                ) : null}
                <circle
                  className={`cc-sweep-fade qa-dot--${T}`}
                  cx={b(g.avg)}
                  cy={_}
                  r={5}
                  tabIndex={0}
                  role="img"
                  {...a(
                    `${g.label}: ${g.avg}%${g.margin !== null ? ` ±${g.margin}` : ''} from ${g.audits} audits${c !== null ? `, ${qaDeltaSentence(g.avg, c).replace('on the period before', 'against the team').replace('same as the period before', 'level with the team')}` : ''}`
                  )}
                />
                <text x={r - m + 8} y={_ + 4} className="qa-trend__lbl">
                  {g.avg}% · {g.audits}
                </text>
              </g>
            )
          })}
        </svg>
        <figcaption className="qa-trend__legend">
          <span>Right: score · audits.</span>
        </figcaption>
      </figure>
    </QaSection>
  )
}

/* --- ml / xn / pl — the coverage machinery -------------------------------------- */
function CoverageTotals({ c: t }: { c: any }) {
  return (
    <div className="cx-panel cx-tablewrap">
      <table className="cx-table">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Audited</th>
            <th scope="col">Queued</th>
            <th scope="col">Quota</th>
          </tr>
        </thead>
        <tbody>
          {t.days
            .map((n: string, a: number) => (
              <tr key={n}>
                <td>
                  {qaDayName(n)} {n}
                </td>
                <td>
                  <Chip status={qaCovTone(t.totals.audited[a], t.totals.target[a])}>
                    {t.totals.audited[a]}
                  </Chip>
                </td>
                <td className="cx-num">{t.totals.queued[a]}</td>
                <td className="cx-num">{t.totals.target[a]}</td>
              </tr>
            ))
            .reverse()}
        </tbody>
      </table>
    </div>
  )
}

/** xn — the per-agent status line (verbatim). */
function xn(t: any): [string, ChipStatus] {
  const n = t.audited.slice(-7).reduce((a: number, s: number) => a + s, 0)
  return t.queuedTotal
    ? t.auditedTotal
      ? n < t.perWeek
        ? [`${n} of ${t.perWeek} in 7 days`, 'warn']
        : [`${n} of ${t.perWeek} in 7 days`, 'ok']
      : ['Queued, never audited', 'bad']
    : ['Never queued', 'bad']
}

export function Coverage({ c: t }: { c: any }) {
  const [n, a] = useState('queued')
  const [s, i] = useState('')
  if (t.error)
    return (
      <QaSection id="qa-cov-h" title="Samples per agent per day">
        <p className="cx-error">
          The Queue Log could not be read: {t.error}
        </p>
      </QaSection>
    )
  if (!t.agents.length)
    return (
      <QaSection id="qa-cov-h" title="Samples per agent per day">
        <Empty
          title={`No agents on the roster and nothing in the Queue Log for the last ${t.days.length} days.`}
        />
      </QaSection>
    )
  const c = t.agents.filter((m: any) => xn(m)[1] !== 'ok').length
  const l = t.agents.find((m: any) => m.expected && !m.actionPlan)?.offerPerDay ?? 0
  const p = (
    <Seg
      className="qa-view"
      name="qa-cov-count"
      value={n}
      onChange={a}
      options={[
        { value: 'queued', label: 'Queued' },
        { value: 'audited', label: 'Audited' },
      ]}
      aria-label="Count"
    />
  )
  return (
    <>
      <QaSection
        id="qa-cov-h"
        title="Samples per agent per day"
        hint={
          n === 'queued'
            ? `Last ${t.days.length} days: items added to the queue each day (Queued Date), whatever happened to them later, against the daily offer of ${l}.`
            : `Last ${t.days.length} days: audits done each day, against the daily quota. ${c} of ${t.agents.length} agents below quota.`
        }
      >
        {p}
        {n === 'queued' ? (
          <p className="qa-cov-tip cx-faint" aria-live="polite">
            {s || 'Point at or tab to a day under the offer to see why.'}
          </p>
        ) : null}
        <div className="cx-panel cx-tablewrap">
          <table className="cx-table qa-cov">
            <thead>
              <tr>
                <th scope="col" className="qa-cov__name">
                  Agent
                </th>
                {t.days.map((m: string) => (
                  <th
                    scope="col"
                    className="qa-cov__day"
                    title={`${qaDayName(m)} ${m}`}
                    key={m}
                  >
                    <span>{qaDayName(m).slice(0, 2)}</span>
                    {+m.slice(8)}
                  </th>
                ))}
                <th scope="col">Audited</th>
                <th scope="col">Queued</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {t.agents.map((m: any) => {
                const [r, u] = xn(m)
                const d = qaPerDay(m, n)
                return (
                  <tr key={m.key}>
                    <th scope="row" className="qa-cov__name">
                      {m.name}
                      <span className="cx-faint qa-sub">
                        {[
                          m.tlName,
                          m.actionPlan ? `action plan, ${m.perDay} a day` : '',
                          m.expected ? '' : 'not on the agent roster',
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </th>
                    {m[n].map((o: number, h: number) => {
                      const b = n === 'queued' ? m.reasons?.[h] : ''
                      const x = `${m.name}, ${qaDayName(t.days[h])} ${t.days[h]}: ${m.queued[h]} queued (offer ${m.offerPerDay}), ${m.audited[h]} audited (quota ${m.perDay})${b ? '. ' + b : ''}`
                      return (
                        <td
                          className="qa-cov__cell"
                          data-l={qaCovTone(o, d)}
                          data-noq={
                            n === 'audited' && !m.queued[h] ? 'true' : undefined
                          }
                          title={x}
                          tabIndex={0}
                          aria-label={x}
                          onMouseEnter={b ? () => i(x) : undefined}
                          onFocus={b ? () => i(x) : undefined}
                          key={t.days[h]}
                        >
                          {o}
                        </td>
                      )
                    })}
                    <td className="cx-num">{m.auditedTotal}</td>
                    <td className="cx-num">
                      {m.queuedTotal}
                      {m.passed || m.expired ? (
                        <span className="cx-faint qa-sub">
                          {m.passed} passed, {m.expired} expired
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <Chip status={u}>{r}</Chip>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="qa-cov-legend cx-faint">
          <span className="qa-cov__cell" data-l="bad">
            0
          </span>{' '}
          none
          <span className="qa-cov__cell" data-l="warn">
            2
          </span>{' '}
          below the daily {n === 'queued' ? 'offer' : 'quota'}
          <span className="qa-cov__cell" data-l="ok">
            {n === 'queued' ? l : 4}
          </span>{' '}
          {n === 'queued' ? 'offer' : 'quota'} met
          {n === 'audited' ? (
            <>
              <span className="qa-cov__cell" data-l="bad" data-noq="true">
                0
              </span>{' '}
              striped: nothing was queued for them that day
            </>
          ) : null}
        </p>
      </QaSection>
      <QaSection id="qa-cov-t-h" title="All agents: audits per day against the quota">
        <CoverageTotals c={t} />
      </QaSection>
    </>
  )
}
