'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy My actions page (my-actions.closure.js symbols ka/_a).
 * Action cards: "Where it stands" note, Post update / I am blocked / Done. */
import { useState } from 'react'
import { Head, LoadError, fetchJson, useSe, dayAt } from './shared'
import { today } from './pw'
import { LinesSkeleton } from '@/features/shared/components/shell/ui'
import { Button, Textarea } from '@/features/shared/components/ui'
import { toast } from '@/features/shared/components/shell/Toasts'

/* I — the actions facade. */
const api = {
  actionsMine: () => fetchJson('/api/people/actions') as Promise<any[]>,
  actionsPostUpdate: (actionId: string, input: { note: string }) =>
    fetchJson('/api/people/actions/updates', { actionId, ...input }),
  actionsSetStatus: (actionId: string, status: string, note: string) =>
    fetchJson('/api/people/actions/status', { actionId, status, note }),
}

/* wa — where an action came from. */
const SOURCE_LABELS: Record<string, string> = {
  one_on_one_agent: '1:1',
  one_on_one_tl: '1:1',
  meeting: 'Meeting',
  task: 'Task',
  adhoc: 'Ad hoc',
}

/* $e */
function Chip({ status, children }: { status?: string; children?: React.ReactNode }) {
  return (
    <span className="cx-chip" data-status={status}>
      {children}
    </span>
  )
}

/* _a — one action card. */
function ActionCard({ a, onChange }: { a: any; onChange: () => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const overdue = a.dueDate < today()
  const act = (call: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    setError('')
    call().then(
      () => {
        setBusy(false)
        setNote('')
        toast(msg)
        onChange()
      },
      (e) => {
        setBusy(false)
        setError(e.message)
      }
    )
  }
  const id = `act-${a.actionId}`
  return (
    <article
      className="cx-panel cx-panel--pad"
      style={{ display: 'grid', gap: 'var(--cx-space-2)' }}
      aria-labelledby={`${id}-t`}
    >
      <h3 className="cx-section__title" id={`${id}-t`}>
        {a.title}
      </h3>
      <p className="cx-hint">
        From a {SOURCE_LABELS[a.sourceType] || a.sourceType}, due {a.dueDate}{' '}
        {overdue ? <Chip status="bad">Overdue</Chip> : null}
        {a.sourceDeleted ? <Chip status="warn">Created in a deleted 1:1</Chip> : null}
        {a.status === 'blocked' ? <Chip status="warn">Blocked</Chip> : null}
        {a.carryCount ? ` Carried ${a.carryCount}x.` : ''}
      </p>
      {a.latestUpdate ? (
        <p className="cx-muted">
          Last update {a.latestUpdate.at ? dayAt(a.latestUpdate.at) : ''}: {a.latestUpdate.note}
        </p>
      ) : (
        <p className="cx-faint">No update yet. Post one so the review takes seconds.</p>
      )}
      <div className="cx-field">
        <label className="cx-label" htmlFor={`${id}-n`}>
          Where it stands
        </label>
        <Textarea
          id={`${id}-n`}
          value={note}
          onInput={(e) => setNote(e.currentTarget.value)}
          placeholder="For example: read sections 4.1-4.3, need 10 minutes with my TL on 4.4."
        />
      </div>
      {error ? (
        <p className="cx-error" role="alert">
          {error}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: 'var(--cx-space-2)', flexWrap: 'wrap' }}>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() =>
            act(() => api.actionsPostUpdate(a.actionId, { note }), 'Update posted. Your team lead sees it in the next review.')
          }
        >
          Post update
        </Button>
        {a.status !== 'blocked' ? (
          <Button
            disabled={busy}
            onClick={() => act(() => api.actionsSetStatus(a.actionId, 'blocked', note), 'Marked blocked. Your team lead sees why.')}
          >
            I am blocked
          </Button>
        ) : (
          <Button
            disabled={busy}
            onClick={() => act(() => api.actionsSetStatus(a.actionId, 'open', note), 'Back to open.')}
          >
            Unblocked
          </Button>
        )}
        <Button
          variant="quiet"
          disabled={busy}
          onClick={() => act(() => api.actionsSetStatus(a.actionId, 'done', note), 'Marked done.')}
        >
          Done
        </Button>
      </div>
    </article>
  )
}

/* ka */
export function MyActionsPage({ route }: { route: { title: string } }) {
  const { data, error, reload } = useSe('people.myactions', () => api.actionsMine())
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!data && !error}>
      <Head title={route.title} sub="What you agreed to in 1:1s and meetings. Post where each stands before it is reviewed." />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {data ? (
        data.length ? (
          <div style={{ display: 'grid', gap: 'var(--cx-space-4)' }}>
            {data.map((a: any) => (
              <ActionCard key={a.actionId} a={a} onChange={reload} />
            ))}
          </div>
        ) : (
          <p className="cx-note" data-status="ok">
            <span>You have no open actions.</span>
          </p>
        )
      ) : (
        <LinesSkeleton lines={6} />
      )}
    </section>
  )
}
