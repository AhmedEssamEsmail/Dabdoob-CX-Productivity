'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Analytics page (analytics.closure.js symbol nl). */
import { useMemo, useState } from 'react'
import { AsOfHint, Head, LoadError, Skeleton, fetchJson, fmt, useSe } from './shared'

const CH_LABEL: Record<string, string> = { call: 'Calls', chat: 'Chats', escalation: 'Escalations' }
const GRAINS: [string, string][] = [['day', 'Day'], ['week', 'Week'], ['month', 'Month']]
const ke = (p: string, g: string, short?: boolean) => (g === 'week' && !short ? `Week of ${p}` : p)

type S = { periods: string[]; values: number[][]; partial: Set<string> }
function pivot(n: any, g: string, sel: Set<string>): S | null {
  const src = n[g]
  const out: S = { periods: src.periods.slice(), values: [], partial: new Set(src.partial) }
  src.periods.forEach(() => out.values.push(n.channels.map(() => 0)))
  const idx: Record<string, number> = {}
  src.periods.forEach((p: string, i: number) => (idx[p] = i))
  src.rows.forEach(([p, ci, country, v]: [string, number, string, number]) => {
    if (sel.size && !sel.has(country)) return
    out.values[idx[p]][ci] += v
  })
  return out
}

export function AnalyticsPage({ route }: { route: { title: string } }) {
  const { data: n, error, reload } = useSe('queue.analytics', () => fetchJson('/api/queue/analytics'))
  const [g, setG] = useState('week')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [pick, setPick] = useState<string | null>(null)
  const c = useMemo(() => (n ? pivot(n, g, sel) : null), [n, g, sel])
  const o = pick && c?.periods.includes(pick) ? pick : null
  const f = useMemo(() => {
    if (!c || !n) return null
    const tot = (T: number) => c.values[T].reduce((S, C) => S + C, 0)
    if (o) {
      const T = c.periods.indexOf(o), partial = c.partial.has(o), C = T && !partial ? tot(T - 1) : 0
      return { p: o, now: tot(T), partial, change: C ? (tot(T) - C) / C : null, split: c.values[T] }
    }
    const w = c.periods.map((T, S) => [T, S] as [string, number]).filter(([T]) => !c.partial.has(T))
    if (w.length < 2) return null
    const [M, $] = w[w.length - 1], [, L] = w[w.length - 2]
    const H = tot($), O = tot(L)
    return { p: M, now: H, partial: false, change: O ? (H - O) / O : null, split: c.values[$] }
  }, [c, n, o])
  const ranked = useMemo(() => {
    if (!n || !f || !c) return null
    const inOne = sel.size === 1
    const fp = f.p
    const m = new Map<string, number>()
    n[g].rows.forEach(([p, ci, country, v]: [string, number, string, number]) => {
      if (p !== fp || ci < 0 || (sel.size && !sel.has(country))) return
      const T = inOne ? n.channels[ci] : country
      m.set(T, (m.get(T) || 0) + v)
    })
    const rows = [...m].sort((x, y) => y[1] - x[1])
    return { inOne, rows, total: rows.reduce((x, y) => x + y[1], 0) }
  }, [n, g, sel, f, c])
  const max = c ? Math.max(1, ...c.values.map((v) => v.reduce((x, y) => x + y, 0))) : 1
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <Head title={route.title} sub="Contacts coming in: inbound calls, chats and internal escalations raised outside CX. Weeks start on Sunday." aside={n ? <AsOfHint iso={n.dataAsOf} what="Inflow" /> : null} />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!n || !c ? <Skeleton lines={6} /> : (
        <>
          <div className="cx-filters">
            <div className="cx-seg" role="radiogroup" aria-label="Period">
              {GRAINS.map(([y, w]) => (
                <label key={y}><input type="radio" name="grain" checked={g === y} onChange={() => { setG(y); setPick(null) }} /><span>{w}</span></label>
              ))}
            </div>
            <fieldset className="cx-fieldset dq-countries">
              <legend className="cx-label">Countries {sel.size ? '' : '(all)'}</legend>
              {n.countries.map((y: string) => (
                <label key={y} className="cx-toggle"><input type="checkbox" checked={sel.has(y)} onChange={() => setSel((w) => { const M = new Set(w); if (M.has(y)) M.delete(y); else M.add(y); return M })} /><span>{y}</span></label>
              ))}
            </fieldset>
          </div>
          {f ? (
            <section className="dq-headline cc-chart" aria-label={o ? 'Pressed period' : 'Latest complete period'}>
              <p className="dq-headline__num cx-num">{fmt(f.now)}</p>
              <p className="dq-headline__text">
                contacts in {ke(f.p, g).replace(/^Week of/, 'the week of')}
                {f.partial ? ' so far' : ''}
                {f.change === null ? '' : Math.round(f.change * 100) === 0 ? `, about the same as the ${g} before` : `, ${f.change > 0 ? 'up' : 'down'} ${Math.abs(Math.round(f.change * 100))}% on the ${g} before`}.
              </p>
              <span className="dq-split cc-sweep-bar" aria-hidden="true">
                {n.channels.map((y: string, w: number) => (f.split[w] ? <i key={y} className={`dq-ch dq-ch--${y}`} style={{ flexGrow: f.split[w] }} /> : null))}
              </span>
              <ul className="dq-legend">
                {n.channels.map((y: string, w: number) => (
                  <li key={y}><i className={`dq-ch dq-ch--${y}`} aria-hidden="true" /> {CH_LABEL[y]} <b className="cx-num">{fmt(f.split[w])}</b></li>
                ))}
              </ul>
            </section>
          ) : null}
          {ranked ? (
            <section className="cx-panel cx-panel--pad dq-rank cc-chart" aria-labelledby="rank-h">
              <div className="dq-rank__head">
                <h2 className="cx-section__title" id="rank-h">{ranked.inOne ? 'By channel' : 'By country'}</h2>
                {o ? <button type="button" className="cx-chip dq-rank__chip" onClick={() => setPick(null)} aria-label={`Clear ${ke(o, g)}`}>{ke(o, g)} <span aria-hidden="true">×</span></button> : <span className="cx-faint">{f ? ke(f.p, g) : ''}</span>}
              </div>
              {ranked.rows.length ? (
                <ol className="dq-rank__list">
                  {ranked.rows.map(([cName, v], ix) => {
                    const label = (ranked.inOne && CH_LABEL[cName]) || cName
                    const share = ranked.total ? Math.round((v / ranked.total) * 100) : 0
                    const inner = (<><span className="dq-rank__n cx-num">{ix + 1}</span><span className="dq-rank__name">{label}</span><span className="dq-rank__track"><i className="cc-sweep-bar" style={{ inlineSize: `${(v / (ranked.rows[0]?.[1] || 1)) * 100}%` }} /></span><span className="dq-rank__val cx-num">{fmt(v)}</span><span className="dq-rank__share cx-num cx-faint">{share}%</span></>)
                    return <li key={cName}>{ranked.inOne ? <div className="dq-rank__row">{inner}</div> : <button type="button" className="dq-rank__row" onClick={() => setSel(new Set([cName]))} aria-label={`${label}: ${fmt(v)}, ${share}%. Show its channels`}>{inner}</button>}</li>
                  })}
                </ol>
              ) : (
                <p className="cx-muted">No contacts in this {g}. Press another bar, or clear the {g}.</p>
              )}
            </section>
          ) : null}
          <section className="cx-panel cx-panel--pad" aria-labelledby="chart-h">
            <h2 className="cx-sr" id="chart-h">Inflow chart</h2>
            <div className="dq-chart" role="group" aria-label={`Inflow per ${g}, stacked by channel. Press a bar to rank that ${g}. Table below.`}>
              {c.periods.map((p, k) => {
                const total = c.values[k].reduce((x, y) => x + y, 0)
                const x = c.partial.has(p)
                return (
                  <button key={p} type="button" className="dq-bar cc-pick" style={{ height: `${(total / max) * 100}%`, opacity: x ? 0.45 : 1 }} aria-pressed={o === p} onClick={() => setPick(o === p ? null : p)} title={`${ke(p, g)}${x ? ' (so far)' : ''}: ${fmt(total)}`}>
                    {n.channels.map((y: string, w: number) => (c.values[k][w] ? <i key={y} className={`dq-ch dq-ch--${y}`} style={{ flexGrow: c.values[k][w] }} /> : null))}
                    <span className="dq-bar__axis">{ke(p, g, true)}</span>
                  </button>
                )
              })}
            </div>
            <p className="cx-hint">The faded {g === 'day' ? 'day' : g} is still in progress. {n.excludedGroups.join(', ')} tickets are left out (documentation and notification-only groups).</p>
          </section>
          <details className="cx-panel dq-details">
            <summary>Show the numbers as a table</summary>
            <div className="cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr><th scope="col">{g === 'day' ? 'Day' : g === 'week' ? 'Week from' : 'Month'}</th>{n.channels.map((y: string) => <th key={y} scope="col" className="cx-num-col">{CH_LABEL[y]}</th>)}<th scope="col" className="cx-num-col">Total</th></tr>
                </thead>
                <tbody>
                  {c.periods.map((y, w) => [y, w] as [string, number]).reverse().map(([y, w]) => (
                    <tr key={y}>
                      <td>{ke(y, g)}{c.partial.has(y) ? <span className="cx-faint"> (so far)</span> : null}</td>
                      {c.values[w].map((M, $) => <td key={$} className="cx-num-col cx-num">{fmt(M)}</td>)}
                      <td className="cx-num-col cx-num"><strong>{fmt(c.values[w].reduce((M, $) => M + $, 0))}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  )
}
