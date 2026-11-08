'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Coaching signals page (coaching.closure.js symbol xa).
 * Send-to-TL form plus the "Sent" history table. */
import { useState } from 'react'
import { Head, LoadError, fetchJson, useSe } from './shared'
import { LinesSkeleton } from '@/features/shared/components/shell/ui'
import { Button, Select, Textarea } from '@/features/shared/components/ui'
import { toast } from '@/features/shared/components/shell/Toasts'

/* I — the coaching facade. */
const api = {
  coachingPage: () => fetchJson('/api/people/coaching'),
  coachingSignal: (input: { email: string; topic: string; reason: string }) =>
    fetchJson('/api/people/coaching', input),
}

/* $e */
function Chip({ status, children }: { status?: string; children?: React.ReactNode }) {
  return (
    <span className="cx-chip" data-status={status}>
      {children}
    </span>
  )
}

/* xa */
export function CoachingPage({ route }: { route: { title: string } }) {
  const { data, error, reload } = useSe('people.coaching', () => api.coachingPage())
  const [person, setPerson] = useState('')
  const [topic, setTopic] = useState('quality')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError('')
    api.coachingSignal({ email: person, topic, reason }).then(
      (r) => {
        setBusy(false)
        setReason('')
        toast(`Sent. ${r.name}'s team lead will see it in their next 1:1.`)
        reload()
      },
      (e2) => {
        setBusy(false)
        setFormError(e2.message)
      }
    )
  }

  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!data && !error}>
      <Head
        title={route.title}
        sub="Saw something a team lead should raise, such as a QA finding? Send it here. It becomes a suggested topic in that person's next 1:1, and the TL cannot skip it without a reason."
      />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <form className="cx-panel cx-panel--pad" onSubmit={submit} style={{ display: 'grid', gap: 'var(--cx-space-3)' }}>
            <div className="cx-field">
              <label className="cx-label" htmlFor="cs-p">
                Person
              </label>
              <Select id="cs-p" value={person} onChange={(e) => setPerson(e.currentTarget.value)}>
                <option value="">Choose a person</option>
                {data.people.map((p: any) => (
                  <option key={p.email} value={p.email}>
                    {p.name}
                    {p.managerName ? `, team of ${p.managerName}` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div className="cx-field">
              <label className="cx-label" htmlFor="cs-t">
                Topic
              </label>
              <Select id="cs-t" value={topic} onChange={(e) => setTopic(e.currentTarget.value)}>
                {data.topics.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="cx-field">
              <label className="cx-label" htmlFor="cs-r">
                What you saw
              </label>
              <Textarea
                id="cs-r"
                value={reason}
                onInput={(e) => setReason(e.currentTarget.value)}
                placeholder="For example: QA audit A-1234 scored 62% on refunds; refunded without approval twice."
              />
            </div>
            {formError ? (
              <p className="cx-error" role="alert">
                {formError}
              </p>
            ) : null}
            <Button type="submit" variant="primary" disabled={busy} style={{ justifySelf: 'start' }}>
              {busy ? 'Sending…' : 'Send to their team lead'}
            </Button>
          </form>
          <section className="cx-section" aria-labelledby="cs-h">
            <div className="cx-section__head">
              <h2 className="cx-section__title" id="cs-h">
                Sent
              </h2>
            </div>
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Person</th>
                    <th scope="col">Topic</th>
                    <th scope="col">What you saw</th>
                    <th scope="col">In a 1:1?</th>
                  </tr>
                </thead>
                <tbody>
                  {data.signals.length ? (
                    data.signals.map((s: any) => (
                      <tr key={s.signalId}>
                        <td className="cx-num">{s.date}</td>
                        <td>{s.name}</td>
                        <td>{data.topics.find((t: any) => t.id === s.topic)?.label ?? s.topic}</td>
                        <td className="cx-muted">{s.reason}</td>
                        <td>
                          {s.pickedUpOn ? (
                            <Chip status="ok">Raised {s.pickedUpOn} by {s.pickedUpBy}</Chip>
                          ) : (
                            <Chip status="neutral">Waiting for their next 1:1</Chip>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>Nothing sent yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <LinesSkeleton lines={6} />
      )}
    </section>
  )
}
