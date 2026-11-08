'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Queue health page — queue.closure.js symbols
 * Ie/Ba/Na/Wa/ja/ys/Ua/Va (the cx-ladder _s, Ca filter bar, it status line,
 * count-up nn/gs and skeleton xe live in ./shared). */
import { Fragment, useRef, useState } from 'react'
import { Button } from '@/features/shared/components/ui'
import {
  AgeChip, AgeLadder, AsOfHint, Count, CxFilters, Head, LoadError, RefreshNow, StatusChip, Xe,
  ageRank, bandTop, dayAt, deltaFmt, edgeRank, fetchJson, fmt, hm, reduceMotion,
  statusLine, sweepStyle, useSe, useSweep,
} from './shared'

/** Ie — the four metric accessors behind the stat tiles. */
const METRICS: Record<string, (q: any) => number> = {
  open: (t) => t.open,
  today: (t) => t.createdToday,
  over: (t) => t.overTop,
  solved: (t) => t.resolvedToday,
}

interface StatTile {
  key: string
  label: string
  value: number
  delta: number | null
  status: string
  total?: boolean
}

/** Ba — the "Queues now" stat tiles with their deltas against the last snapshot. */
function boardStats(t: any): StatTile[] {
  const n = (i: (q: any) => number) => t.queues.reduce((h: number, p: any) => h + i(p), 0)
  const s = t.bands.edges[t.bands.edges.length - 1]
  const a = t.queues.map((i: any) => i.delta).filter((i: number | null) => i !== null)
  const l = n(METRICS.over)
  const r = t.series.find((i: any) => i.slot === t.sinceSlot)
  return [
    {
      key: 'open',
      label: 'Open now',
      value: n(METRICS.open),
      delta: a.length ? a.reduce((i: number, h: number) => i + h, 0) : null,
      status: 'neutral',
      total: true,
    },
    {
      key: 'today',
      label: 'Came in today',
      value: n(METRICS.today),
      delta: null,
      status: 'info',
      total: true,
    },
    {
      key: 'over',
      label: `Open ${bandTop(s)} or more`,
      value: l,
      delta: r ? l - r.overTop : null,
      status: l ? 'bad' : 'ok',
    },
    {
      key: 'solved',
      label: 'Resolved today',
      value: n(METRICS.solved),
      delta: null,
      status: 'ok',
      total: true,
    },
  ]
}

/** Na — the dq-stats row of pressable tiles. */
function StatTiles({ tiles, active, onPick, label }: { tiles: StatTile[]; active: string; onPick: (k: string) => void; label: string }) {
  return (
    <ul className="dq-stats" aria-label={label}>
      {tiles.map((l) => (
        <li key={l.key}>
          {/* kept raw:dq-stat is a bespoke stat tile (data-status edge + aria-pressed), not a ui/Button */}
          <button type="button" className="dq-stat" data-status={l.status} aria-pressed={active === l.key} onClick={() => onPick(active === l.key ? '' : l.key)}>
            <span className="dq-stat__label">{l.label}</span>
            <span className="dq-stat__row">
              <span className="dq-stat__value cx-num">
                <Count value={l.value} format={fmt} />
              </span>
              {l.delta !== null ? (
                <span className="dq-stat__delta cx-num" aria-label={`${deltaFmt(l.delta)} since the last snapshot`}>
                  {deltaFmt(l.delta)}
                </span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Wa — the dq-totals dl beside the stat tiles. */
function DqTotals({ d }: { d: any }) {
  const n = (a: (q: any) => number) => d.queues.reduce((l: number, r: any) => l + a(r), 0)
  const s: [string, number][] = [
    ['Ours to work', n((a) => a.actionable)],
    ['Not assigned', n((a) => a.unassigned)],
  ]
  return (
    <dl className="dq-totals">
      {s.map(([a, l]) => (
        <div key={a} className="dq-totals__item">
          <dt>{a}</dt>
          <dd className="cx-num">
            <Count value={l} format={fmt} />
          </dd>
        </div>
      ))}
    </dl>
  )
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

/** Ua — the queue board: "Queues now" totals + the "By queue" table. */
function Board() {
  const { data: t, error: n, reload: s } = useSe('queue.health', () => fetchJson('/api/queue/health'))
  const [a, l] = useState('')
  const [r, i] = useState('')
  const h = useRef<HTMLDivElement | null>(null)
  useSweep(h)
  if (n) return <LoadError message={n} onRetry={s} />
  if (!t)
    return (
      <Fragment>
        <Xe shape="tiles" n={4} />
        <Xe shape="ladder" n={6} />
      </Fragment>
    )
  const p = t.queues.reduce((m: number, b: any) => m + b.open, 0)
  const d = t.queues.reduce((m: number[], b: any) => b.bands.map((v: number, y: number) => (m[y] || 0) + v), [] as number[])
  const u = boardStats(t)
  const c = u.find((m) => m.key === a)
  const o = r.trim().toLowerCase()
  const f = t.queues.filter((m: any) => (!c || METRICS[c.key](m) > 0) && (!o || m.queue.toLowerCase().includes(o)))
  const g = (m: string) => {
    l(m)
    if (m)
      document.getElementById('queues-h')?.scrollIntoView({
        block: 'start',
        behavior: reduceMotion() ? 'auto' : 'smooth',
      })
  }
  return (
    <Fragment>
      <section className="cx-section" aria-labelledby="board-h">
        <div className="cx-section__head">
          <h2 className="cx-section__title" id="board-h">
            Queues now
          </h2>
          <span className="cx-section__hint">
            <AsOfHint iso={t.dataAsOf} /> <RefreshNow onDone={s} />
          </span>
        </div>
        <StatTiles tiles={u} active={a} onPick={g} label="Queue totals. Press one to list only the queues it counts." />
        <DqTotals d={t} />
        <div className="cx-panel cx-panel--pad" style={{ marginBlockStart: 'var(--cx-space-3)' }}>
          <p className="cx-label" style={{ marginBlockEnd: 'var(--cx-space-2)' }}>
            Open tickets by age <span className="cx-faint cx-num">{fmt(p)}</span>
          </p>
          <AgeLadder counts={d} bands={t.bands} />
        </div>
      </section>
      <section className="cx-section" aria-labelledby="queues-h">
        <div className="cx-section__head">
          <h2 className="cx-section__title" id="queues-h">
            By queue
          </h2>
          <span className="cx-section__hint">
            {c ? (
              <Fragment>
                Queues counted in “{c.label}”: {f.length} of {t.queues.length}.{' '}
                <Button variant="quiet" size="sm" onClick={() => l('')}>
                  Show all queues
                </Button>{' '}
              </Fragment>
            ) : null}
            {t.sinceSlot ? `Change is against the ${t.sinceSlot} snapshot.` : 'No snapshot yet today, so no change column.'}
          </span>
        </div>
        <CxFilters label="Filter queues" search={{ value: r, onChange: i, placeholder: 'Search queue names' }} />
        <div className="cx-panel cx-tablewrap cc-chart" ref={h}>
          <table className="cx-table">
            <thead>
              <tr>
                <th scope="col">Queue</th>
                <th scope="col" className="cx-num-col">
                  Open
                </th>
                <th scope="col" className="cx-num-col">
                  {t.sinceSlot ? `Since ${t.sinceSlot}` : 'Change'}
                </th>
                <th scope="col" className="cx-num-col">
                  Ours to work
                </th>
                <th scope="col" className="cx-num-col">
                  Not assigned
                </th>
                <th scope="col">Age mix</th>
                <th scope="col">Oldest</th>
                <th scope="col" className="cx-num-col">
                  In today
                </th>
                <th scope="col" className="cx-num-col">
                  Resolved today
                </th>
              </tr>
            </thead>
            <tbody>
              {f.length ? null : (
                <tr>
                  <td colSpan={9}>{o ? `No queue matches “${r.trim()}”.` : 'No queues in this count.'}</td>
                </tr>
              )}
              {f.map((m: any, b: number) => (
                <Fragment key={m.queue}>
                  {b > 0 && !m.ours && f[b - 1].ours ? (
                    <tr className="dq-groupbreak">
                      <th scope="colgroup" colSpan={9}>
                        Other teams
                      </th>
                    </tr>
                  ) : null}
                  <tr>
                    <th scope="row" className="dq-rowhead">
                      {m.queue}
                      {m.kind === 'chat' ? <span className="cx-faint"> (best effort)</span> : null}
                      {m.stale ? (
                        <StatusChip status="warn">
                          Stale: these figures are from the daily report of {m.sourceAsOf ? `${dayAt(m.sourceAsOf)} ${hm(m.sourceAsOf)}` : 'never'}, not
                          now. Refresh now does not update chats.
                        </StatusChip>
                      ) : null}
                      {statusLine(m.byStatus) ? <span className="dq-statusline">{statusLine(m.byStatus)}</span> : null}
                    </th>
                    <td className="cx-num-col cx-num">
                      <strong>{fmt(m.open)}</strong>
                    </td>
                    <td className="cx-num-col cx-num cx-muted">{deltaFmt(m.delta)}</td>
                    <td className="cx-num-col cx-num">{fmt(m.actionable)}</td>
                    <td className="cx-num-col cx-num">
                      {m.unassigned ? (
                        m.kind === 'ticket' ? (
                          <a href="#/aging?unassigned=1" title="Open the tickets nobody has">
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
                      <AgeBar q={m} labels={t.bands.labels} i={b} />
                    </td>
                    <td>{m.open ? <AgeChip hours={m.oldestH} band={edgeRank(m.oldestH, t.bands.edges)} /> : '–'}</td>
                    <td className="cx-num-col cx-num">{fmt(m.createdToday)}</td>
                    <td className="cx-num-col cx-num">{fmt(m.resolvedToday)}</td>
                  </tr>
                </Fragment>
              ))}
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
      <Head title={route.title} sub={route.purpose ?? 'Every queue now: open work, its age, and how it moved since the last check-in.'} />
      <Board />
    </section>
  )
}
