'use client'

import {
  Fragment,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { D } from '@/features/shared/shell/i18n'
import { Button, Input, PageShell } from '@/features/shared/components/ui'
import { useSearchParamState } from '@/features/shared/lib/use-search-param-state'
import { useSe } from '@/features/cx-productivity/components/pv-shared'
import {
  $e,
  Ka,
  Va,
  Yt,
  ae,
  dt,
  te,
  useNs,
  type TphData,
  type TrendDay,
} from './tph-grid-shared'
import { As, Ds, Es, Os, Rs, Ts, Xa } from './tph-grid-views'
import { Cs } from './tph-grid-matrix'

/**
 * TPH — verbatim port of the legacy `za` page and its parts
 * (Ga/Ya/de/Xa/Qa/Za/Ja/es/ts/as/rs/cs/is/os/ds) with the module helpers
 * (Va/Ua/F/Wa/dt/P/$e/Gt/We/U/Qe/Pe/An/Ne/xe/Pn/St/ut/je/ss/ns/ht/ls/te/Yt).
 * Split into tph-grid-shared.ts (api/types/helpers), tph-grid-views.tsx
 * (tab views), tph-grid-matrix.tsx (agents-by-hour + dialog); this file keeps
 * the page shell, day picker, tablist and tab router (Ga/Ya/Ja/za).
 */

/* --- Ja — the day picker in the page-head aside ---------------------------- */

function Ja({ d, go }: { d: TphData; go: (date: string) => void }) {
  return (
    <div className="tph-day">
      <Button onClick={() => go(dt(d.date, -1))}>Previous day</Button>
      <label className="cx-sr" htmlFor="tph-date">
        Day
      </label>
      <Input
        id="tph-date"
        type="date"
        className="tph-date"
        value={d.date}
        max={d.today}
        onChange={(e) => e.currentTarget.value && go(e.currentTarget.value)}
      />
      <Button disabled={d.date >= d.today} onClick={() => go(dt(d.date, 1))}>
        Next day
      </Button>
    </div>
  )
}

/* --- Ya — the tablist ------------------------------------------------------- */

function Ya({ tab, select, badges }: { tab: string; select: (t: string, focus?: boolean) => void; badges: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: rm ? 'auto' : 'smooth' })
  }, [tab])
  return (
    <div
      className="tph-tabs"
      role="tablist"
      aria-label="TPH views"
      ref={ref}
      onKeyDown={(e) => {
        const o = te.findIndex(([k]) => k === tab)
        const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
        const h = e.key === 'ArrowRight' ? (rtl ? -1 : 1) : e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0
        const p = h ? (o + h + te.length) % te.length : e.key === 'Home' ? 0 : e.key === 'End' ? te.length - 1 : -1
        if (p < 0) return
        e.preventDefault()
        select(te[p][0])
        requestAnimationFrame(() => document.getElementById(`tph-tab-${te[p][0]}`)?.focus())
      }}
    >
      {te.map(([k, label]) => (
        <Button
          key={k}
          role="tab"
          id={`tph-tab-${k}`}
          className="tph-tab"
          aria-selected={tab === k}
          aria-controls={`tph-panel-${k}`}
          tabIndex={tab === k ? 0 : -1}
          onClick={() => select(k)}
        >
          {label}
          {badges[k] ? (
            <span className="tph-tab__n">
              {badges[k]}
              <span className="cx-sr"> need attention</span>
            </span>
          ) : null}
        </Button>
      ))}
    </div>
  )
}

/* --- Ga — the tab router ---------------------------------------------------------- */

function Ga({ d, reload, go }: { d: TphData; reload: () => void; go: (date: string) => void }) {
  const [, setTabParam] = useSearchParamState('tab', 'overview', { push: true })
  const tab = Yt()
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const runner = useNs(d, reload)
  const [trend, setTrend] = useState<{ forD: TphData; days: TrendDay[] | null; err: string } | null>(null)
  useEffect(() => {
    const onHash = () => bump()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    if (tab !== 'overview' || trend?.forD === d) return
    queueMicrotask(() => setTrend((f) => (f?.forD === d ? f : { forD: d, days: f?.days ?? null, err: '' })))
    ae.trend(dt(d.date, -6), d.date).then(
      (m: { days: TrendDay[] }) =>
        setTrend((f) => (f?.forD === d ? { forD: d, days: m.days, err: '' } : f)),
      (m: unknown) =>
        setTrend((f) => (f?.forD === d ? { forD: d, days: null, err: m instanceof Error ? m.message : String(m) } : f))
    )
  }, [tab, d, trend?.forD, trend?.days])
  const select = (m: string, focus?: boolean) => {
    setTabParam(m)
    if (focus) requestAnimationFrame(() => document.getElementById(`tph-panel-${m}`)?.focus())
  }
  const sum = useMemo(() => Va(d.table, Ka), [d])
  const past = d.date < d.today
  const u = !d.hasCases && past
  const c = !d.touchesReady && past
  const badges = {
    cases: u ? '!' : sum.missing ? String(sum.missing) : '',
    agents: sum.overAgents ? String(sum.overAgents) : '',
    caps: String(d.callVariance.length + (c ? 1 : 0) + sum.over || ''),
  }
  const panel = (m: string, children: ReactNode) => (
    <div role="tabpanel" id={`tph-panel-${m}`} aria-labelledby={`tph-tab-${m}`} tabIndex={0} className="tph-panel">
      {children}
    </div>
  )
  return (
    <Fragment>
      {d.storeErrors?.length ? (
        <div className="cx-panel cx-panel--pad tph-lock" role="alert">
          <strong>Some stores could not be read — numbers may be missing:</strong>
          <ul>
            {d.storeErrors.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          {d.isAdmin ? (
            <p className="cx-faint">
              Run <code>GET /api/admin/source-health</code> for the full diagnosis.
            </p>
          ) : null}
        </div>
      ) : null}
      {d.canEdit ? null : (
        <p className="cx-panel cx-panel--pad tph-lock" role="status">
          This day is read-only for you: team leads can change today and the {d.tlEditDays} days before it. Ask Mohamed
          to change an older day.
        </p>
      )}
      <Ya tab={tab} select={select} badges={badges} />
      {tab === 'overview' ? panel('overview', <Xa d={d} sum={sum} runner={runner} trend={trend} select={select} go={go} />) : null}
      <div
        role="tabpanel"
        id="tph-panel-grid"
        aria-labelledby="tph-tab-grid"
        tabIndex={0}
        className="tph-panel"
        hidden={tab !== 'grid'}
      >
        <Es key={d.date} d={d} onSaved={reload} />
        <Ts d={d} onSaved={reload} />
      </div>
      {tab === 'cases' ? panel('cases', <As d={d} onSaved={reload} missing={sum.missing} select={select} />) : null}
      {tab === 'agents' ? panel('agents', <Fragment><Cs d={d} /><Os d={d} /></Fragment>) : null}
      {tab === 'caps' ? panel('caps', <Rs d={d} badge={badges.caps ?? ''} select={select} />) : null}
      {tab === 'channels' ? panel('channels', <Ds d={d} />) : null}
    </Fragment>
  )
}

/* --- za — the page -------------------------------------------------------------- */

const ROUTE = { title: 'TPH and caps' }

export function TphGridPage() {
  const [dateParam, setDateParam] = useSearchParamState('date', '')
  const dateRef = useRef(dateParam)
  const { data: d, error, reload } = useSe<TphData>(() => ae.page(dateRef.current))
  useEffect(() => {
    if (dateRef.current !== dateParam) {
      dateRef.current = dateParam
      reload()
    }
  }, [dateParam, reload])
  const go = (date: string) => {
    dateRef.current = date
    setDateParam(date)
    reload()
  }
  return (
    <PageShell
      id="page-title"
      className="cxp page"
      title={ROUTE.title}
      purpose={D("Log which channel each agent is on, check the cases offered each hour, and compare each agent's touches with their cap.")}
      aside={
        d ? (
          <div className="page-actions">
            <Ja d={d} go={go} />
            {d.lastAuto ? (
              <span className="small faint">{D('Last build {at}', { at: $e(d.lastAuto.at) })}</span>
            ) : null}
          </div>
        ) : undefined
      }
      busy={!d && !error}
      error={error}
      onRetry={reload}
    >
      {d ? <Ga d={d} reload={reload} go={go} /> : null}
    </PageShell>
  )
}
