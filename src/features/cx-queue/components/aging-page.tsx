'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Aging page (aging.closure.js symbol za). */
import { useMemo, useState } from 'react'
import { Button, Field, Input, Select, Toggle } from '@/features/shared/components/ui'
import { AgeChip, AgeLadder, AsOfHint, LoadError, RefreshNow, Skeleton, ageRank, bandTop, fetchJson, fmt, hm, useHashParams, useSe } from './shared'
import { D } from '@/features/shared/shell/i18n'

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
        <Button variant="quiet" disabled={busy} onClick={() => run(() => fetchJson('/api/queue/aging-flags', { flag_id: flag.flagId, resolved_note: '' }))}>
          Mark handled
        </Button>
        {err ? <span role="alert"> {err}</span> : null}
      </span>
    )
  if (scope !== 'agent') return <span className="cx-faint">–</span>
  return open ? (
    <span className="dq-help">
      <Input aria-label={`What is blocking ticket ${t[0]}`} placeholder="What is blocking it, what you need" value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} />{' '}
      <Button disabled={busy} onClick={() => run(() => fetchJson('/api/queue/aging-flags', { ticket_id: t[0], note }))}>Send</Button>{' '}
      <Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button>
      {err ? <span role="alert"> {err}</span> : null}
    </span>
  ) : flag ? (
    <span className="cx-chip" data-status="warn" title={flag.note}>Asked {flag.at ? '' : ''}: waiting on your TL</span>
  ) : (
    <Button variant="quiet" onClick={() => setOpen(true)} aria-label={`Ask your team lead for help with ticket ${t[0]}`}>
      Ask my TL for help
    </Button>
  )
}

export function AgingPage({ route }: { route: { title: string } }) {
  const { data: n, error, reload } = useSe('queue.aging', () => fetchJson('/api/queue/aging'))
  const params = useHashParams()
  const deep = params.has('unassigned') || params.has('flagged') || params.has('ticket')
  const [band, setBand] = useState<number | null>(null)
  const [top, setTop] = useState<number | null>(deep ? 0 : null)
  const [queue, setQueue] = useState('')
  const [tl, setTl] = useState('')
  const [search, setSearch] = useState(params.get('ticket') ?? '')
  const [mine, setMine] = useState(params.get('mine') === '1')
  const [assign, setAssign] = useState<'all' | 'ours' | 'unassigned'>(params.get('unassigned') === '1' ? 'unassigned' : 'all')
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
  const grid = useMemo(() => {
    const x: Record<string, number[]> = {}
    n?.tickets.forEach((P: any[]) => {
      const U = x[(P[1] as string)] || (x[P[1]] = n.bands.labels.map(() => 0))
      U[Math.min(P[6], U.length - 1)]++
    })
    return Object.entries(x).sort((P, U) => U[1].reduce((V, de) => V + de, 0) - P[1].reduce((V, de) => V + de, 0))
  }, [n])
  const rows = useMemo(() => {
    if (!n) return []
    const x = search.trim()
    return n.tickets.filter(
      (P: any[]) => (band === null ? P[6] >= S : P[6] === band) && (!queue || P[1] === queue) && (!tl || P[8] === tl) && (!mine || P[9]) && (assign === 'all' || (assign === 'unassigned' ? !P[7] : !!P[7])) && (!flagged || flags.has(P[0])) && (!x || String(P[0]).includes(x))
    )
  }, [n, band, S, queue, tl, mine, assign, flagged, flags, search])
  const pick = (x: number | null, P = '') => {
    setBand(x)
    setQueue(P)
    setShown(PAGE)
  }
  const showAll = (x: boolean) => {
    setBand(null)
    setTop(x ? 0 : null)
    setQueue('')
    setTl('')
    setSearch('')
    setAssign('all')
    setFlagged(false)
    setShown(PAGE)
  }
  const title = n ? (band !== null ? n.bands.labels[band] : S >= T ? `Open ${bandTop(n.bands.edges[T - 1])} or more` : 'All open tickets') + (queue ? ` in ${queue}` : '') : ''
  const topCount = counts[counts.length - 1] ?? 0
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <header className="page-head">
        <div>
          <h1 id="page-title" className="page-title">
            {n?.scope === 'agent' ? D('My aging cases') : route.title}
          </h1>
          <p className="page-sub">
            {n?.scope === 'agent'
              ? D('Your open tickets, coloured by how long they have waited. Stuck on one? Ask your team lead for help from its row.')
              : D('Every open ticket, coloured by how long it has waited. The redder the row, the longer the customer has been left.')}
          </p>
        </div>
        <div className="page-actions">
          <div className="seg" role="group" aria-label={D('Assignment')}>
            {(
              [
                ['all', D('All')],
                ['ours', D('Ours')],
                ['unassigned', D('Unassigned')],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={assign === v ? 'on' : ''}
                aria-pressed={assign === v}
                onClick={() => {
                  setAssign(v)
                  setShown(PAGE)
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {n ? (
            <>
              <AsOfHint iso={n.dataAsOf} />
              {n.scope !== 'agent' ? <RefreshNow onDone={reload} /> : null}
            </>
          ) : null}
        </div>
      </header>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {n?.scope === 'agent' ? (
        <p className="cx-hint">
          Freshdesk is read every 15 minutes, about 20 minutes behind. A ticket you have just resolved stays on this list until the next read
          {n.syncedAt ? ` (last one ${hm(n.syncedAt)} Kuwait)` : ''}.
        </p>
      ) : null}
      {!n && !error ? <><Skeleton tall lines={3} /><Skeleton lines={8} /></> : null}
      {n ? (
        <>
          <section className="card mb-3" aria-labelledby="dist-h">
            <div className="card-head">
              <div>
                <h2 id="dist-h" className="card-title" style={{ margin: 0 }}>
                  {D('Wait-time distribution')}
                </h2>
                <div className="card-hint">{D('Select a band to filter the matrix below')}</div>
              </div>
            </div>
            <div className="card-pad">
              <div className="mixbar">
                {(counts as number[]).map((c, i) => {
                  const r = Number(ageRank(i, counts.length))
                  return (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      aria-pressed={band === i && !queue}
                      aria-label={`${n.bands.labels[i]}: ${c} tickets`}
                      style={{
                        flex: Math.max(c, 0.5),
                        background: `var(--cx-age-${r})`,
                        color: `var(--cx-age-ink-${r})`,
                        cursor: 'pointer',
                      }}
                      onClick={() => pick(band === i && !queue ? null : i)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          pick(band === i && !queue ? null : i)
                        }
                      }}
                    >
                      <span>{c}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mixbar-legend">
                {(counts as number[]).map((c, i) => {
                  const r = Number(ageRank(i, counts.length))
                  return (
                    <span key={i}>
                      <i style={{ background: `var(--cx-age-${r})` }} />
                      {n.bands.labels[i]}
                    </span>
                  )
                })}
              </div>
            </div>
          </section>
          <section className="cx-section" aria-labelledby="ladder-h">
            <div className="cx-section__head">
              <h2 className="cx-section__title" id="ladder-h">How long open tickets have waited</h2>
              <span className="cx-section__hint">{fmt(n.total)} open. Select a band or a cell to list its tickets.</span>
            </div>
            <div className="cx-panel cx-panel--pad" style={{ display: 'grid', gap: 'var(--cx-space-4)' }}>
              <AgeLadder counts={counts as number[]} bands={n.bands} pressed={queue ? null : band} onPick={(x) => pick(x)} />
            </div>
            {grid.length > 1 ? (
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title">By queue × age</div>
                    <div className="card-hint">Select a cell to list its tickets</div>
                  </div>
                  {topCount > 0 ? (
                    <span className="pill bad">
                      {fmt(topCount)} tickets &gt; {bandTop(n.bands.edges[T - 1])}
                    </span>
                  ) : null}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl" style={{ minWidth: '64rem' }}>
                    <thead>
                      <tr>
                        <th>Queue</th>
                        {n.bands.labels.map((x: string) => (
                          <th key={x} scope="col" className="num">{x}</th>
                        ))}
                        <th scope="col" className="num">All</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grid.map(([x, P]) => (
                        <tr key={x}>
                          <td className="lead">{x}</td>
                          {P.map((U, V) => (
                            <td key={V} className="num">
                              <button
                                type="button"
                                className="cx-agechip"
                                data-age={ageRank(V, n.bands.labels.length)}
                                data-zero={U === 0 ? 'true' : undefined}
                                aria-pressed={band === V && queue === x}
                                aria-label={`${x}, ${n.bands.labels[V]}: ${U} tickets`}
                                style={{
                                  border: 0,
                                  cursor: 'pointer',
                                  width: '100%',
                                  justifyContent: 'center',
                                  ...(U === 0
                                    ? { background: 'var(--cx-surface-2)', color: 'var(--cx-ink-3)', fontWeight: 'var(--cx-weight-regular)' }
                                    : {}),
                                }}
                                onClick={() => pick(V, x)}
                              >
                                {U}
                              </button>
                            </td>
                          ))}
                          <td className="num"><b>{P.reduce((U, V) => U + V, 0)}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card-pad small faint">
                  Age counts from ticket creation to now. Colour goes grey → deep red as the wait grows. Source: Freshdesk; {n.excludedGroups.join(', ')} groups left out.
                </div>
              </div>
            ) : null}
            <p className="cx-hint">
              Age counts from the time the ticket was created, to now. Colour goes from grey to deep red as the wait grows, and the stripe on each row gets thicker. {n.excludedGroups.join(', ')} are left out (documentation and notification-only groups). Chats are not on this board (they come from the daily report), so this total is lower than &quot;Open now&quot; on Queue health. A blue status is CX&apos;s to work; a grey one is waiting on another team or the customer.
              {n.capped ? ` Showing the oldest ${fmt(n.tickets.length)} of ${fmt(n.total)}.` : ''}
            </p>
          </section>
          <section className="cx-section" aria-labelledby="list-h">
            <div className="cx-section__head">
              <h2 className="cx-section__title" id="list-h">{title}</h2>
              <span className="cx-section__hint" aria-live="polite">{rows.length} ticket{rows.length === 1 ? '' : 's'}, oldest first</span>
            </div>
            <div className="cx-filters">
              <Field label="Queue">
                <Select id="f-q" value={queue} onChange={(e) => { setQueue((e.target as HTMLSelectElement).value); setShown(PAGE) }}>
                  <option value="">All queues</option>
                  {queues.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              {n.scope !== 'agent' ? (
                <Field label="Team lead">
                  <Select id="f-tl" value={tl} onChange={(e) => { setTl((e.target as HTMLSelectElement).value); setShown(PAGE) }}>
                    <option value="">All team leads</option>
                    {tls.map((x) => <option key={x}>{x}</option>)}
                  </Select>
                </Field>
              ) : null}
              <Field label="Ticket number">
                <Input id="f-s" type="search" inputMode="numeric" className="cx-num" value={search} onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />
              </Field>
              {n.scope === 'tl' ? <Toggle checked={mine} onChange={setMine}>My team only</Toggle> : null}
              {n.scope !== 'agent' ? <Toggle checked={assign === 'unassigned'} onChange={(v) => { setAssign(v ? 'unassigned' : 'all'); setShown(PAGE) }}>Not assigned only</Toggle> : null}
              {n.flags?.length ? <Toggle checked={flagged} onChange={(v) => { setFlagged(v); setShown(PAGE) }}>Help asked ({n.flags.length})</Toggle> : null}
              <Button type="button" onClick={() => showAll(false)}>Show tickets open {bandTop(n.bands.edges[T - 1])} or more</Button>
              <Button variant="quiet" type="button" onClick={() => showAll(true)}>Show all open</Button>
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
            {rows.length > shown ? <Button type="button" onClick={() => setShown((x) => x + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more</Button> : null}
          </section>
        </>
      ) : null}
    </section>
  )
}
