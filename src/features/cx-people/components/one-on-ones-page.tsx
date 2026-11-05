'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port. */
/* Port of the legacy One-on-ones page (OneOnOnes.js oneOnOnesPage + one-on-ones.closure.js). */
import { useState } from 'react'
import { Head, LoadError, Skeleton, fetchJson, useSe, dayAt, hm } from './shared'

const STATUS_LABEL: Record<string, string> = { scheduled: 'Scheduled', missed: 'Missed', held: 'Held', held_late: 'Held (late)', excused: 'Excused', rescheduled: 'Rescheduled', cancelled: 'Cancelled' }

export function OneOnOnesPage({ route }: { route: { title: string } }) {
  const { data: n, error, reload } = useSe('people.1on1', () => fetchJson('/api/people/one-on-ones'))
  const [report, setReport] = useState('')
  const [log, setLog] = useState<any>(null)
  const schedule = (n?.schedule ?? []).filter((s: any) => !report || s.reportEmail === report)
  const logs = (n?.logs ?? []).filter((l: any) => !report || l.reportEmail === report)
  const openLog = (id: string) =>
    fetchJson('/api/people/one-on-ones/log?logId=' + encodeURIComponent(id)).then(setLog).catch(() => setLog(null))
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!n && !error}>
      <Head title={route.title} sub="Book, hold and record 1:1s. A booked 1:1 with no record by the evening cutoff counts as missed." />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!n && !error ? <Skeleton tall lines={8} /> : null}
      {n ? (
        <>
          <div className="cx-filters">
            <div className="cx-field">
              <label className="cx-label" htmlFor="oo-r">Person</label>
              <select className="cx-select" id="oo-r" value={report} onChange={(e) => setReport((e.target as HTMLSelectElement).value)}>
                <option value="">Everyone you manage</option>
                {(n.people ?? []).map((p: any) => <option key={p.email} value={p.email}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <section className="cx-section" aria-labelledby="up-h">
            <div className="cx-section__head">
              <h2 className="cx-section__title" id="up-h">Upcoming and unresolved</h2>
              <span className="cx-section__hint">{schedule.length} booking{schedule.length === 1 ? '' : 's'}</span>
            </div>
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table cx-table--nowrap">
                <thead><tr>{['With', 'When', 'Duration', 'Status', 'Week'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                <tbody>
                  {schedule.map((s: any) => (
                    <tr key={s.scheduleId} data-status={s.status === 'missed' ? 'bad' : undefined}>
                      <td>{s.reportName}</td>
                      <td>{dayAt(s.scheduledAt)} {hm(s.scheduledAt)}</td>
                      <td className="cx-num">{s.durationMin} min</td>
                      <td><span className="cx-chip" data-status={s.status === 'missed' ? 'bad' : s.status === 'excused' ? 'warn' : 'info'}>{STATUS_LABEL[s.status] || s.status}</span></td>
                      <td className="cx-muted">{s.weekStart}</td>
                    </tr>
                  ))}
                  {!schedule.length ? <tr><td colSpan={5}>No booked 1:1s here.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
          <section className="cx-section" aria-labelledby="log-h">
            <div className="cx-section__head">
              <h2 className="cx-section__title" id="log-h">Records</h2>
              <span className="cx-section__hint">{logs.length} record{logs.length === 1 ? '' : 's'}</span>
            </div>
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead><tr>{['With', 'Held', 'Summary'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                <tbody>
                  {logs.map((l: any) => (
                    <tr key={l.logId}>
                      <td><button type="button" className="cx-btn cx-btn--quiet" onClick={() => openLog(l.logId)}>{l.reportName}</button></td>
                      <td className="cx-muted">{dayAt(l.heldAt)} {hm(l.heldAt)}</td>
                      <td><pre className="cx-pre">{l.summary}</pre></td>
                    </tr>
                  ))}
                  {!logs.length ? <tr><td colSpan={3}>No records yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
            {log ? (
              <div className="cx-panel cx-panel--pad" role="dialog" aria-label="1:1 record">
                <h3>{log.reportName} · {dayAt(log.heldAt)}</h3>
                <pre className="cx-pre">{log.summary}</pre>
                {(log.topics ?? []).map((t: any, i: number) => (
                  <p key={i}><span className="cx-chip">{t.label || t.topic}</span> {t.outcome}{t.confidential ? ' (confidential)' : ''}</p>
                ))}
                <button type="button" className="cx-btn" onClick={() => setLog(null)}>Close</button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  )
}
