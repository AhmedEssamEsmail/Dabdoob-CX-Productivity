'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Queue health page — queue.closure.js symbols
 * Ie/Ba/Na/Wa/ja/ys/Ua/Va (the cx-ladder _s, Ca filter bar, it status line,
 * count-up nn/gs and skeleton xe live in ./shared). */
import { Fragment, useRef, useState } from 'react'
import {
  AgeChip, AsOfHint, Count, CxFilters, Head, LoadError, RefreshNow, StatusChip, Xe,
  ageRank, bandTop, dayAt, deltaFmt, edgeRank, fetchJson, fmt, hm,
  statusLine, sweepStyle, useSe, useSweep,
} from './shared'

/** Ie — the four metric accessors behind the stat tiles. */
const METRICS: Record<string, (q: any) => number> = {
  open: (t) => t.open,
  today: (t) => t.createdToday,
  over: (t) => t.overTop,
  solved: (t) => t.resolvedToday,
  unassigned: (t) => t.unassigned,
  ours: (t) => t.actionable,
}

/** The mock delta chip: ▲ rising, ▼ falling, – flat. */
function Delta({ n }: { n: number }) {
  return (
    <span className={`delta ${n > 0 ? 'up' : n < 0 ? 'down' : 'flat'}`} aria-label={`${deltaFmt(n)} since the last snapshot`}>
      {n > 0 ? '▲' : n < 0 ? '▼' : '–'} {fmt(Math.abs(n))}
    </span>
  )
}

interface HeadStat {
  key: string
  label: string
  value: number
  tone?: 'bad' | 'warn' | 'ok'
  sub: React.ReactNode
}

/** Ba — the five mock-04 stat cards, from the loaded queue aggregates. */
function headStats(t: any): HeadStat[] {
  const n = (i: (q: any) => number) => t.queues.reduce((h: number, p: any) => h + i(p), 0)
  const s = t.bands.edges[t.bands.edges.length - 1]
  const a = t.queues.map((i: any) => i.delta).filter((i: number | null) => i !== null)
  const r = t.series.find((i: any) => i.slot === t.sinceSlot)
  const openDelta = a.length ? a.reduce((i: number, h: number) => i + h, 0) : null
  const over = n(METRICS.over)
  const overDelta = r ? over - r.overTop : null
  const unassigned = n(METRICS.unassigned)
  const since = t.sinceSlot ? `since ${t.sinceSlot}` : 'no snapshot yet today'
  return [
    {
      key: 'open',
      label: 'Open now',
      value: n(METRICS.open),
      sub: openDelta !== null ? <Fragment><Delta n={openDelta} /> {since}</Fragment> : <span className="muted">{since}</span>,
    },
    {
      key: 'today',
      label: 'Came in today',
      value: n(METRICS.today),
      sub: <span className="muted">All channels</span>,
    },
    {
      key: 'over',
      label: `Open ${bandTop(s)}+`,
      value: over,
      tone: over ? 'bad' : 'ok',
      sub: overDelta !== null ? <Fragment><Delta n={overDelta} /> needs escalation</Fragment> : <span className="muted">{since}</span>,
    },
    {
      key: 'solved',
      label: 'Resolved today',
      value: n(METRICS.solved),
      tone: 'ok',
      sub: <span className="muted">All queues</span>,
    },
    {
      key: 'unassigned',
      label: 'Not assigned',
      value: unassigned,
      tone: unassigned ? 'warn' : 'ok',
      sub: <span>{fmt(n(METRICS.ours))} ours to work</span>,
    },
  ]
}

/** ja — the per-row dq-agebar: band slivers sized by share of the open count. */
function AgeBar({ q, labels, i }: { q: any; labels: string[]; i: number }) {
  const a = q.open || 1
  return (
    <span
      className="dq-agebar cc-sweep-bar"
      style={sweepStyle(i)}
      role="img"
      aria-label={q.bands.map((l: number, r: number) => `${labels[r]}: ${l}`).join(', ')}
    >
      {q.bands.map((l: number, r: number) =>
        l ? <i key={r} data-age={ageRank(r, q.bands.length)} style={{ inlineSize: `${(100 * l) / a}%` }} /> : null,
      )}
    </span>
  )
}

/** The mock row status pill: clear when empty, help past the top age band, watch when work needs a human. */
function rowStatus(m: any): { tone: 'ok' | 'warn' | 'bad'; label: string } | null {
  if (!m.open) return { tone: 'ok', label: 'clear' }
  if ((m.overTop ?? 0) > 0) return { tone: 'bad', label: 'help' }
  if (m.unassigned || m.stale) return { tone: 'warn', label: 'watch' }
  return null
}

/** Ua — the queue board: page head + the 5-stat row, then the "By queue" table. */
function Board({ route }: { route: { title: string; purpose?: string } }) {
  const { data: t, error: n, reload: s } = useSe('queue.health', () => fetchJson('/api/queue/health'))
  const [r, i] = useState('')
  const [ageBand, setAgeBand] = useState<number | null>(null)
  const h = useRef<HTMLDivElement | null>(null)
  useSweep(h)
  const head = (
    <Head
      title={route.title}
      sub={route.purpose ?? 'Every queue now: open work, its age, and how it moved since the last check-in.'}
      aside={<RefreshNow onDone={s} />}
    />
  )
  if (n)
    return (
      <Fragment>
        {head}
        <LoadError message={n} onRetry={s} />
      </Fragment>
    )
  if (!t)
    return (
      <Fragment>
        {head}
        <Xe shape="tiles" n={5} />
        <Xe shape="ladder" n={6} />
      </Fragment>
    )
  const p = t.queues.reduce((m: number, b: any) => m + b.open, 0)
  const d = t.queues.reduce((m: number[], b: any) => b.bands.map((v: number, y: number) => (m[y] || 0) + v), [] as number[])
  const o = r.trim().toLowerCase()
  const f = t.queues.filter(
    (m: any) => (!o || m.queue.toLowerCase().includes(o)) && (ageBand === null || (m.bands?.[ageBand] ?? 0) > 0),
  )
  const helpCount = t.queues.filter((m: any) => (m.overTop ?? 0) > 0).length
  const bandColor = (idx: number) => `var(--cx-age-${ageRank(idx, d.length)})`
  const pickBand = (idx: number) => setAgeBand((cur) => (cur === idx ? null : idx))
  return (
    <Fragment>
      {head}
      <div className="grid grid-5 mb-3">
        {headStats(t).map((m) => (
          <div key={m.key} className="stat" data-tone={m.tone}>
            <span className="stat-l">{m.label}</span>
            <span className="stat-v num">
              <Count value={m.value} format={fmt} />
            </span>
            <span className="stat-d">{m.sub}</span>
          </div>
        ))}
      </div>
      <section className="card mb-3" aria-labelledby="age-h">
        <div className="card-head">
          <div className="card-title" id="age-h">
            Open tickets by age
          </div>
          <div className="card-hint">
            {fmt(p)} open · click a band to list its tickets
            {ageBand !== null ? ` · ${t.bands.labels[ageBand] ?? 'selected band'}` : ''}
            {ageBand !== null ? (
              <button type="button" className="pill warn" onClick={() => setAgeBand(null)}>
                All ages
              </button>
            ) : null}
          </div>
        </div>
        <div className="card-pad">
          <div className="mixbar">
            {d.map((count: number, idx: number) => {
              const label = t.bands.labels[idx] ?? `Band ${idx + 1}`
              return (
                <div
                  key={`${label}-${idx}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={ageBand === idx}
                  aria-label={`${label}: ${fmt(count)}`}
                  title={`${label}: ${fmt(count)}`}
                  style={{ flexGrow: count || (p ? 0 : 1), flexShrink: 1, flexBasis: 0, background: bandColor(idx), color: `var(--cx-age-ink-${ageRank(idx, d.length)})` }}
                  onClick={() => pickBand(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      pickBand(idx)
                    }
                  }}
                >
                  {count ? <span>{fmt(count)}</span> : null}
                </div>
              )
            })}
          </div>
          <div className="mixbar-legend">
            {t.bands.labels.map((label: string, idx: number) => (
              <span key={`${label}-${idx}`}>
                <i style={{ background: bandColor(idx) }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section className="card" aria-labelledby="queues-h">
        <div className="card-head">
          <div>
            <div className="card-title" id="queues-h">
              By queue
            </div>
            <div className="card-hint">
              {t.sinceSlot ? `Change is against the ${t.sinceSlot} snapshot.` : 'No snapshot yet today, so no change column.'}{' '}
              <AsOfHint iso={t.dataAsOf} />
            </div>
          </div>
          <div className="flex">
            {helpCount ? (
              <span className="pill warn">
                {helpCount} {helpCount === 1 ? 'queue needs' : 'queues need'} help
              </span>
            ) : null}
          </div>
        </div>
        <CxFilters label="Filter queues" search={{ value: r, onChange: i, placeholder: 'Search queue names' }} />
        <div className="cc-chart" ref={h}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Queue</th>
                <th scope="col" className="num">
                  Open
                </th>
                <th scope="col" className="num">
                  {t.sinceSlot ? `Since ${t.sinceSlot}` : 'Change'}
                </th>
                <th scope="col" className="num">
                  Ours
                </th>
                <th scope="col" className="num">
                  Unassigned
                </th>
                <th scope="col" style={{ width: '9rem' }}>
                  Age mix
                </th>
                <th scope="col" className="num">
                  Oldest
                </th>
                <th scope="col" className="num">
                  In today
                </th>
                <th scope="col" className="num">
                  Resolved
                </th>
              </tr>
            </thead>
            <tbody>
              {f.length ? null : (
                <tr>
                  <td colSpan={9}>{o ? `No queue matches “${r.trim()}”.` : 'No queues in this count.'}</td>
                </tr>
              )}
              {f.map((m: any, idx: number) => {
                const st = rowStatus(m)
                return (
                  <Fragment key={m.queue}>
                    {idx > 0 && !m.ours && f[idx - 1].ours ? (
                      <tr className="dq-groupbreak">
                        <th scope="colgroup" colSpan={9}>
                          Other teams
                        </th>
                      </tr>
                    ) : null}
                    <tr>
                      <td>
                        <span className="lead">
                          {m.queue}
                          {m.kind === 'chat' ? <span className="cx-faint"> (best effort)</span> : null}
                        </span>
                        <span className="sub">{statusLine(m.byStatus)}</span>
                        {m.stale ? (
                          <StatusChip status="warn">
                            Stale: these figures are from the daily report of {m.sourceAsOf ? `${dayAt(m.sourceAsOf)} ${hm(m.sourceAsOf)}` : 'never'}, not
                            now. Refresh now does not update chats.
                          </StatusChip>
                        ) : null}
                      </td>
                      <td className="num">
                        <b>{fmt(m.open)}</b>
                      </td>
                      <td className="num">
                        {m.delta === null || m.delta === undefined ? (
                          <span className="cx-faint">–</span>
                        ) : (
                          <span className={`delta ${m.delta > 0 ? 'up' : m.delta < 0 ? 'down' : 'flat'}`}>{deltaFmt(m.delta)}</span>
                        )}
                      </td>
                      <td className="num">{fmt(m.actionable)}</td>
                      <td className="num">
                        {m.unassigned ? (
                          m.kind === 'ticket' ? (
                            <a className="rowlink" href="#/aging?unassigned=1" title="Open the tickets nobody has">
                              {m.unassigned}
                            </a>
                          ) : (
                            m.unassigned
                          )
                        ) : (
                          <span className="cx-faint">0</span>
                        )}
                      </td>
                      <td>
                        <AgeBar q={m} labels={t.bands.labels} i={idx} />
                      </td>
                      <td className="num">
                        {m.open ? <AgeChip hours={m.oldestH} band={edgeRank(m.oldestH, t.bands.edges)} /> : null}
                        {st ? <span className={`pill ${st.tone}${st.tone === 'ok' ? ' no-dot' : ''}`}>{st.label}</span> : null}
                      </td>
                      <td className="num">{fmt(m.createdToday)}</td>
                      <td className="num">{fmt(m.resolvedToday)}</td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="cx-hint">
        Our queues (customer support groups and chats) come first. Tickets from {t.excludedGroups.join(', ')}
        {t.excludedText.length ? ` and any group with “${t.excludedText.join('”, “')}” in its name` : ''} are left out: documentation of contacts already
        counted as chats or calls, and notification-only groups. Freshdesk synced {t.syncedAt ? `at ${hm(t.syncedAt)}` : 'not yet'}.
      </p>
    </Fragment>
  )
}

/** Va — the route component. */
export function QueuePage({ route }: { route: { title: string; purpose?: string } }) {
  return (
    <section className="cxp dq-page" aria-labelledby="page-title">
      <Board route={route} />
    </section>
  )
}
