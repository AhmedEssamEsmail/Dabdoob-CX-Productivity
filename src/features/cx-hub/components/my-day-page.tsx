'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */

/* verbatim port of the legacy Zm "My day" page: the part-fetching machine
 * (core/mail/files/followups with stale-while-revalidate), the today/tomorrow
 * agenda with focus-gap booking, deadlines, follow-ups, mail waiting, recent
 * files, the meetings-done ring and the settings/digest card. */

import { useEffect, useRef, useState } from 'react'
import { Button, Input } from '@/features/shared/components/ui'
import { D } from '@/features/shared/shell/i18n'
import { Df, Ft, Fs, If, Nf, useTh } from './hub-shared'

type Q = Record<string, any>
type Section = { ok: boolean; error?: string; data: any[] } | undefined

/* ---------------------------------------------------------------- helpers */
const bo = 'Asia/Kuwait'
const wo = (n: Date) => !isNaN(n.getTime())
const Wn = (n: string | number | Date): string => {
  const e = new Date(n)
  return wo(e)
    ? e.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: bo })
    : ''
}
const Hm = (n: string): string => {
  const e = new Date(`${n}T12:00:00+03:00`)
  return wo(e)
    ? e.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: bo })
    : String(n || '')
}
const co = (n: string): string => {
  const e = new Date(`${String(n).slice(0, 10)}T12:00:00+03:00`)
  return wo(e)
    ? e.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: bo })
    : String(n || 'no date')
}
const Gm = (n: string): string => {
  const e = Date.parse(n)
  return isFinite(e) ? new Date(e + 3 * 36e5).toISOString().slice(0, 10) : ''
}
const Vm = 15e3
const Wm = 10 * 6e4
const ta = ['core', 'mail', 'files', 'followups']
const er = (n: any) => !!n && typeof n === 'object' && Array.isArray(n.data)
const Wo = (n: string) => new Error(`My day ${n}. Run debugMyDay in the Apps Script editor and send the log.`)

function $m(n: Q, e: number): string {
  const t = n.events.today.ok ? n.events.today.data.filter((r: Q) => !r.allDay && Date.parse(r.end) > e).length : 0
  const i = n.deadlines.ok
    ? n.deadlines.data.filter((r: Q) => r.overdue || String(r.due).slice(0, 10) === n.today).length
    : 0
  const s = [
    t ? `${t} meeting${t === 1 ? '' : 's'} left today` : 'No more meetings today',
    i ? `${i} deadline${i === 1 ? '' : 's'} due or late` : '',
  ].filter(Boolean)
  return `${Df(Number(Wn(new Date(e).toISOString()).slice(0, 2)))}. ${s.join(', ')}.`
}

function Xm(n: string, e: any): Q {
  if (!e || typeof e !== 'object') throw Wo('came back empty from the server')
  const t = e
  if (n === 'core') {
    const i = t
    if (!i.events || !er(i.events.today) || !er(i.events.tomorrow) || !er(i.deadlines) || !er(i.focus))
      throw Wo('came back in an unexpected shape')
    i.settings = i.settings || {}
  } else if (!er(t[n])) throw Wo('came back in an unexpected shape')
  return e
}

const Xo = (n: string) => ({ ok: !1, error: n, data: [] })

function Uf(n: Q[], e: Q[]) {
  return [
    ...n.filter((i) => !i.allDay).map((i) => ({ kind: 'event', ev: i })),
    ...e.map((i) => ({ kind: 'gap', gap: i })),
  ].sort((i: any, s: any) =>
    (i.kind === 'event' ? i.ev.start : i.gap.start).localeCompare(s.kind === 'event' ? s.ev.start : s.gap.start)
  )
}

function Ym(n: Q, e: number) {
  const i = (n.events.today.ok ? Uf(n.events.today.data, []) : [])
    .map((a: any) => (a.kind === 'event' ? a.ev : null))
    .find((a) => a && Date.parse(a.end) > e)
  if (!i) return null
  const s = Date.parse(i.start) <= e
  const r = i.meeting?.kind === 'one_on_one'
  return {
    at: Wn(i.start),
    title: i.title,
    live: s,
    meta: r
      ? `1:1 with ${i.meeting?.person || 'your report'}, until ${Wn(i.end)}.`
      : [`Until ${Wn(i.end)}`, i.location].filter(Boolean).join(', ') + '.',
    action: r && i.meeting?.link ? { label: 'Start', href: i.meeting.link } : void 0,
  }
}

function qm(n: string, e: any, t: number): boolean {
  if (!e) return !1
  const i = Date.parse(n)
  return !isFinite(i) || t - i > Wm
}

/* ------------------------------------------------------------- components */
function Km({ events: n, nowMs: e }: { events: Q[]; nowMs: number }) {
  const t = useRef<HTMLDivElement | null>(null)
  useTh(t)
  const i = n.filter((a) => !a.allDay)
  if (!i.length) return null
  const s = i.filter((a) => Date.parse(a.end) <= e).length
  const r = (s / i.length) * 100
  return (
    <div ref={t} className="md-ring cc-chart" role="img" aria-label={`Today: ${s} of ${i.length} meetings done`}>
      <svg className="cc-ring" viewBox="0 0 36 36" aria-hidden="true">
        <circle className="md-ring__track" cx="18" cy="18" r="15.5" pathLength={100} />
        <circle
          className="md-ring__fill cc-sweep-ring"
          cx="18"
          cy="18"
          r="15.5"
          pathLength={100}
          style={{ '--len': 100, '--p': r / 100 } as React.CSSProperties}
        />
      </svg>
      <span className="md-ring__text" aria-hidden="true">
        <strong className="cx-num">
          {s}/{i.length}
        </strong>
        <span>meetings done</span>
      </span>
    </div>
  )
}

function Gr({ section: n, empty: e }: { section: Section; empty: string }) {
  return n ? (
    n.ok ? (
      n.data.length ? null : (
        <div className="empty">
          <div className="s">{e}</div>
        </div>
      )
    ) : (
      <p className="md-err">Could not load this part: {n.error}</p>
    )
  ) : (
    <div className="md-skel" aria-hidden="true" />
  )
}

function Jm({ ev: n }: { ev: Q }) {
  return (
    <li
      className={`md-ev ${n.myStatus === 'INVITED' || n.myStatus === 'MAYBE' ? 'is-tentative' : ''} ${
        n.meeting?.kind === 'one_on_one' ? 'is-1on1' : ''
      }`}
    >
      <span className="md-time">
        {Wn(n.start)}
        <span className="md-time-end">{Wn(n.end)}</span>
      </span>
      <div className="md-ev-body">
        <p className="md-ev-title">
          {n.meeting?.kind === 'one_on_one' ? <span className="md-1on1-tag">1:1</span> : null}
          {n.title}
        </p>
        {n.meeting?.kind === 'one_on_one' ? (
          <p className="md-ev-meta">
            {n.source === 'one_on_one'
              ? `Booked in the 1:1s page with ${n.meeting.person || 'your report'}, not in Calendar. `
              : `With ${n.meeting.person || 'your report'}. `}
            {n.meeting.link ? <a href={n.meeting.link}>Open the 1:1</a> : null}
          </p>
        ) : (
          <p className="md-ev-meta">
            {[n.location, n.guests ? `${n.guests} guest${n.guests === 1 ? '' : 's'}` : '', n.myStatus === 'INVITED' ? 'not answered yet' : '']
              .filter(Boolean)
              .join(', ')}
          </p>
        )}
        {n.meeting ? (
          (n.actions || []).length ? (
            <div className="md-actions">
              <p className="md-actions-h">
                {n.actions.length} open action{n.actions.length === 1 ? '' : 's'} from {n.meeting.label}
              </p>
              <ul>
                {(n.actions || []).map((e: Q) => (
                  <li key={e.id}>
                    <span className={`md-status md-status-${e.status}`}>{e.status}</span> {e.title}{' '}
                    <span className="md-owner">
                      {String(e.owner || '').split('@')[0]}, due {co(e.due)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="md-ev-meta">No open actions from {n.meeting.label}.</p>
          )
        ) : null}
      </div>
    </li>
  )
}

function Qm({ gap: n, onBooked: e }: { gap: Q; onBooked: () => void }) {
  const [t, i] = useState(!1)
  const [s, r] = useState('')
  const [a, o] = useState(!1)
  async function c() {
    i(!0)
    r('')
    try {
      await Fs.createFocusBlock(n.start, n.end, 'Focus time')
      o(!0)
      e()
    } catch (l) {
      r((l as Error).message)
    } finally {
      i(!1)
    }
  }
  return (
    <li className="md-gap">
      <span className="md-time">
        {Wn(n.start)}
        <span className="md-time-end">{Wn(n.end)}</span>
      </span>
      <div className="md-gap-body">
        <span>Free for {n.minutes} minutes</span>
        {a ? (
          <span className="md-booked">Booked as focus time</span>
        ) : (
          <Button className="btn btn-quiet md-book" onClick={() => void c()} disabled={t}>
            {t ? 'Booking…' : 'Book as focus time'}
          </Button>
        )}
        {s ? <span className="field-error">{s}</span> : null}
      </div>
    </li>
  )
}

function DaySection({ title: n, section: e, gaps: t, onBooked: i, compact: s }: {
  title: string
  section: Section
  gaps: Q[]
  onBooked: () => void
  compact?: boolean
}) {
  const r = e?.ok ? e.data.filter((o: Q) => o.allDay) : []
  const a = e?.ok ? Uf(e.data, t) : []
  return (
    <section className={`md-day ${s ? 'md-day-compact' : ''}`} aria-label={n}>
      <h2 className="md-h2">{n}</h2>
      {r.length ? <p className="md-allday">All day: {r.map((o: Q) => o.title).join('; ')}</p> : null}
      {e?.ok && !a.length ? (
        <p className="md-empty">No meetings and no free gaps left in your working hours.</p>
      ) : (
        <Gr section={e} empty="" />
      )}
      <ol className="md-agenda">
        {a.map((o: any) =>
          o.kind === 'event' ? <Jm key={o.ev.id} ev={o.ev} /> : <Qm key={o.gap.start} gap={o.gap} onBooked={i} />
        )}
      </ol>
    </section>
  )
}

function Zl({ label: n, tone: e, items: t, open: i }: { label: string; tone: string; items: Q[]; open?: boolean }) {
  return t.length ? (
    <details className={`md-mailgroup is-${e}`} open={i}>
      <summary>
        <span className="md-mailmark" aria-hidden="true">
          {e === 'starred' ? '★' : e === 'unread' ? '●' : '⌕'}
        </span>
        {n}
        <span className="md-mailcount">{t.length}</span>
      </summary>
      <ul className="worklist">
        {t.map((s) => (
          <li key={s.id} className="workitem">
            <div className="wi-main">
              <a className="wi-t" href={s.url} target="_blank" rel="noopener">
                {s.subject}
              </a>
              <div className="wi-s">
                {s.from}, {s.hoursWaiting} h
                {s.starred && s.unread ? ', also unread' : e === 'results' ? (s.starred ? ', starred' : s.unread ? ', unread' : '') : ''}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </details>
  ) : null
}

function Tg() {
  const [n, e] = useState('')
  const [t, i] = useState<Q | undefined>(void 0)
  return (
    <div className="md-mailsearch">
      <form
        onSubmit={(r) => {
          r.preventDefault()
          const a = n.trim()
          if (!a) {
            i(void 0)
            return
          }
          i({ q: a, busy: !0 })
          Fs.searchMail(a)
            .then((o: any) => i({ q: a, busy: !1, items: o }))
            .catch((o) => i({ q: a, busy: !1, error: o instanceof Error ? o.message : String(o) }))
        }}
        role="search"
      >
        <Input
          type="search"
          value={n}
          onInput={(r) => e((r.target as HTMLInputElement).value)}
          placeholder="Search mail, e.g. from:aramex"
          aria-label="Search mail"
        />
        <Button type="submit" disabled={t?.busy}>
          Search
        </Button>
      </form>
      {t?.busy ? <p className="md-sub">Searching…</p> : null}
      {t?.error ? <p className="md-err">{t.error}</p> : null}
      {t?.items && !t.items.length ? <p className="md-empty">No mail matches “{t.q}”.</p> : null}
      {t?.items?.length ? <Zl label={`Results for “${t.q}”`} tone="results" items={t.items} open={!0} /> : null}
    </div>
  )
}

function MailCard({ section: n, hours: e }: { section: Section; hours: number }) {
  return (
    <section className="card" aria-labelledby="md-mail">
      <div className="card-head">
        <div className="card-title" id="md-mail">
          Waiting for your reply
        </div>
        <div className="card-hint">Unread or starred in your inbox for more than {e} hours.</div>
      </div>
      <div className="card-pad">
        <Tg />
        <Gr section={n} empty="Nothing is waiting on you." />
        {n?.ok && n.data.length ? (
          <Ft>
            <Zl label="Starred" tone="starred" items={n.data.filter((t: Q) => t.starred)} />
            <Zl label="Unread" tone="unread" items={n.data.filter((t: Q) => t.unread && !t.starred)} />
            {n.data.some((t: Q) => t.unread && !t.starred) ? null : (
              <p className="md-empty">No unread mail waiting more than {e} hours.</p>
            )}
          </Ft>
        ) : null}
      </div>
    </section>
  )
}

function ih({ id: n, label: e, count: t, open: i, onToggle: s }: {
  id: string
  label: string
  count: number
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="card-head" id={n}>
      <button type="button" className="md-cardtoggle" aria-expanded={i} aria-controls={`${n}-body`} onClick={s}>
        <span className="card-title">{e}</span>
        {!i && t ? <span className="pill">{t}</span> : null}
      </button>
    </div>
  )
}

function useNh(n: string): [boolean, () => void] {
  const e = `md_open_${n}`
  const [t, i] = useState<boolean>(() => {
    try {
      return localStorage.getItem(e) !== '0'
    } catch {
      return !0
    }
  })
  return [
    t,
    () =>
      i((r) => {
        try {
          localStorage.setItem(e, r ? '0' : '1')
        } catch {
          /* storage unavailable */
        }
        return !r
      }),
  ]
}

function FilesCard({ section: n }: { section: Section }) {
  const [e, t] = useNh('files')
  return (
    <section className="card" aria-labelledby="md-files">
      {ih({ id: 'md-files', label: 'Recent files', count: n?.ok ? n.data.length : 0, open: e, onToggle: t })}
      {e ? (
        <div className="card-pad" id="md-files-body">
          <Gr section={n} empty="No files changed recently." />
          {n?.ok && n.data.length ? (
            <ul className="worklist">
              {n.data.map((i: Q) => (
                <li key={i.id} className="workitem">
                  <div className="wi-main">
                    <a className="wi-t" href={i.url} target="_blank" rel="noopener">
                      {i.name}
                    </a>
                    <div className="wi-s">
                      {wo(new Date(i.updatedAt))
                        ? new Date(i.updatedAt).toLocaleString('en-GB', {
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: bo,
                          })
                        : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function DeadlinesCard({ section: n }: { section: Section }) {
  const [e, t] = useNh('deadlines')
  return (
    <section className="card" aria-labelledby="md-dl">
      {ih({ id: 'md-dl', label: 'Deadlines this week', count: n?.ok ? n.data.length : 0, open: e, onToggle: t })}
      {e ? (
        <div className="card-pad" id="md-dl-body">
          <Gr section={n} empty="Nothing due in the next 7 days." />
          {n?.ok && n.data.length ? (
            <ul className="worklist">
              {n.data.map((i: Q) => (
                <li key={i.id} className="workitem">
                  <div className="wi-main">
                    <div className="wi-t">{i.title}</div>
                    <div className="wi-s">
                      {co(i.due)} · {i.mine ? 'You' : `Assigned to ${String(i.owner || '').split('@')[0]}`}
                    </div>
                  </div>
                  {i.overdue ? (
                    <div className="wi-side">
                      <span className="pill bad">Overdue</span>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function FollowUpsCard({ section: n }: { section: Section }) {
  const [e, t] = useNh('followups')
  const [i, s] = useState<Record<string, boolean>>({})
  const [r, a] = useState('')
  const o = (u: Q) => `${u.id}:${u.lastAtMs}`
  const c = n?.ok ? n.data.filter((u: Q) => !i[o(u)]) : []
  const l = (u: Q) => {
    const d = o(u)
    a('')
    s((p) => ({ ...p, [d]: !0 }))
    Fs.markFollowUpDone(u.id, u.lastAtMs).catch((p) => {
      s((g) => {
        const y = { ...g }
        delete y[d]
        return y
      })
      a(`“${u.subject}” was not marked done: ${p instanceof Error ? p.message : String(p)}`)
    })
  }
  const h = n?.ok ? { ...n, data: c } : n
  return (
    <section className="card" aria-labelledby="md-followups">
      {ih({ id: 'md-followups', label: 'Team lead follow-ups', count: c.length, open: e, onToggle: t })}
      {e ? (
        <div className="card-pad" id="md-followups-body">
          <p className="md-sub">Mails from your team leads to your manager that have no reply yet.</p>
          <Gr section={h} empty="No team lead mail is waiting on a reply." />
          {r ? (
            <p className="md-err" role="alert">
              {r}
            </p>
          ) : null}
          {c.length ? (
            <ul className="worklist">
              {c.map((u: Q) => (
                <li key={u.id} className={`workitem ${u.hoursWaiting >= 48 ? 'md-late' : u.hoursWaiting >= 24 ? 'md-warn' : ''}`}>
                  <div className="wi-main">
                    <a className="wi-t" href={u.url} target="_blank" rel="noopener">
                      {u.subject}
                    </a>
                    <div className="wi-s">
                      {u.from}, {u.hoursWaiting} h without a reply
                    </div>
                  </div>
                  <div className="wi-side">
                    <div className="t">{u.hoursWaiting} h</div>
                    <Button type="button" className="btn btn-quiet" onClick={() => l(u)}>
                      Done
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function SettingsCard({ day: n, onSaved: e }: { day: Q; onSaved: () => void }) {
  const [t, i] = useState(String(n.settings.assistant_reply_after_hours))
  const [s, r] = useState(String(n.settings.assistant_work_hours))
  const [a, o] = useState(String(n.settings.assistant_focus_min_minutes))
  const [c, l] = useState('')
  const [h, u] = useState('')
  async function d(g: React.FormEvent) {
    g.preventDefault()
    l('')
    u('')
    try {
      await Fs.setSettings({
        assistant_reply_after_hours: Number(t),
        assistant_work_hours: s.trim(),
        assistant_focus_min_minutes: Number(a),
      })
      l('Settings saved.')
      e()
    } catch (y) {
      u((y as Error).message)
    }
  }
  async function p() {
    l('')
    u('')
    try {
      l(await Fs.installDigest())
    } catch (g) {
      u((g as Error).message)
    }
  }
  return (
    <details className="card">
      <summary>
        <div className="card-head">
          <div className="card-title">Settings and morning email</div>
        </div>
      </summary>
      <div className="card-pad">
        <form onSubmit={(g) => void d(g)} className="md-settings-form">
          <label className="field-label" htmlFor="md-h">
            Mail counts as waiting after (hours)
          </label>
          <Input id="md-h" className="input" type="number" min={1} max={720} value={t} onInput={(g) => i((g.currentTarget as HTMLInputElement).value)} />
          <label className="field-label" htmlFor="md-w">
            Working hours, Kuwait time
          </label>
          <Input id="md-w" className="input" pattern="\d{1,2}:\d{2}-\d{1,2}:\d{2}" value={s} onInput={(g) => r((g.currentTarget as HTMLInputElement).value)} />
          <label className="field-label" htmlFor="md-m">
            Shortest focus block (minutes)
          </label>
          <Input id="md-m" className="input" type="number" min={15} max={240} value={a} onInput={(g) => o((g.currentTarget as HTMLInputElement).value)} />
          <Button type="submit" className="btn btn-primary">
            Save settings
          </Button>
        </form>
        <p className="md-sub">
          {n.digestInstalled
            ? 'The morning email is scheduled for about 07:30 Kuwait time.'
            : 'A summary of this page can be emailed to you at about 07:30 Kuwait time. It follows the email test-mode setting in Admin.'}
        </p>
        {n.digestInstalled ? null : (
          <Button type="button" className="btn btn-quiet" onClick={() => void p()}>
            Schedule the morning email
          </Button>
        )}
        {c ? (
          <p className="md-ok" role="status">
            {c}
          </p>
        ) : null}
        {h ? <p className="field-error">{h}</p> : null}
      </div>
    </details>
  )
}

function TimelineCard({ day, dayKey, nowMs }: { day: Q | null; dayKey: 'today' | 'tomorrow' | 'week'; nowMs: number }) {
  const rows: { key: string; sort: number; time: string; title: string; sub: string; now: boolean }[] = []
  // 'week' spans the API's two-day window (today + tomorrow).
  const keys = dayKey === 'week' ? (['today', 'tomorrow'] as const) : ([dayKey] as const)
  const tag = (date: string) =>
    dayKey !== 'week' ? '' : date === String(day?.today || '') ? 'Today · ' : date === String(day?.tomorrow || '') ? 'Tomorrow · ' : ''
  if (day) {
    for (const k of keys) {
      const section = day.events?.[k]
      if (section?.ok)
        section.data
          .filter((ev: Q) => !ev.allDay)
          .forEach((ev: Q) => {
            const s = Date.parse(ev.start)
            const e2 = Date.parse(ev.end)
            rows.push({
              key: 'ev-' + String(ev.id ?? ev.start),
              sort: s,
              time: Wn(ev.start),
              title: String(ev.title || ''),
              sub:
                tag(String(day[k] || '')) +
                [
                  ev.meeting?.kind === 'one_on_one'
                    ? `1:1 with ${ev.meeting.person || 'your report'}`
                    : ev.location,
                  ev.guests ? `${ev.guests} guest${ev.guests === 1 ? '' : 's'}` : '',
                ]
                  .filter(Boolean)
                  .join(' · '),
              now: isFinite(s) && s <= nowMs && nowMs < e2,
            })
          })
    }
    if (day.focus?.ok)
      day.focus.data
        .filter((g: Q) => (dayKey === 'week' ? !0 : Gm(g.start) === String(day[dayKey] || '')))
        .forEach((g: Q) => {
          const s = Date.parse(g.start)
          const e2 = Date.parse(g.end)
          rows.push({
            key: 'gap-' + String(g.start),
            sort: s,
            time: Wn(g.start),
            title: 'Focus window',
            sub: `${tag(Gm(g.start))}Free for ${g.minutes} minutes — book as focus time`,
            now: isFinite(s) && s <= nowMs && nowMs < e2,
          })
        })
    if (day.deadlines?.ok)
      day.deadlines.data
        .filter((d: Q) => (dayKey === 'week' ? !0 : String(d.due || '').slice(0, 10) === String(day[dayKey] || '')))
        .forEach((d: Q) => {
          rows.push({
            key: 'dl-' + String(d.id),
            sort: Number.MAX_SAFE_INTEGER,
            time: 'Due',
            title: String(d.title || ''),
            sub: `${tag(String(d.due || '').slice(0, 10))}Deadline · ${d.mine ? 'assigned to you' : `assigned to ${String(d.owner || '').split('@')[0]}`}`,
            now: false,
          })
        })
  }
  rows.sort((a, b) => a.sort - b.sort)
  return (
    <section className="card" aria-labelledby="md-timeline">
      <div className="card-head">
        <div className="card-title" id="md-timeline">
          {D('Timeline')}
        </div>
        <div className="card-hint">Kuwait time{isFinite(nowMs) ? ` · now ${Wn(nowMs)}` : ''}</div>
      </div>
      <div className="card-pad agenda">
        {rows.length ? (
          rows.map((r) => (
            <div className="ag-row" key={r.key}>
              <div className="ag-t">{r.time}</div>
              <div className={`ag-item${r.now ? ' now' : ''}`}>
                <div className="t">{r.title}</div>
                <div className="s">{r.sub}</div>
              </div>
            </div>
          ))
        ) : (
          <p className="md-empty">Nothing scheduled.</p>
        )}
      </div>
    </section>
  )
}

function WaitingCard({ mail, followups }: { mail: Section; followups: Section }) {
  const items: {
    key: string
    href: string
    ico: 'mail' | 'flag'
    tone: string
    title: string
    sub: string
    waited: number
    kind: 'mail' | 'followup'
  }[] = []
  if (mail?.ok)
    mail.data.forEach((m: Q) => {
      const h = Number(m.hoursWaiting) || 0
      items.push({
        key: `mail-${m.id}`,
        href: String(m.url || '#'),
        ico: 'mail',
        tone: h >= 48 ? 'bad' : h >= 24 ? 'warn' : 'info',
        title: String(m.subject || ''),
        sub: [m.from, `${h} h waiting`, m.starred ? 'starred' : '', m.unread ? 'unread' : '']
          .filter(Boolean)
          .join(' · '),
        waited: h,
        kind: 'mail',
      })
    })
  if (followups?.ok)
    followups.data.forEach((f: Q) => {
      const h = Number(f.hoursWaiting) || 0
      items.push({
        key: `fu-${f.id}`,
        href: String(f.url || '#'),
        ico: 'flag',
        tone: h >= 48 ? 'bad' : h >= 24 ? 'warn' : 'info',
        title: String(f.subject || ''),
        sub: [f.from, `${h} h without a reply`].filter(Boolean).join(' · '),
        waited: h,
        kind: 'followup',
      })
    })
  items.sort((a, b) => b.waited - a.waited)
  const loading = !mail && !followups
  return (
    <section className="card" aria-labelledby="md-waiting">
      <div className="card-head">
        <div className="card-title" id="md-waiting">
          {D('Waiting on you')}
        </div>
        <div className="card-hint">{D('From other people')}</div>
      </div>
      {loading ? (
        <div className="card-pad">
          <div className="md-skel" aria-hidden="true" />
        </div>
      ) : items.length ? (
        <div className="worklist">
          {items.map((it) => (
            <a key={it.key} className="workitem" href={it.href} target="_blank" rel="noopener">
              <span className={`wi-ico ${it.tone}`} aria-hidden="true">
                {it.ico === 'mail' ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <path d="M4 21V4" />
                    <path d="M4 4h13l-2.5 4L17 12H4" />
                  </svg>
                )}
              </span>
              <div className="wi-main">
                <div className="wi-t">{it.title}</div>
                <div className="wi-s">{it.sub}</div>
              </div>
              <div className="wi-side">
                <div className="t">{it.waited} h</div>
                <div className="s">{it.kind === 'mail' ? D('waiting') : D('no reply')}</div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="card-pad">
          <div className="empty">
            <div className="s">{D('Nothing is waiting on you.')}</div>
          </div>
        </div>
      )}
    </section>
  )
}

function FocusBlocksCard({ day, dayKey, nowMs, onBooked }: {
  day: Q | null
  dayKey: 'today' | 'tomorrow' | 'week'
  nowMs: number
  onBooked: () => void
}) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [done, setDone] = useState<Record<string, boolean>>({})
  const date = String(day?.[dayKey === 'week' ? 'today' : dayKey] || '')
  const raw: Q[] = day?.focus?.ok
    ? dayKey === 'week'
      ? day.focus.data
      : day.focus.data.filter((g: Q) => Gm(g.start) === date)
    : []
  const gaps = raw
    .map((g) => ({ g, s: Date.parse(g.start), e: Date.parse(g.end) }))
    .sort((a, b) => a.s - b.s)
  async function book(key: string, g: Q) {
    setBusy(key)
    setErr('')
    try {
      await Fs.createFocusBlock(g.start, g.end, 'Focus time')
      setDone((d) => ({ ...d, [key]: !0 }))
      onBooked()
    } catch (l) {
      setErr((l as Error).message)
    } finally {
      setBusy('')
    }
  }
  return (
    <section className="card" aria-labelledby="md-focus">
      <div className="card-head">
        <div className="card-title" id="md-focus">
          {D('Focus blocks')}
        </div>
        <div className="card-hint">
          {gaps.length} {D('free')}
        </div>
      </div>
      <div className="card-pad">
        {!day ? (
          <div className="md-skel" aria-hidden="true" />
        ) : gaps.length ? (
          gaps.map(({ g, s, e }, idx) => {
            const key = String(g.start)
            const isNow = isFinite(s) && s <= nowMs && nowMs < e
            return (
              <div key={key}>
                {idx ? <hr className="hr" style={{ margin: '.7rem 0' }} /> : null}
                <div className="between small">
                  <span>
                    <b>
                      {Wn(g.start)}–{Wn(g.end)}
                    </b>{' '}
                    · {D('Focus window')}
                    {g.minutes ? ` · ${g.minutes} min` : ''}
                  </span>
                  <span className="flex">
                    {done[key] ? (
                      <span className="pill ok">{D('booked')}</span>
                    ) : isNow ? (
                      <span className="pill acc">{D('now')}</span>
                    ) : (
                      <span className="pill">{D('free')}</span>
                    )}
                    {done[key] ? null : (
                      <Button
                        type="button"
                        className="btn btn-quiet"
                        onClick={() => void book(key, g)}
                        disabled={busy === key}
                      >
                        {busy === key ? D('Booking…') : D('Book')}
                      </Button>
                    )}
                  </span>
                </div>
              </div>
            )
          })
        ) : (
          <div className="empty">
            <div className="s">{D('No free focus windows.')}</div>
          </div>
        )}
        {err ? <p className="field-error">{err}</p> : null}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------- Zm */
export function MyDayPage({ route: n }: { route: { title: string } }) {
  const [pd, setPd] = useState<'today' | 'week'>('today')
  const [bb, setBb] = useState(!1)
  const [e, t] = useState<Q | null>(null)
  const [i, s] = useState<Section>(void 0)
  const [r, a] = useState<Section>(void 0)
  const [o, c] = useState<Section>(void 0)
  const [l, h] = useState<Record<string, string>>({})
  const [u, d] = useState('')
  const [p, g] = useState<Record<string, boolean>>({})
  const [y, v] = useState(!1)
  const m = useRef(!0)
  const E = useRef(0)
  const C = (D: string, L: boolean): Promise<void> => {
    if (L) g((I) => ({ ...I, [D]: !0 }))
    E.current++
    const H = setTimeout(() => m.current && v(!0), Vm)
    return Fs.myDayPart(D, L)
      .then((I) => Xm(D, I))
      .then((I) => {
        if (!m.current) return
        h((O) => ({ ...O, [D]: I.generatedAt }))
        if (D === 'core') {
          t(I)
          d('')
        } else if (D === 'mail') s(I.mail)
        else if (D === 'followups') c(I.followups)
        else a(I.files)
        if (!L && qm(I.generatedAt, I.cached, Date.now())) void C(D, !0)
      })
      .catch((I) => {
        if (!m.current) return
        const O = (I as Error).message || 'My day could not be loaded.'
        if (D === 'core') d(O)
        else if (D === 'mail') s((k) => (k && L ? k : Xo(O)))
        else if (D === 'followups') c((k) => (k && L ? k : Xo(O)))
        else a((k) => (k && L ? k : Xo(O)))
      })
      .finally(() => {
        clearTimeout(H)
        E.current--
        if (m.current && E.current <= 0) v(!1)
        if (L && m.current) g((I) => ({ ...I, [D]: !1 }))
      })
  }
  const x = () => ta.forEach((D) => void C(D, !0))
  useEffect(() => {
    m.current = !0
    ta.forEach((D) => void C(D, !1))
    return () => {
      m.current = !1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const b = ta.some((D) => p[D])
  if (u && !e)
    return (
      <section className="page md-page" aria-labelledby="page-title">
        <h1 id="page-title" className="page-title">
          {n.title}
        </h1>
        <p className="md-refused" role="alert">
          {u}
        </p>
        <Button type="button" className="btn btn-primary" disabled={b} onClick={() => void C('core', !0)}>
          {b ? 'Trying again…' : 'Try again'}
        </Button>
      </section>
    )
  const w = e
  const S = ta.map((D) => l[D]).filter((D) => !!D).sort()[0]
  // eslint-disable-next-line react-hooks/purity -- verbatim legacy port: the closure calls Date.now() in render for the staleness text
  const _ = Date.now()
  const T = w ? Ym(w, _) : null
  const R = (D: string) => (w?.focus.ok ? w.focus.data.filter((L: Q) => Gm(L.start) === D) : [])
  // 'week' scope is the API's two-day window: compose both days' gaps.
  const openGaps = w?.focus?.ok
    ? R(w.today)
        .concat(R(w.tomorrow))
        .filter((g: Q) => !g.booked)
        .sort((a: Q, b: Q) => Date.parse(a.start) - Date.parse(b.start))
    : []
  async function bookFirst() {
    const g = openGaps[0]
    if (!g) return
    setBb(!0)
    d('')
    try {
      await Fs.createFocusBlock(g.start, g.end, 'Focus time')
      void C('core', !0)
    } catch (l) {
      d((l as Error).message || 'Focus block could not be booked.')
    } finally {
      setBb(!1)
    }
  }
  return (
    <section className="page md-page" aria-labelledby="page-title">
      <header className="page-head md-head">
        <div>
          <p className="kicker">{w ? Hm(w.today) : ' '}</p>
          <h1 id="page-title" className="page-title">
            {n.title}
          </h1>
          {w ? <p className="page-sub">{$m(w, _)}</p> : null}
        </div>
        <div className="page-actions md-head-actions">
          <Button
            type="button"
            className="btn btn-primary"
            disabled={!w || !openGaps.length || bb}
            onClick={() => void bookFirst()}
          >
            {bb ? D('Booking…') : D('Book focus block')}
          </Button>
          <div className="seg" role="group" aria-label={D('Agenda range')}>
            <button
              type="button"
              className={pd === 'today' ? 'on' : ''}
              aria-pressed={pd === 'today'}
              onClick={() => setPd('today')}
            >
              {D('Today')}
            </button>
            <button
              type="button"
              className={pd === 'week' ? 'on' : ''}
              aria-pressed={pd === 'week'}
              onClick={() => setPd('week')}
            >
              {D('Week')}
            </button>
          </div>
          {w?.events.today.ok ? <Km events={w.events.today.data} nowMs={_} /> : null}
          {T ? <If item={T} /> : null}
          {S ? (
            <span className="md-fresh" role="status">
              {b ? `Showing ${Wn(S)}, updating…` : `Updated ${Wn(S)}`}
            </span>
          ) : null}
          <Button type="button" className="btn btn-quiet" onClick={x} disabled={!w || b}>
            {b ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </header>
      {u && w ? (
        <p className="md-banner" role="alert">
          {u}
        </p>
      ) : null}
      {y && !u ? (
        <p className="md-banner" role="status">
          {w ? 'Still refreshing' : 'Still loading'}: reading your calendar, inbox and Drive can take
          a while. If nothing changes, run debugMyDay in the Apps Script editor and send the log.
        </p>
      ) : null}
      <div className="md-layout">
        <div className="md-main">
          {w ? <TimelineCard day={w} dayKey={pd} nowMs={_} /> : null}
          {T ? <Nf item={T} /> : null}
          <DaySection title="Today" section={w?.events.today} gaps={w ? R(w.today) : []} onBooked={() => void C("core", !0)} />
          <DaySection
            title={w ? `Tomorrow, ${co(w.tomorrow)}` : 'Tomorrow'}
            section={w?.events.tomorrow}
            gaps={w ? R(w.tomorrow) : []}
            onBooked={() => void C('core', !0)}
            compact={!0}
          />
        </div>
        <aside className="md-side">
          <WaitingCard mail={i} followups={o} />
          <FocusBlocksCard day={w} dayKey={pd} nowMs={_} onBooked={() => void C('core', !0)} />
          <DeadlinesCard section={w?.deadlines} />
          <FollowUpsCard section={o} />
          <MailCard section={i} hours={Number(w?.settings.assistant_reply_after_hours ?? 24)} />
          <FilesCard section={r} />
          {w ? <SettingsCard day={w} onSaved={x} /> : null}
        </aside>
      </div>
    </section>
  )
}
export default MyDayPage
