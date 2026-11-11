'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* ls — the outcome picker for each carried action (one-on-ones + meetings). */
import { Chip, Input } from '@/features/shared/components/ui'
import { addDays, dayLabel, dayTime, today } from './pw'

const REVIEW_OUTCOMES = [
  { id: 'done', label: 'Done' },
  { id: 'carried', label: 'Still open' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'dropped', label: 'Dropped' },
]
const REVIEW_NOTE_LABELS: Record<string, string> = {
  done: 'What was done',
  carried: '',
  blocked: 'Blocked by what, and who can unblock it',
  dropped: 'Why it is dropped',
}

export function CarriedReview({
  actions,
  value,
  onChange,
  disabled,
}: {
  actions: any[]
  value: Record<string, any>
  onChange: (v: Record<string, any>) => void
  disabled?: boolean
}) {
  const patch = (a: any, p: Record<string, unknown>) => {
    const next = { ...(value[a.actionId] ?? { actionId: a.actionId, outcome: 'done' }), ...p }
    if (next.outcome === 'carried' && !next.newDueDate) next.newDueDate = addDays(today(), 7)
    onChange({ ...value, [a.actionId]: next })
  }
  return (
    <div>
      {actions.map((a) => {
        const v = value[a.actionId]
        const overdue = a.dueDate < today()
        return (
          <div key={a.actionId} className="pw-carry">
            <div>
              <div className="pw-row-title">
                {a.title} {a.sourceDeleted ? <Chip status="warn">Created in a deleted 1:1</Chip> : null}
              </div>
              <div className="pw-row-meta">
                {a.ownerName}, due {dayLabel(a.dueDate)} {overdue ? <Chip status="bad">Overdue</Chip> : null}{' '}
                {a.carryCount >= 3 ? (
                  <Chip status="bad">Carried {a.carryCount} times: escalate, reassign or drop</Chip>
                ) : a.carryCount ? (
                  <Chip status="warn">Carried {a.carryCount}×</Chip>
                ) : null}
              </div>
              {a.latestUpdate ? (
                <p className="pw-small pw-muted pw-mt-4">
                  Latest from {a.latestUpdate.byName}, {dayTime(a.latestUpdate.at)}:{' '}
                  {a.latestUpdate.kind === 'file' ? `file ${a.latestUpdate.fileName}` : a.latestUpdate.note}
                </p>
              ) : null}
            </div>
            <div className="pw-seg" role="group" aria-label={`Outcome for ${a.title}`}>
              {REVIEW_OUTCOMES.map((o) => (
                 
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={v?.outcome === o.id}
                  disabled={disabled}
                  onClick={() => patch(a, { outcome: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {v ? (
              v.outcome === 'carried' ? (
                <label className="field pw-max-w-220">
                  <span className="field-label">New due date</span>
                  <Input
                    className="input"
                    type="date"
                    min={today()}
                    value={v.newDueDate ?? ''}
                    disabled={disabled}
                    onInput={(e) => patch(a, { newDueDate: e.currentTarget.value })}
                  />
                </label>
              ) : (
                <label className="field">
                  <span className="field-label">{REVIEW_NOTE_LABELS[v.outcome]}</span>
                  <Input
                    className="input"
                    value={v.note ?? ''}
                    disabled={disabled}
                    onInput={(e) => patch(a, { note: e.currentTarget.value })}
                  />
                </label>
              )
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
