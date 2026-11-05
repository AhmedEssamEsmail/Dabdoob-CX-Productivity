'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port. */
/* Port of the legacy Agents scoreboard (Aggregates.js getAgentsPage + agents.closure.js). */
import { useState } from 'react'
import { Head, AsOfHint, LoadError, Skeleton, fetchJson, useSe } from './shared'

export function AgentsPage({ route }: { route: { title: string } }) {
  const { data: n, error, reload } = useSe('people.agents', () => fetchJson('/api/people/agents'))
  const [search, setSearch] = useState('')
  const rows = (n?.agents ?? []).filter((a: any) => !search || String(a.name).toLowerCase().includes(search.toLowerCase()) || String(a.email).includes(search))
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <Head
        title={route.title}
        sub={n?.scope === 'tl' ? 'Your team\'s productivity, quality and activity for the period.' : 'Every agent\'s productivity, quality and activity for the period.'}
        aside={n ? <AsOfHint iso={n.dataAsOf} what="the aggregates job" /> : null}
      />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!n && !error ? <Skeleton tall lines={8} /> : null}
      {n ? (
        <section className="cx-section" aria-labelledby="agents-h">
          <div className="cx-section__head">
            <h2 className="cx-section__title" id="agents-h">Agents</h2>
            <span className="cx-section__hint" aria-live="polite">{rows.length} agent{rows.length === 1 ? '' : 's'} · {n.period}</span>
          </div>
          <div className="cx-filters">
            <div className="cx-field">
              <label className="cx-label" htmlFor="a-s">Search</label>
              <input className="cx-input" id="a-s" type="search" value={search} onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />
            </div>
          </div>
          <div className="cx-panel cx-tablewrap">
            <table className="cx-table cx-table--nowrap">
              <thead>
                <tr>{['Agent', ...(n.scope !== 'tl' ? ['Team lead'] : []), 'Overall', 'Inbound', 'Texting', 'WhatsApp', 'Productive', 'Idle', 'Audits', 'Avg score'].map((h) => <th key={h} scope="col">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((a: any) => (
                  <tr key={a.email}>
                    <td>{a.name}<div className="cx-faint">{a.email}</div></td>
                    {n.scope !== 'tl' ? <td>{a.tlName || '–'}</td> : null}
                    <td className="cx-num">{a.overallPct === null ? '–' : a.overallPct + '%'}</td>
                    <td className="cx-num">{a.inboundPct === null ? '–' : a.inboundPct + '%'}</td>
                    <td className="cx-num">{a.textingPct === null ? '–' : a.textingPct + '%'}</td>
                    <td className="cx-num">{a.waPct === null ? '–' : a.waPct + '%'}</td>
                    <td className="cx-num">{a.productiveMin ? Math.round(a.productiveMin / 60) + ' h' : '–'}</td>
                    <td className="cx-num">{a.idleMin ? Math.round(a.idleMin / 60) + ' h' : '–'}</td>
                    <td className="cx-num">{a.audits || '–'}</td>
                    <td className="cx-num">{a.avgScore === null ? '–' : a.avgScore}</td>
                  </tr>
                ))}
                {!rows.length ? <tr><td colSpan={10}>No agent matches.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <p className="cx-hint">Data as of the last agent-aggregates run: {n.dataAsOf || 'not run yet'}.</p>
        </section>
      ) : null}
    </section>
  )
}
