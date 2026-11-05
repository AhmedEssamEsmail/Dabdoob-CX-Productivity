'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port. */
/* Port of the legacy My actions page (Actions.js actionsMine + my-actions.closure.js). */
import { useState } from 'react'
import { Head, LoadError, Skeleton, fetchJson, useSe, dayAt } from './shared'

export function MyActionsPage({ route }: { route: { title: string } }) {
  const { data: n, error, reload } = useSe('people.myactions', () => fetchJson('/api/people/actions'))
  const [note, setNote] = useState<Record<string, string>>({})
  const actions = n?.actions ?? n ?? []
  const update = (a: any, status: string) =>
    fetchJson('/api/people/actions/status', { actionId: a.actionId, status, note: note[a.actionId] || '' }).then(reload).catch((e) => alert(e.message))
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <Head title={route.title} sub="Everything agreed with you as owner, newest first. Post where each one stands." />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!n && !error ? <Skeleton tall lines={6} /> : null}
      {n ? (
        <section className="cx-section" aria-labelledby="act-h">
          <div className="cx-section__head">
            <h2 className="cx-section__title" id="act-h">Open actions</h2>
            <span className="cx-section__hint">{actions.length} open</span>
          </div>
          <div className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead><tr>{['Action', 'From', 'Due', 'Status', 'Update'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>
                {actions.map((a: any) => (
                  <tr key={a.actionId} data-status={a.overdue ? 'bad' : undefined}>
                    <td>{a.title}</td>
                    <td className="cx-muted">{a.sourceLabel || a.sourceType}</td>
                    <td className="cx-muted">{dayAt(a.dueDate)}</td>
                    <td><span className="cx-chip" data-status={a.overdue ? 'bad' : a.status === 'blocked' ? 'warn' : 'info'}>{a.status}</span></td>
                    <td>
                      <input className="cx-input" placeholder="Where it stands" value={note[a.actionId] || ''} onInput={(e) => setNote({ ...note, [a.actionId]: (e.target as HTMLInputElement).value })} />{' '}
                      <button type="button" className="cx-btn" onClick={() => update(a, 'done')}>Done</button>
                    </td>
                  </tr>
                ))}
                {!actions.length ? <tr><td colSpan={5}>Nothing open. Nice.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  )
}
