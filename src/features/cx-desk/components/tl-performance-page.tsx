'use client'

import { useCallback, useEffect, useReducer, useState, type ReactNode } from 'react'
import { fetchJson } from '@/features/shared/lib/fetch-json'
import { usePageData } from '@/features/shared/lib/use-page-data'
import { useSearchParamState } from '@/features/shared/lib/use-search-param-state'
import { toast } from '@/features/shared/components/shell/Toasts'
import { Button, Chip, Count, Empty, ErrMsg, Failed, Input, PageShell, Select, Skeleton, TableScroll, Textarea } from '@/features/shared/components/ui'
import type { ChipStatus } from '@/features/shared/components/ui/Chip'

/* ------------------------------------------------------------------ *
 * TL performance — port of the legacy Desk page (TlPerformance.js):
 * overall score, team KPI, weekly responsibility-area ratings, projects,
 * on-queue hours, and end-of-shift mail tracking.
 * ------------------------------------------------------------------ */

interface Zones { meets: number; exceeds: number }
interface AreaOut {
  area: string; target: string; measuredBy: string
  value: number | null; label: string; note: string
  history: { week: string; value: number }[]
  measured: { pct: number | null; met: number; total: number; rule: string; from: string } | null
  kb: { accuratePct: number | null; withinDayPct: number | null; open: number } | null
}
interface Project {
  actionId: string; title: string; status: string; overdue: boolean
  deliveredAt: string; deadlineAt: string; expectation: string
  value: number | null; label: string; ratingNote: string
}
interface Otd {
  warehouses: string[]
  months: { month: string; values: (number | null)[]; avg: number | null }[]
}
interface QueueData {
  days: { date: string; windows: string; queueMin: number; callsIn: number; answerRate: number | null; touches: number; respAvgMin: number | null; respCount: number }[]
  total: { queueMin: number; callsIn: number; serviced: number; abandoned: number; answerRate: number | null; touches: number; respAvgMin: number | null; respCount: number }
  source: string; asOf: string
}
interface MailSummary {
  expected: number; repliedByThem: number; coveredByOther: number; open: number; breached: number
  items: {
    messageId: string; gmailUrl: string; subject: string; kind: string; from: string
    receivedAt: string; dueAt: string; nextShift: boolean; status: string
    repliedBy: string; repliedAt: string; minutes: number | null; breached: boolean; coveringMissed: boolean
  }[]
}
interface TeamKpi {
  quality: number | null; fcr: number | null; productivity: number | null
  agents: number; month: string; asOf: string
  kpi: { score: number | null; prod: number | null; qual: number | null; fcr: number | null; behavior: number | null; agents: number; olAgents: number; ineligible: number; redZone: number; actionPlan: number; probation: number; partial: number } | null
}
interface TlData {
  tls: { email: string; name: string }[]
  tl: string; name: string; from: string; to: string; week: string
  canRate: boolean; zones: Zones
  team: TeamKpi | null
  responsibilities: number | null
  overall: { score: number | null; weights: Record<string, number>; missing: string[] }
  areas: AreaOut[]
  otd: Otd | null
  projects: Project[]
  queue: QueueData | null
  mail: MailSummary | null
  notes: string[]
}

const api = {
  tlPerformance: (tl: string) => fetchJson('/api/tl/page?tl=' + encodeURIComponent(tl)) as Promise<TlData>,
  rateArea: (tlEmail: string, area: string, value: number, note: string) =>
    fetchJson('/api/tl/rate', { method: 'POST', body: JSON.stringify({ action: 'area', tlEmail, area, value, note }) }) as Promise<{ value: number; label: string }>,
  rateProject: (actionId: string, value: number, note: string) =>
    fetchJson('/api/tl/rate', { method: 'POST', body: JSON.stringify({ action: 'project', actionId, value, note }) }) as Promise<{ value: number; label: string }>,
  otdSave: (month: string, values: (number | '')[]) =>
    fetchJson('/api/tl/otd', { method: 'POST', body: JSON.stringify({ month, values }) }) as Promise<Otd>,
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const utc3 = (v: string) => new Date(new Date(v).getTime() + 3 * 3600 * 1000)
const B = (v: string) => {
  if (!v) return ''
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00Z') : utc3(v)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}
const st = (v: string) => (v ? utc3(v).toISOString().slice(11, 16) : '')
const V = (v: string) => (v ? `${B(v)}, ${st(v)}` : '')
const LABEL: Record<string, string> = { below: 'Below', meets: 'Meets', exceeds: 'Exceeds' }
const TONE: Record<string, ChipStatus | undefined> = { below: 'bad', exceeds: 'ok' }
const ZONE_TONE: Record<string, string> = { below: 'bad', meets: 'warn', exceeds: 'ok' }
const band = (v: number | null | undefined) => (v === null || v === undefined ? undefined : v >= 90 ? 'ok' : v >= 75 ? 'warn' : 'bad')
const pct = (v: number | null) => (v === null ? '–' : `${v}%`)
const dash = (v: number | null | undefined) => (v === null || v === undefined ? '–' : String(v))
const mins = (v: number | null) => (v === null ? '–' : v >= 90 ? `${Math.round(v / 6) / 10} h` : `${v} min`)
const PART: Record<string, string> = { team: 'team KPI', responsibilities: 'responsibilities' }
const zone = (v: number, z: Zones) => (v >= z.exceeds ? 'exceeds' : v >= z.meets ? 'meets' : 'below')
function Shell({ route, aside, children }: { route: { title: string; purpose: string }; aside?: ReactNode; children: ReactNode }) {
  return (
    <PageShell
      title={route.title}
      purpose={route.purpose}
      aside={aside ? <div className="page-actions">{aside}</div> : undefined}
      id="page-title"
      className="dk"
    >
      {children}
    </PageShell>
  )
}

function Badge({ tone, children }: { tone?: ChipStatus; children: ReactNode }) {
  return <Chip tone={tone}>{children}</Chip>
}

function Rating({ value, label }: { value: number | null; label: string }) {
  return value === null ? (
    <Badge tone="warn">Not rated</Badge>
  ) : (
    <Badge tone={TONE[label]}>
      {LABEL[label]} {value}
    </Badge>
  )
}

function useLoaded<T>(load: () => Promise<T>) {
  return usePageData<T>(null, load, { cache: false })
}

function Slider({ id, value, note, zones, onSave }: { id: string; value: number | null; note: string; zones: Zones; onSave: (v: number, n: string) => Promise<void> }) {
  const [v, setV] = useState(value ?? zones.meets)
  const [rated, setRated] = useState(value !== null)
  const [n, setN] = useState(note)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const g = zone(v, zones)
  const save = async () => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      await onSave(v, n)
      toast(`Rated ${LABEL[g]} ${v}.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="dk-rate">
      <div
        className="dk-slider"
        style={{ '--p': rated ? v : 0 } as React.CSSProperties}
        data-label={rated ? g : 'none'}
        data-zone={rated ? ZONE_TONE[g] : 'none'}
      >
        <label className="cx-sr" htmlFor={`dk-r-${id}`}>
          Rating, 0 to 100
        </label>
        {/* intentionally raw: range slider styled by .dk-slider with zone data-attrs; labelled via cx-sr label htmlFor */}
        <input
          id={`dk-r-${id}`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={v}
          aria-valuetext={rated ? `${v}, ${LABEL[g]}` : 'Not rated'}
          onInput={(e) => {
            setV(Number(e.currentTarget.value))
            setRated(true)
          }}
        />
        <output htmlFor={`dk-r-${id}`} className="dk-slider__out">
          {rated ? (
            <>
              <b>{LABEL[g]}</b> {v}
            </>
          ) : (
            'Not rated: move the slider'
          )}
        </output>
      </div>
      <p className="dk-fine">
        Below under {zones.meets}, Meets {zones.meets} to {zones.exceeds - 1}, Exceeds {zones.exceeds} and over (Admin,
        tlp_rating_zones).
      </p>
      {rated ? (
        <>
          <label className="cx-sr" htmlFor={`dk-note-${id}`}>
            Note
          </label>
          <Textarea
            id={`dk-note-${id}`}
            className="input dk-note"
            rows={2}
            placeholder={g === 'below' ? 'What fell short (required)' : 'Note (optional)'}
            value={n}
            onInput={(e) => setN(e.currentTarget.value)}
          />
          <Button
            variant="primary"
            className="dk-sm"
            disabled={busy || (v === value && n.trim() === note) || (g === 'below' && n.trim().length < 10)}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : 'Save rating'}
          </Button>
        </>
      ) : null}
      <ErrMsg message={err} />
    </div>
  )
}

function Otd({ otd, canEdit }: { otd: Otd; canEdit: boolean }) {
  const [data, setData] = useState(otd)
  const [month, setMonth] = useState(otd.months[0]?.month ?? '')
  const cur = data.months.find((m) => m.month === month)
  const [vals, setVals] = useState<(number | '')[]>((cur?.values ?? []).map((x) => (x === null ? '' : x)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const pick = (m: string) => {
    setMonth(m)
    setVals((data.months.find((x) => x.month === m)?.values ?? []).map((x) => (x === null ? '' : x)))
  }
  return (
    <div className="dk-otd">
      <div className="cx-panel cx-panel--pad">
        <TableScroll label="On-time delivery by month" minWidth="36rem">
          <table className="dk-table">
          <thead>
            <tr>
              <th scope="col">Month</th>
              {data.warehouses.map((w) => (
                <th key={w} scope="col">
                  {w}
                </th>
              ))}
              <th scope="col">Average</th>
            </tr>
          </thead>
          <tbody>
            {data.months.map((m) => (
              <tr key={m.month}>
                <th scope="row">{m.month}</th>
                {m.values.map((x, i) => (
                  <td key={i}>{pct(x)}</td>
                ))}
                <td data-band={band(m.avg)}>{pct(m.avg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </TableScroll>
      </div>
      {canEdit ? (
        <div className="dk-otd__edit">
          <label className="dk-fine" htmlFor="dk-otd-m">
            Enter OTD % for
          </label>
          <Select id="dk-otd-m" className="select" value={month} onChange={(e) => pick(e.currentTarget.value)}>
            {data.months.map((m) => (
              <option key={m.month} value={m.month}>
                {m.month}
              </option>
            ))}
          </Select>
          <div className="dk-otd__grid">
            {data.warehouses.map((w, i) => (
              <label key={w} className="dk-fine">
                {w}
                <Input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  inputMode="decimal"
                  value={vals[i] ?? ''}
                  onInput={(e) =>
                    setVals((a) => a.map((x, j) => (j === i ? (e.currentTarget.value === '' ? '' : Number(e.currentTarget.value)) : x)))
                  }
                />
              </label>
            ))}
          </div>
          <Button
            variant="primary"
            className="dk-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setErr('')
              try {
                setData(await api.otdSave(month, vals))
                toast('OTD saved.')
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Saving…' : 'Save OTD'}
          </Button>
          <ErrMsg message={err} />
        </div>
      ) : null}
      <p className="dk-fine">
        Entered by hand until the OTD sheet is connected (Admin, otd_sheet_id). Warehouse names: Admin, otd_warehouses.
      </p>
    </div>
  )
}

function MailItem({ m }: { m: MailSummary['items'][number] }) {
  return (
    <li>
      <div className="dk-row">
        <a className="cx-link" href={m.gmailUrl} target="_blank" rel="noopener noreferrer">
          {m.subject}
        </a>
        {m.status === 'open' ? <Badge tone={m.breached ? 'bad' : 'warn'}>{m.breached ? 'Open past due' : 'Open'}</Badge> : null}
        {m.coveringMissed ? <Badge tone="bad">Replied by {m.repliedBy}</Badge> : null}
        {m.status === 'replied' && m.breached ? <Badge tone="warn">Replied after the shift ended</Badge> : null}
      </div>
      <span className="dk-fine">
        {m.kind === 'chargeback' ? 'Chargeback' : 'MyFatoorah refund update'} from {m.from}, {V(m.receivedAt)}.{' '}
        {m.status === 'replied' ? `${m.repliedBy} replied at ${st(m.repliedAt)} (${mins(m.minutes)}).` : 'No reply yet.'}{' '}
        {m.dueAt ? `Due ${V(m.dueAt)}${m.nextShift ? ', the end of the next shift (it arrived outside queue hours)' : ', the end of the shift'}.` : ''}
      </span>
    </li>
  )
}

function Body({ p, reload }: { p: TlData; reload: () => void }) {
  const [areas, setAreas] = useState(p.areas)
  const [projects, setProjects] = useState(p.projects)
  const c = p.overall
  const l = p.team?.kpi
  const first = p.name.split(' ')[0] || p.name
  return (
    <>
      <div className="dk-overall" data-band={band(c.score)}>
        <b>
          <Count v={dash(c.score)} />
        </b>
        <span>
          {first}&apos;s overall score: {Object.entries(c.weights).map(([k, w]) => `${PART[k] ?? k} ${w}%`).join(' + ')}
          {c.missing.length ? ` (no ${c.missing.map((m) => PART[m] ?? m).join(' or ')} yet, so left out)` : ''}. The 85 / 15
          split is unconfirmed; it is set in Admin, tlp_weights.
        </span>
      </div>
      <div className="dk-stats">
        <div data-band={band(l?.score ?? null)}>
          <b>
            <Count v={dash(l?.score ?? null)} />
          </b>{' '}
          team KPI (mean agent payout)
        </div>
        <div>
          <b>
            <Count v={dash(l?.prod ?? null)} />
          </b>{' '}
          productivity points
        </div>
        <div>
          <b>
            <Count v={dash(l?.qual ?? null)} />
          </b>{' '}
          quality points
        </div>
        <div>
          <b>
            <Count v={dash(l?.fcr ?? null)} />
          </b>{' '}
          FCR points
        </div>
        <div>
          <b>
            <Count v={dash(l?.behavior ?? null)} />
          </b>{' '}
          behaviour points
        </div>
        <div data-band={band(p.responsibilities)}>
          <b>
            <Count v={dash(p.responsibilities)} />
          </b>{' '}
          responsibilities this week
        </div>
      </div>
      {p.team && l ? (
        <p className="dk-fine">
          {l.agents} of {p.team.agents} agents with scorecard numbers ({p.team.month}); {l.probation} on probation
          tables. {l.olAgents} with an operational-loss deduction (50%), {l.ineligible} not eligible for unplanned
          leaves, {l.redZone} in the red zone, {l.actionPlan} on an action-plan flag
          {l.partial ? `, ${l.partial} incomplete (a missing KPI counts as 0)` : ''}. Raw team averages: quality{' '}
          {pct(p.team.quality)}, FCR {pct(p.team.fcr)}, productivity {pct(p.team.productivity)}. Updated {V(p.team.asOf)}.
        </p>
      ) : (
        <p className="dk-fine">No team KPI yet: the Hub writes it every hour.</p>
      )}
      <h2 className="dk-h">Responsibilities, week of {B(p.week)}</h2>
      {areas.length ? (
        <div className="cx-panel cx-panel--pad">
        <ul className="dk-list">
          {areas.map((a) => (
            <li key={a.area}>
              <div className="dk-row">
                <b>{a.area}</b>
                <Rating value={a.value} label={a.label} />
                {a.measured ? (
                  <Badge tone={a.measured.pct === null ? undefined : a.measured.pct >= 90 ? 'ok' : 'bad'}>
                    {a.measured.pct === null ? 'No tickets' : `${a.measured.pct}%`} in SLA, 7 days ({a.measured.met} of{' '}
                    {a.measured.total})
                  </Badge>
                ) : null}
                {a.kb ? (
                  <Badge tone={a.kb.accuratePct !== null && a.kb.accuratePct < 100 ? 'bad' : undefined}>
                    KB 30 days: {pct(a.kb.accuratePct)} accurate, {pct(a.kb.withinDayPct)} within 1 day, {a.kb.open} open
                  </Badge>
                ) : null}
              </div>
              <span className="dk-fine">
                Target: {a.target}. Measured by: {a.measuredBy}.
              </span>
              {a.history.length ? (
                <span className="dk-fine">
                  Earlier: {a.history.slice(0, 4).map((h) => `${B(h.week)} ${h.value}`).join('; ')}
                </span>
              ) : null}
              {a.area === 'OTD' && p.otd ? <Otd otd={p.otd} canEdit={p.canRate} /> : null}
              {p.canRate ? (
                <Slider
                  id={a.area}
                  value={a.value}
                  note={a.note}
                  zones={p.zones}
                  onSave={async (v, n) => {
                    const d = await api.rateArea(p.tl, a.area, v, n)
                    setAreas((list) => list.map((x) => (x.area === a.area ? { ...x, value: d.value, label: d.label, note: n.trim() } : x)))
                  }}
                />
              ) : a.note ? (
                <p className="dk-fine">{a.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
        </div>
      ) : (
        <div className="cx-panel">
          <Empty title={`No areas are set for ${first}. Add them under Hub Admin, tlp_tl_areas.`} />
        </div>
      )}
      <h2 className="dk-h">Projects against your expectation</h2>
      <p className="dk-fine">Shown for the 1:1; not part of the overall score.</p>
      {projects.length ? (
        <div className="cx-panel cx-panel--pad">
        <ul className="dk-list">
          {projects.map((o) => (
            <li key={o.actionId}>
              <div className="dk-row">
                <b>{o.title}</b>
                {o.status === 'done' ? <Rating value={o.value} label={o.label} /> : o.overdue ? <Badge tone="bad">Overdue</Badge> : <Badge>Open</Badge>}
              </div>
              <span className="dk-fine">{o.status === 'done' ? `Delivered ${B(o.deliveredAt)}` : `Due ${B(o.deadlineAt)}`}</span>
              <p className="dk-expect">{o.expectation ? `Expected: ${o.expectation}` : 'No expectation was written when it was assigned.'}</p>
              {p.canRate && o.status === 'done' ? (
                <Slider
                  id={o.actionId}
                  value={o.value}
                  note={o.ratingNote}
                  zones={p.zones}
                  onSave={async (v, n) => {
                    const d = await api.rateProject(o.actionId, v, n)
                    setProjects((list) => list.map((x) => (x.actionId === o.actionId ? { ...x, value: d.value, label: d.label, ratingNote: n.trim() } : x)))
                  }}
                />
              ) : o.ratingNote ? (
                <p className="dk-fine">{o.ratingNote}</p>
              ) : null}
            </li>
          ))}
        </ul>
        </div>
      ) : (
        <div className="cx-panel">
          <Empty title="No projects in the last 90 days." />
        </div>
      )}
      <h2 className="dk-h">
        While on queue, {B(p.from)} to {B(p.to)}
      </h2>
      {!p.queue || !p.queue.days.length ? (
        <div className="cx-panel">
          <Empty title={`No queue-hour numbers for ${first} these 7 days. The Hub writes them hourly from the TL scheduler.`} />
        </div>
      ) : (
        <>
          <div className="dk-stats">
            <div data-band={band(p.queue.total.answerRate)}>
              <b>
                <Count v={pct(p.queue.total.answerRate)} />
              </b>{' '}
              calls answered ({p.queue.total.serviced} of {p.queue.total.serviced + p.queue.total.abandoned})
            </div>
            <div>
              <b>
                <Count v={p.queue.total.touches} />
              </b>{' '}
              texting touches
            </div>
            <div>
              <b>
                <Count v={mins(p.queue.total.respAvgMin)} />
              </b>{' '}
              average response ({p.queue.total.respCount})
            </div>
          </div>
          <div className="cx-panel cx-panel--pad">
            <TableScroll label="Queue performance by day" minWidth="32rem">
            <table className="dk-table">
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">On queue</th>
                  <th scope="col">Answered</th>
                  <th scope="col">Touches</th>
                  <th scope="col">Response</th>
                </tr>
              </thead>
              <tbody>
                {p.queue.days.map((d) => (
                  <tr key={d.date}>
                    <th scope="row">
                      {B(d.date)}
                      <span className="dk-fine">{d.windows}</span>
                    </th>
                    <td>{Math.round(d.queueMin / 6) / 10} h</td>
                    <td data-band={band(d.answerRate)}>
                      {pct(d.answerRate)}
                      <span className="dk-fine">{d.callsIn} calls</span>
                    </td>
                    <td>{d.touches}</td>
                    <td>{mins(d.respAvgMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableScroll>
          </div>
          <p className="dk-fine">
            Queue hours from the TL scheduler. Calls from Maqsam: answered = answered or completed, or any handling
            time; abandoned = abandoned, missed or no-answer.{' '}
            {p.queue.source === 'freshchat'
              ? 'Texting from Freshchat messages: response is a customer message to the next agent reply.'
              : 'Texting from Freshdesk: activity-log touches and the first response of texting tickets.'}{' '}
            Response counts queue hours only.{p.queue.asOf ? ` Updated ${V(p.queue.asOf)}.` : ''}
          </p>
        </>
      )}
      <h2 className="dk-h">Mails to answer by the end of the shift</h2>
      {!p.mail || !p.mail.items.length ? (
        <div className="cx-panel">
          <Empty title={`No MyFatoorah refund updates or chargeback mails for ${first} these 7 days.`} />
        </div>
      ) : (
        <>
          <div className="dk-stats">
            <div data-band={p.mail.repliedByThem === p.mail.expected ? 'ok' : 'warn'}>
              <b>
                <Count v={p.mail.repliedByThem} /> of <Count v={p.mail.expected} />
              </b>{' '}
              replied by {first}
            </div>
            <div data-band={p.mail.coveredByOther ? 'bad' : 'ok'}>
              <b>
                <Count v={p.mail.coveredByOther} />
              </b>{' '}
              replied by someone else
            </div>
            <div data-band={p.mail.breached ? 'bad' : 'ok'}>
              <b>
                <Count v={p.mail.breached} />
              </b>{' '}
              late{p.mail.open ? `, ${p.mail.open} open` : ''}
            </div>
          </div>
          <div className="cx-panel cx-panel--pad">
          <ul className="dk-list">
            {p.mail.items.map((m) => (
              <MailItem key={m.messageId} m={m} />
            ))}
          </ul>
          </div>
        </>
      )}
      {p.notes.map((n) => (
        <p key={n} className="dk-error">
          {n}
        </p>
      ))}
      <p className="dk-fine">
        <Button variant="quiet" className="dk-sm" onClick={reload}>
          Reload
        </Button>
      </p>
    </>
  )
}

const ROUTE = {
  title: 'TL performance',
  purpose: "A team lead's week: scores, projects, queue hours and mails.",
}

export default function TlPerformancePage() {
  const [tl, setTl] = useSearchParamState('tl', '')
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    const onHash = () => bump()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const load = useCallback(() => api.tlPerformance(tl), [tl])
  const { data, error, reload } = useLoaded(load)
  const aside =
    data && data.tls.length > 1 ? (
      <label className="dk-pick">
        <span className="cx-sr">Team lead</span>
        <Select className="select" value={data.tl} onChange={(e) => setTl(e.currentTarget.value)}>
          {data.tls.map((t) => (
            <option key={t.email} value={t.email}>
              {t.name}
            </option>
          ))}
        </Select>
      </label>
    ) : null
  return (
    <Shell route={ROUTE} aside={aside}>
      {error ? (
        <Failed message={error} retry={() => void reload()} />
      ) : !data || (tl && data.tl !== tl) ? (
        <Skeleton shape="rows" n={5} />
      ) : (
        <Body key={data.tl} p={data} reload={() => void reload()} />
      )}
    </Shell>
  )
}
