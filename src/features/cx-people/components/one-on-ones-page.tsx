'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy 1:1s page (one-on-ones.closure.js symbol jl,
 * with Gl/Ql/Yl/Vl/Kl/Xl/Jl/Zl/ls/ea and the oo-* context widgets). */
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { fetchJson, useSe } from './shared'
import {
  PwShell,
  PwLate,
  PwSkel,
  PwErr,
  PwCombo,
  PwDialog,
  PwDelta,
  useBusy,
  normTask,
  dayLabel,
  dayTime,
  kwDate,
  kwHm,
  today,
  addDays,
  inputDT,
  hashParam,
  routeOf,
  appLink,
  toast,
  prefersReducedMotion,
} from './pw'
import { useBootSelector, getBoot } from '@/features/shared/shell/context'
import { Button, Input, Select, Textarea } from '@/features/shared/components/ui'

/* I — the one-on-ones + tasks facade. */
const api = {
  oneOnOnesPage: () => fetchJson('/api/people/one-on-ones'),
  oneOnOnesStart: (reportEmail: string) =>
    fetchJson(`/api/people/one-on-ones/start?reportEmail=${encodeURIComponent(reportEmail)}`),
  oneOnOnesSubmit: (record: Record<string, unknown>) => fetchJson('/api/people/one-on-ones', record),
  oneOnOnesGetLog: (logId: string) =>
    fetchJson(`/api/people/one-on-ones/log?logId=${encodeURIComponent(logId)}`),
  oneOnOnesProductivity: (reportEmail: string, from: string, to: string) =>
    fetchJson(
      `/api/people/one-on-ones/productivity?reportEmail=${encodeURIComponent(reportEmail)}&from=${from}&to=${to}`
    ),
  oneOnOnesSchedule: (reportEmail: string, when: string, durationMin: number) =>
    fetchJson('/api/people/one-on-ones/schedule', { op: 'book', reportEmail, when, durationMin }),
  oneOnOnesReschedule: (scheduleId: string, when: string, reason: string) =>
    fetchJson('/api/people/one-on-ones/schedule', { op: 'reschedule', scheduleId, when, reason }),
  oneOnOnesMarkNotHeld: (scheduleId: string, reason: string, newWhen: string) =>
    fetchJson('/api/people/one-on-ones/schedule', { op: 'not_held', scheduleId, reason, newWhen }),
  oneOnOnesDeletePreview: (logId: string) =>
    fetchJson('/api/people/one-on-ones/delete', { op: 'preview', logId }),
  oneOnOnesDeleteLog: (logId: string, reason: string) =>
    fetchJson('/api/people/one-on-ones/delete', { op: 'log', logId, reason }),
  oneOnOnesDeleteBooking: (scheduleId: string, reason: string) =>
    fetchJson('/api/people/one-on-ones/delete', { op: 'booking', scheduleId, reason }),
  oneOnOnesRestore: (type: string, id: string) =>
    fetchJson('/api/people/one-on-ones/restore', { type, id }),
  tasksCreate: (input: Record<string, unknown>) => fetchJson('/api/people/tasks', input),
  tasksSetStatus: (actionId: string, status: string, info: Record<string, unknown>) =>
    fetchJson('/api/people/tasks/status', { actionId, status, info }),
  tasksEditDetails: (actionId: string, patch: Record<string, unknown>) =>
    fetchJson('/api/people/tasks/details', { actionId, ...patch }),
  tasksPostMilestone: (actionId: string, milestone: Record<string, unknown>) =>
    fetchJson('/api/people/tasks/milestone', { actionId, ...milestone }),
}

/* ---------------------------------------------- shared oo formatting */
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
/** Pt(ym) — "January" for a YYYY-MM(-DD) string. */
const monthName = (t: string) => MONTH_FULL[Number(t.slice(5, 7)) - 1] ?? t
/** ke(value, floor) — data-band for a percentage. */
const bandOf = (t: number | null, n = 75) => (t === null ? 'none' : t >= 90 ? 'ok' : t >= n ? 'warn' : 'bad')
/** se(t) — "75%" or "–". */
const pct = (t: number | null) => (t === null ? '–' : `${t}%`)
/** Cl(hours) — "2 d" or "5 h". */
const ageH = (t: number) => (t >= 48 ? `${Math.floor(t / 24)} d` : `${Math.round(t)} h`)
/** Ll / ql — check-in slot states. */
const SLOT_LABELS: Record<string, string> = { done: 'Done', due: 'Due now', upcoming: 'Later', missed: 'Missed' }
const SLOT_TONES: Record<string, string | undefined> = { done: 'ok', due: 'warn', missed: 'bad', upcoming: undefined }
const DOES_NOT_FIT = 'DOES_NOT_FIT:' // Ze
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩' // Js
const NUM_RE = /^(\D*?)(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\D*)$/ // el

/** hn() — Arabic-Indic digits when the document is in Arabic. */
function localizeNum(t: string) {
  if (typeof document === 'undefined' || document.documentElement.lang !== 'ar') return t
  return t
    .replace(/(\d)([.,])(?=\d)/g, (_m, d, p) => d + (p === '.' ? '٫' : '٬'))
    .replace(/\d/g, (d) => AR_DIGITS[+d])
}

/* ---------------------------------------------- Zs/he/mn — count-up */
function useCountUp(target: number | null) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const started = useRef(false)
  const [k, setK] = useState(1)
  useEffect(() => {
    if (started.current || target === null || target === 0 || prefersReducedMotion() || document.hidden) return
    started.current = true
    setK(0)
    let raf = 0
    let timer = 0
    const begin = () => {
      const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / 900)
        setK(p)
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      timer = window.setTimeout(() => {
        cancelAnimationFrame(raf)
        setK(1)
      }, 900 + 100)
    }
    const el = ref.current
    const io =
      el && typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            if (entries.some((en) => en.isIntersecting)) {
              io?.disconnect()
              begin()
            }
          })
        : null
    if (io && el) io.observe(el)
    else begin()
    return () => {
      io?.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      setK(1)
    }
  }, [target])
  return { ref, k, ease: 1 - (1 - k) ** 3 }
}

function AnimSpan({ live, final, spanRef }: { live: string; final: string; spanRef: React.Ref<HTMLSpanElement> }) {
  return (
    <>
      <span ref={spanRef} aria-hidden="true">
        {localizeNum(live)}
      </span>
      <span className="sr-only">{localizeNum(final)}</span>
    </>
  )
}

/** he() — animates a number string up to its final value on first view. */
function CountUp({ v }: { v: string | number | null | undefined }) {
  const s = v == null ? '' : String(v)
  const m = NUM_RE.exec(s)
  const num = m ? Number(m[2] + m[3].replace(/,/g, '') + (m[4] ?? '')) : null
  const { ref, k, ease } = useCountUp(num)
  if (!m || num === null || k >= 1) return <AnimSpan live={s} final={s} spanRef={ref} />
  const dec = m[4] ? m[4].length - 1 : 0
  const shown = (num * ease).toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
    useGrouping: m[3].includes(','),
  })
  return <AnimSpan live={m[1] + shown + m[5]} final={s} spanRef={ref} />
}

/* ------------------------------------------------- ns/ss — tickets */
function OoTickets({ rows, url, showAgent }: { rows: any[]; url?: string; showAgent?: boolean }) {
  if (!rows.length) return null
  return (
    <ul className="oo-tickets">
      {rows.map((r) => (
        <li key={r.id}>
          <a href={url ? url + r.id : undefined} target="_blank" rel="noopener noreferrer">
            #{r.id}
          </a>
          <span>
            {r.queue}
            {showAgent && r.agent ? `, ${r.agent}` : ''}
          </span>
          <span className="oo-age" data-band={r.band}>
            {ageH(r.ageH)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function OoStats({ a, bands }: { a: any; bands: string[] }) {
  const top = bands[bands.length - 1] ?? 'oldest band'
  const next = bands[bands.length - 2] ?? 'next band'
  return (
    <div className="oo-stats">
      <div>
        <b>
          <CountUp v={a.open} />
        </b>{' '}
        open
      </div>
      <div data-band={a.overTop ? 'bad' : 'ok'}>
        <b>
          <CountUp v={a.overTop} />
        </b>{' '}
        {top}
      </div>
      <div data-band={a.nearTop ? 'warn' : 'ok'}>
        <b>
          <CountUp v={a.nearTop} />
        </b>{' '}
        {next}
      </div>
    </div>
  )
}

/* -------------------------------------------------- Bl — their team */
function TeamBlock({ ctx, name }: { ctx: any; name: string }) {
  const team = ctx.team
  return (
    <section className="oo-block" aria-labelledby="oo-team-h">
      <h2 id="oo-team-h" className="oo-h">
        Their team
      </h2>
      {team.headcount ? (
        <>
          <div className="oo-stats">
            <div>
              <b>
                <CountUp v={team.headcount} />
              </b>{' '}
              agent{team.headcount === 1 ? '' : 's'}
            </div>
            <div data-band={team.scored ? 'ok' : undefined}>
              <b>
                <CountUp v={team.scored} />
              </b>{' '}
              with scorecard figures
            </div>
            <div data-band={team.belowFloor ? 'bad' : 'ok'}>
              <b>
                <CountUp v={team.belowFloor} />
              </b>{' '}
              under {ctx.floor}% on one
            </div>
          </div>
          <h3 className="oo-h3">Agents, weakest first (lowest of productivity, quality, FCR)</h3>
          <div className="oo-scroll">
            <table className="oo-table">
              <thead>
                <tr>
                  <th scope="col">Agent</th>
                  <th scope="col">Prod</th>
                  <th scope="col">Quality</th>
                  <th scope="col">FCR</th>
                  <th scope="col">Queue 7 d</th>
                  <th scope="col">Tickets</th>
                  <th scope="col">Last 1:1</th>
                </tr>
              </thead>
              <tbody>
                {team.agents.map((a: any) => (
                  <tr key={a.email}>
                    <th scope="row">
                      {a.name}
                      {a.lowest === null ? <span className="oo-fine">No scorecard figures yet</span> : null}
                      {a.behaviorCases ? (
                        <span className="oo-fine">
                          {a.behaviorCases} behaviour case{a.behaviorCases === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </th>
                    {(
                      [
                        ['prod', 'prodLast'],
                        ['qual', 'qualLast'],
                        ['fcr', 'fcrLast'],
                      ] as const
                    ).map(([k, kLast]) => (
                      <td key={k} data-band={bandOf(a[k], ctx.floor)}>
                        {a[k] === null ? <span className="oo-muted">–</span> : `${a[k]}%`}
                        <PwDelta now={a[k]} before={a[kLast]} unit="" />
                      </td>
                    ))}
                    <td data-band={bandOf(a.prod7)}>
                      {pct(a.prod7)}
                      <PwDelta now={a.prod7} before={a.prodPrev7} unit="" />
                    </td>
                    <td>
                      {a.open}
                      {a.overTop ? <span className="oo-fine oo-bad">{a.overTop} oldest</span> : null}
                    </td>
                    <td className="oo-muted">{a.lastOneOnOne ? dayLabel(a.lastOneOnOne) : 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="oo-fine">
            Productivity, quality and FCR are this month on the scorecard, with the change on last month. Queue 7 d is
            productive time over the last 7 days, with the change on the 7 before.
          </p>
          <h3 className="oo-h3">Team tickets</h3>
          <OoStats a={team.aging} bands={ctx.bands} />
          {team.overTopByQueue.length ? (
            <p className="oo-fine">
              Oldest band by queue: {team.overTopByQueue.map((q: any) => `${q.queue} ${q.count}`).join(', ')}.
            </p>
          ) : null}
          <OoTickets rows={team.aging.oldest} url={ctx.ticketUrl} showAgent />
          {team.noAgent ? (
            <p className="oo-fine">
              {team.noAgent} ticket{team.noAgent === 1 ? '' : 's'} in the two oldest bands with no agent (all teams, as on
              Home).
            </p>
          ) : null}
          {team.flags.length ? (
            <>
              <h3 className="oo-h3">Agents asking for help on aged tickets</h3>
              <ul className="oo-flags">
                {team.flags.map((f: any) => (
                  <li key={f.ticketId + f.at}>
                    <a href={ctx.ticketUrl ? ctx.ticketUrl + f.ticketId : undefined} target="_blank" rel="noopener noreferrer">
                      #{f.ticketId}
                    </a>{' '}
                    <b>{f.by}</b>: {f.note}
                    <span className="oo-fine">{dayTime(f.at)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <h3 className="oo-h3">Check-ins today</h3>
          {team.slots.length ? (
            <ul className="oo-slots">
              {team.slots.map((sl: any) => (
                <li key={sl.slot}>
                  <span>{sl.slot}</span>
                  <span className={SLOT_TONES[sl.state] ? `pill ${SLOT_TONES[sl.state]}` : 'pill'}>
                    {SLOT_LABELS[sl.state] ?? sl.state}
                  </span>
                  {sl.submittedBy ? <span className="oo-fine">{sl.submittedBy}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="oo-none">Today&apos;s check-in slots could not be read.</p>
          )}
          <h3 className="oo-h3">{name}&apos;s 1:1s with the team</h3>
          <p className="oo-fine">
            {team.oneOnOnes.overdue
              ? `${team.oneOnOnes.overdue} agent${team.oneOnOnes.overdue === 1 ? '' : 's'} with no 1:1 in ${team.oneOnOnes.cadenceDays + 3} days. `
              : `Every agent had a 1:1 in the last ${team.oneOnOnes.cadenceDays + 3} days. `}
            {team.oneOnOnes.missed30
              ? `${team.oneOnOnes.missed30} missed in the last 30 days.`
              : 'None missed in the last 30 days.'}
          </p>
        </>
      ) : (
        <p className="oo-none">
          No agents report to {name} on the Roster, so there are no team numbers. An admin can set each agent&apos;s team
          lead under Admin.
        </p>
      )}
    </section>
  )
}

/* ----------------------------------- st/ll — entrance anim + tooltip */
const ENTER_MS = 820

/** st(ref) — adds .is-in then .is-done to the element for the sweep-in. */
function useOoEnter(ref: React.RefObject<HTMLElement | null>) {
  const stage = useRef(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (stage.current) {
      el.classList.add('is-in')
      if (stage.current === 2) el.classList.add('is-done')
      return
    }
    if (document.hidden || prefersReducedMotion()) {
      stage.current = 2
      el.classList.add('is-in', 'is-done')
      return
    }
    stage.current = 1
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')))
    setTimeout(() => {
      stage.current = 2
      el.classList.add('is-in', 'is-done')
    }, ENTER_MS)
  })
}

/** ll() — the cc-tip floating tooltip for charts. */
function useOoTip() {
  const ref = useRef<HTMLElement | null>(null)
  useOoEnter(ref as React.RefObject<HTMLElement | null>)
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  const show = (text: string) => (e: React.SyntheticEvent) => {
    const host = ref.current
    if (!host) return
    const m = e.currentTarget.getBoundingClientRect()
    const u = host.getBoundingClientRect()
    setTip({
      text,
      x: Math.max(64, Math.min(u.width - 64, m.left + m.width / 2 - u.left)),
      y: Math.max(0, m.top - u.top),
    })
  }
  const hide = () => setTip(null)
  const tipFor = (label: string) => ({
    'aria-label': label,
    onPointerEnter: show(label),
    onFocus: show(label),
    onPointerLeave: hide,
    onBlur: hide,
  })
  const tipEl = tip ? (
    <span className="cc-tip" aria-hidden="true" style={{ left: `${tip.x}px`, top: `${tip.y}px` }}>
      {tip.text}
    </span>
  ) : null
  return { ref, tipFor, tipEl }
}

/** sl() — "▲ +12% vs prev". */
function vsPrev(now: number | null, before: number | null | undefined) {
  if (now == null || before == null || !before) return ''
  const d = Math.round(((now - before) / Math.abs(before)) * 100)
  return d === 0 ? 'Same as prev' : `${d > 0 ? '▲ +' : '▼ −'}${Math.abs(d)}% vs prev`
}

/* --------------------------------------------------- $l — oo-spark */
function OoSpark({ points, floor }: { points: { date: string; value: number | null }[]; floor: number }) {
  const { ref, tipFor, tipEl } = useOoTip()
  const W = 132
  const H = 30
  const n = points.length
  const x = (i: number) => Math.round((i / (n - 1)) * (W - 4)) + 2
  const y = (v: number) => Math.round(H - 2 - (Math.max(0, Math.min(100, v)) / 100) * (H - 4))
  const paths: string[] = []
  let cur = ''
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur) paths.push(cur)
      cur = ''
      return
    }
    cur += `${cur ? 'L' : 'M'}${x(i)},${y(p.value)}`
  })
  if (cur) paths.push(cur)
  const last = [...points].reverse().find((p) => p.value !== null)
  const lastIdx = last ? points.lastIndexOf(last) : -1
  const vals = points.filter((p) => p.value !== null)
  if (n < 2 || !vals.length) return <span className="oo-fine">Not enough days for a trend yet.</span>
  const tip = [`${last!.date.slice(5)}: ${last!.value}%`, vsPrev(last!.value, vals[vals.length - 2]?.value)]
    .filter(Boolean)
    .join(', ')
  return (
    <span className="oo-spark cc-chart" ref={ref as React.Ref<HTMLSpanElement>}>
      {tipEl}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        tabIndex={0}
        {...tipFor(`Daily trend over ${n} days: ${vals.map((p) => `${p.date.slice(5)} ${p.value}%`).join(', ')}. ${tip}`)}
        aria-label={`Daily trend over ${n} days: ${vals.map((p) => `${p.date.slice(5)} ${p.value}%`).join(', ')}. ${tip}`}
      >
        <line x1="2" x2={W - 2} y1={y(floor)} y2={y(floor)} className="oo-spark-floor" />
        {paths.map((d) => (
          <path key={d} d={d} className="oo-spark-line cc-sweep-line" pathLength={1} />
        ))}
        <circle
          cx={x(lastIdx)}
          cy={y(last!.value!)}
          r="2.5"
          className="oo-spark-dot cc-sweep-fade"
          data-band={bandOf(last!.value, floor)}
        />
      </svg>
    </span>
  )
}

/* ------------------------- Dl/Pl/El — the scorecard + period widgets */
function factLines(metric: string, c: any): string[] {
  // Il()
  if (metric === 'prod')
    return [
      `${c.totalAchieved} of ${c.totalTarget} target, ${c.days} day${c.days === 1 ? '' : 's'}`,
      c.inbTarget ? `Inbound ${pct(c.inbProd)} (${c.inbAchieved} of ${c.inbTarget})` : '',
      c.txtTarget ? `Texting ${pct(c.txtProd)} (${c.txtAchieved} of ${c.txtTarget})` : '',
      c.waTarget ? `Waiting address ${pct(c.waProd)} (${c.waAchieved} of ${c.waTarget})` : '',
    ].filter(Boolean)
  if (metric === 'qual')
    return [c.qual === null ? 'No audits in this period' : `Average over ${c.audits} audit${c.audits === 1 ? '' : 's'}`]
  return [
    c.fcr === null
      ? 'No FCR checks in this period'
      : `${c.fcrPassed} of ${c.fcrPassed + c.fcrFailed} checked contacts resolved first time`,
  ]
}

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'week', label: 'This week' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'custom', label: 'Custom dates' },
]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Se(from, to) — "3 Feb 2026" / "3-9 Feb 2026" / "30 Jan - 2 Feb 2026". */
function periodLabel(a: string, b: string) {
  const d = (t: string) => Number(t.slice(8))
  const m = (t: string) => MONTHS[Number(t.slice(5, 7)) - 1]
  const yr = (t: string) => t.slice(0, 4)
  if (a === b) return `${d(a)} ${m(a)} ${yr(a)}`
  if (a.slice(0, 7) === b.slice(0, 7)) return `${d(a)}-${d(b)} ${m(b)} ${yr(b)}`
  if (yr(a) === yr(b)) return `${d(a)} ${m(a)} - ${d(b)} ${m(b)} ${yr(b)}`
  return `${d(a)} ${m(a)} ${yr(a)} - ${d(b)} ${m(b)} ${yr(b)}`
}

/** _n(metric, periodData) — the metric's headline number for a period. */
const metricVal = (metric: string, d: any) =>
  metric === 'prod' ? (d.days ? d.prod : null) : metric === 'qual' ? d.qual : d.fcr

/** yt(id, today) — the [from,to] a preset resolves to. */
function periodRange(id: string, now: string): [string, string] {
  const dow = new Date(now + 'T00:00:00Z').getUTCDay()
  const first = now.slice(0, 8) + '01'
  switch (id) {
    case 'today':
      return [now, now]
    case 'last7':
      return [addDays(now, -6), now]
    case 'week':
      return [addDays(now, -dow), now]
    case 'last30':
      return [addDays(now, -29), now]
    case 'lastMonth': {
      const prev = addDays(first, -1)
      return [prev.slice(0, 8) + '01', prev]
    }
    default:
      return [first, now]
  }
}

/** Dl() — one metric's period picker + numbers inside an oo-param. */
function PeriodMetric({
  metric,
  label,
  report,
  today: now,
  floor,
}: {
  metric: string
  label: string
  report: string
  today: string
  floor: number
}) {
  const [pick, setPick] = useState('month')
  const [custom, setCustom] = useState<[string, string]>(() => periodRange('last7', now))
  const [range, setRange] = useState<[string, string]>(() => periodRange('month', now))
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState('')
  /* Reset stale results when the requested window changes (render-adjust;
   * the closure reset inside the effect). */
  const [from, to] = range
  const reqKey = `${report}|${from}|${to}`
  const [seenReq, setSeenReq] = useState('')
  if (reqKey !== seenReq) {
    setSeenReq(reqKey)
    setData(null)
    setErr('')
  }
  useEffect(() => {
    let live = true
    api.oneOnOnesProductivity(report, from, to).then(
      (d) => live && setData(d),
      (e) => live && setErr(e.message)
    )
    return () => {
      live = false
    }
  }, [report, from, to])
  const choose = (id: string) => {
    setPick(id)
    if (id !== 'custom') setRange(periodRange(id, now))
  }
  const loaded = !!data && data.from === range[0] && data.to === range[1]
  const cur = loaded ? data.current : null
  const prev = loaded ? data.previous : null
  const now_ = cur ? metricVal(metric, cur) : null
  const before = prev ? metricVal(metric, prev) : null
  const fcrNote = metric === 'fcr' && loaded && !!data.fcrNote
  return (
    <div className="oo-period">
      <div className="oo-period-bar">
        <label className="oo-period-pick">
          <span className="sr-only">{label} period</span>
          <Select className="select" value={pick} onChange={(e) => choose(e.currentTarget.value)}>
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </label>
        <span className="oo-period-dates">{periodLabel(range[0], range[1])}</span>
      </div>
      {pick === 'custom' ? (
        <div className="oo-period-custom">
          <Input
            className="input"
            type="date"
            aria-label="From"
            value={custom[0]}
            max={now}
            onInput={(e) => setCustom([e.currentTarget.value, custom[1]])}
          />
          <Input
            className="input"
            type="date"
            aria-label="To"
            value={custom[1]}
            max={now}
            onInput={(e) => setCustom([custom[0], e.currentTarget.value])}
          />
          <Button
            size="sm"
            disabled={!custom[0] || !custom[1] || custom[0] > custom[1]}
            onClick={() => setRange([custom[0], custom[1]])}
          >
            Show
          </Button>
        </div>
      ) : null}
      {err ? (
        <p className="oo-fine oo-bad">{err}</p>
      ) : loaded ? (
        fcrNote ? (
          <p className="oo-none">{data.fcrNote}</p>
        ) : !cur || now_ === null ? (
          <p className="oo-none">No data for this period ({periodLabel(data.from, data.to)}).</p>
        ) : (
          <>
            <div className="oo-param-row">
              <span className="oo-param-v" data-band={bandOf(now_, floor)} style={{ color: 'var(--band, var(--ink))' }}>
                <CountUp v={pct(now_)} />
              </span>
              <span className="oo-param-side">
                <span>
                  {before !== null ? (
                    <>
                      Previous {data.days} day{data.days === 1 ? '' : 's'} (
                      {periodLabel(data.prevFrom, data.prevTo)}) {pct(before)}{' '}
                      <PwDelta now={now_} before={before} />
                    </>
                  ) : (
                    `No data for the previous ${data.days} day${data.days === 1 ? '' : 's'} (${periodLabel(data.prevFrom, data.prevTo)})`
                  )}
                </span>
              </span>
            </div>
            <ul className="oo-param-facts">
              {factLines(metric, cur).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </>
        )
      ) : (
        <p className="oo-none" aria-busy="true">
          Loading {periodLabel(range[0], range[1])}…
        </p>
      )}
    </div>
  )
}

/** Tl() — this-month fact lines under a scorecard param. */
function monthFacts(p: any, score: any): string[] {
  if (!score) return []
  if (p.id === 'prod')
    return [
      `${pct(score.prod)} of target over ${score.days} day${score.days === 1 ? '' : 's'}`,
      ...[
        score.inbTarget ? `Inbound ${pct(score.inbProd)} (${score.inbAchieved} of ${score.inbTarget})` : '',
        score.txtTarget ? `Texting ${pct(score.txtProd)} (${score.txtAchieved} of ${score.txtTarget})` : '',
        score.waTarget ? `Waiting address ${pct(score.waProd)} (${score.waAchieved} of ${score.waTarget})` : '',
      ].filter(Boolean),
    ]
  if (p.id === 'qual')
    return [
      score.qual === null
        ? 'No audits this month'
        : `Average ${score.qual}% over ${score.audits} audit${score.audits === 1 ? '' : 's'}`,
    ]
  return [
    score.fcr === null
      ? 'No FCR checks this month'
      : `${score.fcrPassed} of ${score.fcrPassed + score.fcrFailed} checked contacts resolved first time; ${score.fcrFailed} came back`,
  ]
}

/** Pl() — one scorecard param: headline, rank, trend spark, period drill. */
function OoParam({
  p,
  s,
  floor,
  month,
  report,
  today: now,
}: {
  p: any
  s: any
  floor: number
  month: string
  report: string
  today: string
}) {
  const label = p.label.split(' (')[0]
  const low = label === 'FCR' ? 'FCR' : label.toLowerCase()
  return (
    <section className="oo-param" aria-labelledby={`oo-p-${p.id}`} data-band={bandOf(p.value, floor)}>
      <h3 id={`oo-p-${p.id}`} className="oo-param-h">
        {p.label}
      </h3>
      <PeriodMetric metric={p.id} label={label} report={report} today={now} floor={floor} />
      <p className="oo-fine oo-period-note">On the scorecard, {monthName(month)}, so far:</p>
      {p.value === null ? (
        <p className="oo-none">
          No {low} score yet for {monthName(month)}.
          {p.lastMonth !== null ? ` Last month: ${p.lastMonth}%.` : ''}
        </p>
      ) : (
        <>
          <div className="oo-param-row">
            <span className="oo-param-v">
              <CountUp v={`${p.value}%`} />
            </span>
            <span className="oo-param-side">
              {p.rank !== null ? (
                <span>
                  Rank <b>{p.rank}</b> of {p.rankOf} on {low}
                </span>
              ) : null}
              <span>
                {p.lastMonth === null ? (
                  'No result last month'
                ) : (
                  <>
                    Last month {p.lastMonth}% <PwDelta now={p.value} before={p.lastMonth} />
                  </>
                )}
              </span>
            </span>
          </div>
          <OoSpark points={p.trend} floor={floor} />
        </>
      )}
      <ul className="oo-param-facts">
        {monthFacts(p, s).map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  )
}

/** El() — "Scorecard, <month> so far" block for an agent. */
function ScorecardBlock({ ctx, report }: { ctx: any; report: string }) {
  const a = ctx.agent
  return (
    <section className="oo-block" aria-labelledby="oo-score-h">
      <h2 id="oo-score-h" className="oo-h">
        Scorecard, {monthName(a.scoreMonth)} so far
      </h2>
      {a.scoreUnavailable || !a.params?.length ? (
        <p className="oo-none oo-unavail">
          {a.scoreUnavailable || 'Scorecard not available: the scorecard figures did not load.'}
        </p>
      ) : (
        <>
          <p className="oo-fine" style={{ marginTop: -8, marginBottom: 10 }}>
            Each is judged on its own and ranked against everyone&apos;s same figure this month.
          </p>
          {a.params.map((p: any) => (
            <OoParam key={p.id} p={p} s={a.score} floor={ctx.floor} month={a.scoreMonth} report={report} today={ctx.today} />
          ))}
          {a.score?.behaviorKnown ? (
            <p className="oo-bhv">Behaviour cases this month: {a.score.behaviorCases}</p>
          ) : null}
        </>
      )}
      {ctx.scoreNotes.map((n: string) => (
        <p key={n} className="oo-fine">
          {n}
        </p>
      ))}
    </section>
  )
}

/* ------------------------------------- Hl/Fe/Nl/Rl — queue blocks */
function PerfLink({ email, name }: { email: string; name: string }) {
  const appUrls = useBootSelector(() => getBoot()?.appUrls ?? {}, [])
  const link = appLink(`#/tl-performance?tl=${encodeURIComponent(email)}`, undefined, appUrls)
  return (
    <p className="oo-block">
      {link.missing ? (
        <span className="oo-muted">
          {name}&apos;s performance page needs the TL desk app&apos;s URL (Hub Admin, Connected apps).
        </span>
      ) : (
        <a className="btn btn-primary" href={link.href} target="_blank" rel="noopener noreferrer">
          Open {name}&apos;s performance
        </a>
      )}
    </p>
  )
}

function QueueRow({ label, now, before }: { label: string; now: number | null; before?: number | null }) {
  if (now === null && (before ?? null) === null) return null
  return (
    <tr>
      <th scope="row">{label}</th>
      <td data-band={bandOf(now)}>{pct(now)}</td>
      <td className="oo-muted">{before === undefined ? '' : pct(before)}</td>
      <td>{before === undefined ? null : <PwDelta now={now} before={before} />}</td>
    </tr>
  )
}

function QueueBlock({ ctx }: { ctx: any }) {
  const { last7, prev7, mtd } = ctx.agent.productivity
  return (
    <section className="oo-block" aria-labelledby="oo-queue-h">
      <h2 id="oo-queue-h" className="oo-h">
        On the queue, last 7 days
      </h2>
      {last7 ? (
        <>
          <table className="oo-table oo-table--narrow">
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">7 days</th>
                <th scope="col">7 before</th>
                <th scope="col">
                  <span className="sr-only">Change</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <QueueRow label="Productive time" now={last7.overallPct} before={prev7?.overallPct ?? null} />
              <QueueRow label="Inbound vs target" now={last7.inboundPct} before={prev7?.inboundPct ?? null} />
              <QueueRow label="Texting vs target" now={last7.textingPct} before={prev7?.textingPct ?? null} />
              <QueueRow label="Waiting address vs target" now={last7.waPct} before={prev7?.waPct ?? null} />
            </tbody>
          </table>
          <p className="oo-fine">
            {last7.days} day{last7.days === 1 ? '' : 's'} worked: {last7.inboundAchieved} inbound handled,{' '}
            {last7.inboundMissed} missed, {last7.textingAchieved} texting, {last7.waAchieved} waiting address. Idle{' '}
            {last7.idleMin} min.
            {last7.audits
              ? ` QA average ${last7.avgScore ?? '–'} over ${last7.audits} audit${last7.audits === 1 ? '' : 's'}.`
              : ''}
            {mtd && mtd.overallPct !== null ? ` Month to date: ${mtd.overallPct}% productive time.` : ''}
          </p>
        </>
      ) : (
        <p className="oo-none">No queue numbers for the last 7 days.</p>
      )}
    </section>
  )
}

function TicketsBlock({ ctx }: { ctx: any }) {
  const a = ctx.agent.aging
  return (
    <section className="oo-block" aria-labelledby="oo-tix-h">
      <h2 id="oo-tix-h" className="oo-h">
        Their open tickets
      </h2>
      {a.open ? (
        <>
          <OoStats a={a} bands={ctx.bands} />
          <OoTickets rows={a.oldest} url={ctx.ticketUrl} />
        </>
      ) : (
        <p className="oo-none">No open tickets assigned.</p>
      )}
    </section>
  )
}

/* -------------------------------------- ct — the DOES_NOT_FIT busy */
function useFitBusy() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fit, setFit] = useState('')
  const run = async (call: (assignAnyway: boolean) => Promise<any>, anyway = false) => {
    if (busy) return undefined
    setBusy(true)
    setError('')
    try {
      const r = await call(anyway)
      setFit('')
      return r
    } catch (e: any) {
      const m = e.message as string
      if (m.startsWith(DOES_NOT_FIT)) setFit(m.slice(DOES_NOT_FIT.length).trim())
      else setError(m)
      return undefined
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, fit, setFit, run }
}

/* ------------------------------- _l/ts/vl/yl — project edit forms */
const PROJ_STATUS = [
  { id: 'in_progress', label: 'In progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Delivered' },
  { id: 'cancelled', label: 'Dropped' },
]

function ProjStatusForm({ t, onSaved, onCancel }: { t: any; onSaved: (x: any) => void; onCancel: () => void }) {
  const [status, setStatus] = useState(t.progressState === 'blocked' ? 'blocked' : 'in_progress')
  const [text, setText] = useState('')
  const busy = useFitBusy()
  const lbl =
    status === 'blocked'
      ? 'What is blocking it'
      : status === 'done'
        ? 'Delivery link or file name'
        : status === 'cancelled'
          ? 'Why it is dropped'
          : ''
  return (
    <div className="oo-proj-form">
      <div className="pw-seg" role="group" aria-label="Status">
        {PROJ_STATUS.map((b) => (
          // eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option button (family chrome, not a form control)
          <button key={b.id} type="button" aria-pressed={status === b.id} onClick={() => setStatus(b.id)}>
            {b.label}
          </button>
        ))}
      </div>
      {lbl ? (
        <label className="field">
          <span className="field-label">{lbl}</span>
          <Input className="input" value={text} onInput={(e) => setText(e.currentTarget.value)} />
        </label>
      ) : null}
      <PwErr message={busy.error} />
      <div className="oo-proj-btns">
        <Button size="sm" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={busy.busy || (!!lbl && status !== 'cancelled' && !text.trim())}
          onClick={() =>
            void busy.run(async () => {
              const r = await api.tasksSetStatus(
                t.actionId,
                status,
                status === 'blocked' ? { blockedReason: text } : status === 'done' ? { deliveryRef: text } : { note: text }
              )
              onSaved(normTask(r))
              toast(
                status === 'done'
                  ? 'Marked delivered'
                  : status === 'cancelled'
                    ? 'Project dropped'
                    : status === 'blocked'
                      ? 'Marked blocked'
                      : 'Status saved'
              )
              return r
            })
          }
        >
          Save status
        </Button>
      </div>
    </div>
  )
}

/** ts() — the "does not fit" save-anyway box. */
function FitBox({
  text,
  busy,
  onAnyway,
  onCancel,
}: {
  text: string
  busy: boolean
  onAnyway: () => void
  onCancel: () => void
}) {
  if (!text) return null
  return (
    <div className="oo-fit" role="alert">
      <p>
        <strong>Does not fit the free hours.</strong> {text}
      </p>
      <div className="oo-proj-btns">
        <Button size="sm" onClick={onCancel}>
          Change it
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={onAnyway}>
          Save anyway
        </Button>
      </div>
    </div>
  )
}

function ProjEditForm({
  t,
  owners,
  onSaved,
  onCancel,
}: {
  t: any
  owners: any[]
  onSaved: (x: any) => void
  onCancel: () => void
}) {
  const [f, setF] = useState({
    title: t.title,
    description: t.description,
    priority: t.priority,
    start: inputDT(t.startAt),
    deadline: inputDT(t.deadlineAt),
    est: String(t.estHours),
    owner: t.ownerEmail,
    reason: '',
    expectation: t.expectation ?? '',
  })
  const busy = useFitBusy()
  const set = (k: string) => (e: any) => setF((v) => ({ ...v, [k]: e.currentTarget.value }))
  const moved = f.deadline !== inputDT(t.deadlineAt)
  const save = (anyway = false) =>
    busy.run(async (aw) => {
      const patch: Record<string, unknown> = {
        title: f.title,
        description: f.description,
        priority: f.priority,
        estHours: Number(f.est),
        ownerEmail: f.owner,
        assignAnyway: aw,
        expectation: f.expectation,
      }
      if (f.start !== inputDT(t.startAt)) patch.startAt = f.start
      if (moved) {
        patch.deadlineAt = f.deadline
        patch.reason = f.reason
      }
      const r = await api.tasksEditDetails(t.actionId, patch)
      onSaved(normTask(r))
      toast(r.ownerEmail !== t.ownerEmail ? `Project handed to ${r.ownerName}` : 'Project saved')
      return r
    }, anyway)
  return (
    <div className="oo-proj-form">
      <label className="field">
        <span className="field-label">Title</span>
        <Input className="input" value={f.title} onInput={set('title')} />
      </label>
      <label className="field">
        <span className="field-label">Description</span>
        <Textarea className="pw-textarea" rows={2} value={f.description} onInput={set('description')} />
      </label>
      <label className="field">
        <span className="field-label">Your expectation (what it is rated against)</span>
        <Textarea className="pw-textarea" rows={2} value={f.expectation} onInput={set('expectation')} />
      </label>
      <div className="oo-proj-grid">
        <label className="field">
          <span className="field-label">Priority</span>
          <Select className="select" value={f.priority} onChange={set('priority')}>
            {['P1', 'P2', 'P3'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span className="field-label">Estimate (h)</span>
          <Input className="input" type="number" min={1} max={500} step={0.5} value={f.est} onInput={set('est')} />
        </label>
        <label className="field">
          <span className="field-label">Start (Kuwait)</span>
          <Input className="input" type="datetime-local" value={f.start} onInput={set('start')} />
        </label>
        <label className="field">
          <span className="field-label">Deadline (Kuwait)</span>
          <Input className="input" type="datetime-local" value={f.deadline} onInput={set('deadline')} />
        </label>
      </div>
      {moved ? (
        <label className="field">
          <span className="field-label">Why the deadline moves</span>
          <Input className="input" value={f.reason} onInput={set('reason')} />
        </label>
      ) : null}
      {owners.length ? (
        <label className="field">
          <span className="field-label">Owner</span>
          <Select className="select" value={f.owner} onChange={set('owner')}>
            {owners.map((o) => (
              <option key={o.email} value={o.email}>
                {o.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      <FitBox text={busy.fit} busy={busy.busy} onAnyway={() => void save(true)} onCancel={() => busy.setFit('')} />
      <PwErr message={busy.error} />
      <div className="oo-proj-btns">
        <Button size="sm" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={busy.busy || !f.title.trim() || (moved && !f.reason.trim())}
          onClick={() => void save()}
        >
          {busy.busy ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}

function ProjProgressForm({ t, onSaved, onCancel }: { t: any; onSaved: (x: any) => void; onCancel: () => void }) {
  const [pctDone, setPctDone] = useState(String(t.percent))
  const [note, setNote] = useState('')
  const [nextStep, setNextStep] = useState('')
  const busy = useFitBusy()
  return (
    <div className="oo-proj-form">
      <div className="oo-proj-grid">
        <label className="field">
          <span className="field-label">Percent done</span>
          <Input
            className="input"
            type="number"
            min={0}
            max={100}
            step={5}
            value={pctDone}
            onInput={(e) => setPctDone(e.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Next step</span>
          <Input className="input" value={nextStep} onInput={(e) => setNextStep(e.currentTarget.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Where it stands</span>
        <Input className="input" value={note} onInput={(e) => setNote(e.currentTarget.value)} />
      </label>
      <PwErr message={busy.error} />
      <div className="oo-proj-btns">
        <Button size="sm" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={busy.busy || !note.trim()}
          onClick={() =>
            void busy.run(async () => {
              const r = await api.tasksPostMilestone(t.actionId, {
                kind: 'status',
                note,
                percent: pctDone === '' ? '' : Number(pctDone),
                nextStep,
              })
              onSaved(normTask(r))
              toast('Progress posted')
              return r
            })
          }
        >
          Post progress
        </Button>
      </div>
    </div>
  )
}

/* zn() — stagger index for the sweep bars. */
const barDelay = (i: number): CSSProperties => ({ ['--i' as string]: Math.min(i, 12) })

/** kl() — one project row in the context aside. */
function ProjectRow({ t, i, owners, onSaved }: { t: any; i: number; owners: any[]; onSaved: (x: any) => void }) {
  const [form, setForm] = useState('')
  const closed = t.status === 'done' || t.status === 'dropped'
  const saved = (x: any) => {
    setForm('')
    onSaved(x)
  }
  return (
    <li>
      <div className="oo-proj-head">
        <strong>{t.title}</strong>
        <span className="oo-proj-pct">{t.percent}%</span>
      </div>
      <div className="pw-meter" data-over={t.overdue ? 'true' : undefined}>
        <i className="cc-sweep-bar" style={{ width: `${Math.max(0, Math.min(100, t.percent))}%`, ...barDelay(i) }} />
      </div>
      <div className="oo-proj-meta">
        <span className="tag">{t.priority}</span>
        <span className={t.overdue ? 'pill bad' : 'pill'}>
          {t.overdue ? 'Past deadline ' : 'Due '}
          {dayLabel(kwDate(t.deadlineAt))}
        </span>
        <span className="tag">{t.estHours} h</span>
        {t.progressState === 'blocked' ? <span className="pill bad">Blocked</span> : null}
        {t.status === 'done' ? (
          <span className="pill ok">Delivered</span>
        ) : t.status === 'dropped' ? (
          <span className="pill">Dropped</span>
        ) : null}
        {!closed && !t.overdue && t.riskReasons.length ? <span className="pill warn">At risk</span> : null}
      </div>
      <p className="oo-fine">
        {t.blockedReason ? `Blocked: ${t.blockedReason}. ` : ''}
        {t.riskReasons.length ? `${t.riskReasons.join('. ')}. ` : ''}
        {t.lastUpdate
          ? `Last update ${dayLabel(kwDate(t.lastUpdate.at))}: ${t.lastUpdate.note || 'no note'}${t.lastUpdate.nextStep ? `. Next: ${t.lastUpdate.nextStep}` : ''}`
          : 'No update posted yet.'}
      </p>
      {!closed && !form ? (
        <div className="oo-proj-btns oo-proj-btns--start">
          <Button size="sm" onClick={() => setForm('edit')}>
            Edit
          </Button>
          <Button size="sm" onClick={() => setForm('progress')}>
            Post progress
          </Button>
          <Button size="sm" onClick={() => setForm('status')}>
            Status
          </Button>
        </div>
      ) : null}
      {form === 'edit' ? <ProjEditForm t={t} owners={owners} onSaved={saved} onCancel={() => setForm('')} /> : null}
      {form === 'progress' ? <ProjProgressForm t={t} onSaved={saved} onCancel={() => setForm('')} /> : null}
      {form === 'status' ? <ProjStatusForm t={t} onSaved={saved} onCancel={() => setForm('')} /> : null}
    </li>
  )
}

/** xl() — "Add project" collapsible form. */
function ProjectAdd({ owner, onAdded }: { owner: string; onAdded: (x: any) => void }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', priority: 'P2', deadline: addDays(today(), 7), est: '4', expectation: '' })
  const busy = useFitBusy()
  const save = (anyway = false) =>
    busy.run(async (aw) => {
      const r = await api.tasksCreate({
        title: f.title,
        description: '',
        ownerEmail: owner,
        priority: f.priority,
        deadlineAt: f.deadline,
        estHours: Number(f.est),
        sourceLabel: '1:1',
        planned: [],
        assignAnyway: aw,
        expectation: f.expectation,
      })
      onAdded(normTask(r))
      toast('Project added')
      setOpen(false)
      setF({ ...f, title: '', expectation: '' })
      return r
    }, anyway)
  return open ? (
    <div className="oo-proj-form">
      <label className="field">
        <span className="field-label">New project title</span>
        <Input className="input" value={f.title} onInput={(e) => setF({ ...f, title: e.currentTarget.value })} />
      </label>
      <label className="field">
        <span className="field-label">Your expectation: the result you will rate Below, Meets or Exceeds</span>
        <Textarea
          className="pw-textarea"
          rows={2}
          value={f.expectation}
          onInput={(e) => setF({ ...f, expectation: e.currentTarget.value })}
        />
      </label>
      <div className="oo-proj-grid">
        <label className="field">
          <span className="field-label">Priority</span>
          <Select className="select" value={f.priority} onChange={(e) => setF({ ...f, priority: e.currentTarget.value })}>
            {['P1', 'P2', 'P3'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span className="field-label">Estimate (h)</span>
          <Input
            className="input"
            type="number"
            min={1}
            max={500}
            value={f.est}
            onInput={(e) => setF({ ...f, est: e.currentTarget.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">Deadline (end of their shift)</span>
          <Input
            className="input"
            type="date"
            value={f.deadline}
            onInput={(e) => setF({ ...f, deadline: e.currentTarget.value })}
          />
        </label>
      </div>
      <FitBox text={busy.fit} busy={busy.busy} onAnyway={() => void save(true)} onCancel={() => busy.setFit('')} />
      <PwErr message={busy.error} />
      <div className="oo-proj-btns">
        <Button size="sm" variant="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={busy.busy || !f.title.trim() || !(Number(f.est) > 0)}
          onClick={() => void save()}
        >
          {busy.busy ? 'Adding…' : 'Add project'}
        </Button>
      </div>
    </div>
  ) : (
    <Button size="sm" className="oo-proj-add" onClick={() => setOpen(true)}>
      Add project
    </Button>
  )
}

/** Sl() — "<name>'s projects". */
function ProjectsBlock({ tasks, name, owner, owners }: { tasks: any[]; name: string; owner: string; owners: any[] }) {
  const [list, setList] = useState(tasks)
  const ref = useRef<HTMLElement | null>(null)
  useOoEnter(ref)
  const saved = (x: any) =>
    setList((l) =>
      x.ownerEmail !== owner ? l.filter((t) => t.actionId !== x.actionId) : l.map((t) => (t.actionId === x.actionId ? x : t))
    )
  return (
    <section className="oo-block" aria-labelledby="oo-proj-h">
      <h2 id="oo-proj-h" className="oo-h">
        {name}&apos;s projects
      </h2>
      {list.length ? null : <p className="oo-none">No open projects or tasks.</p>}
      <ul className="oo-projects cc-chart" ref={ref as React.Ref<HTMLUListElement>}>
        {list.map((t, i) => (
          <ProjectRow key={t.actionId} t={t} i={i} owners={owners} onSaved={saved} />
        ))}
      </ul>
      <ProjectAdd
        owner={owner}
        onAdded={(x) => setList((l) => [...l, x].sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt)))}
      />
    </section>
  )
}

/* ------------------------------------------------- Fl — oo-ctx aside */
function CtxAside({ start }: { start: any }) {
  const ctx = start.context
  const first = start.report.name.split(' ')[0] || start.report.name
  const asOf = [
    ctx.scoreAsOf ? `Scorecard to ${dayLabel(ctx.scoreAsOf)}` : '',
    ctx.prodAsOf ? `queue numbers ${dayTime(ctx.prodAsOf)}` : '',
    ctx.agingAsOf ? `tickets ${dayTime(ctx.agingAsOf)}` : '',
  ].filter(Boolean)
  return (
    <aside
      className="oo-ctx"
      aria-label={start.kind === 'tl' ? `${start.report.name}'s projects and team` : `${start.report.name}'s numbers`}
    >
      <p className="oo-who">
        {start.kind === 'tl' ? 'Team lead 1:1 with ' : 'Agent 1:1 with '}
        <b>{start.report.name}</b>
      </p>
      {start.kind === 'tl' ? (
        <>
          <PerfLink email={start.report.email} name={first} />
          <ProjectsBlock tasks={start.tasks} name={first} owner={start.report.email} owners={start.taskOwners ?? []} />
          {ctx.team ? <TeamBlock ctx={ctx} name={first} /> : null}
        </>
      ) : ctx.agent ? (
        <>
          <ScorecardBlock ctx={ctx} report={start.report.email} />
          <QueueBlock ctx={ctx} />
          <TicketsBlock ctx={ctx} />
        </>
      ) : null}
      {ctx.notes.map((n: string) => (
        <p key={n} className="oo-fine oo-bad">
          {n}
        </p>
      ))}
      {asOf.length ? <p className="oo-fine">{asOf.join('; ')}.</p> : null}
    </aside>
  )
}

/* ----------------------------------- Zl — one topic's entry section */
const EMPTY_EVIDENCE = { behaviour: '', evidence: '', standard: '', shownBefore: '', explanation: '' } // zl
const COACHING_ONLY = ['Coaching given', 'Standard communicated'] // kn

function TopicSection({
  n,
  def,
  kind,
  outcomes,
  state,
  onChange,
}: {
  n: number
  def: any
  kind: string
  outcomes: string[]
  state: any
  onChange: (patch: Record<string, unknown>) => void
}) {
  const ev = state.evidence
  const limited = def.performance && ev.shownBefore !== '' && ev.shownBefore !== 'yes'
  const shown = limited ? outcomes.filter((o) => COACHING_ONLY.includes(o)) : outcomes
  useEffect(() => {
    if (limited && state.outcome && !COACHING_ONLY.includes(state.outcome)) onChange({ outcome: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limited])
  const setEv = (k: string, v: string) => onChange({ evidence: { ...ev, [k]: v } })
  const raisers = kind === 'tl' ? ['mohamed', 'tl', 'system'] : ['tl', 'agent', 'system']
  const raiserLabel: Record<string, string> = {
    mohamed: 'Mohamed',
    tl: kind === 'tl' ? 'The TL' : 'Me',
    agent: 'The agent',
    system: 'Suggested',
  }
  return (
    <section className="pw-topic" aria-label={`Topic ${n}: ${def.label}`}>
      <header className="pw-topic-head">
        <h3 className="pw-h2" style={{ margin: 0 }}>
          {def.label}
        </h3>
        <div className="pw-seg" role="group" aria-label="Raised by">
          {raisers.map((r) => (
            // eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option button (family chrome, not a form control)
            <button key={r} type="button" aria-pressed={state.raisedBy === r} onClick={() => onChange({ raisedBy: r })}>
              {raiserLabel[r]}
            </button>
          ))}
        </div>
      </header>
      <div className="pw-topic-body">
        {def.noData ? <p className="pw-small pw-muted">No performance data is shown for this topic, on purpose.</p> : null}
        {def.prompts.map((p: any) => (
          <label key={p.id} className="field">
            <span className="field-label" style={{ fontWeight: 500 }}>
              {p.text}
            </span>
            <Textarea
              className="pw-textarea"
              style={{ minHeight: 56 }}
              value={state.answers[p.id] ?? ''}
              onInput={(e) => onChange({ answers: { ...state.answers, [p.id]: e.currentTarget.value } })}
            />
          </label>
        ))}
        {def.fields.map((f: any) =>
          f.type === 'dropdown' ? (
            <PwCombo
              key={f.id}
              listKey={f.listKey ?? `one_on_one.${f.id}`}
              label={f.label}
              value={state.fields[f.id] ?? ''}
              onChange={(v) => onChange({ fields: { ...state.fields, [f.id]: v } })}
            />
          ) : f.type === 'yes_no' ? (
            <div key={f.id} className="field">
              <span className="field-label">{f.label}</span>
              <div className="pw-seg" role="group" aria-label={f.label}>
                {['yes', 'no'].map((v) => (
                  // eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option button (family chrome, not a form control)
                  <button
                    key={v}
                    type="button"
                    aria-pressed={state.fields[f.id] === v}
                    onClick={() => onChange({ fields: { ...state.fields, [f.id]: v } })}
                  >
                    {v === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <label key={f.id} className="field">
              <span className="field-label">
                {f.label}
                {f.required ? <span className="req"> *</span> : null}
              </span>
              <Input
                className="input"
                type={f.type === 'date' ? 'date' : 'text'}
                value={state.fields[f.id] ?? ''}
                onInput={(e) => onChange({ fields: { ...state.fields, [f.id]: e.currentTarget.value } })}
              />
            </label>
          )
        )}
        {def.performance ? (
          <fieldset className="pw-evidence" style={{ border: 0 }}>
            <legend className="field-label">Evidence (every field required)</legend>
            {(
              [
                ['behaviour', 'The specific behaviour'],
                ['evidence', 'Evidence: ticket IDs and dates'],
                ['standard', 'The standard it is measured against'],
              ] as const
            ).map(([k, lbl]) => (
              <label key={k} className="field">
                <span className="field-label">{lbl}</span>
                <Input className="input" value={ev[k]} onInput={(e) => setEv(k, e.currentTarget.value)} />
              </label>
            ))}
            <div className="field">
              <span className="field-label">Was the standard shown to them before?</span>
              <div className="pw-seg" role="group" aria-label="Was the standard shown before?">
                {['yes', 'no', 'unsure'].map((v) => (
                  // eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option button (family chrome, not a form control)
                  <button key={v} type="button" aria-pressed={ev.shownBefore === v} onClick={() => setEv('shownBefore', v)}>
                    {v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Unsure'}
                  </button>
                ))}
              </div>
              {limited ? (
                <span className="field-hint">
                  Not shown before, so this can only be recorded as standard communicated or coaching.
                </span>
              ) : null}
            </div>
            <label className="field">
              <span className="field-label">Their explanation</span>
              <Input className="input" value={ev.explanation} onInput={(e) => setEv('explanation', e.currentTarget.value)} />
            </label>
          </fieldset>
        ) : null}
        <label className="field" style={{ maxWidth: 320 }}>
          <span className="field-label">Outcome</span>
          <Select className="select" value={state.outcome} onChange={(e) => onChange({ outcome: e.currentTarget.value })}>
            <option value="">Choose an outcome</option>
            {shown.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </label>
      </div>
    </section>
  )
}

/* ------------------------------- ls — the carried-action outcomes */
const REVIEW_OUTCOMES = [
  { id: 'done', label: 'Done' },
  { id: 'carried', label: 'Still open' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'dropped', label: 'Dropped' },
]
const REVIEW_NOTE_LABELS: Record<string, string> = {
  done: 'What was done',
  carried: '',
  blocked: 'Blocked by what, and who can unblock it',
  dropped: 'Why it is dropped',
}

function CarriedReview({
  actions,
  value,
  onChange,
  disabled,
}: {
  actions: any[]
  value: Record<string, any>
  onChange: (v: Record<string, any>) => void
  disabled?: boolean
}) {
  const patch = (a: any, p: Record<string, unknown>) => {
    const next = { ...(value[a.actionId] ?? { actionId: a.actionId, outcome: 'done' }), ...p }
    if (next.outcome === 'carried' && !next.newDueDate) next.newDueDate = addDays(today(), 7)
    onChange({ ...value, [a.actionId]: next })
  }
  return (
    <div>
      {actions.map((a) => {
        const v = value[a.actionId]
        const overdue = a.dueDate < today()
        return (
          <div key={a.actionId} className="pw-carry">
            <div>
              <div className="pw-row-title">
                {a.title} {a.sourceDeleted ? <span className="pill warn">Created in a deleted 1:1</span> : null}
              </div>
              <div className="pw-row-meta">
                {a.ownerName}, due {dayLabel(a.dueDate)} {overdue ? <span className="pill bad">Overdue</span> : null}{' '}
                {a.carryCount >= 3 ? (
                  <span className="pill bad">Carried {a.carryCount} times: escalate, reassign or drop</span>
                ) : a.carryCount ? (
                  <span className="pill warn">Carried {a.carryCount}×</span>
                ) : null}
              </div>
              {a.latestUpdate ? (
                <p className="pw-small pw-muted" style={{ marginTop: 4 }}>
                  Latest from {a.latestUpdate.byName}, {dayTime(a.latestUpdate.at)}:{' '}
                  {a.latestUpdate.kind === 'file' ? `file ${a.latestUpdate.fileName}` : a.latestUpdate.note}
                </p>
              ) : null}
            </div>
            <div className="pw-seg" role="group" aria-label={`Outcome for ${a.title}`}>
              {REVIEW_OUTCOMES.map((o) => (
                // eslint-disable-next-line -- kept raw: .pw-seg aria-pressed option button (family chrome, not a form control)
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={v?.outcome === o.id}
                  disabled={disabled}
                  onClick={() => patch(a, { outcome: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {v ? (
              v.outcome === 'carried' ? (
                <label className="field" style={{ maxWidth: 220 }}>
                  <span className="field-label">New due date</span>
                  <Input
                    className="input"
                    type="date"
                    min={today()}
                    value={v.newDueDate ?? ''}
                    disabled={disabled}
                    onInput={(e) => patch(a, { newDueDate: e.currentTarget.value })}
                  />
                </label>
              ) : (
                <label className="field">
                  <span className="field-label">{REVIEW_NOTE_LABELS[v.outcome]}</span>
                  <Input
                    className="input"
                    value={v.note ?? ''}
                    disabled={disabled}
                    onInput={(e) => patch(a, { note: e.currentTarget.value })}
                  />
                </label>
              )
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------- Jl — the log form */
function LogForm({
  start,
  scheduleId,
  me,
  onDone,
}: {
  start: any
  scheduleId: string
  me: any
  onDone: () => void
}) {
  const library = start.library
  const def = (id: string) => library.find((d: any) => d.id === id)
  const [reviews, setReviews] = useState<Record<string, any>>({})
  const [topics, setTopics] = useState<string[]>(() => start.suggestions.slice(0, 3).map((s: any) => s.topic))
  const [skips, setSkips] = useState<Record<string, string>>({})
  const [topicState, setTopicState] = useState<Record<string, any>>({})
  const [actions, setActions] = useState<any[]>([{ title: '', ownerEmail: start.report.email, dueDate: addDays(today(), 7) }])
  const [heldAt, setHeldAt] = useState(inputDT(new Date().toISOString()))
  const [noActionReason, setNoActionReason] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [assessment, setAssessment] = useState({ saw: '', concerns: '', ownActions: '' })
  const busy = useBusy()
  const topicFor = (id: string) =>
    topicState[id] ?? {
      raisedBy: start.suggestions.some((s: any) => s.topic === id) ? 'system' : 'tl',
      answers: {},
      fields: {},
      evidence: { ...EMPTY_EVIDENCE },
      outcome: '',
    }
  const patchTopic = (id: string, patch: Record<string, unknown>) =>
    setTopicState((s) => ({ ...s, [id]: { ...topicFor(id), ...patch } }))
  const toggleTopic = (id: string) =>
    setTopics((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length >= 3 ? t : [...t, id]))
  const needSkipReason = start.suggestions.filter((s: any) => s.performance && !topics.includes(s.topic))
  const allReviewed = start.carryForward.every((a: any) => reviews[a.actionId])
  const submit = async () => {
    const record = {
      reportEmail: start.report.email,
      scheduleId: scheduleId || undefined,
      heldAt,
      reviews: Object.values(reviews),
      topics: topics.map((id) => {
        const s = topicFor(id)
        return {
          topic: id,
          raisedBy: s.raisedBy,
          answers: s.answers,
          fields: s.fields,
          outcome: s.outcome,
          evidence: def(id).performance ? s.evidence : undefined,
        }
      }),
      skipped: start.suggestions
        .filter((s: any) => !topics.includes(s.topic) && skips[s.topic])
        .map((s: any) => ({ topic: s.topic, reason: skips[s.topic] })),
      actions: actions.filter((a) => a.title.trim()),
      noActionReason,
      privateNote,
      assessment: start.kind === 'tl' && me.role === 'admin' ? assessment : undefined,
    }
    if (await busy.run(() => api.oneOnOnesSubmit(record))) onDone()
  }
  return (
    <div className="oo-layout" data-kind={start.kind}>
      <CtxAside start={start} />
      <div className="oo-form">
        {start.lastLog ? (
          <div className="pw-panel pw-section">
            <p className="pw-small pw-muted">Last 1:1, {dayTime(start.lastLog.heldAt)}</p>
            <p className="pw-summary">{start.lastLog.summary}</p>
          </div>
        ) : null}
        <section className="pw-section" aria-labelledby="open-h">
          <h2 id="open-h" className="pw-h2">
            1. Open actions and tasks from earlier
          </h2>
          {start.carryForward.length ? (
            <>
              <p className="pw-sub">Give each one an outcome before you submit.</p>
              <div className="pw-panel">
                <CarriedReview actions={start.carryForward} value={reviews} onChange={setReviews} />
              </div>
            </>
          ) : (
            <div className="empty">
              <div className="s">Nothing carried over. This 1:1 starts with the topics.</div>
            </div>
          )}
          {start.kind === 'agent' && start.tasks.length ? (
            <>
              <h3 className="pw-h3" style={{ marginTop: 18 }}>
                {start.report.name}&apos;s open tasks: where each one stands
              </h3>
              <div className="pw-panel">
                {start.tasks.map((t: any) => (
                  <div key={t.actionId} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                    <strong>{t.title}</strong> <span className="tag">{t.priority}</span>{' '}
                    <span className={t.overdue ? 'pill bad' : 'pill'}>{t.percent}% done</span>{' '}
                    <span className={t.overdue ? 'pill bad' : 'pill'}>
                      {t.overdue ? 'Past deadline ' : 'Due '}
                      {dayLabel(t.deadlineAt)}
                    </span>
                    {t.progressState === 'blocked' ? (
                      <>
                        {' '}
                        <span className="pill bad">Blocked</span>
                      </>
                    ) : null}
                    {t.riskReasons.length ? (
                      <p className="pw-small pw-muted" style={{ margin: '4px 0 0' }}>
                        {t.riskReasons.join('. ')}.
                      </p>
                    ) : null}
                    <p className="pw-small pw-muted" style={{ margin: '4px 0 0' }}>
                      {t.blockedReason ? `Blocked: ${t.blockedReason}. ` : ''}
                      {t.lastUpdate
                        ? `Last update ${dayLabel(t.lastUpdate.at)}: ${t.lastUpdate.note || 'no note'}${t.lastUpdate.nextStep ? `. Next: ${t.lastUpdate.nextStep}` : ''}`
                        : 'No update posted yet.'}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {start.otherOpen.length ? (
            <p className="pw-small pw-muted" style={{ marginTop: 10 }}>
              Also open for {start.report.name}:{' '}
              {start.otherOpen.map((a: any) => `${a.title} (due ${dayLabel(a.dueDate)})`).join('; ')}.
            </p>
          ) : null}
        </section>
        <section className="pw-section" aria-labelledby="topics-h">
          <h2 id="topics-h" className="pw-h2">
            2. Pick up to 3 topics
          </h2>
          <p className="pw-sub">
            {start.kind === 'tl'
              ? 'Lead topics: projects, the team’s numbers, how they manage their people, their growth. '
              : 'Agent topics: their scorecard, tickets, attendance, growth and wellbeing. '}
            Suggestions come from the numbers beside this form and are ticked for you. Untick one only with a reason.
          </p>
          {start.suggestions.length ? (
            <div className="pw-panel" style={{ marginBottom: 12 }}>
              {start.suggestions.map((s: any) => (
                <div key={s.topic} className="pw-suggest">
                  <label className="pw-check">
                    {/* eslint-disable-next-line -- kept raw: native checkbox inside .pw-check label */}
                    <input type="checkbox" checked={topics.includes(s.topic)} onChange={() => toggleTopic(s.topic)} />
                    <strong>{s.label}</strong>
                  </label>
                  <span className="pw-small pw-muted">{s.reason}</span>
                  {s.performance && !topics.includes(s.topic) ? (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <PwCombo
                        listKey="one_on_one.skip_reason"
                        label={`Why "${s.label}" is not discussed`}
                        value={skips[s.topic] ?? ''}
                        onChange={(v) => setSkips((x) => ({ ...x, [s.topic]: v }))}
                        required
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <div className="pw-chips" role="group" aria-label="Topics">
            {library.map((d: any) => (
              // eslint-disable-next-line -- kept raw: .pw-chip aria-pressed toggle chip (family chrome)
              <button
                key={d.id}
                type="button"
                className="pw-chip"
                aria-pressed={topics.includes(d.id)}
                disabled={!topics.includes(d.id) && topics.length >= 3}
                onClick={() => toggleTopic(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>
        {topics.map((id, i) => (
          <TopicSection
            key={id}
            n={i + 1}
            def={def(id)}
            kind={start.kind}
            outcomes={start.outcomes}
            state={topicFor(id)}
            onChange={(p) => patchTopic(id, p)}
          />
        ))}
        <section className="pw-section" aria-labelledby="actions-h">
          <h2 id="actions-h" className="pw-h2">
            3. Agree actions
          </h2>
          <p className="pw-sub">Each action needs an owner and a due date. The next 1:1 opens with them.</p>
          <div className="pw-panel">
            {actions.map((a, i) => (
              <div key={i} className="pw-new-action">
                <label className="field">
                  <span className="field-label">Action</span>
                  <Input
                    className="input"
                    placeholder="Starts with a verb, e.g. Re-read refund SOP section 4"
                    value={a.title}
                    onInput={(e) =>
                      setActions((v) => v.map((x, j) => (j === i ? { ...x, title: e.currentTarget.value } : x)))
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">Owner</span>
                  <Select
                    className="select"
                    value={a.ownerEmail}
                    onChange={(e) =>
                      setActions((v) => v.map((x, j) => (j === i ? { ...x, ownerEmail: e.currentTarget.value } : x)))
                    }
                  >
                    {start.owners.map((o: any) => (
                      <option key={o.email} value={o.email}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="field">
                  <span className="field-label">Due</span>
                  <Input
                    className="input"
                    type="date"
                    min={today()}
                    value={a.dueDate}
                    onInput={(e) =>
                      setActions((v) => v.map((x, j) => (j === i ? { ...x, dueDate: e.currentTarget.value } : x)))
                    }
                  />
                </label>
                <Button
                  size="sm"
                  variant="quiet"
                  aria-label={`Remove action ${i + 1}`}
                  onClick={() => setActions((v) => v.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              onClick={() =>
                setActions((v) => [...v, { title: '', ownerEmail: start.report.email, dueDate: addDays(today(), 7) }])
              }
            >
              Add action
            </Button>
            {actions.some((a) => a.title.trim()) ? null : (
              <label className="field" style={{ marginTop: 14 }}>
                <span className="field-label">No action needed because</span>
                <Input className="input" value={noActionReason} onInput={(e) => setNoActionReason(e.currentTarget.value)} />
                <span className="field-hint">
                  Allowed only when every topic is Recognition, Career or Wellbeing and resolved. Reports flag it.
                </span>
              </label>
            )}
          </div>
        </section>
        <section className="pw-section" aria-labelledby="close-h">
          <h2 id="close-h" className="pw-h2">
            4. Close
          </h2>
          <div className="pw-panel" style={{ display: 'grid', gap: 14 }}>
            <label className="field" style={{ maxWidth: 260 }}>
              <span className="field-label">Held at (Kuwait)</span>
              <Input className="input" type="datetime-local" value={heldAt} onInput={(e) => setHeldAt(e.currentTarget.value)} />
            </label>
            <label className="field">
              <span className="field-label">Private note</span>
              <Textarea className="pw-textarea" value={privateNote} onInput={(e) => setPrivateNote(e.currentTarget.value)} />
              <span className="field-hint">Seen only by you and Mohamed, never by {start.report.name}.</span>
            </label>
            {start.kind === 'tl' && me.role === 'admin' ? (
              <fieldset className="pw-evidence" style={{ border: 0 }}>
                <legend className="field-label">Your private assessment (never shown to {start.report.name})</legend>
                {(
                  [
                    ['saw', 'What I saw'],
                    ['concerns', 'Concerns'],
                    ['ownActions', 'My own actions'],
                  ] as const
                ).map(([k, lbl]) => (
                  <label key={k} className="field">
                    <span className="field-label">{lbl}</span>
                    <Textarea
                      className="pw-textarea"
                      value={assessment[k]}
                      onInput={(e) => setAssessment((v) => ({ ...v, [k]: e.currentTarget.value }))}
                    />
                  </label>
                ))}
              </fieldset>
            ) : null}
          </div>
          <div className="pw-actions-bar">
            <Button
              variant="primary"
              disabled={busy.busy || !topics.length || needSkipReason.some((s: any) => !skips[s.topic])}
              onClick={submit}
            >
              {busy.busy ? 'Submitting…' : 'Submit 1:1 record'}
            </Button>
            {allReviewed ? null : <span className="pw-small pw-muted">Review every open action first.</span>}
            {needSkipReason.some((s: any) => !skips[s.topic]) ? (
              <span className="pw-small pw-muted">Give a reason for each unticked suggestion.</span>
            ) : null}
          </div>
          <PwErr message={busy.error} />
          <p className="pw-small pw-muted" style={{ marginTop: 8 }}>
            The record is locked once submitted.
          </p>
        </section>
      </div>
    </div>
  )
}

/* ------------------------------------------- Gl — a due-person row */
function DueRow({
  p,
  reload,
  startLog,
}: {
  p: any
  reload: () => void
  startLog: (email: string, scheduleId?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [when, setWhen] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [reason, setReason] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const busy = useBusy()
  const booked = !!p.scheduled
  const save = async () => {
    const r = await busy.run(() =>
      booked ? api.oneOnOnesReschedule(p.scheduled.scheduleId, when, reason) : api.oneOnOnesSchedule(p.email, when, minutes)
    )
    if (r) {
      setWarnings((r as any).warnings)
      setOpen(false)
      reload()
    }
  }
  return (
    <li className="pw-row">
      <div>
        <div className="pw-row-title">
          {p.name} {p.kind === 'tl' ? <span className="tag">Team lead</span> : null}
        </div>
        <div className="pw-row-meta">
          {p.lastHeld ? `Last held ${dayLabel(p.lastHeld)}` : 'No 1:1 on record'}, every {p.cadenceDays} days
        </div>
      </div>
      <div className="pw-row-meta pw-num">
        {p.scheduled ? (
          <>Booked {dayTime(p.scheduled.scheduledAt)}</>
        ) : p.overdueUnscheduled ? (
          <span className="pill bad">Due since {dayLabel(p.nextDue)}, not booked</span>
        ) : (
          <>Due by {dayLabel(p.nextDue)}</>
        )}
      </div>
      <div className="pw-row-actions">
        <Button size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {booked ? 'Move' : 'Book a time'}
        </Button>
        <Button size="sm" variant="primary" onClick={() => startLog(p.email)}>
          Log 1:1
        </Button>
      </div>
      {open ? (
        <div className="pw-row-wide pw-inline">
          <label className="field">
            <span className="field-label">Date and time (Kuwait)</span>
            <Input
              className="input"
              type="datetime-local"
              value={when || (p.scheduled ? inputDT(p.scheduled.scheduledAt) : '')}
              onInput={(e) => setWhen(e.currentTarget.value)}
            />
          </label>
          {booked ? (
            <label className="field">
              <span className="field-label">Reason for moving</span>
              <Input className="input" value={reason} onInput={(e) => setReason(e.currentTarget.value)} />
            </label>
          ) : (
            <label className="field" style={{ flex: '0 1 120px' }}>
              <span className="field-label">Minutes</span>
              <Input
                className="input"
                type="number"
                min={10}
                max={180}
                step={5}
                value={minutes}
                onInput={(e) => setMinutes(Number(e.currentTarget.value))}
              />
            </label>
          )}
          <Button variant="primary" disabled={busy.busy || !when} onClick={save}>
            {booked ? 'Move 1:1' : 'Book 1:1'}
          </Button>
        </div>
      ) : null}
      {warnings.length ? (
        <div className="pw-row-wide">
          <p className="pw-small">Booked. Check before the day:</p>
          <ul className="pw-warn-list">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {busy.error ? (
        <div className="pw-row-wide">
          <PwErr message={busy.error} />
        </div>
      ) : null}
    </li>
  )
}

/* ------------------------------------------- Ql — a missed row */
function MissedRow({
  row,
  reload,
  startLog,
}: {
  row: any
  reload: () => void
  startLog: (email: string, scheduleId?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [newWhen, setNewWhen] = useState('')
  const busy = useBusy()
  return (
    <div className="pw-panel pw-late">
      <div className="pw-row" style={{ padding: 0 }}>
        <span className="pw-row-title">{row.reportName}</span>
        <span className="pw-row-meta pw-num">Planned {dayTime(row.scheduledAt)}</span>
        <span className="pw-row-actions">
          <Button size="sm" variant="primary" onClick={() => startLog(row.reportEmail, row.scheduleId)}>
            Submit record
          </Button>
          <Button size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            Not held
          </Button>
        </span>
      </div>
      {open ? (
        <div className="pw-inline" style={{ marginTop: 14 }}>
          <PwCombo
            listKey="one_on_one.not_held_reason"
            label="Why it was not held"
            value={reason}
            onChange={setReason}
            required
          />
          <label className="field">
            <span className="field-label">New date and time (within 5 working days)</span>
            <Input className="input" type="datetime-local" value={newWhen} onInput={(e) => setNewWhen(e.currentTarget.value)} />
          </label>
          <Button
            variant="primary"
            disabled={busy.busy}
            onClick={() =>
              busy.run(() => api.oneOnOnesMarkNotHeld(row.scheduleId, reason, newWhen)).then((r) => r && reload())
            }
          >
            Mark not held
          </Button>
        </div>
      ) : null}
      <PwErr message={busy.error} />
    </div>
  )
}

/* ------------------------------------------- Yl — a booked row */
function BookedRow({
  row,
  me,
  reload,
  startLog,
}: {
  row: any
  me: any
  reload: () => void
  startLog: (email: string, scheduleId?: string) => void
}) {
  const [move, setMove] = useState(false)
  const [del, setDel] = useState(false)
  const [when, setWhen] = useState(inputDT(row.scheduledAt))
  const [reason, setReason] = useState('')
  const busy = useBusy()
  const holder = row.managerEmail === me.email
  const report = row.reportEmail === me.email
  // eslint-disable-next-line react-hooks/purity -- a render-time "has it started" snapshot, as in the closure
  const started = Date.now() >= Date.parse(row.scheduledAt)
  const ends = kwHm(Date.parse(row.scheduledAt) + row.durationMin * 6e4)
  return (
    <li className="pw-row pw-booked" data-mine={report ? 'report' : holder ? 'holder' : 'other'}>
      <div className="pw-num pw-booked-time">
        {kwHm(row.scheduledAt)}
        <span className="pw-small pw-muted">
          to {ends}, {row.durationMin} min
        </span>
      </div>
      <div>
        <div className="pw-row-title">
          {report ? `With your manager, ${row.managerName}` : holder ? row.reportName : `${row.managerName} with ${row.reportName}`}{' '}
          {row.kind === 'tl' ? <span className="tag">Team lead</span> : null}
        </div>
        <div className="pw-row-meta">
          {report
            ? 'You are the report: bring where your actions stand.'
            : holder
              ? 'You hold this 1:1.'
              : 'Held by ' + row.managerName + '.'}{' '}
          {started ? <span className="pill warn">Started, not logged yet</span> : null}
        </div>
      </div>
      <div className="pw-row-actions">
        {holder && !started ? (
          <Button size="sm" aria-expanded={move} onClick={() => setMove((m) => !m)}>
            Move
          </Button>
        ) : null}
        {holder ? (
          <Button
            size="sm"
            variant="primary"
            onClick={() => startLog(row.reportEmail, row.scheduleId)}
          >
            Log 1:1
          </Button>
        ) : null}
        {me.role === 'admin' ? (
          <Button size="sm" className="pw-del-btn" onClick={() => setDel(true)}>
            Delete
          </Button>
        ) : null}
      </div>
      {del ? (
        <PwDialog
          title={`Delete the booked 1:1: ${row.managerName} with ${row.reportName}, ${dayTime(row.scheduledAt)}?`}
          lines={[
            "The booking is removed from both people's lists, Home and My day.",
            'Its reminders (the 15-minute email and the in-app alerts) are not sent.',
            'It no longer counts for the one-a-week rule, so another time can be booked that week.',
            'An admin can restore it later.',
          ]}
          confirmLabel="Delete booking"
          onClose={() => setDel(false)}
          onConfirm={async (r) => {
            await api.oneOnOnesDeleteBooking(row.scheduleId, r)
            toast('Booked 1:1 deleted.')
            reload()
            return true
          }}
        />
      ) : null}
      {move ? (
        <div className="pw-row-wide pw-inline">
          <label className="field">
            <span className="field-label">New date and time (Kuwait)</span>
            <Input className="input" type="datetime-local" value={when} onInput={(e) => setWhen(e.currentTarget.value)} />
          </label>
          <label className="field">
            <span className="field-label">Reason for moving</span>
            <Input className="input" value={reason} onInput={(e) => setReason(e.currentTarget.value)} />
          </label>
          <Button
            variant="primary"
            disabled={busy.busy || !when || !reason.trim()}
            onClick={() =>
              busy.run(() => api.oneOnOnesReschedule(row.scheduleId, when, reason)).then((r) => r && reload())
            }
          >
            Move 1:1
          </Button>
        </div>
      ) : null}
      {busy.error ? (
        <div className="pw-row-wide">
          <PwErr message={busy.error} />
        </div>
      ) : null}
    </li>
  )
}

/* -------------------------------- Vl/Kl — booked & due tab content */
function BookedSection({
  data,
  reload,
  startLog,
}: {
  data: any
  reload: () => void
  startLog: (email: string, scheduleId?: string) => void
}) {
  const days: [string, any[]][] = []
  data.upcoming.forEach((r: any) => {
    const d = kwDate(r.scheduledAt)
    const last = days[days.length - 1]
    if (last && last[0] === d) last[1].push(r)
    else days.push([d, [r]])
  })
  return (
    <section className="card pw-section" aria-labelledby="booked-h">
      <div className="card-head">
        <div className="card-title" id="booked-h">
          Booked 1:1s
        </div>
        <div className="card-hint">
          {data.me.role === 'admin'
            ? 'Every booked 1:1 on the team, soonest first.'
            : 'The 1:1s you hold and the ones with your own manager, soonest first.'}{' '}
          Times are Kuwait.
        </div>
      </div>
      <div className="card-pad">
        {data.upcoming.length ? (
          days.map(([d, rows]) => (
            <div key={d} className="pw-booked-day">
              <h3 className="pw-booked-date">
                {d === today() ? `Today, ${dayLabel(d)}` : d === addDays(today(), 1) ? `Tomorrow, ${dayLabel(d)}` : dayLabel(d)}
              </h3>
              <ul className="pw-rows">
                {rows.map((r) => (
                  <BookedRow key={r.scheduleId} row={r} me={data.me} reload={reload} startLog={startLog} />
                ))}
              </ul>
            </div>
          ))
        ) : (
          <div className="empty">
            <div className="s">No 1:1 booked. Book one for each person under &quot;Who is due&quot;.</div>
          </div>
        )}
      </div>
    </section>
  )
}

function BookedDue({
  data,
  reload,
  startLog,
}: {
  data: any
  reload: () => void
  startLog: (email: string, scheduleId?: string) => void
}) {
  return (
    <>
      <BookedSection data={data} reload={reload} startLog={startLog} />
      {data.missed.length ? (
        <section className="card pw-section" aria-labelledby="missed-h">
          <div className="card-head">
            <div className="card-title" id="missed-h">
              Not logged by {data.cutoff}
            </div>
            <div className="card-hint">
              Each one stays on your login pop-up until you submit the record or mark it not held with a new date.
            </div>
          </div>
          <div className="card-pad">
            {data.missed.map((r: any) => (
              <MissedRow key={r.scheduleId} row={r} reload={reload} startLog={startLog} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="card pw-section" aria-labelledby="people-h">
        <div className="card-head">
          <div className="card-title" id="people-h">
            Who is due
          </div>
          <div className="card-hint">
            Set the exact date and time for each 1:1. A 1:1 with no record by {data.cutoff} Kuwait time on its day counts
            as missed.
          </div>
        </div>
        <div className="card-pad">
          {data.people.length ? (
            <ul className="pw-rows">
              {data.people.map((p: any) => (
                <DueRow key={p.email} p={p} reload={reload} startLog={startLog} />
              ))}
            </ul>
          ) : (
            <div className="empty">
              <div className="s">Nobody reports to you on the roster yet. Ask the CX admin to update it.</div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

/* ------------------------------------------------ Xl — Log a 1:1 tab */
function LogTab({ data, initial, onDone }: { data: any; initial: any; onDone: () => void }) {
  const [email, setEmail] = useState(initial?.email ?? '')
  const [slot, setSlot] = useState(initial?.scheduleId ?? '')
  const [start, setStart] = useState<any>(null)
  const busy = useBusy()
  /* Render-adjust equivalents of the closure's two sync effects: adopt a new
   * `initial`, and clear the loaded start payload when the person changes. */
  const initKey = `${initial?.email ?? ''}|${initial?.scheduleId ?? ''}`
  const [seenInit, setSeenInit] = useState(initKey)
  if (initKey !== seenInit) {
    setSeenInit(initKey)
    if (initial) {
      setEmail(initial.email)
      setSlot(initial.scheduleId ?? '')
    }
  }
  const [seenEmail, setSeenEmail] = useState(email)
  if (seenEmail !== email) {
    setSeenEmail(email)
    setStart(null)
  }
  useEffect(() => {
    if (email) busy.run(() => api.oneOnOnesStart(email)).then((s) => s && setStart(s))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])
  const slots = [...data.missed, ...data.upcoming].filter(
    (r: any) => r.reportEmail === email && r.managerEmail === data.me.email
  )
  return (
    <div>
      <div className="pw-inline pw-section">
        <label className="field">
          <span className="field-label">Who is the 1:1 with?</span>
          <Select
            className="select"
            value={email}
            onChange={(e) => {
              setEmail(e.currentTarget.value)
              setSlot('')
            }}
          >
            <option value="">Choose a person</option>
            {data.people.map((p: any) => (
              <option key={p.email} value={p.email}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        {slots.length ? (
          <label className="field">
            <span className="field-label">Which booked slot does this record?</span>
            <Select className="select" value={slot} onChange={(e) => setSlot(e.currentTarget.value)}>
              <option value="">Not booked in advance</option>
              {slots.map((r: any) => (
                <option key={r.scheduleId} value={r.scheduleId}>
                  {dayTime(r.scheduledAt)}
                  {r.status === 'missed' ? ' (missed)' : ''}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>
      <PwErr message={busy.error} />
      {email ? (
        start ? (
          <LogForm key={email} start={start} scheduleId={slot} me={data.me} onDone={onDone} />
        ) : busy.error ? null : (
          <PwSkel lines={4} />
        )
      ) : (
        <div className="empty">
          <div className="s">
            Choose a person to open their 1:1. It starts with the actions still open from last time.
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------ ea — Records tab */
function Records({
  logs,
  deleted,
  me,
  reload,
  initialOpen,
}: {
  logs: any[]
  deleted: any[]
  me: any
  reload: () => void
  initialOpen: string
}) {
  const [openId, setOpenId] = useState('')
  const [del, setDel] = useState<any>(null)
  const busy = useBusy()
  const admin = me.role === 'admin'
  const previewDelete = (log: any) => {
    setDel({ log, lines: [], loading: true })
    api.oneOnOnesDeletePreview(log.logId).then(
      (r) => setDel((d: any) => (d && d.log.logId === log.logId ? { ...d, lines: r.lines, loading: false } : d)),
      (e) =>
        setDel(
          (d: any) => d && { ...d, lines: [`Could not work out what goes with it: ${e.message}`], loading: true }
        )
    )
  }
  const toggle = (id: string) => setOpenId(id)
  /* ?log=<id> deep link: open that record once it exists (render-adjust). */
  const [seenOpen, setSeenOpen] = useState('')
  if (initialOpen && initialOpen !== seenOpen) {
    setSeenOpen(initialOpen)
    if (logs.some((l) => l.logId === initialOpen)) setOpenId(initialOpen)
  }
  /* warm the detail fetch for the open record, like the closure's toggle. */
  const warmed = useRef('')
  useEffect(() => {
    if (openId && openId !== warmed.current) {
      warmed.current = openId
      api.oneOnOnesGetLog(openId).catch(() => {})
    }
  }, [openId])
  const [person, setPerson] = useState('')
  const names = useMemo(() => [...new Set(logs.map((l) => l.reportName))].sort(), [logs])
  const shown = person ? logs.filter((l) => l.reportName === person) : logs
  const deletedSection =
    admin && deleted.length ? (
      <section className="card pw-section" aria-labelledby="deleted-h" style={{ marginTop: 32 }}>
        <div className="card-head">
          <div className="card-title" id="deleted-h">
            Deleted 1:1s
          </div>
          <div className="card-hint">
            Hidden from every list and count. Restore puts back the record and what its delete undid.
          </div>
        </div>
        <PwErr message={busy.error} />
        <ul className="worklist" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {deleted.map((d: any) => (
            <li key={d.type + d.id} className="pw-row">
              <div>
                <div className="pw-row-title">{d.label}</div>
                <div className="pw-row-meta">
                  Deleted {dayTime(d.deletedAt)} by {d.deletedBy}: {d.reason}
                </div>
              </div>
              <span></span>
              <div className="pw-row-actions">
                <Button
                  size="sm"
                  disabled={busy.busy}
                  onClick={() =>
                    busy.run(() => api.oneOnOnesRestore(d.type, d.id)).then((r) => {
                      if (r) {
                        toast('Restored')
                        reload()
                      }
                    })
                  }
                >
                  Restore
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    ) : null
  return logs.length ? (
    <>
      <label className="field pw-section" style={{ maxWidth: 280 }}>
        <span className="field-label">Person</span>
        <Select className="select" value={person} onChange={(e) => setPerson(e.currentTarget.value)}>
          <option value="">Everyone</option>
          {names.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </Select>
      </label>
      <section className="card pw-section" aria-label="1:1 records">
        <div className="card-head">
          <div className="card-title">1:1 records</div>
        </div>
        <ul className="worklist" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {shown.map((l: any) => (
          <li key={l.logId} className="pw-row">
            <div>
              <div className="pw-row-title">
                {l.managerName} with {l.reportName}
              </div>
              <div className="pw-row-meta">{l.topics.map((t: any) => t.topic.replace(/_/g, ' ')).join(', ')}</div>
            </div>
            <div className="pw-row-meta pw-num">
              {dayTime(l.heldAt)} {l.onTime ? null : <span className="pill warn">Logged late</span>}{' '}
              {l.topics.some((t: any) => t.outcome === 'Escalate to Mohamed') ? (
                <span className="pill bad">Escalated to Mohamed</span>
              ) : null}
            </div>
            <div className="pw-row-actions">
              <Button
                size="sm"
                aria-expanded={openId === l.logId}
                onClick={() => toggle(openId === l.logId ? '' : l.logId)}
              >
                {openId === l.logId ? 'Hide' : 'Read'}
              </Button>
              {admin ? (
                <Button size="sm" className="pw-del-btn" onClick={() => previewDelete(l)}>
                  Delete
                </Button>
              ) : null}
            </div>
            {openId === l.logId ? (
              <div className="pw-row-wide">
                <p className="pw-summary">{l.summary}</p>
                {l.topics.map((t: any) =>
                  t.evidence ? (
                    <p key={t.topic} className="pw-small" style={{ marginTop: 8 }}>
                      Evidence: {t.evidence.behaviour}; {t.evidence.evidence}; standard {t.evidence.standard}; shown
                      before: {t.evidence.shownBefore}.
                    </p>
                  ) : null
                )}
                {l.skipped.length ? (
                  <p className="pw-small pw-muted" style={{ marginTop: 8 }}>
                    Not discussed: {l.skipped.map((s: any) => `${s.topic} (${s.reason})`).join('; ')}
                  </p>
                ) : null}
                {l.privateNotes.map((n: any, i: number) => (
                  <p key={i} className="pw-small" style={{ marginTop: 8, whiteSpace: 'pre-line' }}>
                    <strong>{n.kind === 'private_assessment' ? 'Private assessment' : 'Private note'}:</strong> {n.note}
                  </p>
                ))}
              </div>
            ) : null}
          </li>
        ))}
        </ul>
      </section>
      {deletedSection}
      {del ? (
        <PwDialog
          title={`Delete the 1:1 record: ${del.log.managerName} with ${del.log.reportName}, ${dayTime(del.log.heldAt)}?`}
          lines={del.lines}
          loading={del.loading}
          confirmLabel="Delete record"
          onClose={() => setDel(null)}
          onConfirm={async (r) => {
            await api.oneOnOnesDeleteLog(del.log.logId, r)
            toast('1:1 record deleted. Restore it under Deleted 1:1s.')
            reload()
            return true
          }}
        />
      ) : null}
    </>
  ) : (
    <>
      <section className="card pw-section">
        <div className="card-pad">
          <div className="empty">
            <div className="s">No 1:1 records yet. Log one from the Log a 1:1 tab.</div>
          </div>
        </div>
      </section>
      {deletedSection}
    </>
  )
}

/* ------------------------------------------------------- jl — page */
export function OneOnOnesPage({ route }: { route: { title: string; purpose?: string } }) {
  const { data, error, reload } = useSe('people.1on1', () => api.oneOnOnesPage())
  const [tab, setTab] = useState('schedule')
  const [initial, setInitial] = useState<any>(null)
  useEffect(() => {
    if (!data) return
    /* ?schedule=<id> opens that slot on the log tab; ?log=<id> goes to Records.
     * Deferred so the state updates are not synchronous in the effect body. */
    queueMicrotask(() => {
      const sched = hashParam('schedule')
      const hit = sched ? [...data.missed, ...data.upcoming].find((r: any) => r.scheduleId === sched) : undefined
      if (hit) {
        setInitial({ email: hit.reportEmail, scheduleId: hit.scheduleId })
        setTab('log')
      }
      if (hashParam('log')) setTab('records')
    })
  }, [data])
  const startLog = (email: string, scheduleId?: string) => {
    setInitial({ email, scheduleId })
    setTab('log')
    window.scrollTo(0, 0)
  }
  const tabs = [
    { id: 'schedule', label: 'Booked & due', count: data?.missed.length },
    { id: 'log', label: 'Log a 1:1' },
    { id: 'records', label: 'Records' },
  ]
  return (
    <PwShell route={routeOf('one-on-ones', route)}>
      <div className="pw-tabs" role="tablist" aria-label="One-to-ones">
        {tabs.map((t) => (
          // eslint-disable-next-line -- kept raw: .pw-tab role=tab element (family tab chrome)
          <button
            key={t.id}
            type="button"
            role="tab"
            className="pw-tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count ? <span className="pw-count">{t.count}</span> : null}
          </button>
        ))}
      </div>
      {error ? (
        <PwLate message={error} retry={reload} />
      ) : data ? (
        tab === 'schedule' ? (
          <BookedDue data={data} reload={reload} startLog={startLog} />
        ) : tab === 'log' ? (
          <LogTab
            data={data}
            initial={initial}
            onDone={() => {
              setInitial(null)
              void Promise.resolve(reload()).then(() => setTab('records'))
            }}
          />
        ) : (
          <Records
            logs={data.logs}
            deleted={data.deleted ?? []}
            me={data.me}
            reload={reload}
            initialOpen={hashParam('log') ?? ''}
          />
        )
      ) : (
        <PwSkel />
      )}
    </PwShell>
  )
}
