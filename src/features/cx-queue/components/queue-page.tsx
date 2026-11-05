'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Queue health page (queue.closure.js symbol Va). */
import { useMemo, useState } from 'react'
import { AgeChip, AsOfHint, Head, LoadError, Skeleton, ageRank, bandTop, fetchJson, fmt, hm, useSe } from './shared'

function RefreshNow({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [until, setUntil] = useState(0)
  // eslint-disable-next-line react-hooks/purity -- verbatim: cooldown timer seeds from Date.now()
  const [now, setNow] = useState(Date.now())
  const left = Math.max(0, Math.ceil((until - now) / 1000))
  const go = () => {
    setBusy(true)
    setMsg('')
    fetchJson('/api/queue/refresh', {})
      .then((r) => {
        setBusy(false)
        const s = r.refreshed && r.synced_to ? `Freshdesk changes up to ${hm(r.synced_to)} Kuwait time.` : ''
        setMsg((s + ' ' + (r.message || '')).replace(/\s*Try again in \d+ s\.$/, '').trim())
        if (r.retryInS) {
          setUntil(Date.now() + r.retryInS * 1000)
          setNow(Date.now())
          const iv = setInterval(() => setNow(Date.now()), 1000)
          setTimeout(() => clearInterval(iv), r.retryInS * 1000)
        }
        if (r.refreshed) onDone()
      })
      .catch((e) => {
        setBusy(false)
        setMsg(e.message)
      })
  }
  return (
    <span className="dq-refresh">
      <button type="button" className="cx-btn" disabled={busy || left > 0} aria-busy={busy} onClick={go}>
        {busy ? 'Refreshing…' : left > 0 ? `Refresh again in ${left} s` : 'Refresh now'}
      </button>
      {msg ? (
        <span className="cx-section__hint" role="status">
          {msg}
        </span>
      ) : null}
    </span>
  )
}

export function QueuePage({ route }: { route: { title: string } }) {
  const { data, error, reload } = useSe('queue.health', () => fetchJson('/api/queue/health'))
  const [filter, setFilter] = useState('')
  const [metric, setMetric] = useState<string | null>(null)
  const q = useMemo(() => (data?.queues || []).filter((x: any) => !filter || String(x.queue).toLowerCase().includes(filter.toLowerCase())), [data, filter])
  const totals = useMemo(() => {
    const t = { open: 0, actionable: 0, unassigned: 0, createdToday: 0, resolvedToday: 0, overTop: 0, bands: [] as number[] }
    ;(data?.queues || []).forEach((x: any) => {
      t.open += x.open; t.actionable += x.actionable; t.unassigned += x.unassigned
      t.createdToday += x.createdToday; t.resolvedToday += x.resolvedToday; t.overTop += x.overTop
      ;(x.bands || []).forEach((b: number, i: number) => { t.bands[i] = (t.bands[i] || 0) + b })
    })
    return t
  }, [data])
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!data && !error}>
      <Head title={route.title} sub="What is on the queues right now, by queue and by age. Counts refresh every 15 minutes." aside={data ? (<><AsOfHint iso={data.dataAsOf} /><RefreshNow onDone={reload} /></>) : null} />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!data && !error ? <><Skeleton tall lines={2} /><Skeleton lines={8} /></> : null}
      {data ? (
        <>
          <div className="dq-tiles">
            {[
              ['Open now', totals.open, 'open'], ['Came in today', totals.createdToday, 'in'],
              [`Open ${bandTop(data.bands.edges[data.bands.edges.length - 1])} or more`, totals.overTop, 'old'],
              ['Resolved today', totals.resolvedToday, 'done'], ['Not assigned', totals.unassigned, 'free'],
            ].map(([label, v, k]) => (
              <button key={String(k)} type="button" className="dq-tile" aria-pressed={metric === k} onClick={() => setMetric(metric === k ? null : String(k))}>
                <span className="dq-tile__num cx-num">{fmt(Number(v))}</span>
                <span className="dq-tile__label">{label}</span>
              </button>
            ))}
          </div>
          <section className="cx-section" aria-labelledby="qb-h">
            <div className="cx-section__head">
              <h2 className="cx-section__title" id="qb-h">By queue</h2>
              <span className="cx-section__hint">{q.length} queues now{data.sinceSlot ? `; since the ${data.sinceSlot} check-in` : ''}</span>
            </div>
            <div className="cx-filters">
              <input className="cx-input" type="search" placeholder="Filter queues" value={filter} onInput={(e) => setFilter((e.target as HTMLInputElement).value)} aria-label="Filter queues" />
            </div>
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table cx-table--nowrap">
                <thead>
                  <tr>
                    {['Queue', 'Open', 'Ours to work', 'Not assigned', 'Age mix', 'Oldest', 'In today', 'Resolved today', 'Since ' + (data.sinceSlot || 'before')].map((h) => (
                      <th key={h} scope="col">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.map((x: any) => (
                    <tr key={x.queue} data-ours={x.ours ? 'true' : undefined}>
                      <td>{x.queue}{x.stale ? <span className="cx-chip" data-status="warn">Stale</span> : null}</td>
                      <td className="cx-num">{fmt(x.open)}</td>
                      <td className="cx-num">{fmt(x.actionable)}</td>
                      <td className="cx-num">{fmt(x.unassigned)}</td>
                      <td>
                        <span className="cx-ladder cc-sweep-bar" role="group" aria-label="Open tickets by age">
                          {(x.bands || []).map((b: number, i: number) => (
                            <span key={i} className="cx-ladder__seg" data-age={ageRank(i, x.bands.length)} style={{ ['--n' as string]: Math.max(b, 4) }} title={`${data.bands.labels[i]}: ${b} tickets`} />
                          ))}
                        </span>
                      </td>
                      <td><AgeChip hours={x.oldestH} band={x.open ? x.bands.lastIndexOf(Math.max(...(x.bands as number[]))) : 0} /></td>
                      <td className="cx-num">{fmt(x.createdToday)}</td>
                      <td className="cx-num">{fmt(x.resolvedToday)}</td>
                      <td className="cx-num">{x.delta === null ? '–' : x.delta > 0 ? `+${x.delta}` : x.delta}</td>
                    </tr>
                  ))}
                  {!q.length ? <tr><td colSpan={9}>No queue matches.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <p className="cx-hint">
              {data.excludedGroups.join(', ')} are left out (documentation and notification-only groups). Chats come from the daily report
              {data.syncedAt ? `; Freshdesk was last read ${hm(data.syncedAt)} Kuwait` : ''}.
            </p>
          </section>
        </>
      ) : null}
    </section>
  )
}
