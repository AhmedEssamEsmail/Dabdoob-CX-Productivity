'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Meetings & BRs page
 * (meetings.closure.js symbols pa/ya/ga/va/ls/ba/fa/cs). */
import { useRef, useState } from 'react'
import { fetchJson, useSe } from './shared'
import { CarriedReview } from './carried-review'
import {
  PwShell,
  PwLate,
  PwSkel,
  PwErr,
  PwCombo,
  useBusy,
  dayLabel,
  dayTime,
  kwDate,
  today,
  addDays,
  inputDT,
  routeOf,
} from './pw'
import { Button, Chip, Empty, Input, Select, Textarea } from '@/features/shared/components/ui'

/* I — the meetings facade (Meetings.js + Actions.js post-update). */
const api = {
  meetingsPage: () => fetchJson('/api/people/meetings'),
  meetingsCreateSeries: (input: Record<string, unknown>) =>
    fetchJson('/api/people/meetings', { op: 'create_series', ...input }),
  meetingsOpen: (seriesId: string, heldAt: string, nextMeetingAt: string) =>
    fetchJson('/api/people/meetings', { op: 'open', seriesId, heldAt, nextMeetingAt }),
  meetingsGet: (meetingId: string) =>
    fetchJson(`/api/people/meetings?meetingId=${encodeURIComponent(meetingId)}`),
  meetingsSave: (meetingId: string, patch: Record<string, unknown>) =>
    fetchJson('/api/people/meetings', { op: 'save', meetingId, patch }),
  meetingsReview: (meetingId: string, reviews: Record<string, unknown>[]) =>
    fetchJson('/api/people/meetings', { op: 'review', meetingId, reviews }),
  meetingsAddActions: (meetingId: string, list: Record<string, unknown>[]) =>
    fetchJson('/api/people/meetings', { op: 'add_actions', meetingId, list }),
  meetingsLogActions: (seriesId: string, heldOn: string, list: Record<string, unknown>[]) =>
    fetchJson('/api/people/meetings', { op: 'log_actions', seriesId, heldOn, list }),
  meetingsClose: (meetingId: string, attendance: Record<string, boolean>) =>
    fetchJson('/api/people/meetings', { op: 'close', meetingId, attendance }),
  meetingsSendSummary: (meetingId: string) =>
    fetchJson('/api/people/meetings', { op: 'send_summary', meetingId }),
  actionsPostUpdate: (actionId: string, input: { note: string }) =>
    fetchJson('/api/people/actions/updates', { actionId, ...input }),
}

/* rs — meeting type labels. */
const TYPE_LABELS: Record<string, string> = {
  WBR: 'Weekly business review',
  BR: 'Monthly business review',
  team: 'Team meeting',
  adhoc: 'Ad hoc',
}

/* os — attendees of a series get every person, minus agents outside it. */
const eligibleOwners = (people: any[], members: any[]) =>
  people.filter((p) => p.role !== 'agent' || members.some((m) => m.email === p.email))

/* ma / ha — fresh action rows for the multi-row editor. */
let rowSeq = 0
const newAction = (base?: any, dueDate?: string) => ({
  key: ++rowSeq,
  title: '',
  ownerEmail: base?.ownerEmail ?? '',
  dueDate: base?.dueDate ?? dueDate ?? addDays(today(), 7),
})

/* cs — the "one action per row" editor. */
function ActionRows({
  owners,
  dueDate,
  allowTask,
  busy,
  label,
  onSubmit,
  disabled,
}: {
  owners: any[]
  dueDate?: string
  allowTask?: boolean
  busy: boolean
  label: (n: number) => string
  onSubmit: (list: any[]) => Promise<unknown>
  disabled?: boolean
}) {
  const mk = (base?: any) => ({ ...newAction(base), dueDate: base?.dueDate ?? dueDate ?? addDays(today(), 7) })
  const [rows, setRows] = useState<any[]>(() => [mk()])
  const focusKey = useRef(-1)
  const patch = (i: number, p: Record<string, unknown>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const insert = (i: number, added: any[]) => {
    focusKey.current = added[added.length - 1].key
    setRows((rs) => [...rs.slice(0, i + 1), ...added, ...rs.slice(i + 1)])
  }
  const filled = rows.filter((r) => r.title.trim())
  const missingOwner = filled.some((r) => !r.ownerEmail)
  const submit = () =>
    onSubmit(
      filled.map(({ title, ownerEmail, dueDate, trackAsTask, estHours }) => ({
        title,
        ownerEmail,
        dueDate,
        trackAsTask,
        estHours,
      }))
    ).then((r) => {
      if (r) setRows([mk(filled[filled.length - 1])])
    })
  return (
    <>
      <p className="pw-small pw-muted pw-mb-8">
        One action per row. Press Enter for a new row, or paste a list from your notes to get one row per line.
      </p>
      {rows.map((row, i) => (
        <div key={row.key} className={allowTask ? 'pw-mb-10' : undefined}>
          <div className="pw-new-action">
            <label className="field">
              <span className="field-label">Action {i + 1}</span>
              <Input
                className="input"
                value={row.title}
                ref={(el) => {
                  if (el && focusKey.current === row.key) {
                    focusKey.current = -1
                    el.focus()
                  }
                }}
                onInput={(e) => patch(i, { title: e.currentTarget.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    insert(i, [mk(row)])
                  }
                }}
                onPaste={(e) => {
                  const lines = ((e.clipboardData?.getData('text') ?? '') as string)
                    .split(/\r?\n/)
                    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
                    .filter(Boolean)
                  if (lines.length < 2) return
                  e.preventDefault()
                  patch(i, { title: (row.title ? row.title + ' ' : '') + lines[0] })
                  insert(
                    i,
                    lines.slice(1).map((t) => ({ ...mk(row), title: t }))
                  )
                }}
              />
            </label>
            <label className="field">
              <span className="field-label">Owner</span>
              <Select className="select" value={row.ownerEmail} onChange={(e) => patch(i, { ownerEmail: e.currentTarget.value })}>
                <option value="">Choose</option>
                {owners.map((o) => (
                  <option key={o.email} value={o.email}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field">
              <span className="field-label">Due</span>
              <Input
                className="input"
                type="date"
                min={today()}
                value={row.dueDate}
                onInput={(e) => patch(i, { dueDate: e.currentTarget.value })}
              />
            </label>
            <Button
              size="sm"
              variant="quiet"
              aria-label={`Remove action ${i + 1}`}
              disabled={rows.length === 1}
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
          {allowTask ? (
            <div className="pw-inline pw-mt-4">
              <label className="pw-check">
                {/* eslint-disable-next-line -- kept raw: native checkbox inside .pw-check label */}
                <input
                  type="checkbox"
                  checked={!!row.trackAsTask}
                  onChange={(e) => patch(i, { trackAsTask: e.currentTarget.checked })}
                />
                Track as a TL task
              </label>
              {row.trackAsTask ? (
                <label className="field pw-max-w-160">
                  <span className="field-label">Estimated hours</span>
                  <Input
                    className="input"
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={row.estHours ?? ''}
                    onInput={(e) => patch(i, { estHours: Number(e.currentTarget.value) })}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
      <div className="pw-actions-bar">
        <Button size="sm" onClick={() => insert(rows.length - 1, [mk(rows[rows.length - 1])])}>
          Add another action
        </Button>
        <Button variant="primary" disabled={busy || disabled || !filled.length || missingOwner} onClick={submit}>
          {label(filled.length)}
        </Button>
        {missingOwner ? <span className="pw-small pw-muted">Choose an owner for each action.</span> : null}
      </div>
    </>
  )
}

/* ba — "Log actions from a business review" collapsible panel. */
function LogBrActions({ data, onLogged }: { data: any; onLogged: () => void }) {
  const series = data.series
    .filter((s: any) => s.canChair && (s.meetingType === 'BR' || s.meetingType === 'WBR'))
    .sort((a: any, b: any) =>
      a.meetingType === b.meetingType
        ? (b.meetings?.[0]?.heldAt ?? '').localeCompare(a.meetings?.[0]?.heldAt ?? '')
        : a.meetingType === 'BR'
          ? -1
          : 1
    )
  const [open, setOpen] = useState(false)
  const [seriesId, setSeriesId] = useState(series[0]?.seriesId ?? '')
  const chosen = series.find((s: any) => s.seriesId === seriesId) ?? series[0]
  const lastHeld = chosen?.meetings?.find((m: any) => m.heldAt <= new Date().toISOString())?.heldAt
  const [heldOn, setHeldOn] = useState(lastHeld ? kwDate(lastHeld) : today())
  const [logged, setLogged] = useState('')
  const busy = useBusy()
  if (!chosen) return null
  const pick = (id: string) => {
    setSeriesId(id)
    const h = series.find((s: any) => s.seriesId === id)?.meetings?.[0]?.heldAt
    setHeldOn(h && h <= new Date().toISOString() ? kwDate(h) : today())
  }
  const submit = (list: any[]) =>
    busy.run(() => api.meetingsLogActions(chosen.seriesId, heldOn, list)).then((r) =>
      r
        ? (setLogged(
            `Logged ${list.length} action${list.length === 1 ? '' : 's'} to ${chosen.title}, ${dayLabel(heldOn)}. Owners see them under their open actions.`
          ),
          onLogged(),
          true)
        : false
    )
  return open ? (
    <section className="pw-panel pw-section" aria-labelledby="log-h">
      <h2 id="log-h" className="pw-h2">
        Log actions from a business review
      </h2>
      <div className="pw-inline pw-mb-12">
        {series.length > 1 ? (
          <label className="field">
            <span className="field-label">Meeting</span>
            <Select className="select" value={chosen.seriesId} onChange={(e) => pick(e.currentTarget.value)}>
              {series.map((s: any) => (
                <option key={s.seriesId} value={s.seriesId}>
                  {s.title}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <label className="field">
          <span className="field-label">Held on</span>
          <Input className="input" type="date" max={today()} value={heldOn} onInput={(e) => setHeldOn(e.currentTarget.value)} />
        </label>
      </div>
      <ActionRows
        key={chosen.seriesId}
        owners={eligibleOwners(data.people, chosen.members)}
        busy={busy.busy}
        disabled={!heldOn}
        label={(n) => `Log ${n || ''} action${n === 1 ? '' : 's'}`}
        onSubmit={submit}
      />
      <div className="pw-actions-bar">
        <Button variant="quiet" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      {logged ? (
        <p className="pw-small" role="status">
          {logged}
        </p>
      ) : null}
      <PwErr message={busy.error} />
    </section>
  ) : (
    <div className="pw-panel pw-attention pw-section">
      <p>Gave the team actions at the last business review? Log them here in one go.</p>
      <div className="pw-actions-bar">
        <Button
          variant="primary"
          onClick={() => {
            setOpen(true)
            setLogged('')
          }}
        >
          Log actions from the last BR
        </Button>
      </div>
      {logged ? (
        <p className="pw-small" role="status">
          {logged}
        </p>
      ) : null}
    </div>
  )
}

/* fa — one of "Your open actions from meetings": inline update box. */
function MeetingAction({ actionId, title, due }: { actionId: string; title: string; due: string }) {
  const [note, setNote] = useState('')
  const [posted, setPosted] = useState(false)
  const busy = useBusy()
  return (
    <div className="workitem">
      <div className="wi-main">
        <div className="wi-t">{title}</div>
        <div className="wi-s">
          Due {dayLabel(due)} {due < today() ? <Chip status="bad">Overdue</Chip> : null}
        </div>
      </div>
      <Input
        className="input pw-flex-1"
        aria-label={`Where "${title}" stands`}
        placeholder="Where it stands"
        value={note}
        onInput={(e) => setNote(e.currentTarget.value)}
      />
      <div className="pw-row-actions">
        <Button
          size="sm"
          disabled={busy.busy || !note.trim()}
          onClick={() =>
            busy.run(() => api.actionsPostUpdate(actionId, { note })).then((r) => {
              if (r) {
                setPosted(true)
                setNote('')
              }
            })
          }
        >
          {posted ? 'Posted' : 'Post update'}
        </Button>
      </div>
      {busy.error ? (
        <div className="pw-basis-full">
          <PwErr message={busy.error} />
        </div>
      ) : null}
    </div>
  )
}

/* ga — one series: open/continue panel plus past meetings. */
function SeriesView({
  series,
  busy,
  onOpen,
  onOpened,
}: {
  series: any
  busy: boolean
  onOpen: (meetingId: string) => void
  onOpened: (view: any) => void
}) {
  const draft = series.meetings?.find((m: any) => m.status === 'draft')
  const nextAt = series.meetings?.find((m: any) => m.status === 'closed')?.nextMeetingAt ?? ''
  const [heldAt, setHeldAt] = useState(nextAt ? inputDT(nextAt) : `${today()}T10:00`)
  const [nextMeetingAt, setNextMeetingAt] = useState('')
  const open = useBusy()
  return (
    <section aria-labelledby="series-h">
      <h2 id="series-h" className="pw-h2">
        {series.title}
      </h2>
      <p className="pw-sub">
        {series.cadence ? `${series.cadence}. ` : ''}
        {series.members.map((m: any) => m.name).join(', ')}
      </p>
      {series.meetingType === 'team' ? (
        <p className="pw-hint">People-sensitive points belong in 1:1s, not in team meeting notes.</p>
      ) : null}
      {series.canChair ? (
        draft ? (
          <div className="pw-panel pw-attention pw-section">
            <p>The meeting on {dayTime(draft.heldAt)} is open.</p>
            <div className="pw-actions-bar">
              <Button variant="primary" disabled={busy} onClick={() => onOpen(draft.meetingId)}>
                Continue the meeting
              </Button>
            </div>
          </div>
        ) : (
          <div className="pw-panel pw-section">
            <div className="pw-inline">
              <label className="field">
                <span className="field-label">Meeting date and time (Kuwait)</span>
                <Input className="input" type="datetime-local" value={heldAt} onInput={(e) => setHeldAt(e.currentTarget.value)} />
              </label>
              <label className="field">
                <span className="field-label">Next meeting (sets the default action due date)</span>
                <Input
                  className="input"
                  type="datetime-local"
                  value={nextMeetingAt}
                  onInput={(e) => setNextMeetingAt(e.currentTarget.value)}
                />
              </label>
              <Button
                variant="primary"
                disabled={open.busy}
                onClick={() =>
                  open
                    .run(() => api.meetingsOpen(series.seriesId, heldAt, nextMeetingAt))
                    .then((v) => v && onOpened(v))
                }
              >
                Open the meeting
              </Button>
            </div>
            <p className="pw-small pw-muted pw-mt-8">
              It opens with every action still open from earlier meetings of this series.
            </p>
            <PwErr message={open.error} />
          </div>
        )
      ) : null}
      <h3 className="pw-h2">
        Past meetings
      </h3>
      {series.meetings?.filter((m: any) => m.status === 'closed').length ? (
        <div className="worklist">
          {series.meetings
            .filter((m: any) => m.status === 'closed')
            .map((m: any) => (
              <div key={m.meetingId} className="workitem">
                <div className="wi-main">
                  <div className="wi-t">{dayTime(m.heldAt)}</div>
                  <div className="wi-s">{m.decisions ? m.decisions.split('\n')[0] : 'No decisions logged'}</div>
                </div>
                <div className="wi-side">
                  <Button size="sm" disabled={busy} onClick={() => onOpen(m.meetingId)}>
                    Read
                  </Button>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <Empty title="None yet." />
      )}
    </section>
  )
}

/* va — the open/closed meeting view. */
function MeetingView({
  view,
  people,
  onChange,
  onBack,
}: {
  view: any
  people: any[]
  onChange: (view: any) => void
  onBack: () => void
}) {
  const meeting = view.meeting
  const closed = meeting.status === 'closed'
  const canEdit = view.canChair && !closed
  const [reviews, setReviews] = useState<Record<string, any>>({})
  const [notes, setNotes] = useState(meeting.notes)
  const [decisions, setDecisions] = useState(meeting.decisions)
  const [nextAt, setNextAt] = useState(inputDT(meeting.nextMeetingAt))
  const [attendance, setAttendance] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(view.attendees.map((a: any) => [a.email, a.attended ?? true]))
  )
  const busy = useBusy()
  const run = (call: () => Promise<any>) => busy.run(call).then((v) => v && onChange(v))
  const autosave = () => {
    if (
      canEdit &&
      (notes !== meeting.notes || decisions !== meeting.decisions || nextAt !== inputDT(meeting.nextMeetingAt))
    ) {
      run(() => api.meetingsSave(meeting.meetingId, { notes, decisions, nextMeetingAt: nextAt }))
    }
  }
  const toReview = view.carried.filter((a: any) => !a.review)
  const filledReviews = Object.values(reviews).filter((r: any) => toReview.some((a: any) => a.actionId === r.actionId))
  return (
    <section aria-labelledby="mtg-h">
      <div className="pw-actions-bar pw-mt-0 pw-mb-12">
        <Button size="sm" variant="quiet" onClick={onBack}>
          Back to {view.series.title}
        </Button>
      </div>
      <h2 id="mtg-h" className="pw-h2">
        {view.series.title}, {dayTime(meeting.heldAt)}
      </h2>
      <p className="pw-sub">
        {closed ? `Closed ${dayTime(meeting.closedAt)}.` : 'Open.'}{' '}
        {meeting.summarySentAt ? `Summary sent ${dayTime(meeting.summarySentAt)}.` : ''}
      </p>
      <div className="pw-section">
        <h3 className="pw-h2">
          Review of open actions
        </h3>
        {view.carried.length ? (
          <div className="pw-panel">
            {view.carried
              .filter((a: any) => a.review)
              .map((a: any) => (
                <div key={a.actionId} className="pw-carry">
                  <div className="pw-row-title">{a.title}</div>
                  <div className="pw-row-meta">
                    {a.ownerName}:{' '}
                    {a.review.outcome === 'carried' ? `still open, now due ${dayLabel(a.review.newDueDate)}` : a.review.outcome}
                    {a.review.note ? `. ${a.review.note}` : ''}
                  </div>
                </div>
              ))}
            {toReview.length && canEdit ? (
              <>
                <CarriedReview actions={toReview} value={reviews} onChange={setReviews} />
                <div className="pw-actions-bar">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busy.busy || !filledReviews.length}
                    onClick={() =>
                      run(() => api.meetingsReview(meeting.meetingId, filledReviews)).then(() => setReviews({}))
                    }
                  >
                    Save {filledReviews.length || ''} review{filledReviews.length === 1 ? '' : 's'}
                  </Button>
                  <span className="pw-small pw-muted">{toReview.length} still to review</span>
                </div>
              </>
            ) : toReview.length ? (
              <p className="pw-small pw-muted">{toReview.length} waiting for the chair&apos;s review.</p>
            ) : null}
          </div>
        ) : (
          <Empty title="Nothing carried from earlier meetings." />
        )}
      </div>
      <div className="pw-section pw-panel pw-grid-14">
        <label className="field">
          <span className="field-label">Notes</span>
          <Textarea
            className="pw-textarea"
            readOnly={!canEdit}
            value={notes}
            onInput={(e) => setNotes(e.currentTarget.value)}
            onBlur={autosave}
          />
        </label>
        <label className="field">
          <span className="field-label">Decisions</span>
          <Textarea
            className="pw-textarea"
            readOnly={!canEdit}
            value={decisions}
            onInput={(e) => setDecisions(e.currentTarget.value)}
            onBlur={autosave}
          />
        </label>
        <label className="field pw-max-w-280">
          <span className="field-label">Next meeting</span>
          <Input
            className="input"
            type="datetime-local"
            readOnly={!canEdit}
            value={nextAt}
            onInput={(e) => setNextAt(e.currentTarget.value)}
            onBlur={autosave}
          />
        </label>
        {canEdit ? <p className="pw-small pw-muted">Notes save automatically when you leave a field.</p> : null}
      </div>
      <div className="pw-section">
        <h3 className="pw-h2">
          New actions
        </h3>
        {view.newActions.length ? (
          <div className="worklist pw-mb-12">
            {view.newActions.map((a: any) => (
              <div key={a.actionId} className="workitem">
                <div className="wi-main">
                  <div className="wi-t">{a.title}</div>
                  <div className="wi-s">
                    {a.ownerName}, due {dayLabel(a.dueDate)}
                  </div>
                </div>
                <div className="wi-side">{a.trackAsTask ? <Chip>Task</Chip> : null}</div>
              </div>
            ))}
          </div>
        ) : null}
        {canEdit ? (
          <div className="pw-panel">
            <ActionRows
              owners={eligibleOwners(people, view.series.members)}
              dueDate={view.defaultDueDate || addDays(today(), 7)}
              allowTask
              busy={busy.busy}
              label={(n) => `Add ${n || ''} action${n === 1 ? '' : 's'}`}
              onSubmit={(list) =>
                busy.run(() => api.meetingsAddActions(meeting.meetingId, list)).then((v) => (v ? (onChange(v), true) : false))
              }
            />
            <p className="pw-small pw-muted pw-mt-8">
              Default due date is the day before the next meeting ({dayLabel(view.defaultDueDate || addDays(today(), 7))}).
            </p>
          </div>
        ) : null}
      </div>
      <div className="pw-section">
        <h3 className="pw-h2">
          Attendance
        </h3>
        <div className="pw-panel pw-attend">
          {view.attendees.map((a: any) => (
            <label key={a.email} className="pw-check">
              {/* eslint-disable-next-line -- kept raw: native checkbox inside .pw-check label */}
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={!!attendance[a.email]}
                onChange={(e) => setAttendance((v) => ({ ...v, [a.email]: e.currentTarget.checked }))}
              />
              {a.name}
            </label>
          ))}
        </div>
      </div>
      {view.canChair ? (
        <div className="pw-actions-bar">
          {closed ? (
            <>
              <Button
                variant="primary"
                disabled={busy.busy}
                onClick={() => run(() => api.meetingsSendSummary(meeting.meetingId))}
              >
                {meeting.summarySentAt ? 'Send the summary again' : 'Send summary to attendees'}
              </Button>
              {view.mailStatus === 'dry_run' ? (
                <span className="pw-small pw-muted">Logged, not sent: email is in test mode.</span>
              ) : null}
            </>
          ) : (
            <>
              <Button
                variant="primary"
                disabled={busy.busy || view.unreviewed > 0}
                onClick={() =>
                  run(() =>
                    api
                      .meetingsSave(meeting.meetingId, { notes, decisions, nextMeetingAt: nextAt })
                      .then(() => api.meetingsClose(meeting.meetingId, attendance))
                  )
                }
              >
                Close the meeting
              </Button>
              {view.unreviewed ? (
                <span className="pw-small pw-muted">
                  Review the {view.unreviewed} open action{view.unreviewed > 1 ? 's' : ''} first.
                </span>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      <PwErr message={busy.error} />
    </section>
  )
}

/* ya — the "Set up a meeting series" form. */
function NewSeriesForm({ data, onCreated }: { data: any; onCreated: (view: any) => void }) {
  const admin = data.me.role === 'admin'
  const [type, setType] = useState(admin ? 'WBR' : 'team')
  const [name, setName] = useState('')
  const [cadence, setCadence] = useState('')
  const [chair, setChair] = useState(data.me.email)
  const [attendees, setAttendees] = useState<string[]>([])
  const busy = useBusy()
  return (
    <section className="pw-panel pw-section" aria-labelledby="new-series-h">
      <h2 id="new-series-h" className="pw-h2">
        Set up a meeting series
      </h2>
      <div className="form-grid pw-mt-12">
        <div className="field">
          <span className="field-label">Type</span>
          <div className="pw-seg" role="group" aria-label="Type">
            {(admin ? ['WBR', 'BR', 'team', 'adhoc'] : ['team', 'adhoc']).map((t) => (
              // eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option button (family chrome, not a form control)
              <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="field-label">Name</span>
          <Input className="input" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </label>
        <PwCombo listKey="meeting.cadence" label="How often" value={cadence} onChange={setCadence} />
        {admin ? (
          <label className="field">
            <span className="field-label">Chair</span>
            <Select className="select" value={chair} onChange={(e) => setChair(e.currentTarget.value)}>
              {data.people
                .filter((p: any) => p.role !== 'agent')
                .map((p: any) => (
                  <option key={p.email} value={p.email}>
                    {p.name}
                  </option>
                ))}
            </Select>
          </label>
        ) : null}
      </div>
      <fieldset className="pw-fieldset">
        <legend className="field-label">Attendees</legend>
        <div className="pw-checks pw-mt-8">
          {data.people
            .filter((p: any) => p.email !== chair)
            .map((p: any) => (
              <label key={p.email} className="pw-check">
                {/* eslint-disable-next-line -- kept raw: native checkbox inside .pw-check label */}
                <input
                  type="checkbox"
                  checked={attendees.includes(p.email)}
                  onChange={(e) =>
                    setAttendees((v) => (e.currentTarget.checked ? [...v, p.email] : v.filter((x) => x !== p.email)))
                  }
                />
                {p.name}
              </label>
            ))}
        </div>
      </fieldset>
      <div className="pw-actions-bar">
        <Button
          variant="primary"
          disabled={busy.busy || !name.trim()}
          onClick={() =>
            busy
              .run(() =>
                api.meetingsCreateSeries({ meetingType: type, title: name, cadence, chairEmail: chair, attendees })
              )
              .then((v) => v && onCreated(v))
          }
        >
          Create series
        </Button>
      </div>
      <PwErr message={busy.error} />
    </section>
  )
}

/* pa */
export function MeetingsPage({ route }: { route: { title: string; purpose?: string } }) {
  const { data, setData, error, reload } = useSe('people.meetings', () => api.meetingsPage())
  const [seriesId, setSeriesId] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [view, setView] = useState<any>(null)
  const busy = useBusy()
  /* Adjust-on-data + reset-on-change, done during render (the React-sanctioned
   * pattern; the closure used effects). */
  const [seenData, setSeenData] = useState<any>(null)
  if (data !== seenData) {
    setSeenData(data)
    if (data && !seriesId && data.series[0]) setSeriesId(data.series[0].seriesId)
  }
  const [seenSeries, setSeenSeries] = useState(seriesId)
  if (seenSeries !== seriesId) {
    setSeenSeries(seriesId)
    setView(null)
  }
  const chosen = data?.series.find((s: any) => s.seriesId === seriesId) ?? null
  const openMeeting = (meetingId: string) =>
    busy.run(() => api.meetingsGet(meetingId)).then((v) => v && setView(v))
  return (
    <PwShell
      route={routeOf('meetings', route)}
      aside={
        data ? (
          <div className="pw-actions-bar">
            <Button aria-expanded={formOpen} onClick={() => setFormOpen((o) => !o)}>
              {formOpen ? 'Close the form' : 'Set up a meeting series'}
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
            <NewSeriesForm
              data={data}
              onCreated={(v) => {
                setData(v)
                setFormOpen(false)
                setSeriesId(v.series[v.series.length - 1]?.seriesId ?? '')
              }}
            />
          ) : null}
          <LogBrActions data={data} onLogged={() => void reload()} />
          {data.myActions.length ? (
            <section className="cx-panel" aria-labelledby="meet-actions-h">
              <div className="cx-section__head">
                <h2 id="meet-actions-h" className="cx-section__title pw-m-0">
                  Your open actions from meetings
                </h2>
                <div className="cx-section__hint">Post where each one stands before the next meeting — your note fills in the review.</div>
              </div>
              <div className="worklist">
                {data.myActions.map((a: any) => (
                  <MeetingAction key={a.actionId} actionId={a.actionId} title={a.title} due={a.dueDate} />
                ))}
              </div>
            </section>
          ) : null}
          {data.series.length ? (
            <div className="pw-two">
              <nav className="pw-rows" aria-label="Meeting series">
                {data.series.map((s: any) => (
                  // eslint-disable-next-line -- kept raw: .pw-series-btn family nav button (aria-current list picker)
                  <button
                    key={s.seriesId}
                    type="button"
                    className="pw-series-btn"
                    aria-current={s.seriesId === seriesId}
                    onClick={() => setSeriesId(s.seriesId)}
                  >
                    <div className="pw-row-title">{s.title}</div>
                    <div className="pw-row-meta">
                      {TYPE_LABELS[s.meetingType] ?? s.meetingType}, chaired by {s.chairName}
                    </div>
                    {s.openActions ? (
                      <div className="pw-mt-4">
                        <Chip status="warn">{s.openActions} open</Chip>
                      </div>
                    ) : null}
                  </button>
                ))}
              </nav>
              <div>
                {view ? (
                  <MeetingView
                    view={view}
                    people={data.people}
                    onChange={setView}
                    onBack={() => {
                      setView(null)
                      reload()
                    }}
                  />
                ) : chosen ? (
                  <SeriesView series={chosen} busy={busy.busy} onOpen={openMeeting} onOpened={setView} />
                ) : null}
                <PwErr message={busy.error} />
              </div>
            </div>
          ) : (
            <Empty title="No meeting series yet. Set one up to start keeping notes and actions." />
          )}
        </>
      ) : (
        <PwSkel lines={6} />
      )}
    </PwShell>
  )
}
