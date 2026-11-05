'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Aging page (aging.closure.js symbol za). */
import { useMemo, useState } from 'react'
import { AgeChip, AsOfHint, Head, LoadError, Skeleton, ageRank, bandTop, fetchJson, fmt, useHashParams, useSe } from './shared'

const PAGE = 50

function HelpCell({ t, flag, scope, onChange }: { t: any[]; flag: any; scope: string; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = (fn: () => Promise<unknown>) => {
    setBusy(true)
    setErr('')
    fn()
      .then(() => { setBusy(false); setOpen(false); setNote(''); onChange() })
      .catch((e) => { setBusy(false); setErr(e.message) })
  }
  if (flag && scope !== 'agent')
    return (
      <span className="dq-help">
        <span className="cx-chip" data-status="bad" title={flag.note}>Help asked by {String(flag.by).split('@')[0]}</span>
        <span className="cx-muted"> {flag.note}</span>{' '}
        <button type="button" className="cx-btn cx-btn--quiet" disabled={busy} onClick={() => run(() => fetchJson('/api/queue/aging-flags', { flag_id: flag.flagId, resolved_note: '' }))}>
          Mark handled
        </button>
        {err ? <span role="alert"> {err}</span> : null}
      </span>
    )
  if (scope !== 'agent') return <span className="cx-faint">–</span>
  return open ? (
    <span className="dq-help">
      <input className="cx-input" aria-label={`What is blocking ticket ${t[0]}`} placeholder="What is blocking it, what you need" value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} />{' '}
      <button type="button" className="cx-btn" disabled={busy} onClick={() => run(() => fetchJson('/api/queue/aging-flags', { ticket_id: t[0], note }))}>Send</button>{' '}
      <button type="button" className="cx-btn cx-btn--quiet" onClick={() => setOpen(false)}>Cancel</button>
      {err ? <span role="alert"> {err}</span> : null}
    </span>
  ) : flag ? (
    <span className="cx-chip" data-status="warn" title={flag.note}>Asked {flag.at ? '' : ''}: waiting on your TL</span>
  ) : (
    <button type="button" className="cx-btn cx-btn--quiet" onClick={() => setOpen(true)} aria-label={`Ask your team lead for help with ticket ${t[0]}`}>
      Ask my TL for help
    </button>
  )
}

export function AgingPage({ route }: { route: { title: string } }) {
  const { data: n, error, reload } = useSe('queue.aging', () => fetchJson('/api/queue/aging'))
  const [params] = useState(useHashParams)
  const deep = params.has('unassigned') || params.has('flagged') || params.has('ticket')
  const [band, setBand] = useState<number | null>(null)
  const [top, setTop] = useState<number | null>(deep ? 0 : null)
  const [queue, setQueue] = useState('')
  const [tl, setTl] = useState('')
  const [search, setSearch] = useState(params.get('ticket') ?? '')
  const [mine, setMine] = useState(params.get('mine') === '1')
  const [unassigned, setUnassigned] = useState(params.get('unassigned') === '1')
  const [flagged, setFlagged] = useState(params.get('flagged') === '1')
  const [shown, setShown] = useState(PAGE)
  const flags = useMemo(() => new Map((n?.flags ?? []).map((x: any) => [x.ticketId, x])), [n])
  const T = n ? n.bands.edges.length : 4
  const S = top ?? T
  const queues = useMemo(() => (n ? [...new Set<string>(n.tickets.map((x: any[]) => x[1]))].sort() : []), [n])
  const tls = useMemo(() => (n ? [...new Set<string>(n.tickets.map((x: any[]) => x[8]).filter(Boolean))].sort() : []), [n])
  const counts = useMemo(() => {
    const x = (n?.bands.labels ?? []).map(() => 0)
    n?.tickets.forEach((P: any[]) => x[Math.min(P[6], x.length - 1)]++)
    return x
  }, [n])
  const rows = useMemo(() => {
    if (!n) return []
    const x = search.trim()
    return n.tickets.filter(
      (P: any[]) => (band === null ? P[6] >= S : P[6] === band) && (!queue || P[1] === queue) && (!tl || P[8] === tl) && (!mine || P[9]) && (!unassigned || !P[7]) && (!flagged || flags.has(P[0])) && (!x || String(P[0]).includes(x))
    )
  }, [n, band, S, queue, tl, mine, unassigned, flagged, flags, search])
  const title = n ? (band !== null ? n.bands.labels[band] : S >= T ? `Open ${bandTop(n.bands.edges[T - 1])} or more` : 'All open tickets') + (queue ? ` in ${queue}` : '') : ''
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <Head
        title={n?.scope === 'agent' ? 'My aging cases' : route.title}
        sub={n?.scope === 'agent' ? 'Your open tickets, coloured by how long they have waited. Stuck on one? Ask your team lead for help from its row.' : 'Every open ticket, coloured by how long it has waited. The redder the row, the longer the customer has been left.'}
        aside={n ? <AsOfHint iso={n.dataAsOf} /> : null}
      />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!n && !error ? <><Skeleton tall lines={3} /><Skeleton lines={8} /></> : null}
      {n ? (
        <>
          <section className="cx-section" aria-labelledby="ladder-h">
            <div className="cx-section__head">
              <h2 className="cx-section__title" id="ladder-h">How long open tickets have waited</h2>
              <span className="cx-section__hint">{fmt(n.total)} open. Select a band or a cell to list its tickets.</span>
            </div>
            <div className="cx-panel cx-panel--pad" style={{ display: 'grid', gap: 'var(--cx-space-4)' }}>
              <div className="cx-ladder cc-sweep-bar" role="group" aria-label="Open tickets by age">
                {(counts as number[]).map((c: number, i: number) => (
                  <button key={i} type="button" className="cx-ladder__seg cc-pick" data-age={ageRank(i, counts.length)} style={{ ['--n' as string]: Math.max(c, 4) }} aria-pressed={band === i} aria-label={`${n.bands.labels[i]}: ${c} tickets`} onClick={() => { setBand(band === i ? null : i); setShown(PAGE) }}>
                    <span>{c}</span>
                  </button>
                ))}
              </div>
              <div className="cx-ladder__legend" aria-hidden="true">
                {n.bands.labels.map((l: string, i: number) => <span key={i} style={{ ['--n' as string]: Math.max(counts[i], 4) }}>{l}</span>)}
              </div>
            </div>
            <p className="cx-hint">
              Age counts from the time the ticket was created, to now. {n.excludedGroups.join(', ')} are left out (documentation and notification-only groups). Chats are not on this board, so this total is lower than &quot;Open now&quot; on Queue health. A blue status is CX&apos;s to work; a grey one is waiting on another team or the customer.
              {n.capped ? ` Showing the oldest ${fmt(n.tickets.length)} of ${fmt(n.total)}.` : ''}
            </p>
          </section>
          <section className="cx-section" aria-labelledby="list-h">
            <div className="cx-section__head">
              <h2 className="cx-section__title" id="list-h">{title}</h2>
              <span className="cx-section__hint" aria-live="polite">{rows.length} ticket{rows.length === 1 ? '' : 's'}, oldest first</span>
            </div>
            <div className="cx-filters">
              <div className="cx-field">
                <label className="cx-label" htmlFor="f-q">Queue</label>
                <select className="cx-select" id="f-q" value={queue} onChange={(e) => { setQueue((e.target as HTMLSelectElement).value); setShown(PAGE) }}>
                  <option value="">All queues</option>
                  {queues.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              {n.scope !== 'agent' ? (
                <div className="cx-field">
                  <label className="cx-label" htmlFor="f-tl">Team lead</label>
                  <select className="cx-select" id="f-tl" value={tl} onChange={(e) => { setTl((e.target as HTMLSelectElement).value); setShown(PAGE) }}>
                    <option value="">All team leads</option>
                    {tls.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
              ) : null}
              <div className="cx-field">
                <label className="cx-label" htmlFor="f-s">Ticket number</label>
                <input className="cx-input cx-num" id="f-s" type="search" inputMode="numeric" value={search} onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />
              </div>
              {n.scope === 'tl' ? <label className="cx-toggle"><input type="checkbox" checked={mine} onChange={(e) => setMine((e.target as HTMLInputElement).checked)} /><span>My team only</span></label> : null}
              {n.scope !== 'agent' ? <label className="cx-toggle"><input type="checkbox" checked={unassigned} onChange={(e) => { setUnassigned((e.target as HTMLInputElement).checked); setShown(PAGE) }} /><span>Not assigned only</span></label> : null}
              {n.flags?.length ? <label className="cx-toggle"><input type="checkbox" checked={flagged} onChange={(e) => { setFlagged((e.target as HTMLInputElement).checked); setShown(PAGE) }} /><span>Help asked ({n.flags.length})</span></label> : null}
              <button className="cx-btn" type="button" onClick={() => { setBand(null); setTop(0); setShown(PAGE) }}>Show tickets open {bandTop(n.bands.edges[T - 1])} or more</button>
              <button className="cx-btn cx-btn--quiet" type="button" onClick={() => { setBand(null); setTop(null); setShown(PAGE) }}>Show all open</button>
            </div>
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table cx-table--nowrap">
                <thead>
                  <tr>{['Ticket', 'Queue', 'Contact type', 'Agent', ...(n.scope !== 'agent' ? ['Team lead'] : []), 'Status', 'Country', 'Age', 'Help'].map((h) => <th key={h} scope="col">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, shown).map((x: any[]) => (
                    <tr key={x[0]} data-age={ageRank(x[6], n.bands.labels.length)}>
                      <td className="cx-num"><a className="cx-mono" href={n.ticketUrl + x[0]} target="_blank" rel="noopener noreferrer" aria-label={`Open ticket ${x[0]} in Freshdesk`}>#{x[0]}</a></td>
                      <td>{x[1]}</td>
                      <td className="cx-muted">{x[10] || '–'}</td>
                      <td>{x[7] || <span className="cx-faint">Not assigned</span>}</td>
                      {n.scope !== 'agent' ? <td>{x[8] || '–'}</td> : null}
                      <td><span className="cx-chip" data-status={x[3] ? 'info' : 'neutral'} title={x[3] ? "CX's to work" : 'Waiting on another team or the customer'}>{x[2]}</span></td>
                      <td className="cx-muted">{x[4] || '–'}</td>
                      <td><AgeChip hours={x[5]} band={x[6]} /></td>
                      <td><HelpCell t={x} flag={flags.get(x[0])} scope={n.scope} onChange={reload} /></td>
                    </tr>
                  ))}
                  {!rows.length ? <tr><td colSpan={9}>No open ticket matches. Widen the filters or press Show all open.</td></tr> : null}
                </tbody>
              </table>
            </div>
            {rows.length > shown ? <button className="cx-btn" type="button" onClick={() => setShown((x) => x + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more</button> : null}
          </section>
        </>
      ) : null}
    </section>
  )
}
