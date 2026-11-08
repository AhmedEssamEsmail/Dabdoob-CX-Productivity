'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy TL tasks page (tl-tasks.closure.js symbols aa/ua/ia/oa/da/na).
 * Assign/add form, 10-day load meters, filter bar, gantt timeline, task detail. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchJson, useSe } from './shared'
import {
  PwShell,
  PwLate,
  PwSkel,
  PwErr,
  PwBadge,
  PwCombo,
  useBusy,
  useEnterAnim,
  dayLabel,
  dayTime,
  kwDate,
  today,
  addDays,
  hLabel,
  taskDraft,
  routeOf,
} from './pw'
import { stagger } from '@/features/shared/components/shell/ui'
import { Button, Input, Select, Textarea } from '@/features/shared/components/ui'

/* I — the tasks facade (Tasks.js). */
const api = {
  tasksPage: () => fetchJson('/api/people/tasks'),
  tasksPreview: (ownerEmail: string, startAt: string, deadlineAt: string, estHours: number) =>
    fetchJson('/api/people/tasks/preview', { ownerEmail, startAt, deadlineAt, estHours }),
  tasksCreate: (input: Record<string, unknown>) => fetchJson('/api/people/tasks', input),
  tasksPostMilestone: (actionId: string, m: Record<string, unknown>) =>
    fetchJson('/api/people/tasks/milestone', { actionId, ...m }),
  tasksSetStatus: (actionId: string, status: string, info: Record<string, unknown>) =>
    fetchJson('/api/people/tasks/status', { actionId, status, info }),
  tasksSetDeadline: (actionId: string, deadlineAt: string, reason: string) =>
    fetchJson('/api/people/tasks/deadline', { actionId, deadlineAt, reason }),
}

const DOES_NOT_FIT = 'DOES_NOT_FIT:' // Ze

/* gl / is / xn */
const PROGRESS_LABELS: Record<string, string> = {
  open: 'Open',
  blocked: 'Blocked',
  done: 'Done',
  dropped: 'Dropped',
  not_started: 'Not started',
  in_progress: 'In progress',
}
const FIT_LABELS: Record<string, string> = { fits: 'Fits', tight: 'Tight', does_not_fit: 'Does not fit' }
const RAG_LABELS: Record<string, string> = { on_track: 'On track', at_risk: 'At risk', off_track: 'Off track' }

/* ca — file → base64 payload. */
function readFile(file: File): Promise<{ name: string; mimeType: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () =>
      resolve({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64: String(r.result).split(',')[1] ?? '',
      })
    r.onerror = () => reject(new Error('Could not read the file.'))
    r.readAsDataURL(file)
  })
}

/* Ve/sa/la — the shared "cx.filters" localStorage memory. */
const FILTER_KEY = 'cx.filters'
let filterMem: Record<string, string> = (() => {
  try {
    return JSON.parse((typeof localStorage === 'undefined' ? null : localStorage.getItem(FILTER_KEY)) || '{}')
  } catch {
    return {}
  }
})()
const filterSubs = new Set<() => void>()
function saveFilter(key: string, value: string) {
  filterMem = { ...filterMem, [key]: value }
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filterMem))
  } catch {
    /* storage unavailable */
  }
  filterSubs.forEach((fn) => fn())
}
function usePersistedFilter(key: string, options: string[]): [string, (v: string) => void] {
  const [, bump] = useState(0)
  useEffect(() => {
    const update = () => bump((i) => i + 1)
    filterSubs.add(update)
    return () => {
      filterSubs.delete(update)
    }
  }, [])
  const saved = filterMem[key] || ''
  return [options.includes(saved) ? saved : '', (v) => saveFilter(key, v)]
}

/* na — the filter bar: owner select / priority seg / search + children. */
function FilterBar({
  owner,
  team,
  priority,
  search,
  label,
  children,
}: {
  owner?: { value: string; onChange: (v: string) => void; all: string; options: { value: string; label: string }[] }
  team?: { value: string; onChange: (v: string) => void; all: string; options: { value: string; label: string }[] }
  priority?: { value: string; onChange: (v: string) => void; options: string[] }
  search?: { value: string; onChange: (v: string) => void; placeholder: string }
  label: string
  children?: React.ReactNode
}) {
  const sel = (srLabel: string, p: NonNullable<typeof owner>) => (
    <label className="cx-filter">
      <span className="sr-only">{srLabel}</span>
      <Select className="select" value={p.value} onChange={(e) => p.onChange(e.currentTarget.value)}>
        <option value="">{p.all}</option>
        {p.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  )
  return (
    <div className="cx-filters" role="group" aria-label={label}>
      {owner ? sel('Owner', owner) : null}
      {team ? sel('Team', team) : null}
      {priority ? (
        <div className="pw-seg" role="group" aria-label="Priority">
          {/* eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option buttons (family chrome, not a form control) */}
          <button type="button" aria-pressed={!priority.value} onClick={() => priority.onChange('')}>
            Any priority
          </button>
          {priority.options.map((p) => (
            // eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option button (family chrome, not a form control)
            <button
              key={p}
              type="button"
              aria-pressed={priority.value === p}
              onClick={() => priority.onChange(priority.value === p ? '' : p)}
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}
      {search ? (
        <label className="cx-filter cx-filter--search">
          <span className="sr-only">Search</span>
          <Input
            className="input"
            type="search"
            value={search.value}
            placeholder={search.placeholder}
            onInput={(e) => search.onChange(e.currentTarget.value)}
          />
        </label>
      ) : null}
      {children}
    </div>
  )
}

/* ua — the assign/add-task form. */
function AssignForm({ data, onCreated }: { data: any; onCreated: (task: any) => void }) {
  const [form, setForm] = useState<any>(() => ({
    title: taskDraft.title ?? '',
    description: taskDraft.description ?? '',
    ownerEmail: data.owners[0]?.email ?? data.me.email,
    priority: 'P2',
    startAt: '',
    deadlineAt: addDays(today(), 7),
    estHours: 4,
    sourceLabel: '',
    planned: [],
  }))
  useEffect(() => {
    taskDraft.title = taskDraft.description = undefined
  }, [])
  const [preview, setPreview] = useState<any>(null)
  const [doesNotFit, setDoesNotFit] = useState('')
  const busy = useBusy()
  const patch = (p: Record<string, unknown>) => {
    setForm((o: any) => ({ ...o, ...p }))
    setDoesNotFit('')
  }
  useEffect(() => {
    if (!form.ownerEmail || !form.deadlineAt || !(form.estHours > 0)) return
    const t = setTimeout(() => {
      api.tasksPreview(form.ownerEmail, form.startAt ?? '', form.deadlineAt, form.estHours).then(setPreview, () => setPreview(null))
    }, 350)
    return () => clearTimeout(t)
  }, [form.ownerEmail, form.startAt, form.deadlineAt, form.estHours])
  const create = async (assignAnyway: boolean) => {
    try {
      busy.setError('')
      const created = await api.tasksCreate({ ...form, assignAnyway })
      onCreated(created)
    } catch (e: any) {
      const msg = e.message
      if (msg.startsWith(DOES_NOT_FIT)) setDoesNotFit(msg.slice(DOES_NOT_FIT.length).trim())
      else busy.setError(msg)
    }
  }
  return (
    <section className="pw-panel pw-section" aria-labelledby="assign-h">
      <h2 id="assign-h" className="pw-h2">
        {data.me.role === 'admin' ? 'Assign a task' : 'Add a task for yourself'}
      </h2>
      <div className="form-grid" style={{ marginTop: 12 }}>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="field-label">Title</span>
          <Input className="input" value={form.title} onInput={(e) => patch({ title: e.currentTarget.value })} />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="field-label">What done looks like</span>
          <Textarea className="pw-textarea" value={form.description} onInput={(e) => patch({ description: e.currentTarget.value })} />
        </label>
        {form.ownerEmail !== data.me.email ? (
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span className="field-label">Your expectation: the result you will rate Below, Meets or Exceeds in the 1:1</span>
            <Textarea
              className="pw-textarea"
              value={form.expectation ?? ''}
              onInput={(e) => patch({ expectation: e.currentTarget.value })}
            />
          </label>
        ) : null}
        {data.me.role === 'admin' ? (
          <label className="field">
            <span className="field-label">Owner</span>
            <Select className="select" value={form.ownerEmail} onChange={(e) => patch({ ownerEmail: e.currentTarget.value })}>
              {data.owners.map((o: any) => (
                <option key={o.email} value={o.email}>
                  {o.name}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <div className="field">
          <span className="field-label">Priority</span>
          <div className="pw-seg" role="group" aria-label="Priority">
            {['P1', 'P2', 'P3'].map((p) => (
              // eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option button (family chrome, not a form control)
              <button key={p} type="button" aria-pressed={form.priority === p} onClick={() => patch({ priority: p })}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="field-label">Starts (blank = now)</span>
          <Input className="input" type="datetime-local" value={form.startAt} onInput={(e) => patch({ startAt: e.currentTarget.value })} />
        </label>
        <label className="field">
          <span className="field-label">Deadline day</span>
          <Input
            className="input"
            type="date"
            min={today()}
            value={form.deadlineAt}
            onInput={(e) => patch({ deadlineAt: e.currentTarget.value })}
          />
          <span className="field-hint">Due at the end of the owner&apos;s shift that day.</span>
        </label>
        <label className="field">
          <span className="field-label">Estimated effort (hours)</span>
          <Input
            className="input"
            type="number"
            min={0.5}
            step={0.5}
            value={form.estHours}
            onInput={(e) => patch({ estHours: Number(e.currentTarget.value) })}
          />
        </label>
        <PwCombo
          listKey="task.source"
          label="Where it came from"
          value={form.sourceLabel ?? ''}
          onChange={(v) => patch({ sourceLabel: v })}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <span className="field-label">Planned milestones (optional)</span>
        {(form.planned ?? []).map((m: any, i: number) => (
          <div key={i} className="pw-inline" style={{ marginTop: 8 }}>
            <Input
              className="input"
              style={{ flex: '2 1 200px' }}
              placeholder="e.g. Draft SOP"
              aria-label={`Milestone ${i + 1}`}
              value={m.label}
              onInput={(e) =>
                patch({ planned: form.planned.map((x: any, j: number) => (j === i ? { ...x, label: e.currentTarget.value } : x)) })
              }
            />
            <Input
              className="input"
              style={{ flex: '1 1 140px' }}
              type="date"
              aria-label={`Milestone ${i + 1} date`}
              value={m.targetDate}
              onInput={(e) =>
                patch({
                  planned: form.planned.map((x: any, j: number) => (j === i ? { ...x, targetDate: e.currentTarget.value } : x)),
                })
              }
            />
            <Button
              size="sm"
              variant="quiet"
              onClick={() => patch({ planned: form.planned.filter((x: any, j: number) => j !== i) })}
            >
              Remove
            </Button>
          </div>
        ))}
        <div style={{ marginTop: 8 }}>
          <Button
            size="sm"
            onClick={() => patch({ planned: [...(form.planned ?? []), { label: '', targetDate: form.deadlineAt }] })}
          >
            Add milestone
          </Button>
        </div>
      </div>
      {preview ? (
        <p className="pw-panel pw-num" style={{ marginTop: 16 }} aria-live="polite">
          {hLabel(preview.free)} task hours free of {hLabel(preview.available)} working hours; estimate{' '}
          {hLabel(form.estHours)}:{' '}
          <PwBadge tone={preview.fitStatus === 'fits' ? 'ok' : preview.fitStatus === 'tight' ? 'warn' : 'bad'}>
            {FIT_LABELS[preview.fitStatus]}
          </PwBadge>
          {preview.estimated ? <span className="pw-small pw-muted"> Estimated: roster not published.</span> : null}
        </p>
      ) : null}
      {doesNotFit ? (
        <div className="pw-panel pw-attention" role="alert" style={{ marginTop: 12 }}>
          <p>{doesNotFit}</p>
          <div className="pw-actions-bar">
            <Button variant="primary" onClick={() => create(true)}>
              Assign anyway
            </Button>
            <span className="pw-small pw-muted">This is logged against the assignment.</span>
          </div>
        </div>
      ) : (
        <div className="pw-actions-bar">
          <Button
            variant="primary"
            disabled={busy.busy || !form.title.trim()}
            onClick={() => create(false)}
          >
            {data.me.role === 'admin' ? 'Assign task' : 'Add task'}
          </Button>
        </div>
      )}
      <PwErr message={busy.error} />
    </section>
  )
}

/* ra — the gantt bar tone. */
function barTone(t: any): string | undefined {
  if (t.status === 'done') return 'done'
  if (t.overdue || t.fitStatus === 'does_not_fit' || t.ragSelf === 'off_track') return 'bad'
  if (t.atRisk || t.fitStatus === 'tight' || t.ragSelf === 'at_risk' || t.status === 'blocked') return 'warn'
  return undefined
}

/* oa — one task row in the gantt. */
function GanttRow({
  t,
  now,
  pct,
  offRuns,
  nDays,
  selected,
  onSelect,
}: {
  t: any
  now: number
  pct: (ms: number) => number
  offRuns: { i: number; reason?: string }[]
  nDays: number
  selected: boolean
  onSelect: () => void
}) {
  const startMs = Date.parse(t.startAt)
  const endMs = Date.parse(t.deadlineAt)
  const left = pct(startMs)
  const width = Math.max(0.8, pct(endMs) - left)
  const used = t.hours.available > 0 ? Math.min(1, t.hours.elapsed / t.hours.available) : 1
  const hoursText = `${hLabel(t.hours.available)} available, est ${hLabel(t.estHours)}`
  const aria = `${t.title}, ${dayLabel(kwDate(t.startAt))} to ${dayLabel(kwDate(t.deadlineAt))}. ${hoursText}. ${t.riskReasons.join('. ')}`
  return (
    <div className="pw-g-row" aria-current={selected}>
      <div className="pw-g-label">
        {/* eslint-disable-next-line -- kept raw: .pw-g-label button family chrome (ellipsis title pick) */}
        <button type="button" onClick={onSelect} title={t.title}>
          {t.title}
        </button>
        <div className="pw-small pw-muted pw-num">
          {dayLabel(kwDate(t.startAt))} to {dayLabel(kwDate(t.deadlineAt))}{' '}
          {t.status === 'done' ? (
            <PwBadge tone="ok">Done</PwBadge>
          ) : t.overdue ? (
            <PwBadge tone="bad">Overdue</PwBadge>
          ) : t.atRisk ? (
            <PwBadge tone="warn">At risk</PwBadge>
          ) : null}
        </div>
      </div>
      <div className="pw-g-track">
        {offRuns.map((f) => (
          <i
            key={f.i}
            className="pw-g-off"
            data-reason={f.reason ?? undefined}
            title={f.reason === 'holiday' ? 'Public holiday' : 'Day off'}
            style={{ left: `${(f.i / nDays) * 100}%`, width: `${100 / nDays}%` }}
          />
        ))}
        {/* eslint-disable-next-line -- kept raw: .pw-bar gantt bar is positioned family chrome, not a cx-btn */}
        <button
          type="button"
          className="pw-bar"
          data-tone={barTone(t)}
          style={{ left: `${left}%`, width: `${width}%` }}
          onClick={onSelect}
          aria-label={aria}
        >
          <span className="pw-bar-fill cc-sweep-bar" style={{ width: `${used * 100}%` }} />
          <span className="pw-bar-label pw-num">{hoursText}</span>
        </button>
        {t.overdue && now > endMs ? (
          <i className="pw-late-ext" style={{ left: `${pct(endMs)}%`, width: `${Math.max(0.5, pct(now) - pct(endMs))}%` }} />
        ) : null}
        {t.planned
          .filter((m: any) => !m.doneByUpdateId)
          .map((m: any) => (
            <i
              key={m.milestoneId}
              className="pw-mark"
              data-kind="planned"
              style={{ left: `${pct(Date.parse(m.targetDate + 'T12:00:00+03:00'))}%` }}
              title={`Planned: ${m.label}, ${dayLabel(m.targetDate)}`}
            />
          ))}
        {t.milestones.map((m: any) => (
          <i
            key={m.updateId}
            className="pw-mark"
            data-kind={m.kind}
            data-rag={m.rag || undefined}
            style={{ left: `${pct(Date.parse(m.at))}%` }}
            title={`${m.kind === 'file' ? m.fileName : m.note}, ${dayTime(m.at)}`}
          />
        ))}
        <i className="pw-today" style={{ left: `${pct(now)}%` }} />
      </div>
    </div>
  )
}

/* ia — the gantt: header days + per-owner groups + legend. */
function Gantt({ data, tasks, selected, onSelect }: { data: any; tasks: any[]; selected: string; onSelect: (id: string) => void }) {
  const now = Date.parse(data.now)
  const todayStr = today()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  useEnterAnim(wrapRef)
  const { days, startMs, endMs } = useMemo(() => {
    let from = tasks.reduce((acc, t) => (kwDate(t.startAt) < acc ? kwDate(t.startAt) : acc), addDays(todayStr, -2))
    let to = tasks.reduce((acc, t) => (kwDate(t.deadlineAt) > acc ? kwDate(t.deadlineAt) : acc), addDays(todayStr, 2))
    if (from < addDays(todayStr, -35)) from = addDays(todayStr, -35)
    if (to > addDays(from, 70)) to = addDays(from, 70)
    const list: string[] = []
    for (let d = from; d <= to; d = addDays(d, 1)) list.push(d)
    return {
      days: list,
      startMs: Date.parse(from + 'T00:00:00+03:00'),
      endMs: Date.parse(addDays(to, 1) + 'T00:00:00+03:00'),
    }
  }, [tasks, todayStr])
  const pct = (ms: number) => Math.max(0, Math.min(100, ((ms - startMs) / (endMs - startMs)) * 100))
  const offRunsFor = (email: string) => {
    const cal = new Map(((data.calendar[email] ?? []) as any[]).map((c) => [c.date, c]))
    return days
      .map((d, i) => ({ i, c: cal.get(d) }))
      .filter((x) => x.c && !x.c.working)
      .map((x) => ({ i: x.i, reason: x.c.reason }))
  }
  const ownerEmails = [...new Set(tasks.map((t) => t.ownerEmail as string))]
  const allOff = new Set(
    days.filter((d) => ownerEmails.every((e) => ((data.calendar[e] ?? []) as any[]).some((c) => c.date === d && !c.working)))
  )
  const isAllOff = (d: string) => allOff.has(d)
  const loadFor = (email: string) => data.load.find((l: any) => l.email === email)
  return (
    <>
      <div
        className="pw-gantt-wrap cc-chart"
        ref={wrapRef}
        tabIndex={0}
        role="region"
        aria-label="Task timeline, scrolls sideways"
      >
        <div className="pw-gantt" style={{ ['--days' as string]: days.length }}>
          <div className="pw-g-head">
            <div className="pw-g-label pw-small pw-muted">Task</div>
            <div className="pw-g-days">
              {days.map((d) => {
                const dt = new Date(d + 'T00:00:00Z')
                return (
                  <div key={d} className="pw-g-day" data-off={isAllOff(d)} data-today={d === todayStr}>
                    {'SMTWTFS'[dt.getUTCDay()]}
                    <br />
                    {dt.getUTCDate()}
                  </div>
                )
              })}
            </div>
          </div>
          {ownerEmails.map((email) => {
            const ownerTasks = tasks.filter((t) => t.ownerEmail === email)
            const load = loadFor(email)
            return (
              <div key={email}>
                <div className="pw-g-row">
                  <div className="pw-g-group">
                    {ownerTasks[0].ownerName}
                    {load ? (
                      <span className={`pw-small ${load.pct > 100 ? '' : 'pw-muted'}`}>
                        {load.pct}% loaded, next 10 working days
                      </span>
                    ) : null}
                  </div>
                </div>
                {ownerTasks.map((t) => (
                  <GanttRow
                    key={t.actionId}
                    t={t}
                    now={now}
                    pct={pct}
                    offRuns={offRunsFor(t.ownerEmail)}
                    nDays={days.length}
                    selected={selected === t.actionId}
                    onSelect={() => onSelect(selected === t.actionId ? '' : t.actionId)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
      <div className="pw-legend" aria-hidden="true">
        <span>
          <i className="pw-mark" data-kind="file" /> File uploaded
        </span>
        <span>
          <i className="pw-mark" data-kind="status" /> Written update
        </span>
        <span>
          <i className="pw-mark" data-kind="planned" /> Planned milestone
        </span>
        <span>
          <i
            style={{
              display: 'inline-block',
              width: 22,
              height: 10,
              background: 'repeating-linear-gradient(135deg,var(--age-3) 0 3px,transparent 3px 7px)',
              border: '1px solid var(--age-3)',
            }}
          />{' '}
          Past the deadline
        </span>
        <span>
          <i style={{ display: 'inline-block', width: 2, height: 14, background: 'var(--signal)' }} /> Today
        </span>
        <span>Hatched: the TL&apos;s day off or a public holiday in their country. Hours count only rostered shift time.</span>
      </div>
    </>
  )
}

/* da — the selected task's detail: summary, timeline, update/status/deadline actions. */
function TaskDetail({ task: t, me, onChange }: { task: any; me: any; onChange: (task: any) => void }) {
  const [kind, setKind] = useState('status')
  const [note, setNote] = useState('')
  const [percent, setPercent] = useState<number | ''>(t.percent || '')
  const [rag, setRag] = useState(t.ragSelf)
  const [nextStep, setNextStep] = useState('')
  const [milestoneId, setMilestoneId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [flow, setFlow] = useState('')
  const [flowText, setFlowText] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [deadlineReason, setDeadlineReason] = useState('')
  const busy = useBusy()
  const closed = t.status === 'done' || t.status === 'dropped'
  const canManage = me.role === 'admin' || (me.email !== t.ownerEmail && t.assignedBy === me.email)

  const post = async () => {
    const m: Record<string, unknown> = {
      kind,
      note,
      percent,
      rag,
      nextStep,
      plannedMilestoneId: milestoneId || undefined,
    }
    if (kind === 'file') {
      if (!file) return busy.setError('Choose a file to upload.')
      m.file = await readFile(file)
    }
    const updated = await busy.run(() => api.tasksPostMilestone(t.actionId, m))
    if (updated) {
      onChange(updated)
      setNote('')
      setNextStep('')
      setFile(null)
      setMilestoneId('')
    }
  }

  const setStatus = async (status: string) => {
    const info =
      status === 'blocked' ? { blockedReason: flowText } : status === 'done' ? { deliveryRef: flowText } : { note: flowText }
    const updated = await busy.run(() => api.tasksSetStatus(t.actionId, status, info))
    if (updated) {
      onChange(updated)
      setFlow('')
      setFlowText('')
    }
  }

  const changeDeadline = async () => {
    if (!newDeadline) return busy.setError('Choose the new deadline date.')
    if (!deadlineReason.trim()) return busy.setError('Say why the deadline is changing.')
    const updated = await busy.run(() => api.tasksSetDeadline(t.actionId, newDeadline, deadlineReason))
    if (updated) {
      onChange(updated)
      setFlow('')
      setNewDeadline('')
      setDeadlineReason('')
    }
  }

  return (
    <section className="pw-detail" aria-label={`Task: ${t.title}`}>
      <div className="pw-panel">
        <h2 className="pw-h2">{t.title}</h2>
        <p className="pw-small pw-muted" style={{ marginBottom: 12 }}>
          {t.ownerName}, {t.priority}, from {t.sourceLabel || 'ad hoc'}.{' '}
          {PROGRESS_LABELS[t.progressState] ?? t.progressState}.
        </p>
        <dl className="pw-kv">
          <dt>Working hours, start to deadline</dt>
          <dd>{hLabel(t.hours.available)}</dd>
          <dt>Taken by the TL&apos;s other open tasks</dt>
          <dd>{hLabel(Math.max(0, t.hours.available - t.hours.free))}</dd>
          <dt>
            <strong>Free for this task</strong>
          </dt>
          <dd>
            <strong>{hLabel(t.hours.free)}</strong>
          </dd>
          <dt>Estimate</dt>
          <dd>{hLabel(t.estHours)}</dd>
          <dt>Fit</dt>
          <dd>
            <PwBadge tone={t.fitStatus === 'fits' ? 'ok' : t.fitStatus === 'tight' ? 'warn' : 'bad'}>
              {FIT_LABELS[t.fitStatus]}
            </PwBadge>
          </dd>
          <dt>Hours used so far</dt>
          <dd>{hLabel(t.hours.elapsed)}</dd>
          <dt>Deadline</dt>
          <dd>{dayTime(t.deadlineAt)}</dd>
          <dt>Last update</dt>
          <dd>{t.lastUpdateAt ? dayTime(t.lastUpdateAt) : 'None yet'}</dd>
        </dl>
        {t.hours.estimated ? (
          <p className="pw-small pw-muted" style={{ marginTop: 10 }}>
            Estimated: roster not published for part of this window.
          </p>
        ) : null}
        {t.assignedAnyway ? (
          <p className="pw-small" style={{ marginTop: 6 }}>
            Assigned anyway although the estimate did not fit.
          </p>
        ) : null}
        {t.riskReasons.length ? (
          <ul className="pw-warn-list">
            {t.riskReasons.map((r: string) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="pw-panel">
        <h2 className="pw-h2">Where {t.ownerName.split(' ')[0]} stands</h2>
        {t.milestones.length || t.planned.length ? (
          <ul className="pw-timeline" style={{ marginTop: 10 }}>
            {[...t.milestones].reverse().map((m: any) => (
              <li key={m.updateId}>
                <i className="pw-mark" data-kind={m.kind} data-rag={m.rag || undefined} />
                <div>
                  <div className="pw-small pw-muted pw-num">
                    {dayTime(m.at)}, {m.byName}
                    {m.percent !== null ? `, ${m.percent}%` : ''}
                    {m.rag ? `, ${RAG_LABELS[m.rag]}` : ''}
                  </div>
                  {m.kind === 'file' ? (
                    <a href={m.fileUrl} target="_blank" rel="noopener">
                      {m.fileName}
                    </a>
                  ) : null}
                  {m.note ? <div>{m.note}</div> : null}
                  {m.nextStep ? <div className="pw-small pw-muted">Next: {m.nextStep}</div> : null}
                </div>
              </li>
            ))}
            {t.planned
              .filter((m: any) => !m.doneByUpdateId)
              .map((m: any) => (
                <li key={m.milestoneId}>
                  <i className="pw-mark" data-kind="planned" />
                  <div className="pw-small">
                    Planned: {m.label}, by {dayLabel(m.targetDate)}
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <p className="pw-empty">No update yet.</p>
        )}
      </div>
      {closed ? (
        <div className="pw-panel">
          <h2 className="pw-h2">{t.status === 'done' ? 'Delivered' : 'Cancelled'}</h2>
          <p>{t.outcomeNote}</p>
          {t.deliveredAt ? <p className="pw-small pw-muted">{dayTime(t.deliveredAt)}</p> : null}
          {me.role === 'admin' ? (
            <div className="pw-actions-bar">
              <Button size="sm" disabled={busy.busy} onClick={() => setStatus('in_progress')}>
                Re-open task
              </Button>
            </div>
          ) : null}
          <PwErr message={busy.error} />
        </div>
      ) : (
        <div className="pw-panel">
          <h2 className="pw-h2">Post an update</h2>
          <div className="pw-seg" role="group" aria-label="Update type" style={{ margin: '8px 0 12px' }}>
            {/* eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option buttons (family chrome, not a form control) */}
            <button type="button" aria-pressed={kind === 'status'} onClick={() => setKind('status')}>
              Written update
            </button>
            {/* eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option button (family chrome, not a form control) */}
            <button type="button" aria-pressed={kind === 'file'} onClick={() => setKind('file')}>
              Upload a file
            </button>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {kind === 'file' ? (
              <label className="field">
                <span className="field-label">File (up to 10 MB)</span>
                <Input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            ) : null}
            <label className="field">
              <span className="field-label">{kind === 'status' ? 'Where do you stand now?' : 'Note (optional)'}</span>
              <Textarea className="pw-textarea" value={note} onInput={(e) => setNote(e.currentTarget.value)} />
            </label>
            {kind === 'status' ? (
              <>
                <div className="pw-inline">
                  <label className="field" style={{ flex: '0 1 120px' }}>
                    <span className="field-label">% complete</span>
                    <Input
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      value={percent}
                      onInput={(e) => setPercent(e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))}
                    />
                  </label>
                  <div className="field" style={{ flex: '1 1 auto' }}>
                    <span className="field-label">Status</span>
                    <div className="pw-seg" role="group" aria-label="Status">
                      {['on_track', 'at_risk', 'off_track'].map((r) => (
                        // eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option button (family chrome, not a form control)
                        <button key={r} type="button" aria-pressed={rag === r} onClick={() => setRag(r)}>
                          {RAG_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <label className="field">
                  <span className="field-label">Next step</span>
                  <Input className="input" value={nextStep} onInput={(e) => setNextStep(e.currentTarget.value)} />
                </label>
              </>
            ) : null}
            {t.planned.some((m: any) => !m.doneByUpdateId) ? (
              <label className="field">
                <span className="field-label">Ticks off a planned milestone</span>
                <Select className="select" value={milestoneId} onChange={(e) => setMilestoneId(e.currentTarget.value)}>
                  <option value="">None</option>
                  {t.planned
                    .filter((m: any) => !m.doneByUpdateId)
                    .map((m: any) => (
                      <option key={m.milestoneId} value={m.milestoneId}>
                        {m.label}
                      </option>
                    ))}
                </Select>
              </label>
            ) : null}
          </div>
          <div className="pw-actions-bar">
            <Button variant="primary" disabled={busy.busy} onClick={post}>
              {kind === 'file' ? 'Upload file' : 'Post update'}
            </Button>
          </div>
          <div className="pw-actions-bar" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            {t.status === 'blocked' ? (
              <Button size="sm" disabled={busy.busy} onClick={() => setStatus('in_progress')}>
                Unblock
              </Button>
            ) : (
              <Button size="sm" onClick={() => setFlow('blocked')}>
                Mark blocked
              </Button>
            )}
            <Button size="sm" onClick={() => setFlow('done')}>
              Mark done
            </Button>
            {canManage ? (
              <Button size="sm" onClick={() => setFlow('deadline')}>
                Change deadline
              </Button>
            ) : null}
            {me.role === 'admin' ? (
              <Button size="sm" variant="quiet" onClick={() => setFlow('cancelled')}>
                Cancel task
              </Button>
            ) : null}
          </div>
          {flow === 'deadline' ? (
            <div className="pw-inline" style={{ marginTop: 10 }}>
              <label className="field" style={{ flex: '0 1 170px' }}>
                <span className="field-label">New deadline</span>
                <Input className="input" type="date" value={newDeadline} onInput={(e) => setNewDeadline(e.currentTarget.value)} />
              </label>
              <label className="field">
                <span className="field-label">Why it is changing</span>
                <Input className="input" value={deadlineReason} onInput={(e) => setDeadlineReason(e.currentTarget.value)} />
              </label>
              <Button variant="primary" disabled={busy.busy} onClick={changeDeadline}>
                Change deadline
              </Button>
            </div>
          ) : flow ? (
            <div className="pw-inline" style={{ marginTop: 10 }}>
              <label className="field">
                <span className="field-label">
                  {flow === 'blocked' ? 'What is blocking it' : flow === 'done' ? 'Delivery link or file name' : 'Why it is cancelled'}
                </span>
                <Input className="input" value={flowText} onInput={(e) => setFlowText(e.currentTarget.value)} />
              </label>
              <Button variant="primary" disabled={busy.busy} onClick={() => setStatus(flow)}>
                {flow === 'blocked' ? 'Mark blocked' : flow === 'done' ? 'Mark done' : 'Cancel task'}
              </Button>
            </div>
          ) : null}
          <PwErr message={busy.error} />
        </div>
      )}
    </section>
  )
}

/* aa */
export function TlTasksPage({ route }: { route: { title: string; purpose?: string } }) {
  const { data, setData, error, reload } = useSe('people.tasks', () => api.tasksPage())
  const [ownerFilter, setOwnerFilter] = usePersistedFilter('owner', (data?.owners ?? []).map((o: any) => o.email))
  const [priority, setPriority] = useState('')
  const [search, setSearch] = useState('')
  const [show, setShow] = useState('open')
  const [selected, setSelected] = useState('')
  const loadRef = useRef<HTMLElement | null>(null)
  useEnterAnim(loadRef)
  const [formOpen, setFormOpen] = useState(() => !!taskDraft.title)

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.tasks ?? []).filter(
      (t: any) =>
        (!ownerFilter || t.ownerEmail === ownerFilter) &&
        (!priority || t.priority === priority) &&
        (!q || t.title.toLowerCase().includes(q)) &&
        (show === 'all' || t.status === 'open' || t.status === 'blocked')
    )
  }, [data, ownerFilter, priority, search, show])

  const selectedTask = data?.tasks.find((t: any) => t.actionId === selected) ?? null
  const patchTask = (updated: any) =>
    setData((d: any) => d && { ...d, tasks: d.tasks.map((t: any) => (t.actionId === updated.actionId ? updated : t)) })

  return (
    <PwShell
      route={routeOf('tl-tasks', route)}
      aside={
        data ? (
          <div className="pw-actions-bar">
            <Button
              variant="primary"
              aria-expanded={formOpen}
              onClick={() => setFormOpen((o) => !o)}
            >
              {formOpen ? 'Close the form' : data.me.role === 'admin' ? 'Assign a task' : 'Add a task'}
            </Button>
          </div>
        ) : null
      }
    >
      {error ? (
        <PwLate message={error} retry={reload} />
      ) : data ? (
        <>
          {formOpen ? (
            <AssignForm
              data={data}
              onCreated={(task) => {
                setFormOpen(false)
                setSelected(task.actionId)
                reload()
              }}
            />
          ) : null}
          {data.load.length > 1 || data.me.role === 'admin' ? (
            <section className="pw-load cc-chart" ref={loadRef} aria-label="Load for the next 10 working days">
              {data.load.map((l: any, i: number) => (
                <div key={l.email} className="pw-load-item">
                  <div className="pw-row-title">{l.name}</div>
                  <div className="pw-row-meta pw-num">
                    {hLabel(l.committed)} committed of {hLabel(l.capacity)}, next 10 working days
                  </div>
                  <div className="pw-meter" data-over={l.pct > 100} role="img" aria-label={`${l.pct}% loaded`}>
                    <i className="cc-sweep-bar" style={{ width: `${Math.min(100, l.pct)}%`, ...stagger(i) }} />
                  </div>
                </div>
              ))}
            </section>
          ) : null}
          <div className="pw-section">
            <FilterBar
              label="Filter tasks"
              owner={
                data.owners.length > 1
                  ? {
                      value: ownerFilter,
                      onChange: setOwnerFilter,
                      all: 'All team leads',
                      options: data.owners.map((o: any) => ({ value: o.email, label: o.name })),
                    }
                  : undefined
              }
              priority={{ value: priority, onChange: setPriority, options: ['P1', 'P2', 'P3'] }}
              search={{ value: search, onChange: setSearch, placeholder: 'Search task titles' }}
            >
              <div className="pw-seg" role="group" aria-label="Show">
                {/* eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option buttons (family chrome, not a form control) */}
                <button type="button" aria-pressed={show === 'open'} onClick={() => setShow('open')}>
                  Open
                </button>
                {/* eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option button (family chrome, not a form control) */}
                <button type="button" aria-pressed={show === 'all'} onClick={() => setShow('all')}>
                  Include done, last 30 days
                </button>
              </div>
            </FilterBar>
          </div>
          {shown.length ? (
            <Gantt data={data} tasks={shown} selected={selected} onSelect={setSelected} />
          ) : (
            <p className="pw-empty">
              {ownerFilter || priority || search.trim()
                ? 'No tasks match these filters. Clear one to see more.'
                : `No tasks here yet. Use ${data.me.role === 'admin' ? 'Assign a task' : 'Add a task'} to start one.`}
            </p>
          )}
          {selectedTask ? <TaskDetail key={selectedTask.actionId} task={selectedTask} me={data.me} onChange={patchTask} /> : null}
        </>
      ) : (
        <PwSkel lines={7} />
      )}
    </PwShell>
  )
}
