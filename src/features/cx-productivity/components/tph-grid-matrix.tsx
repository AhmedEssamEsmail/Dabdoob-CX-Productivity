'use client'

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chip, Section } from '@/features/shared/components/shell/ui'
import { Button, Seg } from '@/features/shared/components/ui'
import {
  F,
  P,
  _e,
  ae,
  ge,
  je,
  Ne,
  Pn,
  pt,
  We,
  xe,
  type TphAgentRow,
  type TphData,
  type TphDayTotal,
  type TphTableRow,
} from './tph-grid-shared'
import { St, ut } from './tph-grid-views'

/* --- ls/cs — the agents-by-hour matrix + is dialog ---------------------------- */

const ls: [string, string][] = [
  ['pct', 'Score %'],
  ['touches', 'Cases touched'],
  ['cap', 'Target'],
]
export interface HgSel { email: string; hour?: number }
type HgCell =
  | { hour: number; empty: true }
  | { hour: number; empty: false; text: string; status: string | undefined; label: string; title: string | undefined }
interface HgRow {
  email: string
  name: string | undefined
  day: { text: string; p: number | null }
  overHours: number | undefined
  cells: HgCell[]
}

const HgAgentRow = memo(function HgAgentRow({
  row,
  onSelect,
}: {
  row: HgRow
  onSelect: (email: string, hour?: number) => void
}) {
  return (
    <tr>
      <th scope="row">
        <Button className="tph-hg__name" onClick={() => onSelect(row.email)}>
          {row.name}
        </Button>
      </th>
      {row.cells.map((cell) =>
        cell.empty ? (
          <td key={cell.hour} />
        ) : (
          <td key={cell.hour} className="cx-num">
            <Button
              className="tph-hg__cell"
              data-status={cell.status}
              aria-label={cell.label}
              title={cell.title}
              onClick={() => onSelect(row.email, cell.hour)}
            >
              {cell.text}
            </Button>
          </td>
        )
      )}
      <td className="cx-num">
        <Button
          className="tph-hg__cell tph-hg__day"
          data-status={row.day.p != null ? xe(row.day.p) : undefined}
          aria-label={`${row.name} day: ${row.day.text}`}
          onClick={() => onSelect(row.email)}
        >
          {row.day.text}
        </Button>
        {row.overHours ? (
          <span className="tph-hg__over">
            <Chip status="warn">
              {row.overHours}
              <span className="cx-sr"> hour-channels</span> over cap
            </Chip>
          </span>
        ) : null}
      </td>
    </tr>
  )
})

export function Cs({ d }: { d: TphData }) {
  const [metric, setMetric] = useState('pct')
  const [sel, setSel] = useState<HgSel | null>(null)
  const grid = useMemo(() => {
    const byHour = new Map<string, Map<number, { r: TphTableRow; a: TphAgentRow }[]>>()
    const names = new Map<string, string>()
    for (const row of d.table)
      for (const agent of row.agents) {
        names.set(agent.email, agent.name)
        if (!byHour.has(agent.email)) byHour.set(agent.email, new Map())
        const hours = byHour.get(agent.email)!
        hours.set(row.hour, [...(hours.get(row.hour) ?? []), { r: row, a: agent }])
      }
    const totals = new Map(d.dayTotals.map((x) => [x.email, x]))
    d.dayTotals.forEach((x) => names.has(x.email) || names.set(x.email, x.name))
    const onGrid = new Set(d.agents.map((x) => x.email))
    const emails = [
      ...d.agents.map((x) => x.email).filter((x) => names.has(x)),
      ...[...names.keys()].filter((x) => !onGrid.has(x)),
    ]
    const populatedHours = [...new Set(d.table.filter((x) => x.agents.length).map((x) => x.hour))].sort((a, b) => a - b)
    const firstHour = populatedHours[0] ?? d.hours[0] ?? 0
    const lastHour = populatedHours[populatedHours.length - 1] ?? d.hours[d.hours.length - 1] ?? -1
    return {
      byHour,
      names,
      totals,
      emails,
      hours: d.hours.filter((x) => x >= firstHour && x <= lastHour),
    }
  }, [d])
  const agentRows = useMemo<HgRow[]>(() => {
    const cellText = (v: { touches: number | null; cap: number | null; pct: number | null }) =>
      metric === 'pct' ? _e(v.pct) : P(metric === 'touches' ? v.touches : v.cap)
    return grid.emails.map((email) => {
      const total = grid.totals.get(email)
      const flat = [...(grid.byHour.get(email)?.values() ?? [])].flat()
      const totalsForDay = je(flat)
      const day =
        metric === 'pct'
          ? { text: _e(total?.pctOfCap ?? null), p: total?.pctOfCap ?? null }
          : {
              text: P(metric === 'touches' ? (total?.touches ?? totalsForDay.touches) : (total?.cap ?? totalsForDay.cap)),
              p: null,
            }
      return {
        email,
        name: grid.names.get(email),
        day,
        overHours: total?.overHours,
        cells: grid.hours.map((hour) => {
          const value = grid.byHour.get(email)?.get(hour)
          if (!value) return { hour, empty: true }
          const summed = je(value)
          const text = cellText(summed)
          return {
            hour,
            empty: false,
            text,
            status: metric === 'pct' && summed.pct != null ? xe(summed.pct) : undefined,
            label: `${grid.names.get(email)} ${F(hour)}: ${text}`,
            title: metric === 'pct' && summed.pct == null ? pt(value) : undefined,
          }
        }),
      }
    })
  }, [grid, metric])
  const selectCell = useCallback((email: string, hour?: number) => {
    setSel(hour == null ? { email } : { email, hour })
  }, [])
  if (!agentRows.length) return null
  const firstHour = grid.hours[0]
  const lastHour = grid.hours[grid.hours.length - 1]
  const hourRange = grid.hours.length ? `${F(firstHour)} to ${F(lastHour + 1)}` : 'No hours'
  return (
    <Section
      id="tph-hg"
      title="Agents by hour"
      hint={`${hourRange}. Click a number for that hour's channels, or a name for the agent's day.`}
    >
      <Seg
        name="tph-hg-metric"
        className="tph-brush tph-hg-seg"
        aria-label="Value in each cell"
        value={metric}
        onChange={setMetric}
        options={ls.map(([k, label]) => ({ value: k, label }))}
      />
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table tph-hg">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              {grid.hours.map((x) => (
                <th key={x} scope="col" className="cx-num">
                  {F(x)}
                </th>
              ))}
              <th scope="col" className="cx-num">Day</th>
            </tr>
          </thead>
          <tbody>
            {agentRows.map((row) => (
              <HgAgentRow key={row.email} row={row} onSelect={selectCell} />
            ))}
          </tbody>
        </table>
      </div>
      {sel ? (
        <AgentDialog
          d={d}
          sel={sel}
          name={grid.names.get(sel.email) ?? sel.email}
          byHour={grid.byHour.get(sel.email) ?? new Map()}
          total={grid.totals.get(sel.email)}
          pick={setSel}
        />
      ) : null}
    </Section>
  )
}

/* --- is — the agent hour/day dialog -------------------------------------------- */

function AgentDialog({ d, sel, name, byHour, total, pick }: {
  d: TphData; sel: HgSel; name: string
  byHour: Map<number, { r: TphTableRow; a: TphAgentRow }[]>
  total: TphDayTotal | undefined; pick: (s: HgSel | null) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const m = ref.current
    if (m && !m.open) m.showModal()
  }, [])
  const chName = (k: string) => We(d, k)
  const close = () => pick(null)
  const rows = sel.hour == null ? [] : (byHour.get(sel.hour) ?? [])
  const hrSum = je(rows)
  const [touches, setTouches] = useState<{ busy: boolean; err: string; data: { touches: { time: string; ticket: string; channel: string; status: string; group: string; hour: number }[]; outside: number } | null; hour: number | null } | null>(null)
  const loadTouches = (hour: number | null) => {
    setTouches((f) => ({ busy: !!f?.busy || !f?.data, err: '', data: f?.data ?? null, hour }))
    if (touches?.data || touches?.busy) return
    ae.touchList(d.date, sel.email).then(
      (f) => setTouches((v) => ({ busy: false, err: '', data: f as never, hour: v?.hour ?? null })),
      (f: unknown) =>
        setTouches((v) => ({
          busy: false,
          err: f instanceof Error ? f.message : String(f),
          data: null,
          hour: v?.hour ?? null,
        }))
    )
  }
  const visible = touches?.data ? touches.data.touches.filter((m) => touches.hour == null || m.hour === touches.hour) : []
  return (
    <dialog
      ref={ref}
      className="popup tph-dialog"
      aria-labelledby="tph-hg-h"
      onClose={close}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="popup-body">
        <h2 id="tph-hg-h" className="popup-title">
          {sel.hour == null ? `${name}, ${d.date}` : `${name}, ${F(sel.hour)} to ${F(sel.hour + 1)}`}
        </h2>
        {sel.hour != null ? (
          <div className="cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Channel</th>
                  <th scope="col" className="cx-num">Cases offered</th>
                  <th scope="col" className="cx-num">Minutes</th>
                  <th scope="col" className="cx-num">Cap</th>
                  <th scope="col" className="cx-num">Touches</th>
                  <th scope="col" className="cx-num">TPH</th>
                  <th scope="col">Of cap</th>
                  <th scope="col" className="cx-num">Raw %</th>
                  <th scope="col">Cap set by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ r: m, a: f }) => (
                  <tr key={m.channel}>
                    <th scope="row">{chName(m.channel)}</th>
                    <td className="cx-num">
                      {m.cases ?? '–'}
                      {m.source ? <span className="cx-faint tph-src">{ge[m.source]}</span> : null}
                    </td>
                    <td className="cx-num">
                      {f.minutes}
                      {f.callsMin ? <span className="cx-faint tph-src">{f.callsMin} with calls</span> : null}
                    </td>
                    <td className="cx-num">{P(f.cap)}</td>
                    <td className="cx-num">{f.touches ?? <span className="cx-faint">pending</span>}</td>
                    <td className="cx-num">{P(f.tph)}</td>
                    <td>{ut(f)}</td>
                    <td className="cx-num">{_e(f.pctRaw)}</td>
                    <td>{f.limit ? Ne(d, f.limit) : '–'}</td>
                  </tr>
                ))}
                {rows.length > 1 ? (
                  <tr>
                    <th scope="row">This hour</th>
                    <td />
                    <td className="cx-num">{rows.reduce((m, f) => m + f.a.minutes, 0)}</td>
                    <td className="cx-num">{P(hrSum.cap)}</td>
                    <td className="cx-num">{P(hrSum.touches)}</td>
                    <td />
                    <td>
                      {hrSum.pct == null ? (
                        <span className="cx-faint">{pt(rows)}</span>
                      ) : (
                        <Chip status={xe(hrSum.pct)}>{_e(hrSum.pct)}</Chip>
                      )}
                    </td>
                    <td />
                    <td />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <Fragment>
            <div className="cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Hour</th>
                    <th scope="col">Channels</th>
                    <th scope="col" className="cx-num">Minutes</th>
                    <th scope="col" className="cx-num">Cases</th>
                    <th scope="col" className="cx-num">Cap</th>
                    <th scope="col" className="cx-num">Touches</th>
                    <th scope="col">Of cap</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byHour]
                    .sort(([m], [f]) => m - f)
                    .map(([m, f]) => {
                      const v = je(f)
                      return (
                        <tr key={m}>
                          <th scope="row">
                            <Button className="tph-hg__name" onClick={() => pick({ email: sel.email, hour: m })}>
                              {F(m)}
                            </Button>
                          </th>
                          <td>{f.map((y) => chName(y.r.channel)).join(', ')}</td>
                          <td className="cx-num">{f.reduce((y, x) => y + x.a.minutes, 0)}</td>
                          <td className="cx-num">{f.map((y) => y.r.cases ?? '–').join(' + ')}</td>
                          <td className="cx-num">{P(v.cap)}</td>
                          <td className="cx-num">
                            {v.touches ? (
                              <Button
                                className="tph-hg__name"
                                aria-label={`View touches ${F(m)} to ${F(m + 1)} (${v.touches})`}
                                onClick={() => loadTouches(m)}
                              >
                                {P(v.touches)}
                              </Button>
                            ) : (
                              P(v.touches)
                            )}
                          </td>
                          <td>
                            {v.pct == null ? (
                              <span className="cx-faint">{pt(f)}</span>
                            ) : (
                              <Chip status={xe(v.pct)}>{_e(v.pct)}</Chip>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
            {total ? (
              <dl className="tph-card__agent" aria-label="Day totals">
                <div>
                  <dt>Touches</dt>
                  <dd>
                    {total.touches ? (
                      <Button
                        className="tph-hg__name"
                        aria-expanded={!!touches}
                        onClick={() => loadTouches(null)}
                      >
                        View touches ({total.touches})
                      </Button>
                    ) : (
                      (total.touches ?? 'pending')
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Cap</dt>
                  <dd>{P(total.cap)}</dd>
                </div>
                <div>
                  <dt>Of cap</dt>
                  <dd>
                    <St pct={total.pctOfCap} raw={total.pctRaw} over={(total.pctRaw ?? 0) > 100} why="no capped hour" />
                  </dd>
                </div>
                <div>
                  <dt>Scored hours</dt>
                  <dd>{total.scoredHours}</dd>
                </div>
                <div>
                  <dt>Hour-channels over cap</dt>
                  <dd>{total.overHours}</dd>
                </div>
                <div className="tph-card__wide">
                  <dt>Cap set by</dt>
                  <dd>{Pn(d, total.limits)}</dd>
                </div>
              </dl>
            ) : null}
            {touches ? (
              <section className="tph-touches" aria-labelledby="tph-touches-h" aria-busy={touches.busy}>
                <h3 id="tph-touches-h" className="tph-touches__h">
                  {touches.hour == null ? 'Every touch this day' : `Touches ${F(touches.hour)} to ${F(touches.hour + 1)}`}
                  {touches.data ? ` (${visible.length})` : ''}
                  {touches.hour != null && touches.data ? (
                    <Button className="tph-touches__all" onClick={() => loadTouches(null)}>
                      Show all hours
                    </Button>
                  ) : null}
                </h3>
                {touches.busy ? (
                  <p className="cx-faint" role="status">
                    Loading touches from Freshdesk activity…
                  </p>
                ) : touches.err ? (
                  <Fragment>
                    <p className="cx-error" role="alert">
                      Touches could not load: {touches.err}
                    </p>
                    <Button onClick={() => loadTouches(touches.hour)}>Try again</Button>
                  </Fragment>
                ) : touches.data ? (
                  <Fragment>
                    <p className="cx-faint">
                      A ticket counts once per hour and channel; Kuwait time.
                      {touches.data.touches.length !== total?.touches
                        ? ` This list has ${touches.data.touches.length} against the stored ${total?.touches ?? 0}: activity changed since touches were computed, so rebuild the day.`
                        : ''}
                      {touches.data.outside
                        ? ` ${touches.data.outside} more outside the grid hours are not in the total.`
                        : ''}
                    </p>
                    {visible.length ? (
                      <div className="cx-tablewrap tph-touches__wrap">
                        <table className="cx-table">
                          <thead>
                            <tr>
                              <th scope="col">Time</th>
                              <th scope="col">Ticket</th>
                              <th scope="col">Counted on</th>
                              <th scope="col">Status</th>
                              <th scope="col">Group</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visible.map((m, f) => (
                              <tr key={f}>
                                <td className="cx-num">{m.time}</td>
                                <th scope="row" className="cx-num">{m.ticket}</th>
                                <td>{chName(m.channel)}</td>
                                <td>{m.status || <span className="cx-faint">unknown</span>}</td>
                                <td>{m.group || <span className="cx-faint">none</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="cx-muted">No touches in this hour in the current Freshdesk activity.</p>
                    )}
                  </Fragment>
                ) : null}
              </section>
            ) : null}
          </Fragment>
        )}
        <div className="popup-actions">
          {sel.hour != null ? (
            <Button onClick={() => pick({ email: sel.email })}>{name}&apos;s day</Button>
          ) : null}
          <Button variant="primary" onClick={close}>Close</Button>
        </div>
      </div>
    </dialog>
  )
}
