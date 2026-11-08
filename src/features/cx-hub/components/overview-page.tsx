'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */

/* verbatim port of the legacy Rg overview page (Home): dq-page header,
 * up-next, ecosystem link, needs cards, per-role bodies (admin board mu,
 * TL dayrail + oldest, specialist note, agent oldest). */

import { Fragment, useRef, useState } from 'react'
import { Button } from '@/features/shared/components/ui'
import {
  Ao, Df, du, Eo, fg, Ft, Gf, gg, Gs, gu, Hf, Hi, If, jl, Kf, km, lo, Nf,
  Of, pg, Ql, rg, sh, To, useTh, Vi, Wf, Yn, _g,
} from './hub-shared'

type Q = Record<string, any>

function Ag(n: Q) {
  const e = n.slots.find((i: Q) => i.state === 'due') || n.slots.find((i: Q) => i.state === 'upcoming')
  if (!e) return null
  const t = e.state === 'due'
  return {
    at: e.slot,
    title: `${e.name} check-in`,
    live: t,
    meta: t ? `Due by ${Yn(e.dueAt)}.` : `Opens at ${Yn(e.at)}.`,
    action: t ? { label: 'Start', href: '#/checkins' } : void 0,
  }
}
function Cg(n: Q) {
  const e = n.slots.filter((s: Q) => s.state === 'due' || s.state === 'upcoming').length
  const t = n.needs.filter((s: Q) => s.count > 0).length
  return `${[
    n.slots.length
      ? e
        ? `${e} of ${n.slots.length} check-ins left today`
        : 'All check-ins done for today'
      : '',
    t ? `${t} thing${t === 1 ? '' : 's'} need${t === 1 ? 's' : ''} you` : 'Nothing needs you right now',
  ]
    .filter(Boolean)
    .join(', ')}.`
}

function Mg(n: Q, e: number): string {
  if (n.state === 'done') return `${String(n.submittedBy).split('@')[0].replace('.', ' ')}, ${Yn(n.submittedAt)}`
  if (n.state === 'due') return 'Due now. Not submitted yet.'
  if (n.state === 'missed') return 'Missed. Not submitted.'
  const t = Math.max(0, Math.round((new Date(n.at).getTime() - e) / 6e4))
  return t >= 60 ? `In ${Math.floor(t / 60)} h ${t % 60} min` : `In ${t} min`
}
const yg: Record<string, string> = { done: 'ok', due: 'warn', missed: 'bad', upcoming: 'neutral' }

function Sg({ slots, now }: { slots: Q[]; now: string }) {
  const t = new Date(now).getTime()
  return (
    <ol className="cx-dayrail" aria-label="Check-ins today">
      {slots.map((i) => (
        <li key={i.slot} className="cx-dayrail__slot" data-status={yg[i.state]} aria-current={i.state === 'due' ? 'step' : undefined}>
          <span className="cx-dayrail__time">{i.slot}</span>
          <span className="cx-dayrail__name">{i.name}</span>
          <span className="cx-dayrail__who">{Mg(i, t)}</span>
        </li>
      ))}
    </ol>
  )
}

function _u({ rows, title, empty, ticketUrl, showAgent, allLink }: Q) {
  return (
    <section className="cx-section" aria-labelledby="oldest-h">
      <div className="cx-section__head">
        <h2 className="cx-section__title" id="oldest-h">
          {title}
        </h2>
        <a href={allLink}>All aging cases</a>
      </div>
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Ticket</th>
              {showAgent ? <th scope="col">Agent</th> : null}
              <th scope="col">Queue</th>
              <th scope="col">Status</th>
              <th scope="col">Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((a: Q) => (
                <tr key={a.id} data-age={Ao(a.band)}>
                  <td className="cx-num">
                    {ticketUrl ? (
                      <a href={ticketUrl + a.id} target="_blank" rel="noopener noreferrer">
                        #{a.id}
                      </a>
                    ) : (
                      `#${a.id}`
                    )}
                  </td>
                  {showAgent ? (
                    <td>{a.agent || <span className="cx-faint">Not assigned</span>}</td>
                  ) : null}
                  <td>{a.queue}</td>
                  <td className="cx-muted">{a.status}</td>
                  <td>
                    <Gf hours={a.ageH} band={a.band} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={showAgent ? 5 : 4}>{empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ admin board */
const gr: Record<string, (n: Q) => number> = {
  open: (n) => n.open,
  today: (n) => n.createdToday,
  over: (n) => n.overTop,
  solved: (n) => n.resolvedToday,
}
function Eg(n: Q) {
  const e = (a: (c: Q) => number) => n.queues.reduce((o: number, c: Q) => o + a(c), 0)
  const t = n.bands.edges[n.bands.edges.length - 1]
  const i = n.queues.map((a: Q) => a.delta).filter((a: number | null) => a !== null)
  const s = e(gr.over)
  const r = n.series.find((a: Q) => a.slot === n.sinceSlot)
  return [
    { key: 'open', label: 'Open now', value: e(gr.open), delta: i.length ? i.reduce((a: number, o: number) => a + o, 0) : null, status: 'neutral', total: !0 },
    { key: 'today', label: 'Came in today', value: e(gr.today), delta: null, status: 'info', total: !0 },
    { key: 'over', label: `Open ${gg(t)} or more`, value: s, delta: r ? s - r.overTop : null, status: s ? 'bad' : 'ok' },
    { key: 'solved', label: 'Resolved today', value: e(gr.solved), delta: null, status: 'ok', total: !0 },
  ]
}
function Tg({ d }: { d: Q }) {
  const e = (i: (r: Q) => number) => d.queues.reduce((s: number, r: Q) => s + i(r), 0)
  const t: [string, number][] = [
    ['Ours to work', e((i) => i.actionable)],
    ['Not assigned', e((i) => i.unassigned)],
  ]
  return (
    <dl className="dq-totals">
      {t.map(([i, s]) => (
        <div key={i} className="dq-totals__item">
          <dt>{i}</dt>
          <dd className="cx-num">
            <Kf value={s} format={Hi} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
function vg({ tiles, active, onPick, label }: Q) {
  return (
    <ul className="dq-stats" aria-label={label}>
      {tiles.map((s: Q) => (
        <li key={s.key}>
          {/* eslint-disable-next-line -- kept raw: dq-stat is a full stat tile, not a button */}
          <button
            type="button"
            className="dq-stat"
            data-status={s.status}
            aria-pressed={active === s.key}
            onClick={() => onPick(active === s.key ? '' : s.key)}
          >
            <span className="dq-stat__label">{s.label}</span>
            <span className="dq-stat__row">
              <span className="dq-stat__value cx-num">
                <Kf value={s.value} format={Hi} />
              </span>
              {s.delta !== null ? (
                <span className="dq-stat__delta cx-num" aria-label={`${Ql(s.delta)} since the last snapshot`}>
                  {Ql(s.delta)}
                </span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
function wg({ q, labels, i: t }: { q: Q; labels: string[]; i: number }) {
  const i = q.open || 1
  return (
    <span
      className="dq-agebar cc-sweep-bar"
      style={km(t)}
      role="img"
      aria-label={q.bands.map((s: number, r: number) => `${labels[r]}: ${s}`).join(', ')}
    >
      {q.bands.map((s: number, r: number) =>
        s ? (
          <i key={r} data-age={Ao(r, q.bands.length)} style={{ inlineSize: `${(100 * s) / i}%` }} />
        ) : null
      )}
    </span>
  )
}
function xg({ iso, what = 'Freshdesk' }: { iso: string; what?: string }) {
  return iso ? (
    <span className="cx-section__hint">
      {what}, read {To(iso)} at {Yn(iso)} Kuwait time
    </span>
  ) : (
    <span className="cx-section__hint">No data yet: the first scheduled run has not finished.</span>
  )
}

function OvIco({ s }: { s: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      {s === 'bad' ? (
        <Fragment>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </Fragment>
      ) : s === 'warn' ? (
        <Fragment>
          <path d="M4 21V4" />
          <path d="M4 4h13l-2.5 4L17 12H4" />
        </Fragment>
      ) : s === 'ok' ? (
        <Fragment>
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </Fragment>
      ) : (
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      )}
    </svg>
  )
}

const OV_CSS =
  '.ov-main{display:grid;grid-template-columns:1.7fr 1fr;gap:1rem;align-items:start}' +
  '@media (max-width:900px){.ov-main{grid-template-columns:1fr}}'

function Mu() {
  const { data: n, error: e, reload: t } = Eo(Of.queueHealth)
  const [i, s] = useState('')
  const [r, a] = useState('')
  const o = useRef<HTMLDivElement | null>(null)
  useTh(o)
  if (e) return sh({ message: e, onRetry: t })
  if (!n)
    return (
      <Ft>
        <LoTiles />
        <LoLadder />
      </Ft>
    )
  const c = n.queues.reduce((y: number, v: Q) => y + v.open, 0)
  const l = n.queues.reduce((y: number[], v: Q) => v.bands.map((m: number, E: number) => (y[E] || 0) + m), [])
  const h = Eg(n)
  const u = h.find((y) => y.key === i)
  const d = r.trim().toLowerCase()
  const p = n.queues.filter(
    (y: Q) => (!u || (gr[u.key] as (x: Q) => number)(y) > 0) && (!d || y.queue.toLowerCase().includes(d))
  )
  const g = (y: string) => {
    s(y)
    if (y)
      document.getElementById('queues-h')?.scrollIntoView({ block: 'start', behavior: Gs() ? 'auto' : 'smooth' })
  }
  return (
    <Ft>
      <section className="cx-section" aria-labelledby="board-h">
        <div className="cx-section__head">
          <h2 className="cx-section__title" id="board-h">
            Queues now
          </h2>
          <span className="cx-section__hint">
            {xg({ iso: n.dataAsOf })} <Hf onDone={t} />
          </span>
        </div>
        {vg({ tiles: h, active: i, onPick: g, label: 'Queue totals. Press one to list only the queues it counts.' })}
        <Tg d={n} />
        <div className="cx-panel cx-panel--pad" style={{ marginBlockStart: 'var(--cx-space-3)' }}>
          <p className="cx-label" style={{ marginBlockEnd: 'var(--cx-space-2)' }}>
            Open tickets by age <span className="cx-faint cx-num">{Hi(c)}</span>
          </p>
          <Wf counts={l} bands={n.bands} />
        </div>
      </section>
      <section className="cx-section" aria-labelledby="queues-h">
        <div className="cx-section__head">
          <h2 className="cx-section__title" id="queues-h">
            By queue
          </h2>
          <span className="cx-section__hint">
            {u ? (
              <Ft>
                Queues counted in “{u.label}”: {p.length} of {n.queues.length}.{' '}
                <Button type="button" className="btn btn-quiet btn-small" onClick={() => s('')}>
                  Show all queues
                </Button>{' '}
              </Ft>
            ) : null}
            {n.sinceSlot ? `Change is against the ${n.sinceSlot} snapshot.` : 'No snapshot yet today, so no change column.'}
          </span>
        </div>
        {rg({ label: "Filter queues", search: { value: r, onChange: a, placeholder: "Search queue names" } })}
        <div className="cx-panel cx-tablewrap cc-chart" ref={o}>
          <table className="cx-table">
            <thead>
              <tr>
                <th scope="col">Queue</th>
                <th scope="col" className="cx-num-col">Open</th>
                <th scope="col" className="cx-num-col">{n.sinceSlot ? `Since ${n.sinceSlot}` : 'Change'}</th>
                <th scope="col" className="cx-num-col">Ours to work</th>
                <th scope="col" className="cx-num-col">Not assigned</th>
                <th scope="col">Age mix</th>
                <th scope="col">Oldest</th>
                <th scope="col" className="cx-num-col">In today</th>
                <th scope="col" className="cx-num-col">Resolved today</th>
              </tr>
            </thead>
            <tbody>
              {p.length ? null : (
                <tr>
                  <td colSpan={9}>{d ? `No queue matches “${r.trim()}”.` : 'No queues in this count.'}</td>
                </tr>
              )}
              {p.map((y: Q, v: number) => (
                <Fragment key={y.queue}>
                  {v > 0 && !y.ours && p[v - 1].ours ? (
                    <tr className="dq-groupbreak">
                      <th scope="colgroup" colSpan={9}>
                        Other teams
                      </th>
                    </tr>
                  ) : null}
                  <tr>
                    <th scope="row" className="dq-rowhead">
                      {y.queue}
                      {y.kind === 'chat' ? <span className="cx-faint"> (best effort)</span> : null}
                      {y.stale ? (
                        <_g status="warn">
                          Stale: these figures are from the daily report of{' '}
                          {y.sourceAsOf ? `${To(y.sourceAsOf)} ${Yn(y.sourceAsOf)}` : 'never'}, not
                          now. Refresh now does not update chats.
                        </_g>
                      ) : null}
                      {du(y.byStatus) ? <span className="dq-statusline">{du(y.byStatus)}</span> : null}
                    </th>
                    <td className="cx-num-col cx-num">
                      <strong>{Hi(y.open)}</strong>
                    </td>
                    <td className="cx-num-col cx-num cx-muted">{Ql(y.delta)}</td>
                    <td className="cx-num-col cx-num">{Hi(y.actionable)}</td>
                    <td className="cx-num-col cx-num">
                      {y.unassigned ? (
                        y.kind === 'ticket' ? (
                          <a href="#/aging?unassigned=1" title="Open the tickets nobody has">
                            {y.unassigned}
                          </a>
                        ) : (
                          y.unassigned
                        )
                      ) : (
                        <span className="cx-faint">0</span>
                      )}
                    </td>
                    <td>
                      {wg({ q: y, labels: n.bands.labels, i: v })}
                    </td>
                    <td>{y.open ? <Gf hours={y.oldestH} band={pg(y.oldestH, n.bands.edges)} /> : '–'}</td>
                    <td className="cx-num-col cx-num">{Hi(y.createdToday)}</td>
                    <td className="cx-num-col cx-num">{Hi(y.resolvedToday)}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="cx-hint">
        Our queues (customer support groups and chats) come first. Tickets from{' '}
        {n.excludedGroups.join(', ')}
        {n.excludedText.length ? ` and any group with “${n.excludedText.join('”, “')}” in its name` : ''}{' '}
        are left out: documentation of contacts already counted as chats or calls, and
        notification-only groups. Freshdesk synced{' '}
        {n.syncedAt ? `at ${Yn(n.syncedAt)}` : 'not yet'}.
      </p>
    </Ft>
  )
}

const LoTiles = () => lo({ shape: 'tiles', n: 4 })
const LoLadder = () => lo({ shape: 'ladder', n: 6 })

export function OverviewPage({ route: n }: { route: { title: string } }) {
  const { data: e, error: t, reload: i } = Eo(Vi.home)
  const s = e ? String(e.name).split(' ')[0] : ''
  const r = e && !e.specialist && e.role !== 'agent' ? Ag(e) : null
  const edgeCount = e?.bands?.edges?.length ?? 0
  const topEdge = edgeCount ? e.bands.edges[edgeCount - 1] : 0
  const aged = edgeCount ? (e.ladder?.[edgeCount] ?? 0) : 0
  const homeNeeds = (e?.needs ?? []) as { id?: string; count?: number }[]
  const flags = homeNeeds
    .filter((c) => c.id === 'aging-help' || c.id === 'checkin-help')
    .reduce((a, c) => a + (c.count ?? 0), 0)
  const unassigned = homeNeeds.find((c) => c.id === 'unassigned')?.count ?? 0
  const homeSlots = (e?.slots ?? []) as { state?: string }[]
  const slotsDone = homeSlots.filter((x) => x.state === 'done').length
  const slotsTotal = homeSlots.length
  const needsRows = ((e?.needs ?? []) as Q[]).filter((i) => (i.count ?? 0) > 0)
  const ovQueues = ((e?.queues ?? []) as Q[]).slice(0, 6)
  const qMax = Math.max(1, ...ovQueues.map((q) => Number(q.open) || 0))
  const bandLabels = (e?.bands?.labels ?? []) as string[]
  const bandTotal = Math.max(
    1,
    Number(e?.openTotal) ||
      ((e?.ladder ?? []) as number[]).reduce((a: number, c) => a + (Number(c) || 0), 0)
  )
  const pulseRows = bandLabels
    .map((label, i) => ({ label, count: Number(e?.ladder?.[i]) || 0, i }))
    .filter((r) => r.count > 0)
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!e && !t}>
      <header className="page-head">
        <div>
          <h1 id="page-title" className="page-title">
            {e ? `${Df(Number(Yn(e.now).slice(0, 2)))}, ${s}` : n.title}
          </h1>
          {e ? (
            <p className="page-sub">
              {To(e.now)}, {Yn(e.now)} Kuwait ·{' '}
              {!e.specialist && e.role !== 'agent'
                ? Cg(e)
                : e.specialist
                  ? 'Your open actions and the coaching signals you sent.'
                  : e.role === 'agent'
                    ? 'Your oldest open tickets first.'
                    : e.role === 'tl'
                      ? 'What needs you now, then your day in order.'
                      : 'What is red right now, and which queue or team lead it sits with.'}
            </p>
          ) : null}
        </div>
        {e ? (
          <div className="page-actions">
            {e.role !== 'agent' ? <Hf onDone={i} /> : null}
            {r ? <If item={r} /> : null}
          </div>
        ) : null}
      </header>
      {e ? (
        <div className="grid grid-4 mb-3">
          <div className="stat" data-tone={aged ? 'bad' : 'ok'}>
            <span className="stat-l">Open {gg(topEdge)}+</span>
            <span className="stat-v num">{Hi(aged)}</span>
            <span className="stat-d">
              {aged ? 'in the oldest band' : 'nothing in the oldest band'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-l">Open now</span>
            <span className="stat-v num">{Hi(e.openTotal ?? 0)}</span>
            <span className="stat-d">
              {unassigned ? `${Hi(unassigned)} not assigned` : 'all assigned'}
            </span>
          </div>
          <div className="stat" data-tone={flags ? 'warn' : 'ok'}>
            <span className="stat-l">Flags to review</span>
            <span className="stat-v num">{Hi(flags)}</span>
            <span className="stat-d">
              {flags ? 'agents and leads asking for help' : 'nothing waiting on review'}
            </span>
          </div>
          <div className="stat" data-tone="ok">
            <span className="stat-l">Check-ins in today</span>
            <span className="stat-v num">{Hi(slotsDone)}</span>
            <span className="stat-d">
              {slotsTotal
                ? slotsDone === slotsTotal
                  ? 'all done'
                  : `${Hi(slotsTotal - slotsDone)} still to come`
                : 'no check-ins today'}
            </span>
          </div>
        </div>
      ) : t ? null : (
        <LoTiles />
      )}
      {t ? sh({ message: t, onRetry: i }) : null}
      {r ? <Nf item={r} /> : null}
      {e && e.role !== 'agent' && !e.specialist && e.ecosystem ? (
        <section className="cx-section" aria-label="CX ecosystem">
          {gu() ? (
            <p className="cx-ecosystem-link">
              <a className="btn" href={gu()} target="_blank" rel="noopener">
                Ecosystem
              </a>{' '}
              <span className="cx-section__hint">Every system&apos;s health as a 3D map, in a new tab.</span>
            </p>
          ) : (
            <p className="cx-section__hint">
              The ecosystem map opens once the Hub&apos;s web-app URL is set in Admin, Connected apps.
            </p>
          )}
        </section>
      ) : null}
      {e ? (
        <div className="ov-main">
          <style dangerouslySetInnerHTML={{ __html: OV_CSS }} />
          <section className="card" aria-labelledby="needs-h">
            <div className="card-head">
              <div>
                <h2 id="needs-h" className="card-title" style={{ margin: 0 }}>
                  {e.role === 'tl' ? 'Do now' : 'Needs you today'}
                </h2>
                <div className="card-hint">Ordered by how long each has waited.</div>
              </div>
            </div>
            {needsRows.length ? (
              <div className="worklist">
                {needsRows.map((i) => {
                  const who = ((i.who ?? []) as string[]).slice(0, 2).join(' · ')
                  const waited = Number(i.waitedH) || 0
                  return (
                    <a key={i.id} className="workitem" href={i.link}>
                      <span className={`wi-ico${i.status && i.status !== 'neutral' ? ` ${i.status}` : ''}`}>
                        <OvIco s={String(i.status ?? '')} />
                      </span>
                      <div className="wi-main">
                        <div className="wi-t">{i.title}</div>
                        <div className="wi-s">{who}</div>
                      </div>
                      <div className="wi-side">
                        <div className="t">{Hi(Number(i.count) || 0)}</div>
                        <div className="s">{waited ? fg(waited) : 'open'}</div>
                      </div>
                    </a>
                  )
                })}
              </div>
            ) : (
              <div className="empty">
                <div className="s">Nothing is waiting on you.</div>
              </div>
            )}
          </section>
          <div className="grid" style={{ alignContent: 'start' }}>
            <section className="card" aria-labelledby="ovq-h">
              <div className="card-head">
                <h2 id="ovq-h" className="card-title" style={{ margin: 0 }}>
                  Queues right now
                </h2>
                <a className="card-hint" href="#/queue">
                  Open →
                </a>
              </div>
              {ovQueues.length ? (
                <div
                  className="card-pad"
                  style={{ display: 'flex', flexDirection: 'column', gap: '.7rem' }}
                >
                  {ovQueues.map((q) => {
                    const ne = (e.bands?.edges ?? []).length
                    const qb = pg(Number(q.oldestH) || 0, e.bands?.edges ?? [])
                    const qt = !ne ? '' : qb >= ne ? 'bad' : qb === ne - 1 ? 'warn' : ''
                    const qo = Number(q.open) || 0
                    return (
                      <div key={q.queue}>
                        <div className="between small">
                          <b>
                            {q.queue}
                            {q.kind === 'chat' ? <span className="cx-faint"> (best effort)</span> : null}
                          </b>
                          <span className="num">
                            {Hi(qo)} open{qo && Number(q.oldestH) ? ` · oldest ${gg(Number(q.oldestH))}` : ''}
                          </span>
                        </div>
                        <div className={`bar ${qt} mt-1`}>
                          <i style={{ width: `${Math.round((100 * qo) / qMax)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty">
                  <div className="s">No queue snapshot yet.</div>
                </div>
              )}
            </section>
            <section className="card" aria-labelledby="ovp-h">
              <div className="card-head">
                <div>
                  <h2 id="ovp-h" className="card-title" style={{ margin: 0 }}>
                    Team pulse
                  </h2>
                  <div className="card-hint">Open tickets by age band</div>
                </div>
              </div>
              {pulseRows.length ? (
                <div className="card-pad">
                  {pulseRows.map((r) => (
                    <div className="hbar-row" key={r.label}>
                      <span className="small">{r.label}</span>
                      <div className={`bar${r.i === bandLabels.length - 1 ? ' bad' : r.i === bandLabels.length - 2 ? ' warn' : ''}`}>
                        <i style={{ width: `${Math.round((100 * r.count) / bandTotal)}%` }} />
                      </div>
                      <b className="num small">{Hi(r.count)}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <div className="s">No open tickets in view.</div>
                </div>
              )}
            </section>
          </div>
        </div>
      ) : (
        jl({ lines: 2, tall: true })
      )}
      {e ? (
        e.specialist ? (
          <section className="cx-section">
            <p className="cx-note">
              <span>
                You own no tickets, so there is no aging list here. Seen something in a QA audit
                that a team lead should raise? <a href="#/coaching">Send a coaching signal</a>: it
                becomes a suggested topic in that person&apos;s next 1:1.
              </span>
            </p>
          </section>
        ) : e.role === 'admin' ? (
          <Mu />
        ) : e.role === 'tl' ? (
          <Ft>
            <div className="cx-grid-2">
              <section className="cx-section" aria-labelledby="today-h">
                <div className="cx-section__head">
                  <h2 className="cx-section__title" id="today-h">
                    Check-ins today
                  </h2>
                  <a href="#/checkins">Open check-ins</a>
                </div>
                <div className="cx-panel">
                  <Sg slots={e.slots} now={e.now} />
                  <div className="cx-panel--pad">
                    <Wf counts={e.ladder} bands={e.bands} />
                  </div>
                </div>
              </section>
              <_u
                rows={e.oldest}
                title="Oldest tickets in your team"
                empty="Your team has no open tickets."
                ticketUrl={e.ticketUrl}
                showAgent={!0}
                allLink="#/aging?mine=1"
              />
            </div>
            <Mu />
          </Ft>
        ) : (
          <_u
            rows={e.oldest}
            title="My aging cases"
            empty="You have no open tickets assigned to you."
            ticketUrl={e.ticketUrl}
            allLink="#/aging"
          />
        )
      ) : (
        jl({ lines: 6 })
      )}
    </section>
  )
}
export default OverviewPage
