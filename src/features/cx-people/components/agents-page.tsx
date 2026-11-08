'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Agent performance (scorecard) page
 * (agents.closure.js symbols hl/cl/ft/ml/ue/ol/pl). */
import { useEffect, useMemo, useState } from 'react'
import { AsOfHint, Head, LoadError, fetchJson, useSe } from './shared'
import { LinesSkeleton } from '@/features/shared/components/shell/ui'
import { Button, Input, Seg, Select } from '@/features/shared/components/ui'
import { useBoot } from '@/features/shared/shell/context'

/* me — the scorecard facade (Scorecard.js). */
const api = {
  page: (from?: string, to?: string) =>
    fetchJson(`/api/people/scorecard?view=page${from && to ? `&from=${from}&to=${to}` : ''}`),
  detail: (email: string, from: string, to: string) =>
    fetchJson(`/api/people/scorecard?view=detail&email=${encodeURIComponent(email)}&from=${from}&to=${to}`),
  refresh: (months: string[]) => fetchJson('/api/people/scorecard', { op: 'refresh', months }),
  admin: () => fetchJson('/api/people/scorecard?view=admin'),
  saveSource: (month: string, link: string) => fetchJson('/api/people/scorecard', { op: 'save_source', month, link }),
  removeSource: (month: string) => fetchJson('/api/people/scorecard', { op: 'remove_source', month }),
}

/* bt / Dt / yn / He */
const COLUMNS = ['Inbound', 'Texting', 'Waiting Addr', 'Productivity', 'Quality', 'FCR', 'Behaviour', 'KPI score']
const KPI_LABELS: Record<string, string> = { prod: 'Productivity', qual: 'Quality', fcr: 'FCR', behavior: 'Behaviour' }
const KPI_WEIGHTS: Record<string, number> = { prod: 35, qual: 35, fcr: 15, behavior: 15 }
const payLine = (kpi: any, key: string) =>
  kpi.pay[key] === null ? 'no data: 0 pts' : `${kpi.pay[key]}% pay, ${kpi.points[key]} pts`

/* vn / mt / dl */
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
const monthStart = (d: string) => d.slice(0, 7) + '-01'
const monthsBetween = (from: string, to: string) => {
  const out: string[] = []
  for (let y = +from.slice(0, 4), m = +from.slice(5, 7); y * 12 + m <= +to.slice(0, 4) * 12 + +to.slice(5, 7) && out.length < 14; m++) {
    if (m > 12) {
      y++
      m = 1
    }
    out.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return out
}

/* ul */
const tone = (v: number | null) => (v === null ? 'neutral' : v >= 90 ? 'ok' : v >= 75 ? 'warn' : 'bad')

/* pl — the "How the score is built" sub-label under KPI score. */
function kpiSub(k: any) {
  const parts: string[] = []
  if (k.incomplete) parts.push(`incomplete (missing: ${k.missing.map((m: string) => KPI_LABELS[m]).join(', ')})`)
  if (k.ineligible) parts.push('not eligible: unplanned leaves')
  if (k.olDeduction) parts.push(`OL case: ${k.base} x 50%`)
  if (k.probationMonth) parts.push(`probation month ${k.probationMonth}`)
  return parts.join('; ') || 'sum of points'
}

/* ue — a % value chip with an optional sub-line. */
function Val({ v, sub }: { v: number | null; sub?: string }) {
  return (
    <>
      <span className="cx-chip cx-chip--plain" data-status={tone(v)}>
        {v === null ? '–' : `${v}%`}
      </span>
      {sub ? <span className="cx-hint dq-sub">{sub}</span> : null}
    </>
  )
}

/* ft — one scorecard row's eight KPI cells. */
function ScoreCells({ t }: { t: any }) {
  const scored = t.fcrPassed + t.fcrFailed
  const behaviorSub =
    t.behavior === null
      ? 'no log'
      : t.behaviorCases
        ? `${t.behaviorCases === 1 ? '1 case' : `${t.behaviorCases} cases`}${t.behaviorDetails[0]?.note ? ` · ${t.behaviorDetails[0].note}` : ''}`
        : 'clear'
  return (
    <>
      <td>
        <Val v={t.inbProd} sub={`${t.inbAchieved} / ${t.inbTarget}`} />
      </td>
      <td>
        <Val v={t.txtProd} sub={`${t.txtAchieved} / ${t.txtTarget}`} />
      </td>
      <td>
        <Val v={t.waProd} sub={`${t.waAchieved} / ${t.waTarget}`} />
      </td>
      <td>
        <Val v={t.prod} sub={`${t.totalAchieved} / ${t.totalTarget}`} />
        <span className="cx-hint dq-sub">{payLine(t.kpi, 'prod')}</span>
      </td>
      <td>
        <Val v={t.qual} sub={`${t.audits} ${t.audits === 1 ? 'audit' : 'audits'}`} />
        <span className="cx-hint dq-sub">{payLine(t.kpi, 'qual')}</span>
      </td>
      <td>
        <Val v={t.fcr} sub={`${t.fcrPassed} / ${scored} scored${t.fcrExcluded ? ` · ${t.fcrExcluded} excl` : ''}`} />
        <span className="cx-hint dq-sub">{payLine(t.kpi, 'fcr')}</span>
      </td>
      <td>
        <Val v={t.behavior} sub={behaviorSub} />
        <span className="cx-hint dq-sub">{payLine(t.kpi, 'behavior')}</span>
      </td>
      <td>
        <strong>
          <Val v={t.overall} sub={kpiSub(t.kpi)} />
        </strong>
      </td>
    </>
  )
}

/* ml — "How the score is built". */
function KpiBuild({ k, raw }: { k: any; raw: any }) {
  const raws: Record<string, number | null> = {
    prod: raw.prod,
    qual: raw.qual,
    fcr: raw.fcr,
    behavior: raw.behavior,
  }
  return (
    <>
      <h3 className="cx-section__title">How the score is built</h3>
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table cx-table--nowrap">
          <thead>
            <tr>
              <th scope="col">KPI</th>
              <th scope="col" className="cx-num-col">
                Raw
              </th>
              <th scope="col" className="cx-num-col">
                Payout
              </th>
              <th scope="col" className="cx-num-col">
                Weight
              </th>
              <th scope="col" className="cx-num-col">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(KPI_WEIGHTS).map((key) => (
              <tr key={key}>
                <th scope="row">{KPI_LABELS[key]}</th>
                <td className="cx-num-col cx-num">{raws[key] === null ? 'no data' : `${raws[key]}%`}</td>
                <td className="cx-num-col cx-num">{k.pay[key] === null ? '0% (missing)' : `${k.pay[key]}%`}</td>
                <td className="cx-num-col cx-num">{KPI_WEIGHTS[key]}%</td>
                <td className="cx-num-col cx-num">{k.points[key]}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">Sum of points</th>
              <td />
              <td />
              <td />
              <td className="cx-num-col cx-num">{k.base ?? '–'}</td>
            </tr>
            {k.olDeduction && !k.ineligible ? (
              <tr>
                <th scope="row">
                  Operational loss ({k.olCases} {k.olCases === 1 ? 'case' : 'cases'})
                </th>
                <td />
                <td />
                <td />
                <td className="cx-num-col cx-num">x 50%</td>
              </tr>
            ) : null}
            {k.ineligible ? (
              <tr>
                <th scope="row">Unplanned leaves: not eligible</th>
                <td />
                <td />
                <td />
                <td className="cx-num-col cx-num">0</td>
              </tr>
            ) : null}
            <tr>
              <th scope="row">
                <strong>KPI score</strong>
              </th>
              <td />
              <td />
              <td />
              <td className="cx-num-col cx-num">
                <strong>{k.total ?? '–'}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {k.incomplete ? (
        <p className="cx-hint">
          Incomplete (missing: {k.missing.map((m: string) => KPI_LABELS[m]).join(', ')}): counted as 0 points, not
          re-weighted.
        </p>
      ) : null}
      {k.probationMonth ? (
        <p className="cx-hint">
          Probation month {k.probationMonth}: each KPI pays 100% on a pass and 0% on a fail.
          {k.flags.length ? ` Flags: ${k.flags.join(', ')}.` : ''}
        </p>
      ) : null}
    </>
  )
}

/* ol — the per-month read status chip. */
function ReadChip({ m }: { m: any }) {
  if (m.status === 'never' || m.status === '')
    return (
      <span className="cx-chip" data-status="neutral">
        Not read yet
      </span>
    )
  if (m.status === 'error')
    return (
      <span className="cx-chip" data-status="bad">
        Last read failed
      </span>
    )
  return (
    <span className="cx-chip" data-status="ok">
      Read
    </span>
  )
}

/* cl — the admin "Productivity workbook per month" block. */
function ScorecardAdmin() {
  const { data, error, reload } = useSe('people.scorecard.admin', () => api.admin())
  const [month, setMonth] = useState('')
  const [link, setLink] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [found, setFound] = useState<any>(null)
  const [note, setNote] = useState('')
  const [noteErr, setNoteErr] = useState('')

  const run = (key: string, call: () => Promise<any>, done: (r: any) => void) => {
    setBusyKey(key)
    setNote('')
    setNoteErr('')
    call().then(
      (r) => {
        setBusyKey('')
        done(r)
      },
      (e) => {
        setBusyKey('')
        setNoteErr(e.message)
      }
    )
  }
  const save = (m: string, l: string) =>
    run('save', () => api.saveSource(m, l), (r) => {
      setFound({ month: m, i: r.found })
      setNote(`Saved for ${m}. Press Refresh to read it now.`)
      setLink('')
      reload()
    })
  const refresh = (m: string) =>
    run('r' + m, () => api.refresh([m]), (r) => {
      const a = r.months[0]
      setNote(
        a.status === 'error'
          ? `${m}: ${a.error}`
          : a.retryInS
            ? `${m}: read a moment ago, try again in ${a.retryInS} s.`
            : `${m}: read ${a.matrixRows} agent-days, ${a.agents} agents, ${a.fcrRows} FCR rows, ${a.behaviourCases} behaviour cases.`
      )
      reload()
    })
  const remove = (m: string) =>
    run('x' + m, () => api.removeSource(m), () => {
      setNote(`Workbook removed for ${m}. The numbers already read stay until that month is read again.`)
      reload()
    })

  return (
    <div className="block">
      <h2 className="block-title">Productivity workbook per month</h2>
      <p className="block-text">
        The Agent performance page reads each month&apos;s workbook (tabs{' '}
        {data?.tabs.join(', ') ?? 'Productivity Matrix, FCR, Business Behavior'}) into V2 once, overnight for the current
        month and whenever Refresh is pressed. It assumes the same tab layout every month. A month with no workbook of
        its own uses the fallback
        {data ? (
          <>
            {' '}
            (<code>{data.fallbackId.slice(0, 8)}…</code>)
          </>
        ) : null}
        , which only works while the fallback holds that month&apos;s rows.
      </p>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <form
            className="cx-filters"
            onSubmit={(e) => {
              e.preventDefault()
              save(month, link)
            }}
          >
            <div className="cx-field">
              <label className="cx-label" htmlFor="ps-month">
                Month
              </label>
              <Input
                id="ps-month"
                type="month"
                required
                value={month}
                placeholder={data.current}
                onInput={(e) => setMonth(e.currentTarget.value)}
              />
            </div>
            <div className="cx-field" style={{ flex: 1, minInlineSize: '18rem' }}>
              <label className="cx-label" htmlFor="ps-link">
                Workbook link or ID
              </label>
              <Input id="ps-link" required value={link} onInput={(e) => setLink(e.currentTarget.value)} />
            </div>
            <Button type="submit" variant="primary" disabled={busyKey === 'save'}>
              {busyKey === 'save' ? 'Checking…' : 'Check and save'}
            </Button>
          </form>
          {noteErr ? (
            <div className="cx-note" data-status="bad" role="alert">
              <div>{noteErr}</div>
            </div>
          ) : null}
          {note ? (
            <div className="cx-note" data-status="ok" role="status">
              <div>{note}</div>
            </div>
          ) : null}
          {found ? (
            <div className="cx-note" data-status={found.i.monthMatches ? 'info' : 'warn'} role="status">
              <div>
                <strong>{found.i.title}</strong>: Matrix{' '}
                {found.i.matrix
                  ? `${found.i.matrixDays} agent-days, ${found.i.agents} agents (${found.i.firstDate} to ${found.i.lastDate})`
                  : 'missing'}
                ; FCR tab {found.i.fcr ? 'found' : 'missing'}; behaviour tab {found.i.behaviour ? 'found' : 'missing'}.{' '}
                {found.i.note}
              </div>
            </div>
          ) : null}
          <div className="cx-panel cx-tablewrap">
            <table className="cx-table cx-table--nowrap">
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Workbook</th>
                  <th scope="col">Status</th>
                  <th scope="col">What was read</th>
                  <th scope="col">Last read</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m: any) => (
                  <tr key={m.month}>
                    <th scope="row" className="dq-rowhead">
                      {m.month}
                    </th>
                    <td>
                      {m.title || '–'}
                      <span className="cx-faint dq-sub">
                        {m.usingFallback ? 'fallback workbook' : `${m.workbookId.slice(0, 8)}…`}
                      </span>
                    </td>
                    <td>
                      <ReadChip m={m} />
                      {m.error ? <span className="cx-hint dq-sub">{m.error}</span> : null}
                    </td>
                    <td>
                      {m.status === 'never' ? (
                        '–'
                      ) : (
                        <>
                          {m.matrixRows} agent-days, {m.agents} agents
                          {m.firstDate ? ` (${m.firstDate} to ${m.lastDate})` : ''}
                          <span className="cx-hint dq-sub">
                            FCR {m.fcrRows} rows{m.fcrNote ? `: ${m.fcrNote}` : ''}; behaviour{' '}
                            {m.behaviourFound
                              ? `${m.behaviourCases} cases`
                              : `not found${m.behaviourNote ? `: ${m.behaviourNote}` : ''}`}
                            {m.skippedRows ? `; ${m.skippedRows} Matrix rows dated in other months skipped` : ''}
                          </span>
                        </>
                      )}
                    </td>
                    <td>
                      {m.refreshedAt ? (
                        <AsOfHint
                          iso={m.refreshedAt}
                          what={m.refreshedBy === 'nightly' ? 'Nightly' : m.refreshedBy ? `By ${m.refreshedBy.split('@')[0]}` : 'Read'}
                        />
                      ) : (
                        '–'
                      )}
                    </td>
                    <td>
                      <Button disabled={!!busyKey} onClick={() => refresh(m.month)}>
                        {busyKey === 'r' + m.month ? 'Reading…' : 'Refresh now'}
                      </Button>{' '}
                      {m.usingFallback ? null : (
                        <Button variant="danger" disabled={!!busyKey} onClick={() => remove(m.month)}>
                          Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <LinesSkeleton lines={4} />
      )}
    </div>
  )
}

/* hl */
export function AgentsPage({ route }: { route: { title: string } }) {
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, error, reload } = useSe('people.scorecard', () => api.page(range?.from, range?.to), [range])
  const [view, setView] = useState('rank')
  const [agent, setAgent] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [detailErr, setDetailErr] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [notes, setNotes] = useState<string[]>([])

  /* Adjust-on-data during render (the closure used an effect): seed the
   * pickers once, and default the agent to yourself on an agent scope. */
  const [seenData, setSeenData] = useState<any>(null)
  if (data !== seenData) {
    setSeenData(data)
    if (data && !range) {
      setFrom(data.from)
      setTo(data.to)
    }
    if (data?.scope === 'agent' && data.agents[0] && !agent) setAgent(data.agents[0].email)
  }

  const apply = (f: string, t: string) => {
    if (!f || !t) return setNotes(['Pick both dates.'])
    if (f > t) return setNotes(['"From" is after "To".'])
    setNotes([])
    setFrom(f)
    setTo(t)
    setRange({ from: f, to: t })
    reload()
  }

  const todayStr = data?.today ?? ''
  const lastMonthEnd = todayStr ? addDays(monthStart(todayStr), -1) : ''
  const agents = useMemo(
    () => (data ? (mineOnly ? data.agents.filter((a: any) => a.tlEmail === data.you) : data.agents) : []),
    [data, mineOnly]
  )

  /* Reset detail synchronously on key change (render-adjust), then fetch. */
  const detailKey = `${view}|${agent}|${data?.from}|${data?.to}|${data?.dataAsOf}`
  const [seenDetailKey, setSeenDetailKey] = useState('')
  if (detailKey !== seenDetailKey) {
    setSeenDetailKey(detailKey)
    setDetailErr('')
    setDetail(null)
  }
  useEffect(() => {
    if (view !== 'detail' || !agent || !data) return
    let on = true
    api.detail(agent, data.from, data.to).then(
      (r) => on && setDetail(r),
      (e) => on && setDetailErr(e.message)
    )
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, agent, data?.from, data?.to, data?.dataAsOf])

  const refreshNow = () => {
    if (!data) return
    setRefreshing(true)
    setNotes([])
    api.refresh(monthsBetween(data.from, data.to).slice(-3)).then(
      (r) => {
        setRefreshing(false)
        setNotes(
          r.months.map((m: any) =>
            m.status === 'error'
              ? `${m.month}: ${m.error}`
              : m.retryInS
                ? `${m.month}: read a moment ago, try again in ${m.retryInS} s.`
                : `${m.month}: read ${m.matrixRows} agent-days from "${m.title}".`
          )
        )
        reload()
      },
      (e) => {
        setRefreshing(false)
        setNotes([e.message])
      }
    )
  }

  const warnNotes = [...(data?.notes ?? []), ...notes]
  const activeDays = detail?.days.filter((d: any) => d.totalTarget > 0 || d.totalAchieved > 0 || d.audits > 0) ?? []
  const hiddenDays = (detail?.days.length ?? 0) - activeDays.length
  const teamView = data ? data.scope !== 'agent' : true
  const boot = useBoot()

  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!data && !error}>
      <Head
        title={route.title}
        sub={
          teamView
            ? 'Team scorecard from the monthly productivity workbook: ranking and agent detail for any period.'
            : 'Your scorecard from the monthly productivity workbook.'
        }
        aside={data ? <AsOfHint iso={data.dataAsOf} what="Workbook" /> : null}
      />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <section className="cx-section" aria-labelledby="sc-period">
            <div className="cx-section__head">
              <h2 className="cx-section__title" id="sc-period">
                Period
              </h2>
              <span className="cx-section__hint">
                {data.from} to {data.to}
              </span>
            </div>
            <div className="cx-filters">
              <div className="cx-field">
                <label className="cx-label" htmlFor="sc-from">
                  From
                </label>
                <Input id="sc-from" type="date" value={from} onInput={(e) => setFrom(e.currentTarget.value)} />
              </div>
              <div className="cx-field">
                <label className="cx-label" htmlFor="sc-to">
                  To
                </label>
                <Input id="sc-to" type="date" value={to} onInput={(e) => setTo(e.currentTarget.value)} />
              </div>
              <Button variant="primary" onClick={() => apply(from, to)}>
                Apply
              </Button>
              <Button onClick={() => apply(addDays(todayStr, -30), todayStr)}>
                Last 30 Days
              </Button>
              <Button onClick={() => apply(monthStart(lastMonthEnd), lastMonthEnd)}>
                Last Month
              </Button>
              <Button onClick={() => apply(monthStart(todayStr), todayStr)}>
                This Month
              </Button>
              {data.canRefresh ? (
                <Button variant="quiet" onClick={refreshNow} disabled={refreshing}>
                  {refreshing ? 'Reading the workbook…' : 'Refresh now'}
                </Button>
              ) : null}
            </div>
            <p className="cx-hint">
              KPI score: each KPI&apos;s raw % falls in a payout band (productivity 80 / 86 / 95 pay 50 / 75 / 100%;
              quality 90 / 93 / 97; FCR 80 / 85 / 90; a value between bands takes the lower one), and points = payout ×
              weight (35 / 35 / 15 / 15) ÷ 100. The score is the sum of the points. A KPI with no data scores 0 points and
              the score is marked incomplete; it is not re-weighted. Behaviour is 0 with one case in the workbook&apos;s
              log or the KPI logs. An operational-loss case halves the score; 3 unplanned leaves inside 2 months make it
              0. On probation (first 3 months from the hiring date) each KPI is pass or fail. Raw figures sum the whole
              period first and divide once; they are read from each month&apos;s workbook overnight and on Refresh now.
            </p>
            {warnNotes.map((n) => (
              <div key={n} className="cx-note" data-status="warn" role="status">
                <div>{n}</div>
              </div>
            ))}
          </section>
          {teamView ? (
            <div className="cx-filters">
              <Seg
                name="sc-view"
                value={view}
                onChange={(v) => setView(v)}
                aria-label="View"
                options={[
                  { value: 'rank', label: 'Stack Ranking' },
                  { value: 'detail', label: 'Agent Detail' },
                ]}
              />
              {data.scope === 'tl' && view === 'rank' ? (
                <label className="cx-switch">
                  <span>My team only</span>
                  {/* eslint-disable-next-line -- kept raw: native checkbox inside .cx-switch label (track span is CSS) */}
                  <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.currentTarget.checked)} />
                  <span className="cx-switch__track" aria-hidden="true" />
                </label>
              ) : null}
            </div>
          ) : null}
          {view === 'rank' || !teamView ? (
            <section className="cx-section" aria-labelledby="sc-rank">
              <div className="cx-section__head">
                <h2 className="cx-section__title" id="sc-rank">
                  {teamView ? 'Stack Ranking' : 'Your scorecard'}
                </h2>
                <span className="cx-section__hint">
                  {agents.length} agent{agents.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="cx-panel cx-tablewrap">
                <table className="cx-table cx-table--nowrap">
                  <thead>
                    <tr>
                      <th scope="col" className="cx-num-col">
                        #
                      </th>
                      <th scope="col">Agent</th>
                      <th scope="col" className="cx-num-col">
                        Days
                      </th>
                      {COLUMNS.map((c) => (
                        <th key={c} scope="col">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a: any) => (
                      <tr key={a.email}>
                        <td className="cx-num-col cx-num">{a.rank ?? '–'}</td>
                        <th scope="row" className="dq-rowhead">
                          {teamView ? (
                            <Button
                              variant="quiet"
                              onClick={() => {
                                setAgent(a.email)
                                setView('detail')
                              }}
                            >
                              {a.name}
                            </Button>
                          ) : (
                            a.name
                          )}
                          {a.tlName ? <span className="cx-faint dq-sub">reports to {a.tlName}</span> : null}
                        </th>
                        <td className="cx-num-col cx-num">{a.days}</td>
                        <ScoreCells t={a} />
                      </tr>
                    ))}
                    {agents.length ? null : (
                      <tr>
                        <td colSpan={11}>No data in this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {agents.some((a: any) => a.kpi.incomplete) ? (
                <p className="cx-hint">
                  &quot;incomplete&quot; means a KPI had no data for that agent; it counts as 0 points, the rest are not
                  re-weighted.
                </p>
              ) : null}
            </section>
          ) : (
            <section className="cx-section" aria-labelledby="sc-detail">
              <div className="cx-section__head">
                <h2 className="cx-section__title" id="sc-detail">
                  Agent Detail
                </h2>
              </div>
              <div className="cx-field">
                <label className="cx-label" htmlFor="sc-agent">
                  Agent
                </label>
                <Select id="sc-agent" value={agent} onChange={(e) => setAgent(e.currentTarget.value)}>
                  <option value="">Select agent…</option>
                  {data.agents.map((a: any) => (
                    <option key={a.email} value={a.email}>
                      {a.name}
                      {a.tlName ? `  —  ${a.tlName}` : ''}
                    </option>
                  ))}
                </Select>
              </div>
              {agent ? (
                detailErr ? (
                  <LoadError message={detailErr} onRetry={() => setAgent(agent)} />
                ) : detail ? (
                  detail.totals ? (
                    <>
                      <div className="cx-panel cx-tablewrap">
                        <table className="cx-table cx-table--nowrap">
                          <thead>
                            <tr>
                              <th scope="col">Rank</th>
                              <th scope="col" className="cx-num-col">
                                Days
                              </th>
                              {COLUMNS.map((c) => (
                                <th key={c} scope="col">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="cx-num">{detail.totals.rank === null ? '–' : `#${detail.totals.rank}`}</td>
                              <td className="cx-num-col cx-num">{detail.totals.days}</td>
                              <ScoreCells t={detail.totals} />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <KpiBuild k={detail.totals.kpi} raw={detail.totals} />
                      <h3 className="cx-section__title">Day by day</h3>
                      {activeDays.length ? (
                        <div className="cx-panel cx-tablewrap">
                          <table className="cx-table cx-table--nowrap">
                            <thead>
                              <tr>
                                <th scope="col">Date</th>
                                {COLUMNS.map((c) => (
                                  <th key={c} scope="col">
                                    {c}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {activeDays.map((d: any) => (
                                <tr key={d.date}>
                                  <th scope="row" className="dq-rowhead">
                                    {d.date}
                                  </th>
                                  <ScoreCells t={d} />
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="cx-hint">No activity on any day in this period.</p>
                      )}
                      {hiddenDays ? <p className="cx-hint">{hiddenDays} day{hiddenDays === 1 ? '' : 's'} with no activity hidden.</p> : null}
                    </>
                  ) : (
                    <p className="cx-hint">No data for this agent in the period.</p>
                  )
                ) : (
                  <LinesSkeleton lines={6} />
                )
              ) : (
                <p className="cx-hint">Pick an agent to see their day-by-day breakdown.</p>
              )}
            </section>
          )}
        </>
      ) : (
        <LinesSkeleton lines={10} />
      )}
      {boot?.user.role === 'admin' ? <ScorecardAdmin /> : null}
    </section>
  )
}
