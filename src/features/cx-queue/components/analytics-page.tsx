'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Analytics page (analytics.closure.js symbols
 * Za/Sa/ke/el/tl/nl; Ja/ht vocabulary; Xe skeletons + an/_t/wt from ./shared). */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Empty, Seg, TableScroll, Toggle } from '@/features/shared/components/ui'
import { AsOfHint, Count, Head, LoadError, Xe, fetchJson, fmt, sweepStyle, useSe, useSweep, useTip } from './shared'

const Ja: [string, string][] = [
  ['day', 'By day'],
  ['week', 'By week'],
  ['month', 'By month'],
]
const ht: Record<string, string> = {
  call: 'Inbound calls',
  chat: 'Chats',
  escalation: 'Internal escalations',
}
const Hn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** ke — '2026-10-26' -> '26 Oct' (or 'Week of 26 Oct'); '2026-10' -> 'Oct 2026'. */
function ke(t: string, n: string, s = false): string {
  if (n === 'month') return `${Hn[Number(t.slice(5, 7)) - 1]}${s ? '' : ' ' + t.slice(0, 4)}`
  const a = `${Number(t.slice(8, 10))} ${Hn[Number(t.slice(5, 7)) - 1]}`
  return n === 'week' && !s ? `Week of ${a}` : a
}

/** Sa — the tooltip's up/down-vs-previous line. */
function Sa(t: number | null, n: number | null): string {
  if (t == null || n == null || !n) return ''
  const s = Math.round(((t - n) / Math.abs(n)) * 100)
  return s === 0 ? 'Same as prev' : `${s > 0 ? '▲ +' : '▼ −'}${Math.abs(s)}% vs prev`
}

type Pivot = { periods: string[]; values: number[][]; partial: Set<string> }

/** Za — pivot rows into a period x channel matrix, capped at 90 days / 26 weeks / 13 months. */
function pivot(n: any, g: string, sel: Set<string>): Pivot {
  const a = n[g]
  const l = new Map<string, number>(a.periods.map((p: string, d: number) => [p, d]))
  const r = a.periods.map(() => n.channels.map(() => 0))
  a.rows.forEach(([p, d, u, c]: [string, number, string, number]) => {
    if (sel.size && !sel.has(u)) return
    const o = l.get(p)
    if (o !== undefined && d >= 0) r[o][d] += c
  })
  const i = g === 'day' ? 90 : g === 'week' ? 26 : 13
  const h = Math.max(0, a.periods.length - i)
  return { periods: a.periods.slice(h), partial: new Set<string>(a.partial), values: r.slice(h) }
}

/** el — the inflow column chart: a real SVG, one stacked bar per period, pickable. */
function InflowChart({ s: t, g: n, channels: s, sel: a, onSel: l }: { s: Pivot; g: string; channels: string[]; sel: string | null; onSel: (p: string | null) => void }) {
  const { ref: r, tipFor: i, tipEl: h } = useTip()
  const p = t.periods.length
  const d = n === 'day' ? 3 : 8
  const u = 26
  const c = 10
  const o = 44
  const f = useRef<HTMLDivElement | null>(null)
  const [g, m] = useState(0)
  const [b, v] = useState(900)
  const y = Math.max(240, Math.min(460, b - 480))
  useEffect(() => {
    const R = f.current
    if (!R) return
    const k = () => {
      m(R.clientWidth)
      v(window.innerHeight)
    }
    window.addEventListener('resize', k)
    k()
    const A = typeof ResizeObserver > 'u' ? null : new ResizeObserver(k)
    A?.observe(R)
    return () => {
      A?.disconnect()
      window.removeEventListener('resize', k)
    }
  }, [])
  const w = n === 'day' ? 9 : n === 'week' ? 26 : 40
  const M = n === 'day' ? 48 : n === 'week' ? 100 : 160
  const $ = p ? (g - o) / p - d : w
  const L = Math.max(w, Math.min(M, $))
  const H = o + p * (L + d)
  const O = Math.max(1, ...t.values.map((R) => R.reduce((k, A) => k + A, 0)))
  const T = Math.pow(10, Math.floor(Math.log10(O)))
  const S = O / T > 5 ? T * 2 : O / T > 2 ? T : T / 2
  const C = Math.ceil(O / S) * S
  const q = (R: number) => c + (y - u - c) * (1 - R / C)
  const N = Array.from({ length: Math.round(C / S) + 1 }, (R, k) => k * S)
  const E = n === 'day' ? 7 : n === 'week' ? 2 : 1
  return (
    <div
      className="cc-chart"
      ref={r}
      onKeyDown={(R) => {
        if (R.key === 'Escape' && a) l(null)
      }}
    >
      {h}
      <div className="cx-chartwrap" ref={f}>
        <svg
          className="cx-chart"
          width={H}
          height={y}
          viewBox={`0 0 ${H} ${y}`}
          role="group"
          aria-label={`Inflow ${n === 'day' ? 'per day' : n === 'week' ? 'per week' : 'per month'}, stacked by channel. Press a bar to rank that ${n}. Table below.`}
        >
          {N.map((R) => (
            <g key={R}>
              <line x1={o - 4} x2={H} y1={q(R)} y2={q(R)} className="cx-chart__grid" />
              <text x={o - 8} y={q(R) + 4} className="cx-chart__axis" textAnchor="end">
                {R >= 1e3 ? `${R / 1e3}k` : R}
              </text>
            </g>
          ))}
          {t.periods.map((R, k) => {
            const A = o + k * (L + d)
            let I = 0
            const x = t.partial.has(R)
            const P = t.values[k].reduce((J, se) => J + se, 0)
            const U = k && !x ? t.values[k - 1].reduce((J, se) => J + se, 0) : null
            const V = [
              `${ke(R, n)}${x ? ' (so far)' : ''}: ${fmt(P)}`,
              Sa(P, U),
              s.map((J, se) => `${ht[J]} ${fmt(t.values[k][se])}`).join(', '),
            ]
              .filter(Boolean)
              .join('\n')
            const de = () => l(a === R ? null : R)
            return (
              <g key={R} opacity={x ? 0.45 : 1}>
                <g
                  className="cc-sweep-col cc-pick"
                  style={sweepStyle(k)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={a === R}
                  {...(i(V) as object)}
                  onClick={de}
                  onKeyDown={(J) => {
                    if (J.key === 'Enter' || J.key === ' ') {
                      J.preventDefault()
                      de()
                    }
                  }}
                >
                  <rect x={A} y={c} width={L} height={y - u - c} fill="transparent" />
                  {s.map((J, se) => {
                    const Le = t.values[k][se]
                    const ue = q(I + Le)
                    const Ee = q(I)
                    I += Le
                    return Le ? <rect key={J} x={A} y={ue} width={L} height={Math.max(0, Ee - ue - 1)} className={`cx-ch cx-ch--${J}`} rx={1.5} /> : null
                  })}
                </g>
                {k % E === 0 || n !== 'day' ? (
                  <text x={A + L / 2} y={y - 8} className="cx-chart__axis" textAnchor="middle">
                    {ke(R, n, true)}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

/** tl — the cx-rank panel: "By country", or "By channel" inside one country, with the crumb back. */
function RankPanel({
  ranked: t,
  grain: n,
  period: s,
  picked: a,
  country: l,
  headRef: r,
  onDrill: i,
  onClearPick: h,
}: {
  ranked: { inOne: boolean; rows: [string, number][]; total: number }
  grain: string
  period: string
  picked: boolean
  country: string
  headRef: React.RefObject<HTMLHeadingElement | null>
  onDrill: (country: string | null) => void
  onClearPick: () => void
}) {
  const p = useRef<HTMLElement | null>(null)
  useSweep(p)
  const d = t.rows[0]?.[1] || 1
  const u = t.inOne ? 'channel' : 'country'
  return (
    <section className="cx-panel cx-panel--pad cx-rank cc-chart" ref={p} aria-labelledby="rank-h">
      <div className="cx-rank__head">
        <h2 className="cx-section__title" id="rank-h" ref={r} tabIndex={-1}>
          {l ? (
            <>
              <Button className="cx-crumb" onClick={() => i(null)}>
                All inflow
              </Button>
              <span aria-hidden="true"> › </span>
              {l}
            </>
          ) : (
            `By ${u}`
          )}
        </h2>
        {a ? (
          <>
            <Button className="cx-chip cx-rank__chip" onClick={h} aria-label={`Clear ${ke(s, n)}`}>
              {ke(s, n)} <span aria-hidden="true">×</span>
            </Button>
          </>
        ) : (
          <span className="cx-faint">{ke(s, n)}</span>
        )}
      </div>
      <p className="cx-sr" aria-live="polite">
        {`Ranked by ${u}${l ? ` in ${l}` : ''}, ${ke(s, n)}.`}
      </p>
      {t.rows.length ? (
        <ol className="cx-rank__list">
          {t.rows.map(([c, o], f) => {
            const g = (t.inOne && ht[c]) || c
            const m = t.total ? Math.round((o / t.total) * 100) : 0
            const b = (
              <>
                <span className="cx-rank__n cx-num">{f + 1}</span>
                <span className="cx-rank__name" title={String(g)}>{g}</span>
                <span className="cx-rank__track">
                  <i className="cc-sweep-bar" style={{ inlineSize: `${(o / d) * 100}%`, ...sweepStyle(f) }} />
                </span>
                <span className="cx-rank__val cx-num">{fmt(o)}</span>
                <span className="cx-rank__share cx-num cx-faint">{m}%</span>
              </>
            )
            return (
              <li key={c}>
                {t.inOne ? (
                  <div className="cx-rank__row">{b}</div>
                ) : (
                  <>
                    {/* intentionally raw: metric-row widget (full ranked row acting as a drill button); Button's cx-btn chrome would break the row grid */}
                    <button type="button" className="cx-rank__row" onClick={() => i(c)} aria-label={`${g}: ${fmt(o)}, ${m}%. Show its channels`}>
                      {b}
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ol>
      ) : (
        <Empty title={`No contacts in this ${n}. Press another bar, or clear the ${n}.`} />
      )}
    </section>
  )
}

/** nl — the Analytics page. */
export function AnalyticsPage({ route }: { route: { title: string } }) {
  const { data: n, error: s, reload: a } = useSe('queue.analytics', () => fetchJson('/api/queue/analytics'))
  const [l, r] = useState('week')
  const [i, h] = useState<Set<string>>(new Set())
  const [p, d] = useState<string | null>(null)
  const u = useRef<HTMLHeadingElement | null>(null)
  const c = useMemo(() => (n ? pivot(n, l, i) : null), [n, l, i])
  const o = p && c?.periods.includes(p) ? p : null
  const f = useMemo(() => {
    if (!c || !n) return null
    const y = (T: number) => c.values[T].reduce((S, C) => S + C, 0)
    if (o) {
      const T = c.periods.indexOf(o)
      const S = c.partial.has(o)
      const C = T && !S ? y(T - 1) : 0
      return { p: o, now: y(T), partial: S, change: C ? (y(T) - C) / C : null, split: c.values[T] }
    }
    const w = c.periods.map((T, S) => [T, S] as [string, number]).filter(([T]) => !c.partial.has(T))
    if (w.length < 2) return null
    const [M, $] = w[w.length - 1]
    const [, L] = w[w.length - 2]
    const H = y($)
    const O = y(L)
    return { p: M, now: H, partial: false, change: O ? (H - O) / O : null, split: c.values[$] }
  }, [c, n, o])
  const g = useMemo(() => {
    if (!n || !f) return null
    const y = i.size === 1
    const w = new Map<string, number>()
    n[l].rows.forEach(([$, L, H, O]: [string, number, string, number]) => {
      if ($ !== f.p || L < 0 || (i.size && !i.has(H))) return
      const T = y ? n.channels[L] : H
      w.set(T, (w.get(T) || 0) + O)
    })
    const M = [...w].sort(($, L) => L[1] - $[1]) as [string, number][]
    return { inOne: y, rows: M, total: M.reduce(($, L) => $ + L[1], 0) }
  }, [n, l, i, f])
  const m = (y: string | null) => {
    h(new Set(y ? [y] : []))
    setTimeout(() => u.current?.focus())
  }
  const b = useRef<HTMLElement | null>(null)
  useSweep(b)
  const v = (y: string) =>
    h((w) => {
      const M = new Set(w)
      if (M.has(y)) M.delete(y)
      else M.add(y)
      return M
    })
  return (
    <Head
      title={route.title}
      sub="Contacts coming in: inbound calls, chats and internal escalations raised outside CX. Weeks start on Sunday."
      aside={n ? <AsOfHint iso={n.dataAsOf} what="Inflow" /> : null}
    >
      {s ? <LoadError message={s} onRetry={a} /> : null}
      {!n || !c ? (
        <>
          <Xe shape="tiles" n={1} />
          <Xe shape="rows" n={5} />
          <Xe shape="chart" />
        </>
      ) : (
        <>
          <div className="cx-filters">
            <Seg
              name="grain"
              aria-label="Period"
              value={l}
              onChange={(y) => {
                r(y)
                d(null)
              }}
              options={Ja.map(([value, label]) => ({ value, label }))}
            />
            <fieldset className="cx-fieldset cx-countries">
              <legend className="cx-label">Countries {i.size ? '' : '(all)'}</legend>
              {n.countries.map((y: string) => (
                <Toggle key={y} checked={i.has(y)} onChange={() => v(y)}>
                  {y}
                </Toggle>
              ))}
            </fieldset>
          </div>
          {f ? (
            <section className="cx-panel cx-panel--pad cx-headline cc-chart" ref={b} aria-label={o ? 'Pressed period' : 'Latest complete period'}>
              <p className="cx-headline__num cx-num">
                <Count value={f.now} format={fmt} />
              </p>
              <p className="cx-headline__text">
                contacts in {ke(f.p, l).replace(/^Week of/, 'the week of')}
                {f.partial ? ' so far' : ''}
                {f.change === null
                  ? null
                  : Math.round(f.change * 100) === 0
                    ? `, about the same as the ${l} before`
                    : `, ${f.change > 0 ? 'up' : 'down'} ${Math.abs(Math.round(f.change * 100))}% on the ${l} before`}
                .
              </p>
              <span className="cx-chsplit cc-sweep-bar" aria-hidden="true">
                {n.channels.map((y: string, w: number) => (f.split[w] ? <i key={y} className={`cx-ch cx-ch--${y}`} style={{ flexGrow: f.split[w] }} /> : null))}
              </span>
              <ul className="cx-legend">
                {n.channels.map((y: string, w: number) => (
                  <li key={y}>
                    <i className={`cx-ch cx-ch--${y}`} aria-hidden="true" /> {ht[y]} <b className="cx-num">{fmt(f.split[w])}</b>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {g ? <RankPanel ranked={g} grain={l} period={f!.p} picked={!!o} country={g.inOne ? [...i][0] : ''} headRef={u} onDrill={m} onClearPick={() => d(null)} /> : null}
          <section className="cx-panel cx-panel--pad" aria-labelledby="chart-h">
            <h2 className="cx-sr" id="chart-h">
              Inflow chart
            </h2>
            <InflowChart s={c} g={l} channels={n.channels} sel={o} onSel={d} />
            <p className="cx-hint">
              The faded {l === 'day' ? 'day' : l} is still in progress. {n.excludedGroups.join(', ')} tickets are left out (documentation and
              notification-only groups).
            </p>
          </section>
          <details className="cx-panel cx-details">
            <summary>Show the numbers as a table</summary>
            <TableScroll label="Inflow contacts by period" className="cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">{l === 'day' ? 'Day' : l === 'week' ? 'Week from' : 'Month'}</th>
                    {n.channels.map((y: string) => (
                      <th key={y} scope="col" className="cx-num-col">
                        {ht[y]}
                      </th>
                    ))}
                    <th scope="col" className="cx-num-col">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.periods
                    .map((y, w) => [y, w] as [string, number])
                    .reverse()
                    .map(([y, w]) => (
                      <tr key={y}>
                        <td>
                          {ke(y, l)}
                          {c.partial.has(y) ? <span className="cx-faint"> (so far)</span> : null}
                        </td>
                        {c.values[w].map((M, $) => (
                          <td key={$} className="cx-num-col cx-num">
                            {fmt(M)}
                          </td>
                        ))}
                        <td className="cx-num-col cx-num">
                          <strong>{fmt(c.values[w].reduce((M: number, $: number) => M + $, 0))}</strong>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </TableScroll>
          </details>
        </>
      )}
    </Head>
  )
}
