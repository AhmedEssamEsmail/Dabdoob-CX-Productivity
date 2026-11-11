'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Scheduler page — scheduler.closure.js symbols
 * Z/xt/Es/$l/In/zt/jl/Bl/Dl/El/Fl/Pl/Rl/Hl/Il/Ol/ql/Nl/Ll. */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/features/shared/components/shell/Toasts'
import { Button, Chip, Input, Select, Textarea } from '@/features/shared/components/ui'
import { fetchJson, sweepStyle, useSweep } from './shared'

/** Z — the scheduler API object (google.script.run facade). */
const Z = {
  plan: (p: Record<string, unknown>) =>
    fetchJson(
      `/api/queue/scheduler?year=${p.year}&month=${p.month}${p.reshuffle ? '&reshuffle=1' : ''}${p.original ? '&original=1' : ''}${p.fresh ? '&fresh=1' : ''}`,
    ),
  save: (year: number, month: number) => fetchJson('/api/queue/scheduler', { op: 'save', year, month }),
  settings: () => fetchJson('/api/queue/scheduler?view=settings'),
  saveSettings: (cfg: Record<string, unknown>) => fetchJson('/api/queue/scheduler', { op: 'saveSettings', config: cfg }),
  saveTeamDates: (d: Record<string, unknown>) => fetchJson('/api/queue/scheduler', { op: 'saveTeamDates', ...d }),
  offDays: (year: number, month: number) => fetchJson(`/api/queue/scheduler?view=offdays&year=${year}&month=${month}`),
  saveOffDays: (d: Record<string, unknown>) => fetchJson('/api/queue/scheduler', { op: 'saveOffDays', ...d }),
  requests: () => fetchJson('/api/queue/scheduler?view=requests'),
  submitRequest: (d: Record<string, unknown>) => fetchJson('/api/queue/scheduler', { op: 'submitRequest', ...d }),
  respondToSwap: (id: string, accept: boolean) => fetchJson('/api/queue/scheduler', { op: 'respondToSwap', id, accept }),
  decide: (id: string, decision: string, note: string) => fetchJson('/api/queue/scheduler', { op: 'decide', id, decision, note }),
  setOverride: (d: Record<string, unknown>) => fetchJson('/api/queue/scheduler', { op: 'setOverride', ...d }),
  setHourOverride: (d: Record<string, unknown>) => fetchJson('/api/queue/scheduler', { op: 'setHourOverride', ...d }),
  importText: (text: string) => fetchJson('/api/queue/scheduler', { op: 'import', text }),
}

/** xt / Es / $l — the segment kinds and their labels. */
const KIND_LABEL: Record<string, string> = {
  queue: 'Queue',
  people: '1:1',
  task: 'Task',
  break: 'Break',
  meeting: 'Meeting',
}
const KINDS = Object.keys(KIND_LABEL)
const kindLabel = (t: string) => KIND_LABEL[t]

/** Request status -> shared Chip tone. */
function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'Approved' || status === 'Done'
      ? 'ok'
      : status === 'Rejected' || status === 'Declined by peer'
        ? 'bad'
        : status === 'Pending' || status === 'Awaiting peer'
          ? 'warn'
          : undefined
  return <Chip status={tone}>{status}</Chip>
}

// SVG geometry (Pe / Tl / Ne / $e / _e / Nn).
const LABEL_W = 150
const TICK_W = 16
const ROW_H = 46
const COVER_H = 40
const AXIS_Y = 26
const SVG_W = 1040

/** In — "09:30" style label for a decimal hour. */
const hourLabel = (t: number) => `${String(Math.floor(t)).padStart(2, '0')}:${t % 1 ? '30' : '00'}`

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // zt
const ce = (t: unknown) => (t instanceof Error ? t.message : String(t))

/** jl — the Settings field labels, keyed by config key. */
const CFG_LABELS: Record<string, string> = {
  shift_am_start: 'AM shift starts',
  shift_am_end: 'AM shift ends',
  shift_pm_start: 'PM shift starts',
  shift_pm_end: 'PM shift ends',
  shift_hours: 'Shift length (hours)',
  break_minutes: 'Break (minutes, 0 = none drawn)',
  working_days: 'Working days per week',
  primary_queue_h: 'First lead on a slot: queue hours',
  primary_people_h: 'First lead: people hours',
  primary_task_h: 'First lead: task hours',
  secondary_queue_h: 'Second lead: queue hours',
  secondary_people_h: 'Second lead: people hours',
  secondary_task_h: 'Second lead: task hours',
  people_source: 'People time (calendar or reserve)',
  shift_rotation: 'Rotation (weekly or daily)',
  forbid_pm_then_am: 'Never AM straight after PM (yes/no)',
  wfh_max_per_week: 'Work-from-home days per week',
  meeting_minutes: 'Meeting length when none is recorded (minutes)',
  peak_days: 'Busiest days (daily rotation)',
  peak_shift: 'Extra lead goes to (daily rotation)',
  consecutive_off: 'Rest days together (yes/no)',
}

/** Bl — the Settings tab: rules, joining/leaving dates, paste a roster. */
function SettingsTab({ onChanged }: { onChanged: () => void }) {
  const [n, s] = useState<any>(null)
  const [a, l] = useState<Record<string, string>>({})
  const [r, i] = useState('')
  const [h, p] = useState(false)
  const [d, u] = useState<{ ok: boolean; text: string } | null>(null)
  const c = () =>
    Z.settings().then((o) => {
      s(o)
      l(o.config)
    }, (o) => toast(ce(o), 'error'))
  useEffect(() => {
    c()
  }, [])
  return n ? (
    <Fragment>
      <div className="block">
        <h2 className="block-title">Rules</h2>
        <p className="block-text">V1&apos;s defaults, editable. Changing one rebuilds the plan for every month.</p>
        <div className="sch-settings">
          {Object.keys(n.defaults).map((o) => (
            <label key={o} className="field">
              <span className="field-label">{CFG_LABELS[o] ?? o}</span>
              <Input className="input" value={a[o] ?? ''} onInput={(f) => l((g) => ({ ...g, [o]: (f.target as HTMLInputElement).value }))} />
            </label>
          ))}
        </div>
        <Button
          variant="primary"
          onClick={async () => {
            try {
              await Z.saveSettings(a)
              toast('Saved.')
              onChanged()
            } catch (o) {
              toast(ce(o), 'error')
            }
          }}
        >
          Save rules
        </Button>
      </div>
      <div className="block">
        <h2 className="block-title">Joining and leaving dates</h2>
        <p className="block-text">
          Team leads come from People &amp; holidays (role team lead). A date here limits the months a lead is rostered; blank means always.
        </p>
        <div className="sch-scroll">
          <table className="sch-table">
            <thead>
              <tr>
                <th scope="col">Team lead</th>
                <th scope="col">Joins</th>
                <th scope="col">Leaves</th>
              </tr>
            </thead>
            <tbody>
              {n.team.map((o: any) => (
                <tr key={o.email}>
                  <th scope="row">{o.display}</th>
                  {(['start', 'end'] as const).map((f) => (
                    <td key={f}>
                      <Input
                        className="input"
                        type="date"
                        aria-label={`${o.display} ${f === 'start' ? 'joins' : 'leaves'}`}
                        value={o[f]}
                        onChange={async (g) => {
                          const m = (g.target as HTMLInputElement).value
                          try {
                            await Z.saveTeamDates({
                              email: o.email,
                              startDate: f === 'start' ? m : o.start,
                              endDate: f === 'end' ? m : o.end,
                              note: o.note,
                            })
                            toast('Saved.')
                            await c()
                            onChanged()
                          } catch (b) {
                            toast(ce(b), 'error')
                          }
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="block">
        <h2 className="block-title">Paste a roster</h2>
        <p className="block-text">
          One line per day: name or email, date (YYYY-MM-DD), AM, PM, OFF or LEAVE. Every line is checked before any is applied.
        </p>
        <Textarea className="input sch-paste" rows={5} value={r} onInput={(o) => i((o.target as HTMLTextAreaElement).value)} aria-label="Roster to import" />
        <Button
          variant="primary"
          disabled={!r.trim() || h}
          onClick={async () => {
            p(true)
            u(null)
            try {
              const o = await Z.importText(r)
              const f = `Done: ${o.imported} day${o.imported === 1 ? '' : 's'} imported.`
              u({ ok: true, text: f })
              toast(f)
              i('')
              onChanged()
            } catch (o) {
              const f = `Not imported: ${ce(o)}`
              u({ ok: false, text: f })
              toast(f, 'error')
            } finally {
              p(false)
            }
          }}
        >
          {h ? 'Importing…' : 'Import'}
        </Button>
        {h ? (
          <p className="block-text" role="status">
            Importing. Keep this page open.
          </p>
        ) : null}
        {d ? (
          <p className="block-text" role={d.ok ? 'status' : 'alert'} style={{ whiteSpace: 'pre-line', fontWeight: 600 }}>
            {d.text}
          </p>
        ) : null}
      </div>
    </Fragment>
  ) : (
    <div className="skeleton" style={{ height: '200px' }} />
  )
}

/** Dl — the Rest days tab: a per-month pair per lead, plus the weekday cover summary. */
function RestDaysTab({ year, month, admin, onChanged }: { year: number; month: number; admin: boolean; onChanged: () => void }) {
  const [l, r] = useState<any>(null)
  const [i, h] = useState('')
  const p = () => Z.offDays(year, month).then(r, (d) => h(ce(d)))
  useEffect(() => {
    p()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])
  return i ? (
    <p className="field-error" role="alert">
      {i}
    </p>
  ) : l ? (
    <Fragment>
      <p className="block-text">Two consecutive rest days, set per month. A lead left on &quot;rotation&quot; gets a block that walks forward each week.</p>
      <div className="sch-scroll">
        <table className="sch-table">
          <thead>
            <tr>
              <th scope="col">Team lead</th>
              <th scope="col">Rest days for {l.monthName}</th>
            </tr>
          </thead>
          <tbody>
            {l.tls.map((d: string) => {
              const u = l.offDays[d]
              const c = u && u.length === 2 ? u.join(',') : ''
              return (
                <tr key={d}>
                  <th scope="row">{l.names[d] ?? d}</th>
                  <td>
                    {admin ? (
                      <Select
                        className="select"
                        aria-label={`Rest days for ${l.names[d]}`}
                        value={c}
                        onChange={async (o) => {
                          try {
                            await Z.saveOffDays({ tl: d, offDays: (o.target as HTMLSelectElement).value, month: l.monthTag })
                            toast('Saved.')
                            await p()
                            onChanged()
                          } catch (f) {
                            toast(ce(f), 'error')
                          }
                        }}
                      >
                        <option value="">Rotation (automatic)</option>
                        {l.pairs.map((o: { value: string; label: string }) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    ) : c ? (
                      c
                        .split(',')
                        .map((o: string) => l.dowNames[+o])
                        .join(' + ')
                    ) : (
                      'Rotation'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <h2 className="block-title sch-sub">Cover by weekday if these hold</h2>
      <ul className="sch-cover">
        {l.coverage.map((d: any) => (
          <li key={d.dow} className={d.availableIfFixed < 2 ? 'low' : ''}>
            <b>{d.name.slice(0, 3)}</b>
            <span>{d.availableIfFixed} available</span>
            <span className="sch-hint">{d.unset} on rotation</span>
          </li>
        ))}
      </ul>
    </Fragment>
  ) : (
    <div className="skeleton" style={{ height: '160px' }} />
  )
}

/** El — the day the Hour-by-hour tab opens on: today when it is in the month. */
function pickDay(res: any): string {
  const n = new Date()
  const s = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  return res.plan.days.some((a: any) => a.key === s) ? s : res.plan.days[0].key
}

/** Fl — the Requests tab: new-request form + the status table. */
function RequestsTab({ admin, onChanged }: { admin: boolean; onChanged: () => void }) {
  const [s, a] = useState<any>(null)
  const [l, r] = useState<{ email: string; display: string }[]>([])
  const [i, h] = useState({
    type: 'wfh',
    dateFrom: '',
    dateTo: '',
    shift: 'PM',
    withTl: '',
    withShift: '',
    reason: '',
  })
  const p = (c: string, o: unknown) => h((f) => ({ ...f, [c]: o }))
  const d = () => Z.requests().then(a, (c) => toast(ce(c), 'error'))
  useEffect(() => {
    d()
    Z.settings().then((c) => r(c.team), () => {})
  }, [])
  const u = async (c: () => Promise<unknown>, o: string) => {
    try {
      await c()
      toast(o)
      await d()
      onChanged()
    } catch (f) {
      toast(ce(f), 'error')
    }
  }
  return (
    <Fragment>
      <div className="block">
        <h2 className="block-title">New request</h2>
        <div className="sch-edit-row">
          <label className="field">
            <span className="field-label">Type</span>
            <Select
              className="select"
              value={i.type}
              onChange={(c) => {
                p('type', (c.target as HTMLSelectElement).value)
                p('shift', (c.target as HTMLSelectElement).value === 'offday' ? '' : 'PM')
              }}
            >
              <option value="wfh">Work from home</option>
              <option value="swap">Swap a shift</option>
              <option value="leave">Leave</option>
              <option value="offday">Change rest days</option>
            </Select>
          </label>
          <label className="field">
            <span className="field-label">{i.type === 'leave' ? 'From' : 'Date'}</span>
            <Input className="input" type="date" value={i.dateFrom} onInput={(c) => p('dateFrom', (c.target as HTMLInputElement).value)} />
          </label>
          {i.type === 'leave' ? (
            <label className="field">
              <span className="field-label">To</span>
              <Input className="input" type="date" value={i.dateTo} onInput={(c) => p('dateTo', (c.target as HTMLInputElement).value)} />
            </label>
          ) : null}
          {i.type === 'wfh' || i.type === 'swap' ? (
            <label className="field">
              <span className="field-label">{i.type === 'swap' ? 'My shift' : 'Shift'}</span>
              <Select className="select" value={i.shift} onChange={(c) => p('shift', (c.target as HTMLSelectElement).value)}>
                <option>AM</option>
                <option>PM</option>
              </Select>
            </label>
          ) : null}
          {i.type === 'offday' ? (
            <label className="field">
              <span className="field-label">Two days (0 = Sunday)</span>
              <Input className="input" placeholder="5,6" value={i.shift} onInput={(c) => p('shift', (c.target as HTMLInputElement).value)} />
            </label>
          ) : null}
          {i.type === 'swap' ? (
            <Fragment>
              <label className="field">
                <span className="field-label">With</span>
                <Select className="select" value={i.withTl} onChange={(c) => p('withTl', (c.target as HTMLSelectElement).value)}>
                  <option value="">Choose…</option>
                  {l
                    .filter((c) => c.email !== s?.me)
                    .map((c) => (
                      <option key={c.email} value={c.email}>
                        {c.display}
                      </option>
                    ))}
                </Select>
              </label>
              <label className="field">
                <span className="field-label">Their shift</span>
                <Select className="select" value={i.withShift} onChange={(c) => p('withShift', (c.target as HTMLSelectElement).value)}>
                  <option value="">Off</option>
                  <option>AM</option>
                  <option>PM</option>
                </Select>
              </label>
            </Fragment>
          ) : null}
          <label className="field sch-grow">
            <span className="field-label">Reason</span>
            <Input className="input" value={i.reason} onInput={(c) => p('reason', (c.target as HTMLInputElement).value)} />
          </label>
        </div>
        <Button
          variant="primary"
          onClick={() =>
            void u(
              () =>
                Z.submitRequest({ ...i, shift: i.shift }).then(() =>
                  h((c) => ({ ...c, dateFrom: '', dateTo: '', reason: '' })),
                ),
              'Request sent.',
            )
          }
        >
          Send request
        </Button>
      </div>
      <div className="sch-scroll">
        <table className="sch-table">
          <thead>
            <tr>
              <th scope="col">Who</th>
              <th scope="col">Request</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="cx-sr">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {s?.rows.length ? null : (
              <tr>
                <td colSpan={4}>No requests.</td>
              </tr>
            )}
            {s?.rows.map((c: any) => (
              <tr key={c.id}>
                <th scope="row">{c.tlName}</th>
                <td>
                  {c.type === 'wfh' ? 'Work from home' : c.type === 'swap' ? `Swap with ${c.withName}` : c.type === 'leave' ? 'Leave' : 'Rest days'} ·{' '}
                  {c.dateFrom}
                  {c.dateTo && c.dateTo !== c.dateFrom ? ` to ${c.dateTo}` : ''}
                  {c.shift && c.type !== 'leave' ? ` · ${c.shift}` : ''}
                  {c.reason ? <div className="sch-hint">{c.reason}</div> : null}
                </td>
                <td>
                  {c.status ? <StatusPill status={c.status} /> : null}
                  {c.note ? <div className="sch-hint">{c.note}</div> : null}
                </td>
                <td className="sch-actions">
                  {c.needsMyAnswer ? (
                    <Fragment>
                      <Button variant="quiet" onClick={() => void u(() => Z.respondToSwap(c.id, true), 'Agreed.')}>
                        Agree
                      </Button>
                      <Button variant="quiet" onClick={() => void u(() => Z.respondToSwap(c.id, false), 'Declined.')}>
                        Decline
                      </Button>
                    </Fragment>
                  ) : null}
                  {admin && c.status === 'Pending' ? (
                    <Fragment>
                      <Button variant="primary" onClick={() => void u(() => Z.decide(c.id, 'approve', ''), 'Approved.')}>
                        Approve
                      </Button>
                      <Button variant="quiet" onClick={() => void u(() => Z.decide(c.id, 'reject', ''), 'Rejected.')}>
                        Reject
                      </Button>
                    </Fragment>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Fragment>
  )
}

/** Pl — the day-cell edit panel under the month grid. */
function DayEdit({ plan, tl, date, onClose, onSaved }: { plan: any; tl: string; date: string; onClose: () => void; onSaved: () => void }) {
  const r = plan.grid[tl][date]
  const [i, h] = useState(r.manual ? (r.leave ? 'LEAVE' : r.shift) : '')
  const [p, d] = useState(r.reason)
  const [u, c] = useState(!!r.wfh)
  return (
    <div className="sch-edit block" role="group" aria-label="Change one day">
      <h2 className="block-title">
        {plan.names[tl]} · {date}
      </h2>
      <div className="sch-edit-row">
        <label className="field">
          <span className="field-label">Shift</span>
          <Select className="select" value={i} onChange={(o) => h((o.target as HTMLSelectElement).value)}>
            <option value="">As generated</option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
            <option value="OFF">Off</option>
            <option value="LEAVE">Leave</option>
          </Select>
        </label>
        <label className="field">
          <span className="field-label">Reason</span>
          <Input className="input" value={p} onInput={(o) => d((o.target as HTMLInputElement).value)} />
        </label>
        <label className="sch-check">
          {/* kept raw:sch-check is a bespoke inline checkbox, not a ui/Toggle pill */}
          <input type="checkbox" checked={u} onChange={(o) => c((o.target as HTMLInputElement).checked)} /> Working from home
        </label>
      </div>
      <div className="sch-edit-row">
        <Button
          variant="primary"
          onClick={async () => {
            try {
              await Z.setOverride({ date, tl, shift: i, wfh: u, reason: p })
              onSaved()
            } catch (o) {
              toast(ce(o), 'error')
            }
          }}
        >
          Apply
        </Button>
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

/** Rl — the warnings strip over the month grid: uncovered slots, task shortfalls, moves, exceptions. */
function PlanWarns({ plan }: { plan: any }) {
  const n = plan.problems.filter((r: any) => r.kind !== 'moved')
  const s = plan.problems.filter((r: any) => r.kind === 'moved')
  const a = (r: any[], i: (h: any) => React.ReactNode) => (
    <ul>
      {r.slice(0, 6).map((h, p) => (
        <li key={p}>{i(h)}</li>
      ))}
      {r.length > 6 ? <li>…and {r.length - 6} more</li> : null}
    </ul>
  )
  const l = (r: string) => (r ? plan.names[r] ?? r : '')
  return (
    <div className="sch-warns">
      {plan.gaps.length ? (
        <div className="sch-warn sch-warn-bad">
          <b>
            {plan.gaps.length} uncovered shift{plan.gaps.length === 1 ? '' : 's'}
          </b>
          {a(plan.gaps, (r: any) => `${r.date} · ${r.shift}${r.why ? ' — ' + r.why : ''}`)}
          <span className="sch-warn-tip">Regenerate may find an arrangement that covers them.</span>
        </div>
      ) : null}
      {n.length ? (
        <div className="sch-warn sch-warn-bad">
          <b>
            {n.length} task{n.length === 1 ? '' : 's'} will not fit before the deadline
          </b>
          {a(n, (r: any) => `${r.task}${r.tl ? ' (' + l(r.tl) + ')' : ''} — ${r.why}`)}
        </div>
      ) : null}
      {s.length ? (
        <div className="sch-warn">
          <b>
            {s.length} recurring booking{s.length === 1 ? '' : 's'} moved
          </b>
          {a(s, (r: any) => `${r.task} — ${r.why}`)}
        </div>
      ) : null}
      {plan.exceptions.length ? (
        <div className="sch-warn">
          <b>
            {plan.exceptions.length} roster exception{plan.exceptions.length === 1 ? '' : 's'}
          </b>
          {a(plan.exceptions, (r: any) => [r.date, l(r.tl), r.shift, r.why].filter(Boolean).join(' · '))}
        </div>
      ) : null}
    </div>
  )
}

/** Hl — the Month tab: the sch-grid-table of leads x days. */
function MonthGrid({ res, admin, onOpenDay, onChanged }: { res: any; admin: boolean; onOpenDay: (key: string) => void; onChanged: () => void }) {
  const { plan: l } = res
  const [r, i] = useState<{ tl: string; date: string } | null>(null)
  return (
    <Fragment>
      {admin ? <PlanWarns plan={l} /> : null}
      <div className="sch-scroll">
        <table className="sch-grid-table">
          <thead>
            <tr>
              <th scope="col" className="sch-sticky">
                Team lead
              </th>
              {l.days.map((h: any) => (
                <th key={h.key} scope="col" className={`sch-day${h.dow === 5 || h.dow === 6 ? ' wk' : ''}`}>
                  {/* kept raw:sch-day-btn is a bespoke day-header button, not a ui/Button */}
                  <button type="button" className="sch-day-btn" onClick={() => onOpenDay(h.key)} title="Open this day hour by hour">
                    <span>{DOW[h.dow]}</span>
                    <b>{h.dom}</b>
                  </button>
                </th>
              ))}
              <th scope="col">AM</th>
              <th scope="col">PM</th>
            </tr>
          </thead>
          <tbody>
            {l.tls.map((h: string) => (
              <tr key={h}>
                <th scope="row" className="sch-sticky">
                  {l.names[h] ?? h}
                </th>
                {l.days.map((p: any) => {
                  const d = l.grid[h][p.key]
                  const u = d.shift === 'OFF' ? (d.leave ? 'L' : '·') : d.shift
                  const c = `${l.names[h]} · ${p.key} · ${d.shift === 'OFF' ? (d.leave ? 'leave' : 'off') : `${d.shift} ${d.start}-${d.end}${d.wfh ? ' · working from home' : ''}`}${d.reason ? ' · ' + d.reason : ''}`
                  return (
                    <td key={p.key} className="sch-cell-td">
                      {/* kept raw: sch-cell is a bespoke roster grid cell (sch-* kind classes + manual ring), not a ui/Button */}
                      <button
                        type="button"
                        className={`sch-cell sch-${d.shift.toLowerCase()}${d.manual ? ' manual' : ''}`}
                        title={c}
                        aria-label={c}
                        onClick={() => (admin ? i({ tl: h, date: p.key }) : onOpenDay(p.key))}
                      >
                        {u}
                        {d.wfh ? <sup>H</sup> : null}
                      </button>
                    </td>
                  )
                })}
                <td className="num">{l.totals[h]?.am ?? 0}</td>
                <td className="num">{l.totals[h]?.pm ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sch-hint">
        Click a day number for the hour-by-hour graph. {admin ? 'Click a cell to move that lead for that day.' : ''} A small H is working from home; L is
        leave; a ring marks a hand change.
      </p>
      {r ? <DayEdit plan={l} tl={r.tl} date={r.date} onClose={() => i(null)} onSaved={() => { i(null); onChanged() }} /> : null}
    </Fragment>
  )
}

/** Il — the hour-edit panel under the timeline. */
function HourEdit({ plan, hours, date, sel, onClose, onSaved }: { plan: any; hours: number[]; date: string; sel: { tl: string; hour: number }; onClose: () => void; onSaved: () => void }) {
  const [i, h] = useState(sel.hour)
  const [p, d] = useState(sel.hour)
  const [u, c] = useState('task')
  const [o, f] = useState('')
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- verbatim Il: the panel re-seeds when the picked cell changes
    h(sel.hour)
    d(sel.hour)
  }, [sel.tl, sel.hour])
  const g = async (m: string) => {
    try {
      await Z.setHourOverride({ date, tl: sel.tl, hourFrom: i, hourTo: Math.max(i, p), kind: m, label: o })
      onSaved()
    } catch (b) {
      toast(ce(b), 'error')
    }
  }
  return (
    <div className="sch-edit block" role="group" aria-label="Change hours">
      <h2 className="block-title">
        {plan.names[sel.tl]} · {date}
      </h2>
      <div className="sch-edit-row">
        <label className="field">
          <span className="field-label">From</span>
          <Select className="select" value={i} onChange={(m) => h(+(m.target as HTMLSelectElement).value)}>
            {hours.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, '0')}:00
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span className="field-label">Until the end of</span>
          <Select className="select" value={p} onChange={(m) => d(+(m.target as HTMLSelectElement).value)}>
            {hours
              .filter((m) => m >= i)
              .map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}:00
                </option>
              ))}
          </Select>
        </label>
        <label className="field">
          <span className="field-label">Doing</span>
          <Select className="select" value={u} onChange={(m) => c((m.target as HTMLSelectElement).value)}>
            {KINDS.filter((m) => m !== 'meeting').map((m) => (
              <option key={m} value={m}>
                {kindLabel(m)}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span className="field-label">Label (optional)</span>
          <Input className="input" value={o} onInput={(m) => f((m.target as HTMLInputElement).value)} />
        </label>
      </div>
      <div className="sch-edit-row">
        <Button variant="primary" onClick={() => void g(u)}>
          Apply
        </Button>
        <Button variant="quiet" onClick={() => void g('')}>
          Clear my edit
        </Button>
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}

/** Ol — the sch-legend list. */
function Legend() {
  return (
    <ul className="sch-legend" aria-label="Legend">
      {KINDS.map((t) => (
        <li key={t}>
          <span className={`sch-swatch sch-k-${t}`} aria-hidden="true" />
          {KIND_LABEL[t]}
        </li>
      ))}
      <li>
        <span className="sch-swatch sch-cov-one" aria-hidden="true" />
        Only one on the queue
      </li>
      <li>
        <span className="sch-swatch sch-cov-zero" aria-hidden="true" />
        Nobody on the queue
      </li>
    </ul>
  )
}

/** ql — the hour-by-hour SVG: gridlines, coverage band and one row per lead. */
function Timeline({
  date,
  hours,
  rows,
  coverage,
  names,
  selected,
  onPick,
}: {
  date: string
  hours: number[]
  rows: any[]
  coverage: { rostered: number[]; onQueue: number[] } | undefined
  names: Record<string, string>
  selected: { tl: string; hour: number } | null
  onPick?: (tl: string, hour: number) => void
}) {
  const h = useRef<HTMLDivElement | null>(null)
  useSweep(h)
  if (!hours.length) return null
  const p = hours[0]
  const d = (SVG_W - LABEL_W - TICK_W) / hours.length
  const u = (o: number) => LABEL_W + (o - p) * d
  const c = AXIS_Y + COVER_H + rows.length * ROW_H + 8
  return (
    <div className="sch-tl-wrap cc-chart" ref={h}>
      <svg className="sch-tl" viewBox={`0 0 ${SVG_W} ${c}`} role="img" aria-label={`Hour by hour for ${date}: ${rows.length} team leads on shift`}>
        {hours.map((o) => (
          <g key={o}>
            <line className="sch-grid" x1={u(o)} x2={u(o)} y1={AXIS_Y} y2={c - 8} />
            <text className="sch-axis" x={u(o) + 3} y={16}>
              {String(o).padStart(2, '0')}
            </text>
          </g>
        ))}
        <line className="sch-grid" x1={u(p + hours.length)} x2={u(p + hours.length)} y1={AXIS_Y} y2={c - 8} />
        <text className="sch-rowlabel" x={LABEL_W - 10} y={AXIS_Y + COVER_H / 2 + 4} textAnchor="end">
          On the queue
        </text>
        {hours.map((o, f) => {
          const g = coverage?.rostered[f] ?? 0
          const m = coverage?.onQueue[f] ?? 0
          if (!g) return <rect key={o} className="sch-cov sch-cov-none" x={u(o) + 1} y={AXIS_Y + 4} width={d - 2} height={COVER_H - 8} rx={3} />
          const b = m === 0 ? 'sch-cov-zero' : m === 1 ? 'sch-cov-one' : 'sch-cov-ok'
          return (
            <g key={o}>
              <title>{`${String(o).padStart(2, '0')}:00: ${m} on the queue, ${g} on shift`}</title>
              <rect className={`sch-cov ${b}`} x={u(o) + 1} y={AXIS_Y + 4} width={d - 2} height={COVER_H - 8} rx={3} />
              <text className="sch-cov-n" x={u(o) + d / 2} y={AXIS_Y + COVER_H / 2 + 4} textAnchor="middle">
                {m}
              </text>
            </g>
          )
        })}
        {rows.map((o, f) => {
          const g = AXIS_Y + COVER_H + f * ROW_H
          return (
            <g key={o.tl} className="cc-sweep-fade" style={sweepStyle(f)}>
              <text className="sch-rowlabel" x={LABEL_W - 10} y={g + 20} textAnchor="end">
                {names[o.tl] ?? o.tl}
              </text>
              <text className="sch-rowsub" x={LABEL_W - 10} y={g + 35} textAnchor="end">
                {o.shift} {hourLabel(o.from)}-{hourLabel(o.to)}
                {o.wfh ? ' · WFH' : ''}
              </text>
              <rect className="sch-shiftband" x={u(o.from)} y={g + 6} width={u(o.to) - u(o.from)} height={ROW_H - 12} rx={6} />
              {o.segments.map((m: any) => {
                const b = u(m.from)
                const v = u(m.to) - b
                const y = Math.max(0, Math.floor((v - 10) / 6.4))
                const w = m.label.length > y ? (y > 3 ? m.label.slice(0, y - 1) + '…' : '') : m.label
                const M = selected && selected.tl === o.tl && m.from <= selected.hour && m.to > selected.hour
                return (
                  <g
                    key={m.from}
                    className={`sch-seg${M ? ' sch-seg-sel' : ''}${onPick ? ' sch-seg-click' : ''}`}
                    onClick={onPick ? () => onPick(o.tl, m.from) : undefined}
                  >
                    <title>{`${names[o.tl] ?? o.tl} · ${String(m.from).padStart(2, '0')}:00-${String(m.to).padStart(2, '0')}:00 · ${kindLabel(m.kind)}: ${m.label}${m.booked ? ' (booked)' : ''}${m.manual ? ' (edited by hand)' : ''}`}</title>
                    <rect className={`sch-bar sch-k-${m.kind}${m.manual ? ' sch-manual' : ''}`} x={b + 1} y={g + 8} width={Math.max(0, v - 2)} height={ROW_H - 16} rx={5} />
                    {w ? (
                      <text className="sch-bar-text" x={b + 7} y={g + ROW_H / 2 + 4}>
                        {w}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Nl — the Hour-by-hour tab. */
function TimelineTab({ res, admin, date, setDate, onChanged }: { res: any; admin: boolean; date: string; setDate: (d: string) => void; onChanged: () => void }) {
  const { plan: r, timeline: i } = res
  const h = useMemo(
    () => i.rows.filter((g: any) => g.date === date).sort((g: any, m: any) => g.from - m.from || (r.names[g.tl] ?? '').localeCompare(r.names[m.tl] ?? '')),
    [i, date, r.names],
  )
  const p = r.tls.filter((g: string) => !h.some((m: any) => m.tl === g))
  const d = r.days.findIndex((g: any) => g.key === date)
  const [u, c] = useState<{ tl: string; hour: number } | null>(null)
  const o = i.conflicts.filter((g: any) => g.date === date)
  const f = (i.coverage[date]?.onQueue ?? []).some((g: number, m: number) => g === 1 && (i.coverage[date]?.rostered[m] ?? 0) > 0)
  return (
    <Fragment>
      <div className="sch-daybar">
        <Button variant="quiet" disabled={d <= 0} onClick={() => setDate(r.days[d - 1].key)} aria-label="Previous day">
          ‹
        </Button>
        <label className="cx-sr" htmlFor="sch-date">
          Day
        </label>
        <Select
          id="sch-date"
          className="select"
          value={date}
          onChange={(g) => {
            c(null)
            setDate((g.target as HTMLSelectElement).value)
          }}
        >
          {r.days.map((g: any) => (
            <option key={g.key} value={g.key}>
              {DOW[g.dow]} {g.dom}
            </option>
          ))}
        </Select>
        <Button variant="quiet" disabled={d >= r.days.length - 1} onClick={() => setDate(r.days[d + 1].key)} aria-label="Next day">
          ›
        </Button>
        <strong className="sch-daytitle">{date ? `${DOW[r.days[d]?.dow ?? 0]} ${date}` : ''}</strong>
      </div>
      {h.length ? (
        <Timeline
          date={date}
          hours={i.hours}
          rows={h}
          coverage={i.coverage[date]}
          names={r.names}
          selected={u}
          onPick={admin ? (g, m) => c({ tl: g, hour: m }) : undefined}
        />
      ) : (
        <p className="block-text">Nobody is rostered on this day.</p>
      )}
      <Legend />
      {p.length ? <p className="sch-hint">Off: {p.map((g: string) => r.names[g] ?? g).join(', ')}.</p> : null}
      {f ? (
        <p className="sch-hint">Hours marked amber have one lead on the queue: that lead cannot be pulled into a meeting, 1:1 or task.</p>
      ) : null}
      {admin && o.length ? (
        <div className="sch-warn sch-warn-bad">
          <b>
            {o.length} booking{o.length === 1 ? '' : 's'} on the only lead on the queue
          </b>
          <ul>
            {o.map((g: any, m: number) => (
              <li key={m}>
                {r.names[g.tl]} at {String(g.hour).padStart(2, '0')}:00 — {g.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="block sch-sources">
        <h2 className="block-title">Where these hours come from</h2>
        <p className="block-text">
          Task blocks are the team leads&apos; tasks, placed before their deadline. 1:1 and meeting blocks are the ones booked in their tabs; for the My
          day owner their calendar adds busy blocks. Log them where they belong and this graph follows.
        </p>
        <p className="sch-links">
          <a className="btn btn-quiet" href="#/one-on-ones">
            Log a 1:1
          </a>{' '}
          <a className="btn btn-quiet" href="#/tl-tasks">
            Add a TL task
          </a>{' '}
          <a className="btn btn-quiet" href="#/meetings">
            Add a meeting
          </a>
        </p>
      </div>
      {admin && u ? (
        <HourEdit plan={r} hours={i.hours} date={date} sel={u} onClose={() => c(null)} onSaved={() => { c(null); onChanged() }} />
      ) : null}
      {admin && !u && h.length ? <p className="sch-hint">Click a bar to change what a lead is doing in those hours.</p> : null}
    </Fragment>
  )
}

/** Ll — the Scheduler page. */
export function SchedulerPage({ route }: { route: { title: string } }) {
  const n = new Date()
  const [s, a] = useState({ year: n.getFullYear(), month: n.getMonth() })
  const [l, r] = useState<any>(null)
  const [i, h] = useState('')
  const [p, d] = useState(false)
  const [u, c] = useState('month')
  const [o, f] = useState('')
  async function g(y: Record<string, unknown> = {}) {
    d(true)
    h('')
    try {
      const w = await Z.plan({ year: s.year, month: s.month, ...y })
      r(w)
      f((M) => (M && w.plan.days.some(($: any) => $.key === M) ? M : pickDay(w)))
      if (w.regen) {
        const M = w.regen
        toast(
          M.to === M.from && M.note
            ? M.note
            : M.to === 0
              ? `Back to the original roster (${M.changed} shift${M.changed === 1 ? '' : 's'} changed).`
              : `Regenerated: roster variant ${M.to}. ${M.changed} shift${M.changed === 1 ? '' : 's'} changed.`,
        )
      } else if (y.fresh) {
        toast('Re-read every input. The roster only changes when an input does; use Regenerate for another arrangement.')
      }
    } catch (w) {
      h(ce(w))
    } finally {
      d(false)
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- verbatim Ll: the plan reloads when the month changes
    g()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.year, s.month])
  const m = l?.me.role === 'admin'
  const b = (y: number) =>
    a((w) => {
      const M = new Date(w.year, w.month + y, 1)
      return { year: M.getFullYear(), month: M.getMonth() }
    })
  const v: string[][] = [
    ['month', 'Month'],
    ['timeline', 'Hour by hour'],
    ['off', 'Rest days'],
    ['requests', 'Requests'],
  ]
  if (m) v.push(['settings', 'Settings'])
  return (
    <section className="page sch-page" aria-labelledby="page-title">
      <header className="page-head sch-head">
        <div>
          <h1 id="page-title" className="page-title">
            {route.title}
          </h1>
          <p className="page-purpose">
            Who works which shift, and what each lead is doing in every hour.
          </p>
        </div>
        <div className="sch-controls">
          <div className="sch-month" role="group" aria-label="Month">
            <Button variant="quiet" onClick={() => b(-1)} aria-label="Previous month">
              ‹
            </Button>
            <strong className="sch-month-name">{l?.plan.monthName ?? '…'}</strong>
            <Button variant="quiet" onClick={() => b(1)} aria-label="Next month">
              ›
            </Button>
          </div>
          {m ? (
            <Fragment>
              <Button
                variant="primary"
                disabled={p}
                onClick={() => void g({ reshuffle: true })}
                title="Try another arrangement of who works which week. Covers every slot the current roster covers."
              >
                Regenerate
              </Button>
              {l && l.plan.variant > 0 ? (
                <Button variant="quiet" disabled={p} onClick={() => void g({ original: true })}>
                  Original roster
                </Button>
              ) : null}
              <Button
                variant="quiet"
                disabled={p}
                onClick={() => void g({ fresh: true })}
                title="Read every sheet again. Use after editing a tab by hand."
              >
                Re-read inputs
              </Button>
              <Button
                variant="quiet"
                disabled={p}
                onClick={async () => {
                  try {
                    const y = await Z.save(s.year, s.month)
                    toast(`Saved ${y.saved} rows. Working hours now follow this roster.`)
                  } catch (y) {
                    toast(ce(y), 'error')
                  }
                }}
              >
                Save roster
              </Button>
            </Fragment>
          ) : null}
        </div>
      </header>
      {l ? (
        <p className="sch-variant">
          Roster variant {l.plan.variant}
          {l.plan.variant === 0 ? ' (the original)' : ''}. Shifts are Kuwait time.
        </p>
      ) : null}
      {i ? (
        <p className="field-error" role="alert">
          {i}
        </p>
      ) : null}
      <div className="sch-tabs" role="tablist" aria-label="Scheduler views">
        {v.map(([y, w]) => (
          // kept raw:sch-tab is a bespoke tab button (sch-tab/.on classes + sch-panel aria hooks), not a ui/Tabs
          <button
            key={y}
            type="button"
            role="tab"
            id={`sch-tab-${y}`}
            aria-selected={u === y}
            aria-controls={`sch-panel-${y}`}
            className={`sch-tab${u === y ? ' on' : ''}`}
            onClick={() => c(y)}
          >
            {w}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`sch-panel-${u}`} aria-labelledby={`sch-tab-${u}`} aria-busy={p} className="cx-panel">
        <div className="cx-section__head">
          <div>
            <div className="cx-section__title">{v.find(([y]) => y === u)?.[1] ?? ''}</div>
            <div className="cx-section__hint">{l?.plan.monthName ?? ''}</div>
          </div>
        </div>
        <div className="cx-panel--pad">
        {!l && !i ? <div className="skeleton" style={{ height: '220px' }} /> : null}
        {l && u === 'month' ? <MonthGrid res={l} admin={!!m} onOpenDay={(y) => { f(y); c('timeline') }} onChanged={() => g()} /> : null}
        {l && u === 'timeline' ? <TimelineTab res={l} admin={!!m} date={o} setDate={f} onChanged={() => g()} /> : null}
        {l && u === 'off' ? <RestDaysTab year={s.year} month={s.month} admin={!!m} onChanged={() => g()} /> : null}
        {l && u === 'requests' ? <RequestsTab admin={!!m} onChanged={() => g()} /> : null}
        {l && u === 'settings' && m ? <SettingsTab onChanged={() => g()} /> : null}
        </div>
      </div>
    </section>
  )
}
