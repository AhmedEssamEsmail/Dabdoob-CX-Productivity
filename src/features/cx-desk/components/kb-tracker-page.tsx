'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { fetchJson } from '@/features/shared/lib/fetch-json'
import { usePageData } from '@/features/shared/lib/use-page-data'
import { toast } from '@/features/shared/components/shell/Toasts'
import { Button, Chip, Count, Empty, ErrMsg, Failed, Input, PageShell, Select, Skeleton } from '@/features/shared/components/ui'

/* ------------------------------------------------------------------ *
 * KB tracker — port of the legacy Desk page: articles requested of the
 * Knowledge base owner, with done/accuracy stamps and 30-day metrics.
 * ------------------------------------------------------------------ */

interface KbRow {
  id: string
  topic: string
  requestedAt: string
  doneAt: string
  accurate: string
  owner: string
  ownerEmail: string
  note: string
}

interface KbData {
  canEdit: boolean
  metrics: { accuratePct: number | null; withinDayPct: number | null; open: number }
  owners: { email: string; name: string }[]
  rows: KbRow[]
}

const api = {
  kbPage: () => fetchJson('/api/tl/kb') as Promise<KbData>,
  kbSave: (row: Partial<KbRow>) => fetchJson('/api/tl/kb', { method: 'POST', body: JSON.stringify(row) }) as Promise<KbRow>,
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const utc3 = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3600 * 1000)
const dayFmt = (v: string) => {
  if (!v) return ''
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00Z') : utc3(v)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}
const V = (iso: string) => (iso ? `${dayFmt(iso)}, ${utc3(iso).toISOString().slice(11, 16)}` : '')
const pct = (v: number | null) => (v === null ? '–' : `${v}%`)
const toLocal = (iso: string) => (iso ? utc3(iso).toISOString().slice(0, 16) : '')
const fromLocal = (v: string) => (v ? new Date(Date.parse(v + ':00+03:00')).toISOString() : '')
const blank = (): Partial<KbRow> => ({ topic: '', requestedAt: new Date().toISOString(), doneAt: '', accurate: '', note: '' })

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

function useLoaded<T>(load: () => Promise<T>) {
  return usePageData<T>(null, load, { cache: false })
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

function KbForm({ row, onSaved, onCancel }: { row: Partial<KbRow>; onSaved: (r: KbRow) => void; onCancel: () => void }) {
  const [f, setF] = useState(row)
  const run = useRun()
  const set = (k: string, v: string) => setF((o) => ({ ...o, [k]: v }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run.run(async () => {
      onSaved(await api.kbSave(f))
      toast('Saved.')
    })
  }
  return (
    <form className="dk-kb-form" onSubmit={submit}>
      <label className="dk-fine">
        Article or topic
        <Input className="input" value={f.topic ?? ''} onInput={(e) => set('topic', e.currentTarget.value)} required />
      </label>
      <label className="dk-fine">
        Requested
        <Input
          className="input"
          type="datetime-local"
          value={toLocal(f.requestedAt ?? '')}
          onInput={(e) => set('requestedAt', fromLocal(e.currentTarget.value))}
        />
      </label>
      <label className="dk-fine">
        Done
        <Input
          className="input"
          type="datetime-local"
          value={toLocal(f.doneAt ?? '')}
          onInput={(e) => set('doneAt', fromLocal(e.currentTarget.value))}
        />
      </label>
      <label className="dk-fine">
        Accurate
        <Select className="select" value={f.accurate ?? ''} onChange={(e) => set('accurate', e.currentTarget.value)}>
          <option value="">Not checked</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </Select>
      </label>
      <label className="dk-fine dk-kb-note">
        Note
        <Input className="input" value={f.note ?? ''} onInput={(e) => set('note', e.currentTarget.value)} />
      </label>
      <div className="md-actions">
        <Button type="submit" variant="primary" className="dk-sm" disabled={run.busy}>
          {run.busy ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="quiet" className="dk-sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <ErrMsg message={run.error} />
    </form>
  )
}

const ROUTE = {
  title: 'KB tracker',
  purpose: 'KB articles requested, done and checked for accuracy.',
}

export default function KbTrackerPage() {
  const { data, setData, error, reload } = useLoaded(api.kbPage)
  const [editing, setEditing] = useState<Partial<KbRow> | null>(null)
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
        <Skeleton shape="rows" n={5} />
      </Shell>
    )
  }
  const onSaved = (r: KbRow) => {
    setEditing(null)
    setData((d) => (d ? { ...d, rows: [r, ...d.rows.filter((x) => x.id !== r.id)] } : d))
    void reload()
  }
  return (
    <Shell
      route={ROUTE}
      aside={
        data.canEdit && !editing ? (
          <Button variant="primary" className="dk-sm" onClick={() => setEditing(blank())}>
            Add a KB update
          </Button>
        ) : null
      }
    >
      <div className="dk-stats">
        <div data-band={data.metrics.accuratePct === null ? undefined : data.metrics.accuratePct >= 100 ? 'ok' : 'bad'}>
          <b>
            <Count v={pct(data.metrics.accuratePct)} />
          </b>{' '}
          accurate, 30 days (target 100%)
        </div>
        <div data-band={data.metrics.withinDayPct === null ? undefined : data.metrics.withinDayPct >= 90 ? 'ok' : 'warn'}>
          <b>
            <Count v={pct(data.metrics.withinDayPct)} />
          </b>{' '}
          updated within 1 day
        </div>
        <div>
          <b>
            <Count v={data.metrics.open} />
          </b>{' '}
          still open
        </div>
      </div>
      {editing ? <KbForm row={editing} onSaved={onSaved} onCancel={() => setEditing(null)} /> : null}
      {data.rows.length ? (
        <div className="cx-panel cx-panel--pad">
        <ul className="dk-list">
          {data.rows.map((r) => (
            <li key={r.id}>
              <div className="dk-row">
                <b>{r.topic}</b>
                {r.doneAt ? (
                  r.accurate === 'no' ? (
                    <Chip status="bad">Not accurate</Chip>
                  ) : r.accurate === 'yes' ? (
                    <Chip status="ok">Accurate</Chip>
                  ) : (
                    <Chip>Done, not checked</Chip>
                  )
                ) : (
                  <Chip status="warn">Open</Chip>
                )}
                {data.canEdit ? (
                  <Button variant="quiet" className="dk-sm" onClick={() => setEditing(r)}>
                    Edit
                  </Button>
                ) : null}
              </div>
              <span className="dk-fine">
                Requested {V(r.requestedAt)}
                {r.doneAt ? `, done ${V(r.doneAt)}` : ''}
                {r.owner ? `, ${r.owner}` : ''}.{r.note ? ` ${r.note}` : ''}
              </span>
            </li>
          ))}
        </ul>
        </div>
      ) : (
        <div className="cx-panel">
          <Empty title="No KB updates yet. Add the first one when an article is requested." />
        </div>
      )}
    </Shell>
  )
}
