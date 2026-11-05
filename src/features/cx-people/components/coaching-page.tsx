'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port. */
/* Port of the legacy Coaching page (Coaching.js coachingPage + coaching.closure.js):
   flag something a TL should raise at the next 1:1. */
import { useState } from 'react'
import { Head, LoadError, Skeleton, fetchJson, useSe, dayAt } from './shared'

export function CoachingPage({ route }: { route: { title: string } }) {
  const { data: n, error, reload } = useSe('people.coaching', () => fetchJson('/api/people/coaching'))
  const [who, setWho] = useState('')
  const signals = (n?.signals ?? []).filter((s: any) => !who || s.email === who)
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <Head title={route.title} sub="Saw something a team lead should raise at the next 1:1? Flag it here — it lands on their topic list." />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!n && !error ? <Skeleton tall lines={6} /> : null}
      {n ? (
        <section className="cx-section" aria-labelledby="sig-h">
          <div className="cx-section__head">
            <h2 className="cx-section__title" id="sig-h">Coaching signals</h2>
            <span className="cx-section__hint">{signals.length} open</span>
          </div>
          <div className="cx-filters">
            <div className="cx-field">
              <label className="cx-label" htmlFor="c-w">Person</label>
              <select className="cx-select" id="c-w" value={who} onChange={(e) => setWho((e.target as HTMLSelectElement).value)}>
                <option value="">Everyone</option>
                {[...new Set<string>((n?.signals ?? []).map((s: any) => s.email))].map((e) => (
                  <option key={e} value={e}>{(n.people ?? []).find((p: any) => p.email === e)?.name || e}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead><tr>{['Person', 'Topic', 'Reason', 'Raised by', 'When'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>
                {signals.map((s: any) => (
                  <tr key={s.signalId}>
                    <td>{s.personName || s.email}</td>
                    <td><span className="cx-chip" data-status="info">{s.topic}</span></td>
                    <td>{s.reason}</td>
                    <td className="cx-muted">{s.raisedBy || s.submittedBy}</td>
                    <td className="cx-muted">{dayAt(s.signalDate || s.submittedAt)}</td>
                  </tr>
                ))}
                {!signals.length ? <tr><td colSpan={5}>Nothing flagged right now.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  )
}
