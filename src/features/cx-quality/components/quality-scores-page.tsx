'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality quality-scores page
 * (.devin/work/extract/quality/pages/quality-scores.closure.js):
 *   $l → QualityScoresPage, Cl → TrendChart, Sl → SideBars, Al → ScoreCell,
 *   Tl → BreakdownTable, ea → DrillSection (qa-shared), ta → BasisSeg (qa-shared),
 *   wl/Ua/ql → hash params, ca/ia/vl/He/pe/dt → date helpers (qa-shared),
 *   M/_e → sort (qa-shared), Pe/bn/Ot/Me/ye/kl/na → vocabulary (qa-shared).
 */
import { useRef, useState } from 'react'
import { Chip, useTip } from '@/features/shared/components/shell/ui'
import { pageParams } from '@/features/shared/shell/gates'
import {
  BasisSeg,
  DrillSection,
  P,
  QaLink,
  QaPage,
  QA_BASIS_LABELS,
  QA_LEVELS,
  QA_PRESETS,
  QA_REASON_LABELS,
  QA_TREND_ARROW,
  SortTh,
  qaBand,
  qaBasisNote,
  qaDayLabel,
  qaDeltaLabel,
  qaIsDay,
  qaMargin,
  qaPct,
  qaRangeFor,
  qaToday,
  useQaSort,
  useSe,
} from './qa-shared'

/* --- Cl — the trend line chart with the 95% band --------------------------- */
function TrendChart({ d, compare }: { d: any; compare: boolean }) {
  const { ref: a, tipFor: s, tipEl: i } = useTip<HTMLElement>()
  const c = d.series
  const l = c.length
  const p = 640,
    m = 230,
    r = 34,
    u = 10,
    dd = 12,
    o = 42
  const h = c
    .flatMap((v: any) => [
      v.score !== null ? v.score - (v.margin ?? 0) : null,
      compare ? v.prevScore : null,
    ])
    .filter((v: any) => v !== null)
  const b = Math.max(
    0,
    Math.min(80, Math.floor((h.length ? Math.min(...h) : 80) / 10) * 10)
  )
  const x = (v: number) => r + (l <= 1 ? (p - r - u) / 2 : (v * (p - r - u)) / (l - 1))
  const f = (v: number) =>
    dd + ((100 - Math.max(b, Math.min(100, v))) * (m - dd - o)) / (100 - b)
  const g = (v: (A: number) => number | null) =>
    c
      .map((w: any, A: number) =>
        v(A) === null
          ? ''
          : `${A && v(A - 1) !== null ? 'L' : 'M'}${x(A).toFixed(1)} ${f(v(A) as number).toFixed(1)}`
      )
      .join('')
  const y: number[][] = []
  c.forEach((v: any, w: number) => {
    if (v.score === null || v.margin === null) return
    const A = y[y.length - 1]
    if (A && A[A.length - 1] === w - 1) A.push(w)
    else y.push([w])
  })
  const _ = (v: number[], w: number) =>
    v
      .map((A) => `${x(A).toFixed(1)} ${f(c[A].score + w * c[A].margin).toFixed(1)}`)
      .join('L')
  const T = y
    .filter((v) => v.length > 1)
    .map((v) => `M${_(v, 1)}L${_([...v].reverse(), -1)}Z`)
    .join('')
  const k = (v: string) =>
    d.bucket === 'month'
      ? new Date(v + '-01T00:00:00Z').toLocaleString('en-GB', {
          month: 'short',
          timeZone: 'UTC',
        })
      : `${+v.slice(8)} ${new Date(v + 'T00:00:00Z').toLocaleString('en-GB', {
          month: 'short',
          timeZone: 'UTC',
        })}`
  const C = Math.max(1, Math.ceil(l / 10))
  const O = c.filter((v: any) => v.score !== null).length
  return (
    <figure className="qa-trend qa-line cc-chart" ref={a as any}>
      {i}
      <div className="qa-trend__scroll">
        <svg
          viewBox={`0 0 ${p} ${m}`}
          role="group"
          aria-label={`Team score by ${d.bucket}, ${qaDayLabel(d.from)} to ${qaDayLabel(d.to)}`}
        >
          {[b, (b + 100) / 2, 100].map((v) => (
            <g key={v}>
              <line x1={r} x2={p - u} y1={f(v)} y2={f(v)} className="qa-trend__grid" />
              <text x={r - 6} y={f(v) + 4} textAnchor="end" className="qa-trend__lbl">
                {v}
              </text>
            </g>
          ))}
          {b < 90 ? (
            <line x1={r} x2={p - u} y1={f(90)} y2={f(90)} className="qa-line__target" />
          ) : null}
          {T ? <path d={T} className="qa-line__band" /> : null}
          {compare ? <path d={g((v) => c[v].prevScore)} className="qa-line__prev" /> : null}
          <path d={g((v) => c[v].score)} className="qa-line__cur" />
          {c.map((v: any, w: number) => (
            <g key={v.key}>
              {v.score !== null ? (
                <circle
                  cx={x(w)}
                  cy={f(v.score)}
                  r={4}
                  className={`qa-dot--${qaBand(v.score, false)}`}
                  tabIndex={0}
                  role="img"
                  {...s(
                    `${v.key}: ${v.score}% ${qaMargin(v.margin)} from ${v.audits} audits${compare && v.prevScore !== null ? `; before ${v.prevScore}%` : ''}`
                  )}
                />
              ) : null}
              {w % C === 0 || w === l - 1 ? (
                <text x={x(w)} y={m - 24} textAnchor="middle" className="qa-trend__lbl">
                  {k(v.key)}
                </text>
              ) : null}
              {w % C === 0 || w === l - 1 ? (
                <text x={x(w)} y={m - 8} textAnchor="middle" className="qa-trend__lbl qa-trend__n">
                  {v.audits ? `n=${v.audits}` : '–'}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="qa-trend__legend">
        <span className="qa-trend__key qa-line__k-cur">
          Team score by {d.bucket}, band = 95% range
        </span>
        {compare ? (
          <span className="qa-trend__key qa-line__k-prev">
            {qaDayLabel(d.prevFrom)} to {qaDayLabel(d.prevTo)}
          </span>
        ) : null}
        <span>
          {O < l ? `Points under 10 audits are left out (${l - O} of ${l}).` : ''}
        </span>
      </figcaption>
    </figure>
  )
}

/* --- Sl — "Why points were lost" + "Not in the score" side panels ------------ */
function SideBars({ d }: { d: any }) {
  const n = ['agent', 'process', 'product', 'kb'].filter((s) => d.reasons[s])
  const a = n.reduce((s, i) => s + d.reasons[i], 0)
  return (
    <section className="cx-section qs-side" aria-labelledby="qs-why-h">
      <div className="cx-panel">
        <h2 className="cx-section__title" id="qs-why-h">
          Why points were lost
        </h2>
        {a ? (
          <ul className="qs-bars">
            {n.map((s) => (
              <li key={s}>
                <span>{QA_REASON_LABELS[s]}</span>
                <span className="qs-track" aria-hidden="true">
                  <i style={{ inlineSize: `${(d.reasons[s] / a) * 100}%` }} />
                </span>
                <span className="cx-num">
                  {Math.round((d.reasons[s] / a) * 100)}%{' '}
                  <span className="cx-faint">({d.reasons[s]})</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cx-faint">No tagged fails in these dates.</p>
        )}
      </div>
      <div className="cx-panel">
        <h2 className="cx-section__title">Not in the score</h2>
        {d.others.length ? (
          <ul className="qs-others">
            {d.others.map((s: any) => (
              <li key={s.basis}>
                {QA_BASIS_LABELS[s.basis]}: n={s.audits}, average {qaPct(s.avg)}
                {s.critical ? `, ${s.critical} critical` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="cx-faint">Every audit in these dates is from the random sample.</p>
        )}
      </div>
    </section>
  )
}

/* --- Al — the score cell (chip + margin + n + low sample) ------------------- */
function ScoreCell({ r, minN }: { r: any; minN: number }) {
  if (r.score === null) return <span className="cx-faint">–</span>
  const a =
    r.randomAudits && r.randomAudits !== r.audits
      ? `random only: ${r.randomScore}% (n=${r.randomAudits})`
      : ''
  return (
    <span title={a || undefined}>
      <Chip status={r.verdict ? qaBand(r.score, false) : 'neutral'}>{r.score}%</Chip>{' '}
      <span className="qa-range cx-num">{qaMargin(r.margin)}</span>
      <span className="cx-faint qa-sub">
        n={r.audits}
        {r.lowSample ? (
          <>
            {' '}
            <span className="qs-tag" title={`Under ${minN} audits: read with care`}>
              low sample
            </span>
          </>
        ) : (
          ''
        )}
        {a ? `; ${a}` : ''}
      </span>
    </span>
  )
}

/* --- Tl — "Who is behind the score" --------------------------------------- */
function BreakdownTable({
  d,
  s,
  set,
  open,
}: {
  d: any
  s: any
  set: (patch: any) => void
  open: (pick: { agent: string; agentName: string }) => void
}) {
  const i =
    s.by === 'tl'
      ? d.byTl
      : s.by === 'channel'
        ? d.byChannel
        : d.byAgent.filter((r: any) => !s.tl || r.tlEmail === s.tl)
  const c = useQaSort({
    name: { get: (r) => r.label, type: 'text' },
    score: { get: (r) => r.score, type: 'num' },
    audits: { get: (r) => r.audits, type: 'num' },
    delta: {
      get: (r) => (r.score !== null && r.prevScore !== null ? r.score - r.prevScore : null),
      type: 'num',
    },
    critical: { get: (r) => r.critical, type: 'num' },
  })
  const l = s.tl
    ? (d.byTl.find((r: any) => r.key === s.tl)?.label ??
      d.byAgent.find((r: any) => r.tlEmail === s.tl)?.tlName ??
      s.tl)
    : ''
  const p = s.by === 'agent' ? d.minN : 10
  const m = s.by === 'agent'
  return (
    <section className="cx-section" aria-labelledby="qs-tbl-h">
      <div className="cx-section__head">
        <h2 className="cx-section__title" id="qs-tbl-h">
          Who is behind the score
        </h2>
        <div className="cx-seg" role="radiogroup" aria-label="Show">
          {QA_LEVELS.map(([r, u]) => (
            <label key={r}>
              <input
                type="radio"
                name="qs-level"
                checked={s.by === r}
                onChange={() => set({ by: r, tl: '' })}
              />
              <span>{u}</span>
            </label>
          ))}
        </div>
      </div>
      {s.tl ? (
        <nav className="qs-crumbs" aria-label="Drill path">
          <QaLink label="All team leads" onClick={() => set({ by: 'tl', tl: '' })} />{' '}
          <span aria-hidden="true">/</span>{' '}
          <span aria-current="page">{l}</span>
        </nav>
      ) : null}
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <SortTh col="name" sort={c}>
                {s.by === 'tl' ? 'Team lead' : s.by === 'channel' ? 'Channel' : 'Agent'}
              </SortTh>
              <SortTh col="score" sort={c}>
                Score
              </SortTh>
              <SortTh col="delta" sort={c}>
                Change
              </SortTh>
              <SortTh col="audits" sort={c}>
                Audits
              </SortTh>
              <SortTh col="critical" sort={c}>
                Critical
              </SortTh>
              {m ? <th scope="col">Loses most to</th> : <th scope="col">Agents</th>}
            </tr>
          </thead>
          <tbody>
            {i.length ? (
              c.apply(i).map((r: any) => (
                <tr key={r.key}>
                  <td>
                    {s.by === 'tl' && r.key !== '(no lead)' ? (
                      <QaLink label={r.label} onClick={() => set({ by: 'agent', tl: r.key })} />
                    ) : m ? (
                      <QaLink
                        label={r.label}
                        onClick={() => open({ agent: r.key, agentName: r.label })}
                      />
                    ) : (
                      r.label
                    )}
                    {m && !s.tl && r.tlName ? (
                      <span className="cx-faint qa-sub">{r.tlName}</span>
                    ) : null}
                  </td>
                  <td>
                    <ScoreCell r={r} minN={p} />
                  </td>
                  <td className="cx-num">
                    {qaDeltaLabel(
                      r.score !== null && r.prevScore !== null
                        ? Math.round((r.score - r.prevScore) * 10) / 10
                        : null,
                      r.trend
                    )}
                  </td>
                  <td className="cx-num">{r.audits}</td>
                  <td className="cx-num">{r.critical || ''}</td>
                  <td>{m ? (r.topReason ? QA_REASON_LABELS[r.topReason] : '–') : (r.agents ?? '')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No random audits in these dates.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* --- Ua/wl/ql — the ?params on the page URL ('#/quality-scores?…' in the
 * legacy; the shim moves them to location.search, which is also the form
 * writeHash keeps so a reload re-applies the same filters) ----------------- */
function readHash(): URLSearchParams {
  return pageParams()
}

function writeHash(t: any) {
  const n = new URLSearchParams({ p: t.preset, from: t.from, to: t.to, by: t.by })
  if (t.tl) n.set('tl', t.tl)
  if (t.agent) n.set('agent', t.agent)
  if (t.basis === 'audit') n.set('basis', 'audit')
  history.replaceState(null, '', `${location.pathname || '/quality-scores'}?${n}`)
}

function initialState() {
  const t = readHash(),
    n = qaToday(),
    a = QA_PRESETS.some(([l]) => l === t.get('p'))
      ? (t.get('p') as string)
      : qaIsDay(t.get('from'))
        ? 'custom'
        : 'month',
    [s, i] =
      a === 'custom' && qaIsDay(t.get('from')) && qaIsDay(t.get('to'))
        ? [t.get('from') as string, t.get('to') as string]
        : qaRangeFor(a, n, 0),
    c = ['tl', 'agent', 'channel'].includes(t.get('by') ?? '')
      ? (t.get('by') as string)
      : 'tl'
  return {
    preset: a,
    from: s,
    to: i,
    by: c,
    tl: t.get('tl') ?? '',
    agent: t.get('agent') ?? '',
    basis: t.get('basis') === 'audit' ? 'audit' : 'interaction',
  }
}

/* --- $l — Team scores -------------------------------------------------------- */
export default function QualityScoresPage({ route }: { route: { title: string } }) {
  const [n, a] = useState(initialState)
  const s = useRef(n)
  const { data: i, error: c, reload: l } = useSe(() =>
    P.scoresPage(s.current.from, s.current.to, s.current.basis)
  )
  const [p, m] = useState(true)
  const [r, u] = useState(false)
  const [d, o] = useState({ from: n.from, to: n.to })
  const h = (y: any) => {
    const _ = { ...n, ...y }
    a(_)
    writeHash(_)
    if (_.from !== s.current.from || _.to !== s.current.to || _.basis !== s.current.basis) {
      s.current = _
      l()
    }
  }
  const b = (y: string) => {
    if (y === 'custom') {
      h({ preset: y })
      return
    }
    const [_, T] = qaRangeFor(y, qaToday(), i?.weekStartsOn ?? 0)
    o({ from: _, to: T })
    h({ preset: y, from: _, to: T, agent: '' })
  }
  const x = (y: any) => {
    h({ agent: y.agent ?? '' })
    requestAnimationFrame(() => document.getElementById('qa-drill-h')?.focus())
  }
  const f = i?.team
  const g = n.agent ? (i?.byAgent.find((y: any) => y.key === n.agent)?.label ?? n.agent) : ''
  return (
    <QaPage
      route={route}
      d={i}
      error={c}
      reload={l}
      sub="How the team scores for the dates you pick. The team score uses the random daily sample; every agent, lead and channel row counts all their audits."
    >
      {i && f ? (
        <>
          <div className="cx-filters qs-bar">
            <div className="cx-seg" role="radiogroup" aria-label="Period">
              {QA_PRESETS.map(([y, _]) => (
                <label key={y}>
                  <input
                    type="radio"
                    name="qs-preset"
                    checked={n.preset === y}
                    onChange={() => b(y)}
                  />
                  <span>{_}</span>
                </label>
              ))}
            </div>
            {n.preset === 'custom' ? (
              <form
                className="qs-custom"
                onSubmit={(y) => {
                  y.preventDefault()
                  h({ from: d.from, to: d.to, agent: '' })
                }}
              >
                <label>
                  From{' '}
                  <input
                    className="cx-input"
                    type="date"
                    value={d.from}
                    max={qaToday()}
                    onInput={(y) => o({ ...d, from: y.currentTarget.value })}
                  />
                </label>
                <label>
                  To{' '}
                  <input
                    className="cx-input"
                    type="date"
                    value={d.to}
                    max={qaToday()}
                    onInput={(y) => o({ ...d, to: y.currentTarget.value })}
                  />
                </label>
                <button type="submit" className="cx-btn">
                  Show
                </button>
              </form>
            ) : null}
            <span className="qs-range">
              {qaDayLabel(i.from)} to {qaDayLabel(i.to)}
            </span>
            <label className="qs-check">
              <input
                type="checkbox"
                checked={p}
                onChange={(y) => m(y.currentTarget.checked)}
              />{' '}
              Compare with the {i.days} days before
            </label>
            <BasisSeg basis={n.basis} onChange={(y) => h({ basis: y, agent: '' })} />
          </div>
          <p className="cx-faint qa-basisnote">
            {qaBasisNote(i.basis, i.fallbackDates)}
            {i.fallbackDates && i.basis === 'interaction'
              ? ' Older audits get theirs once backfillQaInteractionDates has run.'
              : ''}
          </p>
          <section className="cx-panel qs-hero" aria-labelledby="qs-team-h">
            <div>
              <h2 className="cx-section__title" id="qs-team-h">
                Team score, random sample
              </h2>
              {f.score === null ? (
                <p className="qs-big cx-faint">–</p>
              ) : (
                <p className="qs-big" data-status={f.badge !== 'low' ? qaBand(f.score, false) : undefined}>
                  {f.score}
                  <small>% {qaMargin(f.margin)}</small>
                </p>
              )}
              <p className="qs-all">
                All audits: <b className="cx-num">{qaPct(f.allScore)}</b>{' '}
                <span className="cx-faint">(n={f.allAudits}, any sample, from 1 audit)</span>
              </p>
            </div>
            <p className="qs-delta">
              {f.score === null
                ? `No agent has ${i.minN} random audits in these dates yet.`
                : p && f.delta !== null
                  ? `${f.delta > 0 ? '+' : ''}${f.delta} points vs the ${i.days} days before (${f.prevScore}%)${f.trend ? ` ${QA_TREND_ARROW[f.trend]}` : ', within the noise'}`
                  : p
                    ? 'No score for the period before.'
                    : ''}
            </p>
            <dl className="qs-facts">
              <div>
                <dt>Audits counted</dt>
                <dd className="cx-num">
                  {f.audits}
                  <span className="cx-faint">
                    , {f.agents} agents scored
                    {f.agentsExcluded ? `, ${f.agentsExcluded} under ${i.minN}` : ''}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Critical fails</dt>
                <dd className="cx-num">
                  {f.critical}
                  {f.fatalRate ? (
                    <span className="cx-faint">, {f.fatalRate.pct}% of audits</span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Without critical fails</dt>
                <dd className="cx-num">{qaPct(f.scoreNoCritical)}</dd>
              </div>
              <div>
                <dt>Disputes raised</dt>
                <dd className="cx-num">
                  {f.disputes}
                  {f.disputeRate ? (
                    <span className="cx-faint">, {f.disputeRate.pct}% of audits</span>
                  ) : null}
                  {f.pendingDisputes ? (
                    <span className="cx-faint">, {f.pendingDisputes} undecided</span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </section>
          <TrendChart d={i} compare={p} />
          {n.agent ? (
            <DrillSection
              scope={{
                grain: 'range',
                period: `${i.from}..${i.to}`,
                basis: i.basis,
                label: `${qaDayLabel(i.from)} to ${qaDayLabel(i.to)}`,
              }}
              pick={{ agent: n.agent, agentName: g }}
              open={x}
              close={() => h({ agent: '' })}
              key={`${n.agent}|${i.from}|${i.to}|${i.basis}`}
            />
          ) : null}
          <BreakdownTable d={i} s={n} set={h} open={x} />
          <SideBars d={i} />
          <p className="cx-faint">
            <button
              type="button"
              className="qa-link"
              aria-expanded={r}
              onClick={() => u(!r)}
            >
              How scores work
            </button>{' '}
            More detail by week or month:{' '}
            <a href="#/quality-analytics">Quality analytics</a>.
          </p>
          {r ? (
            <p className="cx-muted">
              The team score and its chart use the random daily sample only: the
              average of agent averages, so every agent counts once, and an agent
              joins it from {i.minN} audits. &quot;All audits&quot; beside it, and every row
              in the table, count every audit whatever how it was chosen (random,
              history, requested, off-queue, non-ticket), from 1 audit; under{' '}
              {i.minN} audits (10 for a lead or channel) the row is tagged low
              sample, and a score is coloured from {i.verdictN}. The random-only
              figure shows beside a row when it differs. Disputed audits are left
              out until decided. The ± is a 95% range; an arrow appears only when
              the change is bigger than both ranges together. The team lead is
              the one on each audit, not today&apos;s roster.
            </p>
          ) : null}
        </>
      ) : null}
    </QaPage>
  )
}
