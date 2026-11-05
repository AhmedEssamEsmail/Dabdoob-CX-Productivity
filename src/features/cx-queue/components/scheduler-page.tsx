'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Scheduler page (scheduler.closure.js symbol Ll). */
import { useEffect, useState } from 'react'
import { fetchJson } from './shared'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function SchedulerPage({ route }: { route: { title: string } }) {
  const now = new Date()
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('month')
  const [date, setDate] = useState('')
  const load = (y = {}) => {
    setBusy(true)
    setErr('')
    fetchJson(`/api/queue/scheduler?year=${ym.year}&month=${ym.month}${(y as any).reshuffle ? '&reshuffle=1' : ''}${(y as any).fresh ? '&fresh=1' : ''}`)
      .then((w) => {
        setRes(w)
        setDate((M) => (M && w.plan.days.some((d: any) => d.key === M) ? M : w.plan.days[0]?.key || ''))
      })
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false))
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- verbatim: load() flips busy then resolves into state
  useEffect(load, [ym.year, ym.month])
  const admin = res?.me.role === 'admin'
  const bump = (n: number) => setYm((w) => { const M = new Date(w.year, w.month + n, 1); return { year: M.getFullYear(), month: M.getMonth() } })
  const tabs = [['month', 'Month'], ['timeline', 'Hour by hour'], ['off', 'Rest days'], ['requests', 'Requests'], ...(admin ? [['settings', 'Settings'] as string[]] : [])]
  const dayRows = (res?.timeline.rows || []).filter((r: any) => r.date === date).sort((a: any, b: any) => a.from - b.from)
  return (
    <section className="page sch-page" aria-labelledby="page-title">
      <header className="page-head sch-head">
        <div>
          <h1 id="page-title" className="page-title">{route.title}</h1>
          <p className="page-purpose">Who works which shift, and what each lead is doing in every hour. Meetings, 1:1s and tasks come from their own tabs.</p>
        </div>
        <div className="sch-controls">
          <div className="sch-month" role="group" aria-label="Month">
            <button type="button" className="btn btn-quiet" onClick={() => bump(-1)} aria-label="Previous month">‹</button>
            <strong className="sch-month-name">{res?.plan.monthName ?? '…'}</strong>
            <button type="button" className="btn btn-quiet" onClick={() => bump(1)} aria-label="Next month">›</button>
          </div>
          {admin ? (
            <>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => load({ reshuffle: true })} title="Try another arrangement of who works which week. Covers every slot the current roster covers.">Regenerate</button>
              <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => load({ fresh: true })} title="Read every sheet again. Use after editing a tab by hand.">Re-read inputs</button>
              <button type="button" className="btn btn-quiet" disabled={busy} onClick={async () => { try { const y = await fetchJson('/api/queue/scheduler', { op: 'save', year: ym.year, month: ym.month }); alert(`Saved ${y.saved} rows. Working hours now follow this roster.`) } catch (e: any) { alert(e.message) } }}>Save roster</button>
            </>
          ) : null}
        </div>
      </header>
      {res ? <p className="sch-variant">Roster variant {res.plan.variant}{res.plan.variant === 0 ? ' (the original)' : ''}. Shifts are Kuwait time.</p> : null}
      {err ? <p className="field-error" role="alert">{err}</p> : null}
      <div className="sch-tabs" role="tablist" aria-label="Scheduler views">
        {tabs.map(([y, w]) => (
          <button key={y} type="button" role="tab" id={`sch-tab-${y}`} aria-selected={tab === y} aria-controls={`sch-panel-${y}`} className={`sch-tab${tab === y ? ' on' : ''}`} onClick={() => setTab(y)}>{w}</button>
        ))}
      </div>
      <div role="tabpanel" id={`sch-panel-${tab}`} aria-labelledby={`sch-tab-${tab}`} aria-busy={busy}>
        {!res && !err ? <div className="skeleton" style={{ height: '220px' }} /> : null}
        {res && tab === 'month' ? (
          <div className="cx-tablewrap"><table className="cx-table"><thead><tr><th scope="col">Team lead</th>{res.plan.days.map((d: any) => <th key={d.key} scope="col" className="cx-num-col">{DOW[d.dow]} {d.dom}</th>)}</tr></thead>
            <tbody>
              {res.plan.tls.map((tl: string) => (
                <tr key={tl}>
                  <th scope="row">{res.plan.names[tl] ?? tl}</th>
                  {res.plan.days.map((d: any) => {
                    const p = res.plan.rows.find((r: any) => r.tl_email === tl && String(r.date).slice(0, 10) === d.key)
                    return <td key={d.key} className={`sch-cell${p ? ' sch-' + String(p.shift).toLowerCase() : ''}`} onClick={() => { setDate(d.key); setTab('timeline') }}>{p ? p.shift : '·'}</td>
                  })}
                </tr>
              ))}
            </tbody></table></div>
        ) : null}
        {res && tab === 'timeline' ? (
          <>
            <div className="sch-daybar">
              <button type="button" className="btn btn-quiet" disabled={res.plan.days.findIndex((d: any) => d.key === date) <= 0} onClick={() => setDate(res.plan.days[res.plan.days.findIndex((d: any) => d.key === date) - 1].key)} aria-label="Previous day">‹</button>
              <select className="select" value={date} onChange={(e) => setDate((e.target as HTMLSelectElement).value)} aria-label="Day">
                {res.plan.days.map((d: any) => <option key={d.key} value={d.key}>{DOW[d.dow]} {d.dom}</option>)}
              </select>
              <button type="button" className="btn btn-quiet" disabled={res.plan.days.findIndex((d: any) => d.key === date) >= res.plan.days.length - 1} onClick={() => setDate(res.plan.days[res.plan.days.findIndex((d: any) => d.key === date) + 1].key)} aria-label="Next day">›</button>
              <strong className="sch-daytitle">{date ? `${DOW[res.plan.days[res.plan.days.findIndex((d: any) => d.key === date)]?.dow ?? 0]} ${date}` : ''}</strong>
            </div>
            {dayRows.length ? (
              <div className="cx-tablewrap"><table className="cx-table"><thead><tr><th scope="col">Team lead</th>{res.timeline.hours.map((h: number) => <th key={h} scope="col" className="cx-num-col">{String(h).padStart(2, '0')}</th>)}</tr></thead>
                <tbody>
                  {dayRows.map((r: any) => (
                    <tr key={r.tl}>
                      <th scope="row">{res.plan.names[r.tl] ?? r.tl}<br /><span className="sch-rowsub">{r.shift} {r.from}-{r.to}{r.wfh ? ' · WFH' : ''}</span></th>
                      {res.timeline.hours.map((h: number) => {
                        const seg = r.segments.find((s: any) => s.from <= h && s.to > h)
                        return <td key={h} className={`sch-cell${seg ? ' sch-k-' + seg.kind : ''}`} title={seg ? `${seg.kind}: ${seg.label}` : ''}>{seg ? String(seg.label).slice(0, 8) : ''}</td>
                      })}
                    </tr>
                  ))}
                </tbody></table></div>
            ) : (
              <p className="block-text">Nobody is rostered on this day.</p>
            )}
            <div className="block sch-sources">
              <h2 className="block-title">Where these hours come from</h2>
              <p className="block-text">Task blocks are the team leads&apos; tasks, placed before their deadline. 1:1 and meeting blocks are the ones booked in their tabs; for the My day owner their calendar adds busy blocks. Log them where they belong and this graph follows.</p>
              <p className="sch-links"><a className="btn btn-quiet" href="#/one-on-ones">Log a 1:1</a> <a className="btn btn-quiet" href="#/tl-tasks">Add a TL task</a> <a className="btn btn-quiet" href="#/meetings">Add a meeting</a></p>
            </div>
          </>
        ) : null}
        {res && tab === 'off' ? (
          <div className="cx-tablewrap"><table className="cx-table"><thead><tr><th scope="col">Team lead</th><th scope="col">Rest days</th></tr></thead>
            <tbody>
              {res.plan.tls.map((tl: string) => (
                <tr key={tl}><th scope="row">{res.plan.names[tl] ?? tl}</th><td>{(res.offdays ?? []).filter((o: any) => o.tl_email === tl).map((o: any) => o.date).join(', ') || <span className="cx-faint">None this month</span>}</td></tr>
              ))}
            </tbody></table></div>
        ) : null}
        {res && tab === 'requests' ? (
          <RequestsTab admin={admin} onChanged={() => load()} />
        ) : null}
        {res && tab === 'settings' && admin ? <p className="block-text">Scheduler settings are saved through the API (schedulerSaveSettings / schedulerSaveTeamDates).</p> : null}
      </div>
    </section>
  )
}

function RequestsTab({ admin, onChanged }: { admin: boolean; onChanged: () => void }) {
  const [reqs, setReqs] = useState<any[] | null>(null)
  useEffect(() => {
    fetchJson('/api/queue/scheduler?view=requests').then((r) => setReqs(r.requests)).catch(() => setReqs([]))
  }, [])
  if (!reqs) return <div className="skeleton" style={{ height: '120px' }} />
  return (
    <div className="cx-tablewrap"><table className="cx-table"><thead><tr>{['Type', 'From', 'To', 'Date', 'Status', ''].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>
        {reqs.map((r: any) => (
          <tr key={r.request_id}>
            <td>{r.type}</td><td>{r.from_email}</td><td>{r.to_email || '–'}</td><td>{r.date}{r.their_date ? ` ↔ ${r.their_date}` : ''}</td><td><span className="cx-chip">{r.status}</span></td>
            <td>
              {admin && r.status === 'pending_admin' ? (
                <>
                  <button className="cx-btn" type="button" onClick={async () => { await fetchJson('/api/queue/scheduler', { op: 'decide', request_id: r.request_id, approve: true }); onChanged() }}>Approve</button>{' '}
                  <button className="cx-btn cx-btn--quiet" type="button" onClick={async () => { await fetchJson('/api/queue/scheduler', { op: 'decide', request_id: r.request_id, approve: false }); onChanged() }}>Decline</button>
                </>
              ) : null}
            </td>
          </tr>
        ))}
        {!reqs.length ? <tr><td colSpan={6}>No requests yet.</td></tr> : null}
      </tbody></table></div>
  )
}
