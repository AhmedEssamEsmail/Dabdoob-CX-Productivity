'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port. */
/* Port of the legacy Notes page (Notes.js notesPage + notes.closure.js): the owner's
   private scratchpad — raw / exploring / decided / dropped. */
import { useState } from 'react'
import { Head, LoadError, Skeleton, fetchJson, useSe, dayAt } from './shared'

const STATUSES = ['raw', 'exploring', 'decided', 'dropped']

export function NotesPage({ route }: { route: { title: string } }) {
  const { data: n, error, reload } = useSe('people.notes', () => fetchJson('/api/people/notes'))
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const notes = (n?.notes ?? []).filter((x: any) => !status || x.status === status)
  const save = (body: Record<string, unknown>) => fetchJson('/api/people/notes', body).then(reload).catch((e) => alert(e.message))
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <Head title={route.title} sub="Your private scratchpad. Nobody else sees these." />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!n && !error ? <Skeleton tall lines={6} /> : null}
      {n ? (
        <section className="cx-section" aria-labelledby="notes-h">
          <div className="cx-section__head">
            <h2 className="cx-section__title" id="notes-h">Notes</h2>
            <span className="cx-section__hint">{notes.length} note{notes.length === 1 ? '' : 's'}</span>
          </div>
          <div className="cx-filters">
            <div className="cx-field" style={{ flex: 1 }}>
              <label className="cx-label" htmlFor="n-new">New note</label>
              <input className="cx-input" id="n-new" placeholder="Write it down" value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
            </div>
            <button type="button" className="cx-btn" disabled={!text.trim()} onClick={() => { save({ text }).then(() => setText('')) }}>Save</button>
            <div className="cx-field">
              <label className="cx-label" htmlFor="n-f">Status</label>
              <select className="cx-select" id="n-f" value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value)}>
                <option value="">All</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead><tr>{['Note', 'Tag', 'Status', 'Written'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>
                {notes.map((x: any) => (
                  <tr key={x.noteId}>
                    <td>{x.text}</td>
                    <td className="cx-muted">{x.tag || '–'}</td>
                    <td><span className="cx-chip" data-status={x.status === 'decided' ? 'ok' : x.status === 'dropped' ? 'neutral' : 'info'}>{x.status}</span></td>
                    <td className="cx-muted">{dayAt(x.updatedAt || x.submittedAt)}</td>
                  </tr>
                ))}
                {!notes.length ? <tr><td colSpan={4}>No notes yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  )
}
