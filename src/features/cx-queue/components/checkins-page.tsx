'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Check-ins page (checkins.closure.js symbol Xa). */
import { useEffect, useState } from 'react'
import { AgeChip, Head, LoadError, Skeleton, fetchJson, hm, useHashParams, useSe } from './shared'

const STATUSES = ['On track', 'Busy but coping', 'Behind, need a plan', 'Swamped, help needed']
const STATUS_ORDER = (t: string) => {
  const n = t.toLowerCase()
  if (n.includes('not counted')) return 40
  if (n.includes('customer')) return 30
  const s = ['open', 'new', 'assigned', 'pending on cx', 'pending'].indexOf(n)
  return s === -1 ? 20 : s
}
const byStatusLine = (t: Record<string, number>) => {
  const n = Object.entries(t || {})
  const s = n.filter(([l]) => STATUS_ORDER(l) < 40).sort((l, r) => STATUS_ORDER(l[0]) - STATUS_ORDER(r[0]) || r[1] - l[1]).map(([l, r]) => `${l === l.toUpperCase() ? l.charAt(0) + l.slice(1).toLowerCase() : l} ${r.toLocaleString('en-US')}`).join(' · ')
  const a = n.filter(([l]) => STATUS_ORDER(l) >= 40).map(([l, r]) => `${l} ${r.toLocaleString('en-US')}`)
  return a.length ? `${s} (also ${a.join(', ')})` : s
}
const delta = (t: number | null) => (t === null ? '–' : t > 0 ? `+${t}` : t < 0 ? `−${Math.abs(t)}` : '0')
const draftOf = (t: any) => ({ agents: t.agents === null ? '' : String(t.agents), status: t.status || '', note: t.note || '', correct: t.openCorrected !== null && t.openCorrected !== undefined, openCorrected: t.openCorrected === null || t.openCorrected === undefined ? '' : String(t.openCorrected) })

export function CheckinsPage({ route }: { route: { title: string } }) {
  const [params] = useState(useHashParams)
  const [slot, setSlot] = useState(() => params.get('slot') ?? '')
  const { data: a, error, reload, setData } = useSe('queue.checkins', () => fetchJson('/api/queue/checkins-page' + (slot ? '?slot=' + slot : '')), [slot])
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [gen, setGen] = useState('')
  const [help, setHelp] = useState(false)
  const [helpNote, setHelpNote] = useState('')
  const [reason, setReason] = useState('')
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (a) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- verbatim: drafts prefill from the loaded page payload
      setDraft(Object.fromEntries(a.prefill.map((k: any) => [k.queue, draftOf(k)])))
      setGen(a.existing?.generalNote ?? '')
      setHelp(a.existing?.helpNeeded ?? false)
      setHelpNote(a.existing?.helpNote ?? '')
      setReason(a.existing?.correctionReason ?? '')
    }
  }, [a])
  const cur = a?.slots.find((k: any) => k.slot === a.current)
  const upcoming = a?.slots.find((k: any) => k.state === 'upcoming')
  const missed = a ? a.slots.filter((k: any) => k.state === 'missed' && k.slot !== a.current) : []
  const done = cur?.state === 'done'
  // eslint-disable-next-line react-hooks/purity -- verbatim: "is the slot open yet" compares against Date.now()
  const notOpen = !!cur && new Date(cur.opensAt).getTime() > Date.now()
  const needsReason = a ? a.prefill.some((k: any) => draft[k.queue]?.correct && draft[k.queue].openCorrected !== '' && Number(draft[k.queue].openCorrected) !== k.open) : false
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!a || !cur) return
    const A: Record<string, string> = {}
    a.prefill.forEach((x: any) => {
      const P = draft[x.queue]
      if (!P) return
      if (P.agents === '' || !Number.isInteger(Number(P.agents)) || Number(P.agents) < 0) A[x.queue] = 'Enter how many agents are on it (a whole number).'
      else if (P.status && P.status !== 'On track' && !P.note.trim()) A[x.queue] = `Say what is slowing ${x.queue} so the next shift can plan for it.`
      else if (!P.status) A[x.queue] = 'Choose how it is going.'
    })
    setErrs(A)
    setErr('')
    if (Object.keys(A).length) return
    setBusy(true)
    try {
      const x = await fetchJson('/api/queue/checkins-page', {
        slot: a.current,
        queues: a.prefill.map((q: any) => ({ queue: q.queue, agents: Number(draft[q.queue].agents), status: draft[q.queue].status, note: draft[q.queue].note.trim(), openCorrected: draft[q.queue].correct && draft[q.queue].openCorrected !== '' ? Number(draft[q.queue].openCorrected) : null })),
        generalNote: gen, helpNeeded: help, helpNote, correctionReason: reason,
      })
      setData({ ...a, slots: a.slots.map((P: any) => (P.slot === x.slot ? { ...P, state: 'done', submittedBy: x.submittedBy, submittedAt: x.submittedAt } : P)) })
      reload()
    } catch (x: any) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!a && !error}>
      <Head title={route.title} sub={cur ? `Four times a day: 09:30, 13:00, 18:30 and 22:00 Kuwait. This one is ${cur.slot}, ${String(cur.name).toLowerCase()} (${cur.cairo} Cairo).` : 'Four times a day: 09:30, 13:00, 18:30 and 22:00 Kuwait time.'} />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!a || !cur ? <><Skeleton tall lines={2} /><Skeleton lines={10} /></> : (
        <>
          <section className="cx-panel" aria-label="Today's check-ins">
            <div className="dq-slots">
              {a.slots.map((k: any) => (
                <button key={k.slot} type="button" className={`dq-slot dq-slot--${k.state}${k.slot === a.current ? ' on' : ''}`} onClick={() => k.state !== 'upcoming' && setSlot(k.slot)}>
                  <b>{k.slot}</b>
                  <span>{k.name}</span>
                  <i>{k.state === 'done' ? `by ${String(k.submittedBy).split('@')[0]}` : k.state}</i>
                </button>
              ))}
            </div>
          </section>
          {missed.length ? (
            <div className="cx-note" data-status="warn">
              <div>
                <strong>Missed today: {missed.map((k: any) => k.slot).join(', ')}.</strong> You can still answer a missed check-in; it is saved as late with your note, so Mohamed sees why.{' '}
                {missed.map((k: any) => <button key={k.slot} type="button" className="cx-btn cx-btn--quiet" onClick={() => setSlot(k.slot)}>Answer {k.slot}</button>)}
              </div>
            </div>
          ) : null}
          <div className="cx-split cx-split--narrow">
            <form className="cx-panel" onSubmit={submit} noValidate>
              <div className="cx-panel--pad" style={{ display: 'grid', gap: 'var(--cx-space-3)', borderBlockEnd: '1px solid var(--cx-line)' }}>
                {notOpen ? (
                  <div className="cx-note" data-status="neutral"><div><strong>The {cur.slot} check-in opens at {hm(cur.opensAt)}.</strong> The numbers below are live and will change.</div></div>
                ) : (
                  <div className="cx-note" data-status={a.frozen ? 'info' : 'warn'}>
                    <div>
                      <strong>Freshdesk is read about {Math.round((new Date(cur.readAfter).getTime() - new Date(cur.at).getTime()) / 6e4)} minutes after the slot.</strong>{' '}
                      {a.frozen ? `Open counts and the oldest ticket were read at ${hm(a.dataAsOf)} and are locked. You fill in the agents and the status, because only you know them.` : `These are live numbers. The official snapshot is read at ${hm(cur.readAfter)}; reload then if you want the frozen figures.`}
                    </div>
                  </div>
                )}
                {cur.state === 'missed' ? <div className="cx-note" data-status="warn"><div><strong>The {cur.slot} check-in was missed.</strong> Answer it now and it is saved as late. Use the note below to say why it was missed.</div></div> : null}
                {a.carriedFrom && !done ? <div className="cx-note" data-status="neutral"><div><strong>Agents, status and notes are copied from the {a.carriedFrom} check-in.</strong> Check each line and change what has moved before you submit.</div></div> : null}
                {done ? <div className="cx-note" data-status="ok"><div><strong>{cur.slot} check-in submitted</strong> by {cur.submittedBy} at {hm(cur.submittedAt)}. {missed.length ? `Still missing: ${missed.map((k: any) => k.slot).join(', ')}.` : upcoming ? `Next one is due at ${upcoming.slot}.` : 'That was the last one today.'} You can still correct it below.</div></div> : null}
              </div>
              {a.prefill.map((k: any) =>
                draft[k.queue] ? (
                  <fieldset key={k.queue} className="cx-queuerow cx-fieldset">
                    <legend className="cx-sr">{k.queue}</legend>
                    <div className="cx-readout">
                      <span className="cx-queuerow__name">
                        {k.queue}
                        {k.stale ? <span className="cx-chip" data-status="warn">Stale: not refreshed since the daily report</span> : null}
                        {byStatusLine(k.byStatus) ? <span className="dq-statusline">{byStatusLine(k.byStatus)}</span> : null}
                      </span>
                      <span><b className="cx-num">{k.open}</b> open</span>
                      {a.previousSlot ? <span className="cx-delta">{delta(k.delta)} since {a.previousSlot}</span> : null}
                      <span className="cx-lock">{k.kind === 'chat' ? `From the daily report${k.sourceAsOf ? `, ${hm(k.sourceAsOf)}` : ''}` : `From Freshdesk${a.dataAsOf ? `, ${hm(a.dataAsOf)}` : ''}`}</span>
                      <label className="dq-correct"><input type="checkbox" checked={draft[k.queue].correct} onChange={(e) => setDraft((d) => ({ ...d, [k.queue]: { ...d[k.queue], correct: (e.target as HTMLInputElement).checked } }))} /> Correct the count</label>
                      {draft[k.queue].correct ? <input className="cx-input cx-num" type="number" min={0} aria-label={`Correct open count for ${k.queue}`} value={draft[k.queue].openCorrected} onInput={(e) => setDraft((d) => ({ ...d, [k.queue]: { ...d[k.queue], openCorrected: (e.target as HTMLInputElement).value } }))} /> : null}
                    </div>
                    <div className="cx-readout">
                      <span>Oldest</span>
                      {k.open ? <AgeChip hours={k.oldestH} band={k.oldestBand} /> : <span>–</span>}
                      <span className="cx-delta">{k.unassigned} not assigned</span>
                    </div>
                    <div style={{ display: 'grid', gap: 'var(--cx-space-3)' }}>
                      <div className="cx-field">
                        <label className="cx-label" htmlFor={`q-${k.queue.replace(/\W+/g, '-')}-ag`}>Agents on it now</label>
                        <input className="cx-input cx-num" id={`q-${k.queue.replace(/\W+/g, '-')}-ag`} type="number" min={0} inputMode="numeric" value={draft[k.queue].agents} onInput={(e) => setDraft((d) => ({ ...d, [k.queue]: { ...d[k.queue], agents: (e.target as HTMLInputElement).value } }))} />
                      </div>
                      <div className="cx-field">
                        <label className="cx-label" htmlFor={`q-${k.queue.replace(/\W+/g, '-')}-st`}>How is it going?</label>
                        <select className="cx-select" id={`q-${k.queue.replace(/\W+/g, '-')}-st`} value={draft[k.queue].status} onChange={(e) => setDraft((d) => ({ ...d, [k.queue]: { ...d[k.queue], status: (e.target as HTMLSelectElement).value } }))}>
                          <option value="">Choose…</option>
                          {(draft[k.queue].status && !STATUSES.includes(draft[k.queue].status) ? [draft[k.queue].status, ...STATUSES] : STATUSES).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="cx-field">
                      <label className="cx-label" htmlFor={`q-${k.queue.replace(/\W+/g, '-')}-n`}>What is driving it? <span className="cx-faint" style={{ fontWeight: 400, visibility: draft[k.queue].status && draft[k.queue].status !== 'On track' ? 'visible' : 'hidden' }}>Needed unless on track</span></label>
                      <textarea className="cx-textarea" id={`q-${k.queue.replace(/\W+/g, '-')}-n`} style={{ minHeight: '6.2rem' }} placeholder="For example: Aramex delay in Kuwait, 40 tickets waiting for their reply." value={draft[k.queue].note} aria-invalid={errs[k.queue] ? 'true' : undefined} onInput={(e) => setDraft((d) => ({ ...d, [k.queue]: { ...d[k.queue], note: (e.target as HTMLTextAreaElement).value } }))} />
                      {errs[k.queue] ? <span className="cx-error">{errs[k.queue]}</span> : null}
                    </div>
                  </fieldset>
                ) : null
              )}
              <div className="cx-panel--pad" style={{ display: 'grid', gap: 'var(--cx-space-3)', borderBlockStart: '1px solid var(--cx-line)' }}>
                {needsReason ? (
                  <div className="cx-field"><label className="cx-label" htmlFor="reason">Why did you change a count from Freshdesk?</label><input className="cx-input" id="reason" value={reason} onInput={(e) => setReason((e.target as HTMLInputElement).value)} /></div>
                ) : null}
                <div className="cx-field"><label className="cx-label" htmlFor="gen">Anything the next shift or Mohamed should know? <span className="cx-faint" style={{ fontWeight: 400 }}>Optional</span></label><textarea className="cx-textarea" id="gen" value={gen} onInput={(e) => setGen((e.target as HTMLTextAreaElement).value)} /></div>
                <label className="dq-correct"><input type="checkbox" checked={help} onChange={(e) => setHelp((e.target as HTMLInputElement).checked)} /> I need help from Mohamed now</label>
                {help ? (
                  <div className="cx-field"><label className="cx-label" htmlFor="help">What help do you need?</label><textarea className="cx-textarea" id="help" value={helpNote} onInput={(e) => setHelpNote((e.target as HTMLTextAreaElement).value)} /><span className="cx-hint">Mohamed gets an email and a card on his Home as soon as you submit.</span></div>
                ) : null}
                {err ? <p className="cx-error" role="alert">{err}</p> : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cx-space-3)', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p className="cx-hint">Submitting as <span className="cx-isolate">{a.you}</span>. Saved to the {cur.slot} slot with the time you press the button.</p>
                  <button className="cx-btn cx-btn--primary" type="submit" disabled={busy || notOpen}>{busy ? 'Submitting…' : done ? `Update ${cur.slot} check-in` : `Submit ${cur.slot} check-in`}</button>
                </div>
              </div>
            </form>
            <div style={{ display: 'grid', gap: 'var(--cx-space-4)', alignContent: 'start' }}>
              {a.earlier.map((k: any) => (
                <section key={(k.date ?? '') + k.slot} className="cx-section">
                  <div className="cx-section__head">
                    <h2 className="cx-section__title">{k.date && k.date !== a.today ? `Last night, ${k.slot}` : `Earlier today, ${k.slot}`}</h2>
                    <span className="cx-section__hint">{String(k.by).split('@')[0]}{k.late ? ' (late)' : ''}</span>
                  </div>
                  {k.helpNeeded ? <p className="cx-note" data-status="bad"><span><strong>Asked Mohamed for help:</strong> {k.helpNote || 'no note'}</span></p> : null}
                  {k.generalNote ? <p className="cx-note" data-status="info"><span><strong>Handoff note:</strong> {k.generalNote}</span></p> : null}
                  <div className="cx-panel cx-tablewrap">
                    <table className="cx-table">
                      <thead><tr><th scope="col">Queue</th><th scope="col" className="cx-num-col">Agents</th><th scope="col">Status given</th></tr></thead>
                      <tbody>
                        {(k.queues || []).map((A: any) => (
                          <tr key={A.queue}><td>{A.queue}</td><td className="cx-num-col cx-num">{A.agents}</td><td><span className="cx-chip" data-status={A.status === 'On track' ? 'ok' : 'warn'}>{A.status}</span>{A.note ? <span className="dq-statusline">{A.note}</span> : null}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
              <div className="cx-note" data-status="neutral"><div><strong>If a check-in is missed</strong><br />The team lead gets an email and a pop-up 30 minutes after the slot. Mohamed sees the slot marked missed on Home.</div></div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
