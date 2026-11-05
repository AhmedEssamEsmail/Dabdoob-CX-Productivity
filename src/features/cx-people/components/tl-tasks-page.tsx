'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port. */
/* Port of the legacy TL tasks board (Tasks.js tasksPage + tl-tasks.closure.js). */
import { useState } from 'react'
import { Head, LoadError, Skeleton, fetchJson, useSe, dayAt, hm } from './shared'

const STATUS_LABEL: Record<string, string> = { not_started: 'Not started', in_progress: 'In progress', blocked: 'Blocked', done: 'Done', cancelled: 'Cancelled' }

export function TlTasksPage({ route }: { route: { title: string } }) {
  const { data: n, error, reload } = useSe('people.tasks', () => fetchJson('/api/people/tasks'))
  const [status, setStatus] = useState('')
  const tasks = (n?.tasks ?? []).filter((t: any) => !status || t.progressState === status || t.status === status)
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <Head title={route.title} sub="Assign work with a deadline and watch it land. Blocked and overdue tasks are flagged in the daily digest." />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!n && !error ? <Skeleton tall lines={8} /> : null}
      {n ? (
        <section className="cx-section" aria-labelledby="tasks-h">
          <div className="cx-section__head">
            <h2 className="cx-section__title" id="tasks-h">Tasks</h2>
            <span className="cx-section__hint">{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>
          </div>
          <div className="cx-filters">
            <div className="cx-field">
              <label className="cx-label" htmlFor="t-s">Status</label>
              <select className="cx-select" id="t-s" value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value)}>
                <option value="">All</option>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="cx-panel cx-tablewrap">
            <table className="cx-table cx-table--nowrap">
              <thead><tr>{['Task', 'Owner', 'Priority', 'Due', 'Status', 'Progress'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>
                {tasks.map((t: any) => (
                  <tr key={t.actionId} data-status={t.overdue ? 'bad' : undefined}>
                    <td>{t.title}</td>
                    <td>{t.ownerName}</td>
                    <td>{t.priority || '–'}</td>
                    <td className="cx-muted">{dayAt(t.deadlineAt)} {hm(t.deadlineAt)}</td>
                    <td><span className="cx-chip" data-status={t.overdue ? 'bad' : t.progressState === 'blocked' ? 'warn' : 'info'}>{STATUS_LABEL[t.progressState] || t.status}</span>{t.overdue ? ' · overdue' : ''}</td>
                    <td className="cx-num">{t.percent ?? ''}{t.percent != null ? '%' : ''}</td>
                  </tr>
                ))}
                {!tasks.length ? <tr><td colSpan={6}>No tasks here.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  )
}
