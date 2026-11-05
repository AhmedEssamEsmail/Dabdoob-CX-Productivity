'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port. */
/* Port of the legacy Meetings page (Meetings.js meetingsPage + meetings.closure.js). */
import { Head, LoadError, Skeleton, fetchJson, useSe, dayAt, hm } from './shared'

export function MeetingsPage({ route }: { route: { title: string } }) {
  const { data: n, error, reload } = useSe('people.meetings', () => fetchJson('/api/people/meetings'))
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <Head title={route.title} sub="Recurring meetings and business reviews. Open actions carry into the next occurrence until they are reviewed." />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!n && !error ? <Skeleton tall lines={6} /> : null}
      {n ? (
        <section className="cx-section" aria-labelledby="ser-h">
          <div className="cx-section__head">
            <h2 className="cx-section__title" id="ser-h">Series</h2>
            <span className="cx-section__hint">{(n.series ?? []).length} series</span>
          </div>
          <div className="cx-panel cx-tablewrap">
            <table className="cx-table cx-table--nowrap">
              <thead><tr>{['Title', 'Type', 'Chair', 'Cadence', 'Next', 'Open actions'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>
                {(n.series ?? []).map((s: any) => (
                  <tr key={s.seriesId}>
                    <td>{s.title}</td>
                    <td>{s.type}</td>
                    <td>{s.chairName}</td>
                    <td className="cx-muted">{s.cadence}</td>
                    <td className="cx-muted">{s.nextAt ? dayAt(s.nextAt) + ' ' + hm(s.nextAt) : '–'}</td>
                    <td className="cx-num">{s.openActions ?? 0}</td>
                  </tr>
                ))}
                {!(n.series ?? []).length ? <tr><td colSpan={6}>No meeting series you can see.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  )
}
