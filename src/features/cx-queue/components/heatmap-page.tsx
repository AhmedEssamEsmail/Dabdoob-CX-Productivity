'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Heatmap page (heatmap.closure.js symbol wl). */
import { useMemo, useState } from 'react'
import { Head, LoadError, Skeleton, fetchJson, useSe } from './shared'

export function HeatmapPage({ route }: { route: { title: string } }) {
  const { data: n, error, reload } = useSe('queue.heatmap', () => fetchJson('/api/queue/heatmap'))
  const [input, setInput] = useState('')
  const [set, setSet] = useState('')
  const { data: cells, error: err2 } = useSe('queue.heatmap.input', () => (input ? fetchJson('/api/queue/heatmap?input=' + input + (set ? '&set=' + set : '')) : Promise.resolve(null)), [input, set])
  const grid = useMemo(() => {
    const cs = cells?.heatmap?.cells || []
    const days = (n?.days || []) as string[]
    const starts = [...new Set<string>(cs.map((c: any) => String(c.start)))].sort()
    const byCell: Record<string, number> = {}
    let max = 0
    cs.forEach((c: any) => {
      const k = c.day + '|' + c.start
      byCell[k] = (byCell[k] || 0) + (c.needed ?? c.volume ?? 0)
      if (byCell[k] > max) max = byCell[k]
    })
    return { days, starts, byCell, max }
  }, [cells, n])
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <Head title={route.title} sub="How many people each interval needs, from the uploaded volumes and the assumption set." />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {err2 ? <LoadError message={err2} onRetry={reload} /> : null}
      {!n && !error ? <Skeleton lines={6} /> : null}
      {n ? (
        <div className="cx-panel cx-panel--pad">
          <div className="cx-filters">
            <div className="cx-field">
              <label className="cx-label" htmlFor="hm-in">Heatmap input</label>
              <select className="cx-select" id="hm-in" value={input} onChange={(e) => setInput((e.target as HTMLSelectElement).value)}>
                <option value="">Choose…</option>
                {n.inputs.map((i: any) => <option key={i.inputId} value={i.inputId}>{i.name} ({i.cellsCount} cells)</option>)}
              </select>
            </div>
            <div className="cx-field">
              <label className="cx-label" htmlFor="hm-set">Assumptions</label>
              <select className="cx-select" id="hm-set" value={set} onChange={(e) => setSet((e.target as HTMLSelectElement).value)}>
                <option value="">Defaults</option>
                {n.sets.map((s: any) => <option key={s.setId} value={s.setId}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {cells ? (
            <div className="cx-tablewrap">
              <table className="cx-table hm-grid">
                <thead><tr><th scope="col" /><th>{grid.days.map((d: string) => <th key={d} scope="col">{d}</th>)}</th></tr></thead>
                <tbody>
                  {grid.starts.map((s) => (
                    <tr key={s}>
                      <th scope="row" className="cx-num">{s}</th>
                      {grid.days.map((d: string) => {
                        const v = grid.byCell[d + '|' + s] || 0
                        return <td key={d} className="cx-num" data-hm={grid.max ? Math.ceil((v / grid.max) * 6) : 0}>{v || ''}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="cx-hint">Choose an input to see the interval heatmap. Upload new volumes from the API (saveHeatmapInput / parseHeatmapUpload).</p>
          )}
        </div>
      ) : null}
    </section>
  )
}
