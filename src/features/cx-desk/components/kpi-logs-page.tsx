'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { fetchJson } from '@/features/shared/lib/fetch-json'
import { toast } from '@/features/shared/components/shell/Toasts'
import { Button, Input, Select } from '@/features/shared/components/ui'

/* ------------------------------------------------------------------ *
 * KPI logs — port of the legacy Desk page (KpiLogs.js): three hand-kept
 * lists — HR-confirmed behaviour cases, unplanned leaves, and tickets
 * left out of an area's SLA. Entries are soft-deleted.
 * ------------------------------------------------------------------ */

interface KpiData {
  agents: { email: string; name: string }[]
  leaveTypes: string[]
  areas: string[]
  days: number
  canExclude: string[]
  behaviour: { id: string; name: string; date: string; note: string; loggedBy: string }[]
  leaves: { id: string; name: string; from: string; to: string; type: string; note: string; loggedBy: string }[]
  exclusions: { id: string; ticketId: string; area: string; reason: string; loggedBy: string; loggedAt: string }[]
}

const api = {
  kpiLogs: () => fetchJson('/api/kpi/logs') as Promise<KpiData>,
  kpiLogSave: (kind: string, input: Record<string, string>) =>
    fetchJson('/api/kpi/logs', { method: 'POST', body: JSON.stringify({ kind, input }) }) as Promise<unknown[]>,
  kpiLogRemove: (kind: string, id: string) =>
    fetchJson(`/api/kpi/logs?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' }) as Promise<{ id: string }>,
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const B = (v: string) => {
  if (!v) return ''
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00Z') : new Date(new Date(v).getTime() + 3 * 3600 * 1000)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}
const todayKw = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="dk-skel">
      {[92, 70, 84, 60, 76].map((w) => (
        <span key={w} className="skeleton" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

function Failed({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="dk-failed" role="alert">
      <p>This page could not load: {message}</p>
      <Button variant="primary" onClick={retry}>
        Try again
      </Button>
    </div>
  )
}

function Shell({ route, children }: { route: { title: string; purpose: string }; children: ReactNode }) {
  return (
    <section className="page dk" aria-labelledby="page-title">
      <header className="page-head">
        <div>
          <h1 id="page-title" className="page-title">
            {route.title}
          </h1>
          <p className="page-purpose">{route.purpose}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

function Badge({ tone, children }: { tone?: string; children: ReactNode }) {
  return <span className={tone ? `pill ${tone}` : 'pill'}>{children}</span>
}

function ErrMsg({ message }: { message: string }) {
  return message ? (
    <p className="dk-error" role="alert">
      {message}
    </p>
  ) : null
}

function useLoaded<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const reload = useCallback(() => {
    setError('')
    load().then(setData, (e) => setError(e instanceof Error ? e.message : String(e)))
  }, [load])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload() only clears a stale error, then sets state in the async .then
    reload()
  }, [reload])
  return { data, setData, error, reload }
}

function useRun() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const running = useRef(false)
  return {
    busy,
    error,
    run: async (fn: () => Promise<void>) => {
      if (running.current) return
      running.current = true
      setBusy(true)
      setError('')
      try {
        await fn()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        running.current = false
        setBusy(false)
      }
    },
  }
}

function AgentPick({ d, f, set }: { d: KpiData; f: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <label className="dk-fine">
      Agent
      <Select className="select" value={f.email} onChange={(e) => set('email', e.currentTarget.value)} required>
        <option value="">Choose…</option>
        {d.agents.map((a) => (
          <option key={a.email} value={a.email}>
            {a.name}
          </option>
        ))}
      </Select>
    </label>
  )
}

function LogForm({
  kind,
  label,
  blank,
  onSaved,
  children,
}: {
  kind: string
  label: string
  blank: Record<string, string>
  onSaved: () => void
  children: (f: Record<string, string>, set: (k: string, v: string) => void) => ReactNode
}) {
  const [f, setF] = useState(blank)
  const run = useRun()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run.run(async () => {
      await api.kpiLogSave(kind, f)
      setF(blank)
      toast('Logged.')
      onSaved()
    })
  }
  return (
    <form className="dk-kb-form" onSubmit={submit}>
      {children(f, (k, v) => setF((m) => ({ ...m, [k]: v })))}
      <div className="md-actions">
        <Button type="submit" variant="primary" className="dk-sm" disabled={run.busy}>
          {run.busy ? 'Saving…' : label}
        </Button>
      </div>
      <ErrMsg message={run.error} />
    </form>
  )
}

function RemoveBtn({ kind, id, onDone }: { kind: string; id: string; onDone: () => void }) {
  const run = useRun()
  return (
    <>
      <Button
        variant="quiet"
        className="dk-sm"
        disabled={run.busy}
        onClick={() =>
          void run.run(async () => {
            await api.kpiLogRemove(kind, id)
            toast('Removed.')
            onDone()
          })
        }
      >
        {run.busy ? 'Removing…' : 'Remove'}
      </Button>
      <ErrMsg message={run.error} />
    </>
  )
}

const ROUTE = {
  title: 'KPI logs',
  purpose: "What no system records: HR-confirmed behaviour cases, unplanned leaves, and tickets left out of an area's SLA. The scorecard reads them.",
}

export default function KpiLogsPage() {
  const { data, error, reload } = useLoaded(api.kpiLogs)
  if (error) {
    return (
      <Shell route={ROUTE}>
        <Failed message={error} retry={() => void reload()} />
      </Shell>
    )
  }
  if (!data) {
    return (
      <Shell route={ROUTE}>
        <Skeleton />
      </Shell>
    )
  }
  const refresh = () => void reload()
  return (
    <Shell route={ROUTE}>
      <h2 className="dk-h">Behaviour cases confirmed by HR</h2>
      <p className="dk-fine">One case in the period takes the agent&apos;s Behaviour KPI to 0 (15 points).</p>
      <div className="card card-pad">
      <LogForm kind="behaviour" label="Log the case" blank={{ email: '', date: todayKw(), note: '' }} onSaved={refresh}>
        {(f, set) => (
          <>
            <AgentPick d={data} f={f} set={set} />
            <label className="dk-fine">
              Date of the case
              <Input
                className="input"
                type="date"
                value={f.date}
                max={todayKw()}
                onInput={(e) => set('date', e.currentTarget.value)}
                required
              />
            </label>
            <label className="dk-fine dk-kb-note">
              What happened
              <Input className="input" value={f.note} onInput={(e) => set('note', e.currentTarget.value)} required />
            </label>
          </>
        )}
      </LogForm>
      {data.behaviour.length ? (
        <ul className="dk-list">
          {data.behaviour.map((a) => (
            <li key={a.id}>
              <div className="dk-row">
                <b>{a.name}</b>
                <span>{B(a.date)}</span>
                <Badge tone="bad">Confirmed case</Badge>
                <RemoveBtn kind="behaviour" id={a.id} onDone={refresh} />
              </div>
              <span className="dk-fine">
                {a.note.replace(/\.?$/, '.')} Logged by {a.loggedBy}.
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <div className="s">No cases in the last {data.days} days.</div>
        </div>
      )}
      </div>
      <h2 className="dk-h">Unplanned leaves</h2>
      <p className="dk-fine">
        Each entry is one leave, however many days it covers. 3 inside any 2 months within the last 3 months make the
        agent not eligible for KPIs.
      </p>
      <div className="card card-pad">
      <LogForm kind="leave" label="Log the leave" blank={{ email: '', from: todayKw(), to: '', type: '', note: '' }} onSaved={refresh}>
        {(f, set) => (
          <>
            <AgentPick d={data} f={f} set={set} />
            <label className="dk-fine">
              First day
              <Input
                className="input"
                type="date"
                value={f.from}
                onInput={(e) => set('from', e.currentTarget.value)}
                required
              />
            </label>
            <label className="dk-fine">
              Last day
              <Input className="input" type="date" value={f.to} min={f.from} onInput={(e) => set('to', e.currentTarget.value)} />
            </label>
            <label className="dk-fine">
              Type
              <Select className="select" value={f.type} onChange={(e) => set('type', e.currentTarget.value)} required>
                <option value="">Choose…</option>
                {data.leaveTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </label>
            <label className="dk-fine dk-kb-note">
              Note
              <Input className="input" value={f.note} onInput={(e) => set('note', e.currentTarget.value)} />
            </label>
          </>
        )}
      </LogForm>
      {data.leaves.length ? (
        <ul className="dk-list">
          {data.leaves.map((a) => (
            <li key={a.id}>
              <div className="dk-row">
                <b>{a.name}</b>
                <span>
                  {B(a.from)}
                  {a.to !== a.from ? ` to ${B(a.to)}` : ''}
                </span>
                <Badge>{a.type}</Badge>
                <RemoveBtn kind="leave" id={a.id} onDone={refresh} />
              </div>
              <span className="dk-fine">
                {a.note ? `${a.note.replace(/\.?$/, '.')} ` : ''}Logged by {a.loggedBy}.
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <div className="s">No unplanned leaves in the last {data.days} days.</div>
        </div>
      )}
      </div>
      <h2 className="dk-h">Tickets left out of an area&apos;s SLA</h2>
      <p className="dk-fine">
        For tickets the data cannot tell apart, such as Returns shipped with Ajex or outside KSA. Applied at the next
        hourly update.
      </p>
      <div className="card card-pad">
      {data.canExclude.length ? (
        <LogForm
          kind="exclusion"
          label="Leave out"
          blank={{ area: data.canExclude.includes('Returns') ? 'Returns' : data.canExclude[0], ticketIds: '', reason: '' }}
          onSaved={refresh}
        >
          {(f, set) => (
            <>
              <label className="dk-fine">
                Area
                <Select className="select" value={f.area} onChange={(e) => set('area', e.currentTarget.value)}>
                  {data.canExclude.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </Select>
              </label>
              <label className="dk-fine">
                Ticket IDs
                <Input
                  className="input"
                  value={f.ticketIds}
                  placeholder="451230, 451244"
                  inputMode="numeric"
                  onInput={(e) => set('ticketIds', e.currentTarget.value)}
                  required
                />
              </label>
              <label className="dk-fine">
                Why
                <Input
                  className="input"
                  value={f.reason}
                  placeholder="Ajex"
                  onInput={(e) => set('reason', e.currentTarget.value)}
                  required
                />
              </label>
            </>
          )}
        </LogForm>
      ) : (
        <div className="empty">
          <div className="s">Only an area&apos;s owner or an admin can leave tickets out.</div>
        </div>
      )}
      {data.exclusions.length ? (
        <ul className="dk-list">
          {data.exclusions.map((a) => (
            <li key={a.id}>
              <div className="dk-row">
                <b>#{a.ticketId}</b>
                <span>{a.area}</span>
                <Badge tone="warn">{a.reason}</Badge>
                <RemoveBtn kind="exclusion" id={a.id} onDone={refresh} />
              </div>
              <span className="dk-fine">
                Left out by {a.loggedBy}, {B(a.loggedAt)}.
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <div className="s">No tickets left out in the last {data.days} days.</div>
        </div>
      )}
      </div>
    </Shell>
  )
}
