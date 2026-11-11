'use client'

import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Chip, Section } from '@/features/shared/components/shell/ui'
import { D } from '@/features/shared/shell/i18n'
import { toast } from '@/features/shared/components/shell/Toasts'
import { AutoSaveInput, Button, Input, PaintGrid, Seg, Select, TableScroll, Toggle } from '@/features/shared/components/ui'
import {
  $e,
  $n,
  F,
  Gt,
  Ne,
  P,
  Pn,
  Ua,
  U,
  Wa,
  We,
  Ze,
  ae,
  ge,
  oe,
  useNs,
  useSs,
  xe,
  type Sum,
  type TphAgentRow,
  type TphChannel,
  type TphData,
  type TphDayTotal,
  type TphTableRow,
  type TphTask,
  type TrendDay,
} from './tph-grid-shared'

/* --- ht — the back-to-overview notice -------------------------------------- */

function ht({ text, select }: { text: string; select: (tab: string, focus?: boolean) => void }) {
  return (
    <p className="tph-back">
      <Chip status="warn">{text}</Chip>
      <Button onClick={() => select('overview', true)}>See Overview</Button>
    </p>
  )
}

/* --- St/ut — cap-cell renderers (shared with the agents-by-hour dialog) ---- */

export function St({ pct, raw, over, why }: { pct: number | null; raw: number | null; over: boolean; why: string }) {
  return pct == null ? (
    <span className="cx-faint">{why}</span>
  ) : (
    <Fragment>
      <Chip status={xe(pct)}>{pct}%</Chip>
      {over ? <span className="tph-src tph-over">over cap: {raw}%</span> : null}
    </Fragment>
  )
}
export const ut = (a: TphAgentRow) => <St pct={a.pctOfCap} raw={a.pctRaw} over={a.over} why={$n[a.reason] ?? 'no cap'} />

const TextListItem = memo(function TextListItem({ text }: { text: string }) {
  return <li>{text}</li>
})

/* --- de — a KPI card --------------------------------------------------------- */

function de({ label, value, lines, warn, lead }: { label: string; value: ReactNode; lines: (ReactNode | null | false)[]; warn?: boolean; lead?: boolean }) {
  return (
    <div className={`tph-kpi${lead ? ' tph-kpi--lead' : ''}`} data-state={warn ? 'warn' : undefined}>
      <span className="tph-kpi__l">{label}</span>
      <span className="tph-kpi__v">{value}</span>
      {lines.filter(Boolean).map((l, i) => (
        <span key={i} className="tph-kpi__s">
          {l}
        </span>
      ))}
    </div>
  )
}

/* --- Qa — the 7-day team % of cap chart --------------------------------------- */

function Qa({ d, trend, go }: { d: TphData; trend: { forD: TphData; days: TrendDay[] | null; err: string } | null; go: (date: string) => void }) {
  const s = trend?.days
  const l = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
  return (
    <figure className="tph-trendbox">
      <figcaption className="tph-trend__cap">Last 7 days, clipped at each hour&rsquo;s cap</figcaption>
      {trend?.err ? (
        <p className="cx-error" role="alert">
          The 7-day trend could not load: {trend.err}
        </p>
      ) : s ? (
        <Fragment>
        {!s.length ? <p className="cx-faint">No days returned for this range.</p> : null}
        <ol className="tph-trend tph-trend--days">
          {s.map((r) => {
            const o = !r.touchesReady || !r.hasCases || r.pct == null
            const i = r.touchesReady ? (r.hasCases ? 'no scored hours' : 'cases not computed') : 'touches not computed'
            const h = o
              ? `not computed (${i})`
              : `${P(r.pct)}%${r.pctRaw !== r.pct ? `, un-clipped ${P(r.pctRaw)}%` : ''}, scored ${r.scored} of ${r.onGrid} agent-hours`
            return (
              <li key={r.date} className="tph-trend__col" data-sel={r.date === d.date ? '' : undefined}>
                <Button
                  className="tph-trend__hit"
                  onClick={() => go(r.date)}
                  aria-label={`${r.date}: ${h}. Open this day`}
                  title={`${r.date}: ${h}`}
                >
                  <span className="tph-trend__val" aria-hidden="true">
                    {o ? '–' : `${Math.round(r.pct ?? 0)}%`}
                  </span>
                  <span className="tph-trend__track" aria-hidden="true">
                    {o ? (
                      <span className="tph-trend__gap" />
                    ) : (
                      <span className="tph-trend__bar" style={{ '--p': r.pct } as CSSProperties} data-over={r.over ? '' : undefined} />
                    )}
                  </span>
                  <span className="tph-trend__axis" aria-hidden="true">
                    {l(r.date)}
                    <br />
                    {r.date.slice(8)}
                  </span>
                </Button>
              </li>
            )
          })}
        </ol>
        </Fragment>
      ) : (
        <Fragment>
          <p className="cx-sr" role="status">
            Loading the last 7 days…
          </p>
          <ol className="tph-trend tph-trend--days" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <li className="tph-trend__col" key={i}>
                <span className="tph-trend__val">&nbsp;</span>
                <span className="tph-trend__track">
                  <span className="skeleton" />
                </span>
                <span className="tph-trend__axis">&nbsp;</span>
              </li>
            ))}
          </ol>
        </Fragment>
      )}
    </figure>
  )
}

/* --- Za — the day's % of cap by hour ------------------------------------------ */

function Za({ d, sum }: { d: TphData; sum: Sum }) {
  const a = new Map(sum.hours.map((h) => [h.hour, h]))
  const s = d.nowSlot == null ? -1 : Math.floor(d.nowSlot / 4)
  return (
    <figure className="tph-trendbox">
      <figcaption className="tph-trend__cap">{d.date} by hour</figcaption>
      {!d.hours.length ? <p className="cx-faint">No grid hours for this day.</p> : null}
      <ol className="tph-trend tph-trend--hours">
        {d.hours.map((h) => {
          const r = a.get(h)
          const o = r?.pct == null ? 'no score' : `${P(r.pct)}%${r.over ? `, ${U(r.over, 'hour-channel')} over cap` : ''}`
          return (
            <li
              key={h}
              className="tph-trend__col"
              data-now={h === s ? '' : undefined}
              title={`${F(h)}: ${o}`}
              tabIndex={0}
              aria-label={`${F(h)}: ${o}`}
            >
              <span className="cx-sr">
                {F(h)}: {o}
              </span>
              <span className="tph-trend__track" aria-hidden="true">
                {r?.pct == null ? null : (
                  <span className="tph-trend__bar" style={{ '--p': r.pct } as CSSProperties} data-over={r.over ? '' : undefined} />
                )}
              </span>
              <span className="tph-trend__axis" aria-hidden="true" data-third={h % 3 === 0 ? '' : undefined}>
                {String(h).padStart(2, '0')}
              </span>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}

/* --- Xa — the Overview tab --------------------------------------------------- */

export function Xa({ d, sum, runner, trend, select, go }: {
  d: TphData; sum: Sum; runner: ReturnType<typeof useNs>
  trend: { forD: TphData; days: TrendDay[] | null; err: string } | null
  select: (t: string, focus?: boolean) => void; go: (date: string) => void
}) {
  const o = d.date < d.today
  const i = !d.hasCases && o
  const h = d.touchesReady ? '' : o ? 'Touches not computed for this day' : 'Touches for today come in tomorrow at about 08:30'
  const p = useMemo(() => d.dayTotals.filter((w) => w.pctOfCap != null), [d.dayTotals])
  const below = useMemo(() => p.filter((w) => (w.pctOfCap ?? 0) < 60), [p])
  const overRows = useMemo(() => d.dayTotals.filter((w) => w.overHours > 0), [d.dayTotals])
  const missingMap = useMemo(() => Ua(d.table), [d.table])
  const missingItems = useMemo(
    () =>
      [...missingMap].map(([channel, hours]) => ({
        key: channel,
        text: `${We(d, channel)}: ${hours.map(F).join(', ')}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- We(d,…) reads only d.off/d.channels/d.activities; narrowed deps keep the memo stable on new `d` identity
    [missingMap, d.off, d.channels, d.activities]
  )
  const callItems = useMemo(
    () =>
      d.callVariance.map((w) => ({
        key: `${w.email}|${w.hour}`,
        text: `${w.name}, ${F(w.hour)}: ${w.callMin} min`,
      })),
    [d.callVariance]
  )
  const overItems = useMemo(
    () => overRows.map((w) => ({ key: w.email, text: `${w.name}: ${U(w.overHours, 'hour-channel')}, ${P(w.pctRaw)}% un-clipped` })),
    [overRows]
  )
  const belowItems = useMemo(
    () => below.map((w) => ({ key: w.email, text: `${w.name}: ${P(w.pctOfCap)}%` })),
    [below]
  )
  const noteItems = useMemo(
    () =>
      d.channels
        .filter((w) => d.rebuiltReasons[w.key])
        .map((w) => ({ key: w.key, text: `${w.name}: ${d.rebuiltReasons[w.key]}` })),
    [d.channels, d.rebuiltReasons]
  )
  const note =
    h || (i ? 'No cases for this day: rebuild needed' : sum.scored ? '' : 'No scored hours yet: no agent has a cap and touches')
  const { running: m, progress: f, run: v, btn: y } = runner
  const x = (label: string) => (
    <Button className={y.class || undefined} style={y.style} disabled={m} onClick={v}>
      {y.label === 'Rebuild cases and touches' ? label : y.label}
    </Button>
  )
  const M = (tab: string, label: string) => (
    <Button className="tph-attn__go" onClick={() => select(tab, true)}>
      {label}
    </Button>
  )
  const k: { key: string; title: string; body: ReactNode; actions: ReactNode }[] = []
  if (i)
    k.push({
      key: 'noday',
      title: `No cases for ${d.date} yet`,
      body: (
        <p className="cx-faint">
          The 08:30 run and the hourly build cover the last 3 days. Rebuild this day from history to get caps, TPH and % of cap.
        </p>
      ),
      actions: x('Rebuild this day'),
    })
  if (missingMap.size)
    k.push({
      key: 'missing',
      title: `Cases: ${U(sum.missing, 'hour-channel')} missing, so nobody on them has a score`,
      body: (
        <Fragment>
          <ul>
            {missingItems.map((item) => (
              <TextListItem key={item.key} text={item.text} />
            ))}
          </ul>
          <p className="cx-faint">
            {d.canEdit
              ? 'Enter them in Cases, then cap, TPH and % of cap appear.'
              : `Only an admin can enter cases for a day more than ${d.tlEditDays} days ago.`}
          </p>
        </Fragment>
      ),
      actions: d.canEdit ? M('cases', 'Go to cases') : null,
    })
  if (!d.touchesReady && o)
    k.push({
      key: 'touches',
      title: `Touches for ${d.date} have not been computed`,
      body: (
        <p className="cx-faint">
          The hourly build covers the last 3 days, so TPH and % of cap stay empty for this day until you compute it.
        </p>
      ),
      actions: m ? null : x('Compute touches and cases now'),
    })
  if (d.callVariance.length)
    k.push({
      key: 'calls',
      title: 'Call time deducted where the grid shows no calls',
      body: (
        <Fragment>
          <p className="cx-faint">
            These agents took calls in hours where no slot is marked with calls. The call minutes were still taken off
            their queue minutes; mark the slots with + Calls to keep the grid accurate.
          </p>
          <ul>
            {callItems.map((item) => (
              <TextListItem key={item.key} text={item.text} />
            ))}
          </ul>
        </Fragment>
      ),
      actions: M('grid', 'Open the grid'),
    })
  if (sum.over)
    k.push({
      key: 'over',
      title: `Over cap: ${U(sum.overAgents, 'agent')} in ${U(sum.over, 'hour-channel')}`,
      body: (
        <Fragment>
          <p className="cx-faint">
            % of cap stops at 100, so these hours look full; {P(sum.overTouches)} touches went above the cap.
          </p>
          <ul>
            {overItems.map((item) => (
              <TextListItem key={item.key} text={item.text} />
            ))}
          </ul>
        </Fragment>
      ),
      actions: M('agents', 'Open agents'),
    })
  if (below.length)
    k.push({
      key: 'below',
      title: `${U(below.length, 'agent')} below 60% of cap`,
      body: (
        <ul>
          {belowItems.map((item) => (
            <TextListItem key={item.key} text={item.text} />
          ))}
        </ul>
      ),
      actions: M('agents', 'Open agents'),
    })
  if (sum.zeroCapTouches)
    k.push({
      key: 'zero',
      title: `${U(sum.zeroCapTouches, 'touch', 'touches')} in hours with a cap of 0`,
      body: <p className="cx-faint">The hour had 0 cases or no cap minutes, so this work is not scored.</p>,
      actions: M('caps', 'Open caps'),
    })
  if (noteItems.length)
    k.push({
      key: 'notes',
      title: `Notes on the rebuilt numbers${d.rebuiltAsOf ? `, ${$e(d.rebuiltAsOf)}` : ''}`,
      body: (
        <Fragment>
          <ul>
            {noteItems.map((item) => (
              <TextListItem key={item.key} text={item.text} />
            ))}
          </ul>
          <p className="cx-faint">A channel without numbers needs yours, or a rebuild once its source has the day.</p>
        </Fragment>
      ),
      actions: M('cases', 'Open cases'),
    })
  const A = d.lastAuto
  return (
    <div className="tph-ov">
      <div className="tph-ov__build">
        <p className="cx-faint" role="status">
          {f || (A ? (
            <Fragment>
              Last automatic build: {$e(A.at)} ({A.job}){A.status === 'error' ? ', with errors' : ''}.
            </Fragment>
          ) : (
            'No automatic build found in the run log yet.'
          ))}
          {f ? null : ` Touches computed: ${d.touchesReady ? $e(d.touchesAsOf) : 'not yet'}.`}
        </p>
        {o && !i ? x('Rebuild now') : null}
      </div>
      <h2 className="cx-sr">Key numbers for {d.date}</h2>
      <div className="tph-kpis">
        {de({
          lead: true,
          label: 'Team % of cap',
          warn: !!note || sum.pct == null,
          value: sum.pct == null ? '–' : `${P(sum.pct)}%`,
          lines:
            sum.pct == null
              ? [note]
              : [
                  sum.pctRaw !== sum.pct ? `Un-clipped ${P(sum.pctRaw)}%` : null,
                  `Scored ${sum.scored} of ${sum.onGrid} on-grid agent-hours`,
                ],
        })}
        {de({
          label: 'Team TPH, excl. Inbound calls',
          warn: !d.touchesReady,
          value: P(sum.tphExCalls),
          lines: d.touchesReady
            ? [`All channels: ${P(sum.tph)}`, sum.outside ? `${U(sum.outside, 'touch', 'touches')} outside the grid, not in TPH` : null]
            : [h],
        })}
        {de({
          label: 'Cases coverage',
          warn: i || sum.missing > 0,
          value: i ? '–' : `${sum.covered} of ${sum.covered + sum.missing}`,
          lines: i
            ? ['No cases for this day: rebuild needed']
            : [
                sum.missing
                  ? `${U(sum.missing, 'hour-channel')} with someone on the grid and no cases`
                  : 'Every on-grid hour-channel has cases',
                sum.carried ? `${sum.carried} carried from the hour before (estimate)` : null,
              ],
        })}
        {de({
          label: 'Agents on the grid',
          value: sum.agents,
          lines: [p.length ? `${below.length} of ${p.length} scored below 60% of cap` : 'None scored yet'],
        })}
        {de({
          label: 'Over cap',
          warn: sum.over > 0,
          value: d.touchesReady ? U(sum.over, 'hour-channel') : '–',
          lines: d.touchesReady
            ? [sum.over ? `${U(sum.overAgents, 'agent')}, ${P(sum.overTouches)} touches above cap` : 'Nobody went over a cap']
            : [h],
        })}
        {de({
          label: 'Call time',
          value: d.callsBasis === 'actual' ? 'Actual' : 'Estimate',
          lines: [
            d.callsBasis === 'actual'
              ? `Maqsam minutes, ${$e(d.callsAsOf)}`
              : `Marked slots count at ${Math.round(d.callsFactor * 100)}% until the actual minutes arrive`,
            d.callVariance.length ? `${U(d.callVariance.length, 'hour')} with calls not marked on the grid` : null,
          ],
        })}
      </div>
      <section className="tph-ov__sec" aria-labelledby="tph-attn">
        <h2 className="cx-section__title" id="tph-attn">
          Needs attention
        </h2>
        {k.length ? (
          <ul className="tph-attn">
            {k.map((w) => (
              <li key={w.key} className="cx-panel cx-panel--pad tph-attn__row">
                <div className="tph-attn__text">
                  <strong>{w.title}</strong>
                  {w.body}
                </div>
                {w.actions ? <div className="tph-attn__act">{w.actions}</div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="tph-attn__none">Nothing needs attention for {d.date}.</p>
        )}
      </section>
      <section className="tph-ov__sec" aria-labelledby="tph-trend-h">
        <h2 className="cx-section__title" id="tph-trend-h">
          Team % of cap
        </h2>
        <div className="tph-trends">
          <Qa d={d} trend={trend} go={go} />
          <Za d={d} sum={sum} />
        </div>
      </section>
    </div>
  )
}

/* --- es — the paintable grid --------------------------------------------------- */

const EsPaintGrid = memo(PaintGrid)

export function Es({ d, onSaved }: { d: TphData; onSaved: () => void }) {
  const [brush, setBrush] = useState(d.channels[0]?.key ?? d.off)
  const [cells, setCells] = useState(d.cells)
  const [saving, setSaving] = useState(false)
  const touched = useRef<Record<string, Set<number>>>({})
  useEffect(() => {
    const c = d.cells
    queueMicrotask(() => setCells(c))
  }, [d])
  const label = (k: string) => We(d, k)
  const paint = useCallback((email: string, idx: number) => {
    setCells((f) => {
      const v = f[email].slice()
      const y = v[idx]
      if (brush === oe || brush === Ze) {
        const add = brush === oe
        const M = !add && y.c === 'calls' ? '' : y.c || (add ? 'calls' : '')
        v[idx] = M ? { c: M, calls: add && M !== 'calls' && M !== d.off, src: 'grid' } : { c: '', calls: false, src: '' }
      } else {
        v[idx] = brush
          ? { c: brush, calls: y.calls && brush !== 'calls' && brush !== d.off, src: 'grid' }
          : { c: '', calls: false, src: '' }
      }
      return { ...f, [email]: v }
    })
    ;(touched.current[email] = touched.current[email] || new Set()).add(d.firstSlot + idx)
  }, [brush, d.off, d.firstSlot])
  const flush = useCallback(() => {
    const entries = Object.entries(touched.current)
    touched.current = {}
    if (!entries.length) return
    setSaving(true)
    const body = brush === oe || brush === Ze ? { calls: brush === oe } : { channel: brush }
    Promise.all(
      entries.map(([email, slots]) => ae.saveSlots({ date: d.date, email, slots: [...slots], ...body }))
    ).then(
      () => {
        setSaving(false)
        onSaved()
      },
      (err: unknown) => {
        setSaving(false)
        toast(err instanceof Error ? err.message : String(err), 'error')
        onSaved()
      }
    )
  }, [brush, d.date, onSaved])
  const n = (d.hours.length * 60) / d.slotMin
  const columnHeaders = useMemo(() => d.hours.map((h) => ({ label: F(h), span: 4, className: 'tph-hour' })), [d.hours])
  const gridStyle = useMemo(() => ({ '--tph-n': n } as CSSProperties), [n])
  const rows = useMemo(
    () =>
      d.agents.map((a) => ({
        id: a.email,
        label: <span title={a.name}>{a.name}</span>,
        cells: (cells[a.email] || []).map((cell, f) => {
          const v = d.firstSlot + f
          const y = `${a.name} ${Wa(v)}: ${cell.c ? We(d, cell.c) : 'nothing logged'}${cell.calls ? ' + inbound calls' : ''}${cell.src === 'carried' ? ' (carried)' : cell.src === 'task' ? ' (from a task)' : ''}`
          return {
            id: `${a.email}:${v}`,
            label: y,
            data: {
              ch: Gt(d, cell.c),
              calls: cell.calls ? '' : undefined,
              src: cell.src || undefined,
              now: d.nowSlot === v ? '' : undefined,
              hour: v % 4 === 0 ? '' : undefined,
            },
          }
        }),
      })),
    [cells, d]
  )
  return (
    <Section
      id="tph-grid"
      title="Who is on which channel"
      hint={saving ? 'Saving…' : d.canEdit ? 'Pick a channel or activity, then click or drag across the slots' : 'Read-only'}
    >
      <div hidden={!d.canEdit}>
        <Seg
          name="tph-brush"
          className="tph-brush"
          aria-label="Channel or activity to paint"
          value={brush}
          onChange={setBrush}
          options={[...d.channels.map((c) => c.key), ...d.activities.map((c) => c.key), d.off, ''].map((k) => ({
            value: k,
            label: k ? (
              <>
                <i className="tph-swatch" data-ch={Gt(d, k)} aria-hidden="true" />
                {label(k)}
              </>
            ) : (
              'Clear'
            ),
          }))}
        />
      </div>
      <div hidden={!d.canEdit}>
        <Seg
          name="tph-brush-calls"
          className="tph-brush"
          aria-label="Inbound calls alongside the channel"
          value={brush}
          onChange={setBrush}
          options={([
            [oe, '+ Calls (blended)'],
            [Ze, '− Calls'],
          ] as [string, string][]).map(([k, lbl]) => ({
            value: k,
            label: k === oe ? (
              <>
                <i className="tph-swatch tph-swatch--calls" aria-hidden="true" />
                {lbl}
              </>
            ) : (
              lbl
            ),
          }))}
        />
      </div>
      <section className="cx-panel" aria-labelledby="tph-grid-card-h">
        <div className="cx-section__head">
          <div>
            <h3 id="tph-grid-card-h" className="cx-section__title">
              {D('Who is on which channel')}
            </h3>
            <div className="cx-section__hint">
              {D('{agents} agents · {channels} channels · {slots} slots of {minutes} min', {
                agents: String(d.agents.length),
                channels: String(d.channels.length),
                slots: String(n),
                minutes: String(d.slotMin),
              })}
            </div>
          </div>
        </div>
        {rows.length ? (
        <div className="tph-gridwrap">
          <EsPaintGrid
            className="tph-grid"
            style={gridStyle}
            aria-label={`Channel per agent, ${d.slotMin}-minute slots`}
            columnHeaders={columnHeaders}
            cornerLabel="Agent"
            rowClassName="tph-row"
            rowHeadClassName="tph-name"
            cellClassName="tph-cell"
            rows={rows}
            readOnly={!d.canEdit}
            onPaint={paint}
            onCommit={flush}
          />
        </div>
        ) : (
          <p className="cx-faint">No agents on the grid for this day.</p>
        )}
      </section>
      <p className="cx-faint tph-note">
        A dark bar on top marks Inbound calls blended with the channel. Hatched slots were not logged and repeat the
        slot before them until Off shift or now.
        {d.shiftsLinked
          ? ' Carrying also stops at the end of each shift.'
          : ' Shifts are not linked yet, so log Off shift at the end of a shift.'}
      </p>
    </Section>
  )
}

const TaskItem = memo(function TaskItem({
  task,
  channelName,
  canEdit,
  onRemove,
}: {
  task: TphTask
  channelName: string
  canEdit: boolean
  onRemove: (taskId: string) => void
}) {
  return (
    <li>
      <span>
        <strong>{task.name}</strong> {task.start}–{task.end}, {channelName}
        {task.calls ? ' + inbound calls' : ''} <span className="cx-faint">by {task.by}</span>
      </span>
      {canEdit ? <Button onClick={() => onRemove(task.taskId)}>Remove</Button> : null}
    </li>
  )
})

/* --- ts — log a task ----------------------------------------------------------- */

export function Ts({ d, onSaved }: { d: TphData; onSaved: () => void }) {
  const [form, setForm] = useState({
    email: d.agents[0]?.email ?? '',
    channel: d.channels[0]?.key ?? '',
    calls: false,
    start: '',
    end: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const h = (key: string) => (e: { currentTarget: { value: string } }) => setForm({ ...form, [key]: e.currentTarget.value })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    ae.addTask({ date: d.date, ...form, calls: form.calls && form.channel !== d.off }).then(
      (g: { slots: number }) => {
        setBusy(false)
        toast(`Task logged: ${g.slots} slots filled.`)
        setForm({ ...form, start: form.end, end: '' })
        onSaved()
      },
      (g: unknown) => {
        setBusy(false)
        setErr(g instanceof Error ? g.message : String(g))
      }
    )
  }
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])
  const remove = useCallback(
    (taskId: string) =>
      ae.removeTask(taskId).then(
        () => {
          toast('Task removed.')
          onSavedRef.current()
        },
        (g: unknown) => toast(g instanceof Error ? g.message : String(g), 'error')
      ),
    []
  )
  const tasks = useMemo(() => d.tasks, [d.tasks])
  const label = (k: string) => We(d, k)
  return (
    <Section id="tph-tasks" title="Log a task" hint="Fills the grid slots it covers for 8 minutes or more">
      <form className="tph-taskform" onSubmit={submit} hidden={!d.canEdit}>
        <div className="cx-field">
          <label className="cx-label" htmlFor="tt-a">
            Agent
          </label>
          <Select id="tt-a" value={form.email} onChange={h('email')}>
            {d.agents.map((a) => (
              <option key={a.email} value={a.email}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="cx-field">
          <label className="cx-label" htmlFor="tt-c">
            Channel
          </label>
          <Select id="tt-c" value={form.channel} onChange={h('channel')}>
            {d.channels.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
            {d.activities.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
            <option value={d.off}>Off shift</option>
          </Select>
        </div>
        <div className="cx-field">
          <label className="cx-label" htmlFor="tt-s">
            Start
          </label>
          <Input id="tt-s" type="time" step={300} required value={form.start} onInput={h('start')} />
        </div>
        <div className="cx-field">
          <label className="cx-label" htmlFor="tt-e">
            End
          </label>
          <Input id="tt-e" type="time" step={300} required value={form.end} onInput={h('end')} />
        </div>
        <Toggle
          className="tph-check"
          checked={form.calls}
          disabled={form.channel === d.off || form.channel === 'calls'}
          onChange={(c) => setForm({ ...form, calls: c })}
        >
          + Inbound calls
        </Toggle>
        <Button type="submit" variant="primary" disabled={busy || !form.email}>
          {busy ? 'Logging…' : 'Log task'}
        </Button>
      </form>
      {err ? (
        <p className="cx-error" role="alert">
          {err}
        </p>
      ) : null}
      {tasks.length ? (
        <ul className="tph-tasks">
          {tasks.map((t) => (
            <TaskItem
              key={t.taskId}
              task={t}
              channelName={label(t.channel)}
              canEdit={d.canEdit}
              onRemove={remove}
            />
          ))}
        </ul>
      ) : (
        <p className="cx-faint">No tasks logged for this day.</p>
      )}
    </Section>
  )
}

const CaseHourRow = memo(function CaseHourRow({
  hourRow,
  channels,
  canEdit,
  saving,
  onSave,
}: {
  hourRow: TphData['cases'][number]
  channels: TphChannel[]
  canEdit: boolean
  saving: string
  onSave: (key: string, hour: number, channel: string, raw: string, prev: number | null) => void
}) {
  return (
    <tr>
      <th scope="row">{F(hourRow.hour)}</th>
      {channels.map((ch) => {
        const cell = hourRow.byChannel[ch.key]
        return (
          <td key={ch.key}>
            <AutoSaveInput
              className="tph-num"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              aria-label={`${ch.name} at ${F(hourRow.hour)}`}
              disabled={!canEdit}
              value={cell?.tl == null ? '' : String(cell.tl)}
              placeholder={cell?.cases == null ? '' : String(cell.cases)}
              isSaving={saving === `${hourRow.hour}:${ch.key}`}
              onCommit={(v) => onSave(`${hourRow.hour}:${ch.key}`, hourRow.hour, ch.key, v, cell?.tl ?? null)}
            />
            {cell?.source && cell.source !== 'tl' ? <span className="cx-faint tph-src">{ge[cell.source]}</span> : null}
            {cell?.rebuilt && cell.source !== 'rebuilt' ? (
              <span className="cx-faint tph-src">history: {cell.rebuilt.stock + cell.rebuilt.new}</span>
            ) : null}
            {cell?.rebuilt && cell.source === 'rebuilt' ? (
              <span className="cx-faint tph-src">
                {cell.rebuilt.stock} open + {cell.rebuilt.new} new
              </span>
            ) : null}
          </td>
        )
      })}
    </tr>
  )
})

/* --- as — cases offered each hour -------------------------------------------- */

export function As({ d, onSaved, missing, select }: {
  d: TphData; onSaved: () => void; missing: number; select: (t: string, focus?: boolean) => void
}) {
  const [saving, setSaving] = useState('')
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])
  const save = useCallback(
    (key: string, hour: number, channel: string, raw: string, prev: number | null) => {
      const v = raw.trim() === '' ? '' : Number(raw)
      if ((v === '' && prev == null) || v === prev) return
      setSaving(key)
      ae.saveCases({ date: d.date, hour, channel, cases: v })
        .then(
          () => onSavedRef.current(),
          (u: unknown) => toast(u instanceof Error ? u.message : String(u), 'error')
        )
        .finally(() => setSaving((s) => (s === key ? '' : s)))
    },
    [d.date]
  )
  const cases = useMemo(() => d.cases, [d.cases])
  const channels = useMemo(() => d.channels, [d.channels])
  const r = !d.hasCases && d.date < d.today
  return (
    <Section
      id="tph-cases"
      title="Cases offered each hour"
      hint="Open at the start of the hour plus new during it (chats: open at half past the hour). Today fills in from the queue; past days are rebuilt from Freshchat, the ticket store and Freshdesk activity. Your number replaces both."
    >
      {r ? (
        ht({ text: `No cases for ${d.date}: rebuild needed`, select })
      ) : missing ? (
        ht({ text: `${U(missing, 'hour-channel')} missing`, select })
      ) : null}
      <TableScroll label="Cases offered each hour" className="cx-panel cx-tablewrap">
        <table className="cx-table tph-cases">
          <thead>
            <tr>
              <th scope="col">Hour</th>
              {channels.map((c) => (
                <th key={c.key} scope="col">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!cases.length ? (
              <tr>
                <td colSpan={channels.length + 1} className="cx-faint">
                  No case rows for this day.
                </td>
              </tr>
            ) : null}
            {cases.map((o) => (
              <CaseHourRow
                key={o.hour}
                hourRow={o}
                channels={channels}
                canEdit={d.canEdit}
                saving={saving}
                onSave={save}
              />
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Section>
  )
}

const CapAgent = memo(function CapAgent({ agent, d }: { agent: TphAgentRow; d: TphData }) {
  return (
    <dl className="tph-card__agent" aria-label={agent.name}>
      <div className="tph-card__name">
        <dt>Agent</dt>
        <dd>{agent.name}</dd>
      </div>
      <div>
        <dt>Minutes</dt>
        <dd>{agent.minutes}</dd>
      </div>
      <div>
        <dt>Touches</dt>
        <dd>{agent.touches == null ? 'pending' : agent.touches}</dd>
      </div>
      <div>
        <dt>TPH</dt>
        <dd>{P(agent.tph)}</dd>
      </div>
      <div>
        <dt>Cap</dt>
        <dd>{P(agent.cap)}</dd>
      </div>
      <div>
        <dt>Of cap</dt>
        <dd>{ut(agent)}</dd>
      </div>
      <div>
        <dt>Cap set by</dt>
        <dd>{agent.limit ? Ne(d, agent.limit) : '–'}</dd>
      </div>
    </dl>
  )
})

const CapCard = memo(function CapCard({ row, channelName, d }: { row: TphTableRow; channelName: string; d: TphData }) {
  return (
    <div className="cx-panel cx-panel--pad tph-card">
      <strong>
        {F(row.hour)} {channelName}: {row.cases ?? '–'} cases
        {row.source && row.source !== 'tl' ? <span className="cx-faint"> ({ge[row.source]})</span> : null}
      </strong>
      {row.agents.length ? (
        row.agents.map((agent) => <CapAgent key={agent.email} agent={agent} d={d} />)
      ) : (
        <p className="cx-faint">Nobody is on this channel in the grid and nobody touched it this hour</p>
      )}
    </div>
  )
})

const CapTableAgentRow = memo(function CapTableAgentRow({
  cell,
  row,
  index,
  channelName,
  d,
}: {
  cell: TphAgentRow
  row: TphTableRow
  index: number
  channelName: string
  d: TphData
}) {
  return (
    <tr className={index === 0 ? 'tph-first' : undefined}>
      {index === 0 ? (
        <th scope="rowgroup" rowSpan={row.agents.length}>
          {F(row.hour)}
        </th>
      ) : null}
      {index === 0 ? <td rowSpan={row.agents.length}>{channelName}</td> : null}
      {index === 0 ? (
        <td rowSpan={row.agents.length} className="cx-num">
          {row.cases ?? '–'}
          {row.source && row.source !== 'tl' ? <span className="cx-faint tph-src">{ge[row.source]}</span> : null}
        </td>
      ) : null}
      <td>{cell.name}</td>
      <td className="cx-num">
        {cell.minutes}
        {cell.callsMin ? <span className="cx-faint tph-src">{cell.callsMin} with calls</span> : null}
      </td>
      <td className="cx-num">{cell.capMin}</td>
      <td className="cx-num">{cell.touches == null ? <span className="cx-faint">pending</span> : cell.touches}</td>
      <td className="cx-num">{P(cell.tph)}</td>
      <td className="cx-num">{P(cell.cap)}</td>
      <td>{ut(cell)}</td>
      <td>{cell.limit ? Ne(d, cell.limit) : '–'}</td>
    </tr>
  )
})

const CapTableEmptyRow = memo(function CapTableEmptyRow({ row, channelName }: { row: TphTableRow; channelName: string }) {
  return (
    <tr className="tph-first">
      <th scope="rowgroup">{F(row.hour)}</th>
      <td>{channelName}</td>
      <td className="cx-num">
        {row.cases ?? '–'}
        {row.source && row.source !== 'tl' ? <span className="cx-faint tph-src">{ge[row.source]}</span> : null}
      </td>
      <td colSpan={8} className="cx-faint">
        Nobody is on this channel in the grid and nobody touched it this hour
      </td>
    </tr>
  )
})

/* --- rs — caps and touches per hour (cards on narrow, table on wide) --------- */

export function Rs({ d, badge, select }: { d: TphData; badge: string; select: (t: string, focus?: boolean) => void }) {
  const chName = (u: string) => d.channels.find((c) => c.key === u)?.name ?? u
  const onGrid = useCallback((u: TphAgentRow) => u.minutes > 0, [])
  const hasGrid = useMemo(() => d.table.some((u) => u.agents.some(onGrid)), [d.table, onGrid])
  const [onlyGrid, setOnlyGrid] = useState(true)
  const wide = useSs()
  const hiddenCount = useMemo(
    () => (onlyGrid && hasGrid ? d.table.reduce((n, row) => n + row.agents.filter((g) => !onGrid(g)).length, 0) : 0),
    [d.table, onlyGrid, hasGrid, onGrid]
  )
  const rows = useMemo(
    () =>
      d.table
        .map((u) => ({
          ...u,
          agents: u.agents.filter((c) => !hiddenCount || onGrid(c)).sort((c, g) => Number(onGrid(g)) - Number(onGrid(c))),
        }))
        .filter((u, c) => u.agents.length || !d.table[c].agents.length),
    [d.table, hiddenCount, onGrid]
  )
  return (
    <Section
      id="tph-caps"
      title="Caps and touches per hour"
      hint={`Cap: the smallest of the agent's share of the cases, one case per ${d.minutesPerCase} minutes, and the cases offered; minutes after :${d.capWindowMin} do not count, and call time comes off the agent's queue minutes in that hour.`}
    >
      {badge ? ht({ text: 'Call time, touches or over-cap hours need attention', select }) : null}
      <p className="cx-muted tph-note">
        {d.callsBasis === 'actual'
          ? "Call time: each agent's actual Maqsam call minutes are taken off their Internal, Chats and other queue minutes in that hour, whether or not the slot is marked with calls. Breaks, meetings and Inbound calls slots are not reduced."
          : `Call time: estimate until tomorrow, only for slots marked with calls (they count at ${Math.round(d.callsFactor * 100)}%). After the morning run the actual Maqsam call minutes replace it.`}
      </p>
      {d.touchesReady || d.date < d.today ? null : (
        <p className="cx-muted tph-note">
          Touches for today come in tomorrow at about 08:30, once Freshdesk activity is in. Until then the table shows
          minutes and caps only.
        </p>
      )}
      {hasGrid && d.table.some((u) => u.agents.some((c) => !onGrid(c))) ? (
        <Toggle className="tph-check" checked={onlyGrid} onChange={setOnlyGrid}>
          Only agents on the grid
          {hiddenCount ? ` (${hiddenCount} with touches but no grid time hidden)` : ''}
        </Toggle>
      ) : null}
      {rows.length ? (
        <Fragment>
          {wide ? null : (
            <div className="tph-cards">
              {rows.map((u) => (
                <CapCard key={`${u.hour}|${u.channel}`} row={u} channelName={chName(u.channel)} d={d} />
              ))}
            </div>
          )}
          {wide ? (
            <TableScroll label="Cap minutes by hour and channel" className="cx-panel cx-tablewrap tph-capstable">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Hour</th>
                    <th scope="col">Channel</th>
                    <th scope="col" className="cx-num">Cases</th>
                    <th scope="col">Agent</th>
                    <th scope="col" className="cx-num">Minutes</th>
                    <th scope="col" className="cx-num">Cap minutes</th>
                    <th scope="col" className="cx-num">Touches</th>
                    <th scope="col" className="cx-num">TPH</th>
                    <th scope="col" className="cx-num">Cap</th>
                    <th scope="col">Of cap</th>
                    <th scope="col">Cap set by</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.flatMap((u) =>
                    (u.agents.length ? u.agents : [null]).map((c, g) =>
                      c === null ? (
                        <CapTableEmptyRow key={`${u.hour}|${u.channel}`} row={u} channelName={chName(u.channel)} />
                      ) : (
                        <CapTableAgentRow
                          key={`${u.hour}|${u.channel}|${c.email}`}
                          cell={c}
                          row={u}
                          index={g}
                          channelName={chName(u.channel)}
                          d={d}
                        />
                      )
                    )
                  )}
                </tbody>
              </table>
            </TableScroll>
          ) : null}
        </Fragment>
      ) : (
        <p className="cx-muted">
          Nothing to score for this day: no agent is on a channel in the grid, no cases are logged
          {d.touchesReady ? ' and nobody has touches' : ''}. Paint the grid above to see caps.
        </p>
      )}
    </Section>
  )
}

/* --- os — each agent's day (collapsible) --------------------------------------- */

const AgentDayCard = memo(function AgentDayCard({ day, d, tph }: { day: TphDayTotal; d: TphData; tph: number | null }) {
  return (
    <dl className="cx-panel cx-panel--pad tph-card__agent cv-auto" aria-label={day.name}>
      <div className="tph-card__name">
        <dt>Agent</dt>
        <dd>{day.name}</dd>
      </div>
      <div>
        <dt>Minutes</dt>
        <dd>{day.minutes}</dd>
      </div>
      <div>
        <dt>Touches</dt>
        <dd>{day.touches ?? 'pending'}</dd>
      </div>
      <div>
        <dt>TPH on the grid</dt>
        <dd>{P(tph)}</dd>
      </div>
      <div>
        <dt>Cap ({day.scoredHours} h)</dt>
        <dd>{P(day.cap)}</dd>
      </div>
      <div>
        <dt>Touches in capped hours</dt>
        <dd>{day.capTouches ?? '–'}</dd>
      </div>
      <div>
        <dt>Of cap</dt>
        <dd>
          <St pct={day.pctOfCap} raw={day.pctRaw} over={(day.pctRaw ?? 0) > 100} why="no capped hour" />
        </dd>
      </div>
      <div>
        <dt>Hour-channels over cap</dt>
        <dd>{day.overHours}</dd>
      </div>
      <div className="tph-card__wide">
        <dt>Cap set by</dt>
        <dd>{Pn(d, day.limits)}</dd>
      </div>
    </dl>
  )
})

export function Os({ d }: { d: TphData }) {
  const n = useMemo(() => d.dayTotals.filter((o) => o.minutes > 0 || o.touches), [d.dayTotals])
  const summary = useMemo(
    () => ({
      below: n.filter((o) => o.pctOfCap != null && o.pctOfCap < 60).length,
      over: n.reduce((o, i) => o + (i.overHours || 0), 0),
    }),
    [n]
  )
  const perAgent = useMemo(() => {
    const map = new Map<string, { t: number; m: number }>()
    d.table.forEach((o) =>
      o.agents.forEach((i) => {
        if (i.minutes <= 0 || i.touches == null) return
        const h = map.get(i.email) ?? { t: 0, m: 0 }
        map.set(i.email, { t: h.t + i.touches, m: h.m + i.minutes })
      })
    )
    return map
  }, [d.table])
  const tph = useCallback((email: string) => {
    const v = perAgent.get(email)
    return v && v.m ? (v.t * 60) / v.m : null
  }, [perAgent])
  if (!n.length)
    return (
      <Section id="tph-day" title="Each agent's day">
        <p className="cx-faint">No agents have minutes or touches on this day.</p>
      </Section>
    )
  const a = summary.below
  const s = summary.over
  return (
    <Section
      id="tph-day"
      title="Each agent's day"
      collapsible
      defaultOpen={false}
      unmount
      summary={
        <Fragment>
          {n.length} agents{' '}
          {a ? <Chip status="warn">{a} below 60%</Chip> : <span>0 below 60%</span>}{' '}
          {s ? <Chip status="warn">{U(s, 'hour-channel')} over cap</Chip> : <span>0 hour-channels over cap</span>}
        </Fragment>
      }
      hint="Touches and TPH over every logged hour. Cap and % of cap count only hours with a cap and touches; an hour over its cap counts as 100%, so it cannot make up for an hour under it."
    >
      <div className="tph-cards tph-cards--day">
        {n.map((o) => (
          <AgentDayCard key={o.email} day={o} d={d} tph={tph(o.email)} />
        ))}
      </div>
    </Section>
  )
}

/* --- ds — who works each channel ------------------------------------------------ */

const EligibleChannel = memo(function EligibleChannel({ item, name }: { item: TphData['eligible'][number]; name?: string }) {
  return (
    <div className="cx-panel cx-panel--pad">
      <h3 className="cx-label">{name}</h3>
      {item.agents.length ? (
        <p className="tph-names">{item.agents.map((a) => a.name).join(', ')}</p>
      ) : (
        <p className="cx-faint">Nobody yet.</p>
      )}
    </div>
  )
})

export function Ds({ d }: { d: TphData }) {
  const eligible = useMemo(() => d.eligible, [d.eligible])
  const channels = useMemo(() => d.channels, [d.channels])
  return (
    <Section
      id="tph-who"
      title="Who works each channel"
      hint={`Agents with touches on the channel in the last ${d.eligibleDays} days`}
    >
      <div className="tph-who">
        {eligible.length ? (
          eligible.map((n) => (
            <EligibleChannel key={n.channel} item={n} name={channels.find((c) => c.key === n.channel)?.name} />
          ))
        ) : (
          <p className="cx-faint">No agents have touches on these channels in the last {d.eligibleDays} days.</p>
        )}
      </div>
    </Section>
  )
}
