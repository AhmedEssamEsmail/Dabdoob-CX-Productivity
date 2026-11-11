'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Heatmap page (heatmap.closure.js symbol wl and
 * its children: Al RegTable, Cl AdminBuild, Ml SavedSets, Sl CountryChips,
 * He/Pn/Ze/ne/bl AssumptionPanel, kl HmResult, xl HmGrid, vl UploadDialog,
 * gs/Bt/fs/On the animated count, Oe/Qe the grid sweep). The engine and the
 * upload parsers live in ../lib/heatmap-engine (As/Cs/cl/dl/hl/ul/xs + rn/Ts/
 * ml/gl/fl). google.script.run is the /api/queue/heatmap route. */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button, Empty, Input, Select, Textarea } from '@/features/shared/components/ui'
import { fetchJson } from './shared'
import {
  HM_AHT_GROUPS, hmChatSlotMin_, hmCsvParse_, hmCsv_, hmDeepMerge_, hmDefaults_,
  hmExampleLong_, hmExampleWide_, hmFmt_, hmGetPath_, hmLongParse_, hmPlan_, hmSetPath_, hmSniff_, hmWideParse_,
} from '../lib/heatmap-engine'

/** be: the google.script.run seam -> /api/queue/heatmap. */
const be = {
  page: () => fetchJson('/api/queue/heatmap'),
  input: (id: string) => fetchJson('/api/queue/heatmap?input=' + encodeURIComponent(id)),
  saveInput: (name: string, source: string, hm: any) => fetchJson('/api/queue/heatmap', { op: 'save', name, source, heatmap: hm }),
  parseUpload: (fileName: string, base64: string) => fetchJson('/api/queue/heatmap', { op: 'parse', fileName, base64 }),
  buildFromSource: (sid: string) => fetchJson('/api/queue/heatmap', { op: 'build', spreadsheetId: sid }),
  priorRegression: () => fetchJson('/api/queue/heatmap', { op: 'regression' }),
  saveSet: (name: string, assumptions: any) => fetchJson('/api/queue/heatmap', { op: 'assumptions', name, assumptions }),
  setCountries: (countries: string[], aliases: any) => fetchJson('/api/queue/heatmap', { op: 'countries', countries, aliases }),
}

const OTHER = '__other__' // Re sentinel for the wide upload's country choice

/** Al: the prior-sheet regression table. */
function RegTable({ reg, full }: { reg: any; full: any }) {
  const s = useMemo(() => {
    const l = (reg.outcomeRows || []).slice(0, 16).filter((u: any[]) => u.some((c) => String(c).trim()))
    let r: any = null
    let i = ''
    try {
      const u = l.map((o: any[]) => o.map((f) => (/[",\n]/.test(f) ? `"${String(f).replace(/"/g, '""')}"` : f)).join(',')).join('\n')
      const c = hmWideParse_(u, { country: '*', intervalMinutes: 60 })
      r = { intervalMinutes: c.intervalMinutes, cells: c.cells }
    } catch (u: any) {
      i = u.message
    }
    const h = (u: any) => {
      const c: Record<string, number> = {}
      for (const o of u.cells) c[o.channel] = (c[o.channel] ?? 0) + o.volume
      return c
    }
    const p = { ...full, countries: null, countryList: null }
    const d = (u: any) => {
      try {
        return hmPlan_(u, p).headcount.hires
      } catch {
        return NaN
      }
    }
    return { prior: r, err: i, v2: h(reg.heatmap), old: r ? h(r) : {}, v2Hires: d(reg.heatmap), oldHires: r ? d(r) : NaN }
  }, [reg, full])
  const a = [...new Set([...Object.keys(s.v2), ...Object.keys(s.old)])]
  return (
    <div className="hm-reg">
      <table className="trk-table hm-reg-table">
        <caption>Contacts per week, by channel</caption>
        <thead>
          <tr>
            <th scope="col">Channel</th>
            <th scope="col">September tab</th>
            <th scope="col">Rebuilt here</th>
          </tr>
        </thead>
        <tbody>
          {a.map((l) => (
            <tr key={l}>
              <th scope="row">{l}</th>
              <td>{s.old[l] !== undefined ? hmFmt_(s.old[l]) : 'not in tab'}</td>
              <td>{s.v2[l] !== undefined ? hmFmt_(s.v2[l]) : 'none'}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Hires with these assumptions</th>
            <td>{isNaN(s.oldHires) ? 'n/a' : s.oldHires}</td>
            <td>{isNaN(s.v2Hires) ? 'n/a' : s.v2Hires}</td>
          </tr>
        </tbody>
      </table>
      {s.err ? <p className="field-error">The HeatMap tab could not be read as a heatmap: {s.err}</p> : null}
      <p className="hm-hint">
        {(reg.notes || []).join(' ')} Rows 17 to 51 of the HeatMap tab ({(reg.outcomeRows || []).slice(16).filter((l: any[]) => l.some((r) => String(r).trim())).length} non-empty) are not compared yet.
      </p>
    </div>
  )
}

/** Cl: the admin tools — build from raw tabs, and the September regression. */
function AdminBuild({ full, onLoaded }: { full: any; onLoaded: (r: any) => void }) {
  const [s, a] = useState('')
  const [l, r] = useState('')
  const [i, h] = useState('')
  const [p, d] = useState<any>(null)
  async function u(c: string) {
    r(c)
    h('')
    try {
      if (c === 'source') onLoaded(await be.buildFromSource(s.trim()))
      else {
        const o = await be.priorRegression()
        d(o)
        onLoaded(o)
      }
    } catch (o: any) {
      h(o.message)
    } finally {
      r('')
    }
  }
  return (
    <details className="hm-admin">
      <summary>Build volumes from raw data (admin)</summary>
      <div className="hm-admin-body">
        <div className="field">
          <label className="field-label" htmlFor="hm-sid">
            Spreadsheet with the raw tabs (Maqsam, Freshchat, Freshdesk, WA)
          </label>
          <div className="hm-save-set">
            <Input id="hm-sid" className="input" placeholder="Spreadsheet id" value={s} onInput={(c) => a(c.currentTarget.value)} />
            <Button variant="quiet" disabled={!!l || !s.trim()} onClick={() => u('source')}>
              {l === 'source' ? 'Building…' : 'Build volumes'}
            </Button>
          </div>
          <p className="hm-hint">Cairo timestamps are moved to Kuwait time before they are counted. Large tabs take up to a few minutes.</p>
        </div>
        <div>
          <Button variant="quiet" disabled={!!l} onClick={() => u('prior')}>
            {l === 'prior' ? 'Reading the September sheet…' : 'Compare with the September heatmap'}
          </Button>
          <p className="hm-hint">Rebuilds the 03-Sep-2026 heatmap from its own raw tabs and compares it with its HeatMap tab.</p>
        </div>
        {i ? <p className="field-error">{i}</p> : null}
        {p ? <RegTable reg={p} full={full} /> : null}
      </div>
    </details>
  )
}

/** Ml: saved assumption sets — apply one, or save the current overrides. */
function SavedSets({ page, over, setOver, onSets }: { page: any; over: any; setOver: (o: any) => void; onSets: (s: any) => void }) {
  const [l, r] = useState('')
  const [i, h] = useState('')
  const [p, d] = useState(false)
  async function u() {
    d(true)
    h('')
    try {
      onSets(await be.saveSet(l, over))
      r('')
    } catch (c: any) {
      h(c.message)
    } finally {
      d(false)
    }
  }
  return (
    <div className="hm-sets">
      <h2 className="hm-h2">Saved assumption sets</h2>
      {page.sets.length ? (
        <ul className="hm-set-list">
          {page.sets.map((c: any) => (
            <li key={c.id}>
              <span>{c.name}</span>
              <Button variant="quiet" onClick={() => setOver(c.assumptions)}>
                Apply
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="None yet. Save the current assumptions to come back to them." />
      )}
      <div className="hm-save-set">
        <Input className="input" aria-label="Name for these assumptions" placeholder="Name, e.g. Ramadan plan" maxLength={60} value={l} onInput={(c) => r(c.currentTarget.value)} />
        <Button variant="quiet" disabled={!l.trim() || p} onClick={u}>
          {p ? 'Saving…' : 'Save assumptions'}
        </Button>
      </div>
      {i ? <p className="field-error">{i}</p> : null}
    </div>
  )
}

/** Sl: the country chips + the admin edit box. */
function CountryChips({ page, selected, setSelected, onSaved }: { page: any; selected: string[]; setSelected: (c: string[]) => void; onSaved: (c: string[], a: any) => void }) {
  const [l, r] = useState(false)
  const [i, h] = useState('')
  const [p, d] = useState('')
  const [u, c] = useState('')
  const o = page?.countries ?? []
  const f = selected.length === 0
  const g = (b: string) => {
    const v = f ? [] : selected
    const y = v.includes(b) ? v.filter((w) => w !== b) : [...v, b]
    setSelected(y.length === o.length ? [] : y)
  }
  async function m() {
    c('')
    const b = i.split('\n').map((y) => y.trim()).filter(Boolean)
    const v: Record<string, string> = {}
    for (const y of p.split('\n')) {
      const [w, M] = y.split('=').map(($) => $?.trim())
      if (w && M) v[w] = M
    }
    try {
      const y = await be.setCountries(b, v)
      onSaved(y.countries, y.aliases)
      setSelected([])
      r(false)
    } catch (y: any) {
      c(y.message)
    }
  }
  return (
    <div className="hm-countries" role="group" aria-labelledby="hm-countries-h">
      <h2 id="hm-countries-h" className="hm-h2">Countries</h2>
      <div className="hm-chips">
        <label className={`hm-chip ${f ? 'is-on' : ''}`}>
          {/* kept raw:hm-chip is a bespoke chip toggle (is-on class + hidden input), not a ui/Toggle pill */}
          <input type="checkbox" checked={f} onChange={() => setSelected([])} />
          All countries
        </label>
        {o.map((b: string) => (
          <label key={b} className={`hm-chip ${!f && selected.includes(b) ? 'is-on' : ''}`}>
            {/* kept raw:hm-chip is a bespoke chip toggle (is-on class + hidden input), not a ui/Toggle pill */}
            <input type="checkbox" checked={!f && selected.includes(b)} onChange={() => g(b)} />
            {b}
          </label>
        ))}
      </div>
      <p className="hm-hint">Volumes are pooled across the countries you pick, then sized once. One team serves them all.</p>
      {page?.canAdmin ? (
        l ? (
          <div className="hm-edit-countries">
            <label className="field-label" htmlFor="hm-cl">Country list, one per line</label>
            <Textarea id="hm-cl" className="input" rows={5} value={i} onInput={(b) => h(b.currentTarget.value)} />
            <label className="field-label" htmlFor="hm-al">
              Other spellings in the data, one per line as &quot;Saudi Arabia = KSA&quot;
            </label>
            <Textarea id="hm-al" className="input" rows={3} value={p} onInput={(b) => d(b.currentTarget.value)} />
            {u ? <p className="field-error">{u}</p> : null}
            <div className="hm-dialog-actions">
              <Button variant="quiet" onClick={() => r(false)}>Cancel</Button>
              <Button variant="primary" onClick={m}>Save countries</Button>
            </div>
          </div>
        ) : (
          <Button
            variant="quiet"
            onClick={() => {
              h(o.join('\n'))
              d(Object.entries(page.aliases).map(([b, v]) => `${b} = ${v}`).join('\n'))
              r(true)
            }}
          >
            Edit country list
          </Button>
        )
      ) : null}
    </div>
  )
}

/** He: a collapsible assumptions group. */
function HmGroup({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="hm-group" open={open}>
      <summary>{title}</summary>
      <div className="hm-group-body">{children}</div>
    </details>
  )
}

/** Pn: a labelled checkbox with an optional inline hint. */
function HmToggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="hm-toggle">
      {/* kept raw:hm-toggle is a bespoke inline checkbox row, not a ui/Toggle pill */}
      <input type="checkbox" checked={checked} onChange={(l) => onChange(l.currentTarget.checked)} />
      <span>
        {label}
        {hint ? <span className="hm-hint hm-hint-inline">{hint}</span> : null}
      </span>
    </label>
  )
}

/** Ze: a time input (30-minute steps). */
function HmTime({ label, value, onChange, compact }: { label: string; value: string; onChange: (v: string) => void; compact?: boolean }) {
  const l = useId()
  return (
    <div className={`hm-num ${compact ? 'hm-num-compact' : ''}`}>
      <label htmlFor={l} className={compact ? 'cx-sr' : undefined}>
        {label}
      </label>
      <Input id={l} className="input" type="time" step={1800} value={value} onChange={(r) => r.currentTarget.value && onChange(r.currentTarget.value)} />
    </div>
  )
}

/** ne: a number input bound to one assumption path (scale = shown units). */
function HmNum({ label, path, a, set, scale = 1, min, max, step = 1, hint, unit }: {
  label: string; path: string[]; a: any; set: (path: string[], v: any) => void
  scale?: number; min?: number; max?: number; step?: number; hint?: string; unit?: string
}) {
  const u = useId()
  const c = hmGetPath_(a, path)
  const o = typeof c === 'number' ? Math.round(c * scale * 1e3) / 1e3 : ''
  return (
    <div className="hm-num">
      <label htmlFor={u}>
        {label}
        {unit ? <span className="hm-unit"> ({unit})</span> : null}
      </label>
      <Input
        id={u}
        className="input"
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={o}
        onChange={(f) => {
          const g = f.currentTarget.valueAsNumber
          if (!isFinite(g)) return
          const m = Math.min(max ?? 1 / 0, Math.max(min ?? -1 / 0, g))
          set(path, m / scale)
        }}
      />
      {hint ? <p className="hm-hint">{hint}</p> : null}
    </div>
  )
}

/** bl: the assumptions panel (calls / chats / escalations / WA / staffing). */
function AssumptionPanel({ a, set, chatSlotAuto, onReset }: { a: any; set: (path: string[], v: any) => void; chatSlotAuto: number; onReset: () => void }) {
  const l = a.shifts ?? []
  const r = (d: string, u: string) => hmGetPath_(a, ['channels', d, u])
  const i = (d: number, u: any) => set(['shifts'], l.map((c: any, o: number) => (o === d ? { ...c, ...u } : c)))
  const h = r('waiting_address', 'include') !== false || r('customer_didnt_answer', 'include') !== false
  const p = hmGetPath_(a, ['chats', 'slotMinutes'])
  return (
    <div className="hm-panel">
      <div className="hm-panel-head">
        <h2 className="hm-h2">Assumptions</h2>
        <Button variant="quiet" onClick={onReset}>
          Reset to defaults
        </Button>
      </div>
      <HmGroup title="Calls (Erlang C)">
        <HmNum label="Service level target" unit="%" path={['calls', 'slTarget']} a={a} set={set} scale={100} min={50} max={99} />
        <HmNum label="Answered within" unit="seconds" path={['calls', 'answerWithinSec']} a={a} set={set} min={5} max={600} />
        <HmNum label="Handling time per call" unit="seconds" path={['channels', 'inbound_calls', 'ahtSec']} a={a} set={set} min={30} max={3600} />
        <HmNum label="Maximum occupancy" unit="%" path={['occupancyCap']} a={a} set={set} scale={100} min={50} max={100} />
      </HmGroup>
      <HmGroup title="Chats">
        <HmNum label="Chats at once, per agent" path={['chats', 'concurrency']} a={a} set={set} min={1} max={5} hint="Capped at 5." />
        <HmNum
          label="Agent effort per chat"
          unit="seconds"
          path={['channels', 'social_media', 'ahtSec']}
          a={a}
          set={(d, u) => {
            set(['channels', 'social_media', 'ahtSec'], u)
            set(['channels', 'in_app', 'ahtSec'], u)
          }}
          min={30}
          max={3600}
          hint="Social media and In-App chats."
        />
        <HmNum label="Conversation length" unit="minutes" path={['chats', 'conversationMin']} a={a} set={set} min={0} max={120} step={0.5} />
        <HmNum label="No-reply timeout" unit="minutes" path={['chats', 'noReplyTimeoutMin']} a={a} set={set} min={0} max={120} hint="Agents resolve a chat after this long without a customer reply." />
        <div className="hm-num">
          <label htmlFor="hm-slot">
            Slot time per chat <span className="hm-unit">(minutes)</span>
          </label>
          <Input
            id="hm-slot"
            className="input"
            type="number"
            min={1}
            max={240}
            step={0.5}
            placeholder={`${chatSlotAuto} (calculated)`}
            value={typeof p === 'number' && p > 0 ? p : ''}
            onChange={(d) => {
              const u = d.currentTarget.valueAsNumber
              set(['chats', 'slotMinutes'], isFinite(u) && u > 0 ? u : null)
            }}
          />
          <p className="hm-hint">Blank uses conversation length plus the timeout ({chatSlotAuto} min). Enter a measured mean to override.</p>
        </div>
      </HmGroup>
      <HmGroup title="Internal escalations">
        <HmToggle label="Include escalations in the headcount" checked={r('internal_tickets', 'include') !== false} onChange={(d) => set(['channels', 'internal_tickets', 'include'], d)} />
        <HmNum label="Resolve within" unit="minutes" path={['channels', 'internal_tickets', 'slaMin']} a={a} set={set} min={30} max={1440} step={30} />
        <HmNum label="Handling time per escalation" unit="seconds" path={['channels', 'internal_tickets', 'ahtSec']} a={a} set={set} min={30} max={3600} />
      </HmGroup>
      <HmGroup title="Waiting Address" open={false}>
        <HmToggle
          label="Count Waiting Address work"
          checked={h}
          onChange={(d) => {
            set(['channels', 'waiting_address', 'include'], d)
            set(['channels', 'customer_didnt_answer', 'include'], d)
          }}
        />
        <HmNum label="Handling time per confirmation" unit="seconds" path={['channels', 'waiting_address', 'ahtSec']} a={a} set={set} min={10} max={3600} />
        <HmNum label="Handling time per retry" unit="seconds" path={['channels', 'customer_didnt_answer', 'ahtSec']} a={a} set={set} min={10} max={3600} hint="Customer didn't answer, called again." />
      </HmGroup>
      <HmGroup title="Staffing">
        <HmNum label="Shrinkage" unit="%" path={['shrinkage']} a={a} set={set} scale={100} min={0} max={70} hint="Covers breaks, leave, absence and training." />
        <HmNum label="Days worked per week" path={['shiftsPerAgentPerWeek']} a={a} set={set} min={1} max={7} />
        <HmNum label="Fewest agents while open" path={['minOnFloor']} a={a} set={set} min={0} max={50} />
        <div className="hm-pair">
          <HmTime label="Open from" value={String(a.open ?? '')} onChange={(d) => set(['open'], d)} />
          <HmTime label="Close at" value={String(a.close ?? '')} onChange={(d) => set(['close'], d)} />
        </div>
        <fieldset className="hm-shifts">
          <legend>Shifts (Kuwait time)</legend>
          {l.map((d: any, u: number) => (
            <div className="hm-shift" key={d.id}>
              <label className="hm-toggle">
                {/* kept raw:hm-shift enable checkbox is a bespoke hm-toggle row, not a ui/Toggle pill */}
                <input type="checkbox" checked={d.enabled !== false} onChange={(c) => i(u, { enabled: c.currentTarget.checked })} />
                <span className={`hm-shift-name hm-shift-${String(d.id).toLowerCase()}`}>{d.id}</span>
              </label>
              <HmTime label={`${d.id} starts`} value={d.start} onChange={(c) => i(u, { start: c })} compact />
              <HmTime label={`${d.id} ends`} value={d.end} onChange={(c) => i(u, { end: c })} compact />
            </div>
          ))}
        </fieldset>
      </HmGroup>
      <p className="hm-note">
        Agents who take calls drop their chats and tickets, then return. Chats and tickets are sized on the capacity calls leave free, not on top of it.
      </p>
    </div>
  )
}

/** je: download a text file. */
function hmDownload_(t: string, n: string) {
  const s = URL.createObjectURL(new Blob([n], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = s
  a.download = t
  a.click()
  setTimeout(() => URL.revokeObjectURL(s), 1e3)
}

const COUNT_MS = 900 // qn
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩' // Aa

/** On: the page number — Arabic digits and separators in an ar document. */
function hmAr_(t: string): string {
  return document.documentElement.lang !== 'ar'
    ? t
    : t
        .replace(/(\d)([.,])(?=\d)/g, (n, s, a) => s + (a === '.' ? '٫' : '٬'))
        .replace(/\d/g, (n) => AR_DIGITS[+n])
}

/** Bt: the live count plus a screen-reader copy of the final value. */
function CountOut({ live, final, spanRef }: { live: string; final: string; spanRef: React.Ref<HTMLSpanElement> }) {
  return (
    <>
      <span ref={spanRef} aria-hidden="true">
        {hmAr_(live)}
      </span>
      <span className="cx-sr">{hmAr_(final)}</span>
    </>
  )
}

const NUM_RE = /^(\D*?)(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\D*)$/ // Ta

/** bt: reduced-motion check. */
function hmReducedMotion_(): boolean {
  return (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.hasAttribute('data-reduce-motion')
}

/** fs: 0..1 progress when the number scrolls into view. */
function useCountUp(t: number | null) {
  const n = useRef<HTMLElement | null>(null)
  const s = useRef(false)
  const [a, l] = useState(1)
  useEffect(() => {
    if (s.current || t === null || t === 0 || hmReducedMotion_() || document.hidden) return
    s.current = true
    l(0)
    let r = 0
    let i = 0
    const h = () => {
      const u = performance.now()
      const c = (o: number) => {
        const f = Math.min(1, (o - u) / COUNT_MS)
        l(f)
        if (f < 1) r = requestAnimationFrame(c)
      }
      r = requestAnimationFrame(c)
      i = window.setTimeout(() => {
        cancelAnimationFrame(r)
        l(1)
      }, COUNT_MS + 100)
    }
    const p = n.current
    const d = p && typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((u) => {
          if (u.some((c) => c.isIntersecting)) {
            d?.disconnect()
            h()
          }
        })
      : null
    if (d && p) d.observe(p)
    else h()
    return () => {
      d?.disconnect()
      cancelAnimationFrame(r)
      clearTimeout(i)
      l(1)
    }
  }, [t])
  return { ref: n, k: a, ease: 1 - (1 - a) ** 3 }
}

/** gs: the animated count — animates the numeric part, keeps prefix/suffix. */
function Count({ v }: { v: unknown }) {
  const n = v == null ? '' : String(v)
  const s = NUM_RE.exec(n)
  const a = s ? Number(s[2] + s[3].replace(/,/g, '') + (s[4] ?? '')) : null
  const { ref: l, k: r, ease: i } = useCountUp(a)
  if (!s || a === null || r >= 1) return <CountOut live={n} final={n} spanRef={l as React.Ref<HTMLSpanElement>} />
  const h = s[4] ? s[4].length - 1 : 0
  const p = (a * i).toLocaleString('en-US', {
    minimumFractionDigits: h,
    maximumFractionDigits: h,
    useGrouping: s[3].includes(','),
  })
  return <CountOut live={s[1] + p + s[5]} final={n} spanRef={l as React.Ref<HTMLSpanElement>} />
}

/** kl: the result — hires total, per-shift hires, facts, window note, warnings. */
function HmResult({ plan, meta, hm }: { plan: any; meta: any; hm: any }) {
  const a = plan.headcount
  const l = meta?.window ?? hm.window
  return (
    <section className="hm-result" aria-labelledby="hm-res">
      <h2 id="hm-res" className="cx-sr">Result</h2>
      <div className="hm-total">
        <span className="hm-total-n">
          <Count v={a.hires} />
        </span>
        <span className="hm-total-l">people to hire in total</span>
      </div>
      <ul className="hm-shifts-out">
        {a.perShift.map((r: any) => (
          <li key={r.id} className={`hm-shift-out hm-shift-${String(r.id).toLowerCase()}`}>
            <span className="hm-shift-out-n">{r.hiresIfFixed}</span>
            <span className="hm-shift-out-l">{r.id} shift, {r.start} to {r.end}</span>
            <span className="hm-shift-out-d">{r.bodiesByDay.join(' / ')} on Sun to Sat</span>
          </li>
        ))}
      </ul>
      <dl className="hm-facts">
        <div>
          <dt>Exact need</dt>
          <dd>{hmFmt_(a.hiresExact)}</dd>
        </div>
        <div>
          <dt>Busiest day</dt>
          <dd>{a.peakDay} on shift</dd>
        </div>
        <div>
          <dt>Occupancy</dt>
          <dd>{Math.round(a.occupancy * 100)}%, {a.regime}</dd>
        </div>
        {a.realisedCallSL !== null ? (
          <div>
            <dt>Calls answered in target</dt>
            <dd>{Math.round(a.realisedCallSL * 100)}%</dd>
          </div>
        ) : null}
      </dl>
      {l?.note ? (
        <p className="hm-hint">
          {[l.from && l.to ? `Volumes from ${l.from} to ${l.to}.` : '', l.note].filter(Boolean).join(' ')}
        </p>
      ) : null}
      {[...a.warnings, ...plan.problems].length ? (
        <ul className="hm-warn">
          {[...a.warnings, ...plan.problems].map((r: string) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

const SWEEP_MS = 820 // ka

/** Oe: the grid's fade-in sweep (adds is-in / is-done). */
function useSweepIn(t: React.RefObject<HTMLElement | null>) {
  const n = useRef(0)
  useEffect(() => {
    const s = t.current
    if (!s) return
    if (n.current) {
      s.classList.add('is-in')
      if (n.current === 2) s.classList.add('is-done')
      return
    }
    if (document.hidden || hmReducedMotion_()) {
      n.current = 2
      s.classList.add('is-in', 'is-done')
      return
    }
    n.current = 1
    requestAnimationFrame(() =>
      requestAnimationFrame(() => s.classList.add('is-in'))
    )
    const timer = setTimeout(() => {
      n.current = 2
      s.classList.add('is-in', 'is-done')
    }, SWEEP_MS)
    return () => clearTimeout(timer)
  })
}

/** Qe: per-row sweep delay index. */
const sweepStyle = (t: number) => ({ '--i': Math.min(t, 12) }) as React.CSSProperties

/** xl: the agents-per-interval grid (rostered / on floor / coverage layers). */
function HmGrid({ plan, layer, setLayer }: { plan: any; layer: string; setLayer: (l: string) => void }) {
  const a = useRef<HTMLDivElement | null>(null)
  useSweepIn(a)
  const l = plan.requirement.slots
  const r = plan.assumptions.intervalMinutes
  const i = plan.roster.shifts
  const h = (f: number, g: number) =>
    layer === 'coverage' ? plan.roster.days[f].coverage[g] : (plan.requirement.days[f].intervals[g]?.[layer] ?? 0)
  let p = 0
  let d = 1 / 0
  plan.requirement.days.forEach((f: any, g: number) =>
    l.forEach((m: number, b: number) => {
      p = Math.max(p, h(g, b))
      d = Math.min(d, h(g, b))
    })
  )
  const u = p - d
  const c = [
    { id: 'rostered', label: 'Needed, shrinkage included' },
    { id: 'onFloor', label: 'Needed on the floor' },
    { id: 'coverage', label: 'Scheduled by the shifts' },
  ]
  const o = (f: number) => `${String(Math.floor(f / 60)).padStart(2, '0')}:${String(f % 60).padStart(2, '0')}`
  return (
    <section className="cx-panel" aria-labelledby="hm-grid-t">
      <div className="cx-section__head">
        <div>
          <h2 id="hm-grid-t" className="cx-section__title">Agents in each half hour</h2>
          <div className="cx-section__hint">Needed agents per half hour — pick a layer to compare rostered, on-floor and scheduled coverage.</div>
        </div>
        <fieldset className="hm-chips">
          <legend className="cx-sr">Show</legend>
          {c.map((f) => (
            <label key={f.id} className={`hm-chip ${layer === f.id ? 'is-on' : ''}`}>
              {/* kept raw:hm-chip is a bespoke chip radio (is-on class + hidden input), not a ui/Seg */}
              <input type="radio" name="hm-layer" checked={layer === f.id} onChange={() => setLayer(f.id)} />
              {f.label}
            </label>
          ))}
        </fieldset>
      </div>
      <div className="cx-panel--pad">
      <div ref={a} className="hm-grid-scroll cc-chart" tabIndex={0} role="region" aria-label="Agents per interval and day">
        <table className="hm-grid">
          <thead>
            <tr>
              <th scope="col" className="hm-gt">Kuwait time</th>
              <th scope="col" className="hm-gs">
                <span className="cx-sr">Shifts on duty</span>
              </th>
              {plan.requirement.days.map((f: any) => (
                <th scope="col" key={f.day}>{f.day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {l.map((f: number, g: number) => (
              <tr className="cc-sweep-fade" style={sweepStyle(g)} key={f}>
                <th scope="row" className="hm-gt">{o(f)}</th>
                <td className="hm-gs">
                  {i.map((m: any) => (
                    <span key={m.id} className={`hm-bar hm-shift-${String(m.id).toLowerCase()} ${m.startMin <= f && f + r <= m.endMin ? 'is-on' : ''}`} title={`${m.id} on duty`} />
                  ))}
                </td>
                {plan.requirement.days.map((m: any, b: number) => {
                  const v = h(b, g)
                  const y = u > 0 ? 0.08 + (0.92 * (v - d)) / u : 0.3
                  return (
                    <td
                      key={b}
                      className="hm-c"
                      style={{ '--k': y.toFixed(3) } as React.CSSProperties}
                      data-hot={y > 0.62 ? '1' : undefined}
                    >
                      {layer === 'coverage' ? v : hmFmt_(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="hm-gtotal">
              <th scope="row" className="hm-gt">On shift</th>
              <td className="hm-gs" />
              {plan.roster.days.map((f: any) => (
                <td key={f.day}>{f.total}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="hm-hint">Bars show which shift is on duty: {i.map((f: any) => f.id).join(' and ')}. Darker cells need more agents.</p>
      </div>
    </section>
  )
}

/** yl: File -> base64 (data: prefix stripped). */
function hmFileB64_(t: File): Promise<string> {
  return new Promise((n, s) => {
    const a = new FileReader()
    a.onload = () => n(String(a.result).replace(/^data:[^,]*,/, ''))
    a.onerror = () => s(new Error('The file could not be read.'))
    a.readAsDataURL(t)
  })
}

/** vl: the upload dialog — file, format readout, options, name, save. */
function UploadDialog({ countries, canAdmin, onClose, onSaved, onCountryAdded, onAht }: {
  countries: string[]; canAdmin: boolean; onClose: () => void
  onSaved: (r: any) => void; onCountryAdded: (c: string) => Promise<void>; onAht: (aht: Record<string, number>) => void
}) {
  const i = useRef<HTMLDialogElement | null>(null)
  const [h, p] = useState<any>(null)
  const [d, u] = useState('')
  const [c, o] = useState(false)
  const [f, g] = useState('')
  const [m, b] = useState('*')
  const [v, y] = useState('')
  const [w, M] = useState(60)
  const [$, L] = useState('')
  const [H, O] = useState(false)
  useEffect(() => {
    if (i.current && !i.current.open) i.current.showModal?.()
  }, [])
  async function T(A?: File) {
    if (A) {
      g('')
      p(null)
      u(A.name)
      L(A.name.replace(/\.(csv|xlsx)$/i, ''))
      o(true)
      try {
        let I: any
        if (/\.csv$/i.test(A.name)) I = hmCsvParse_(await A.text())
        else if (/\.xlsx$/i.test(A.name)) I = (await be.parseUpload(A.name, await hmFileB64_(A))).rows
        else throw new Error('Upload a .csv or .xlsx file.')
        I = I.filter((P: any[]) => P.some((U) => String(U).trim() !== ''))
        const x = hmSniff_(I)
        if (x === 'unknown') throw new Error('The file is not in a heatmap format. Open "What the file needs" below and download an example.')
        if (
          x === 'long' &&
          I.slice(1).some((P: any[]) => /:30/.test(String(P[I[0].map((U: unknown) => String(U).trim().toLowerCase()).indexOf('interval')])))
        )
          M(30)
        p({ format: x, rows: I })
      } catch (I: any) {
        g(I.message)
      } finally {
        o(false)
      }
    }
  }
  function S() {
    if (!h) return null
    const A = hmCsv_(h.rows)
    if (h.format === 'long') return { hm: hmLongParse_(A, w) }
    const I = hmWideParse_(A, { country: m === OTHER ? v.trim() || '*' : m, intervalMinutes: w })
    return { hm: { intervalMinutes: I.intervalMinutes, cells: I.cells }, aht: I.ahtMinutes }
  }
  let C: any = null
  let q = ''
  try {
    C = S()
  } catch (A: any) {
    q = A.message
  }
  const N = C?.hm.cells ?? []
  const E = [...new Set(N.map((A: any) => A.channel))]
  const R = [...new Set(N.map((A: any) => A.country))]
  async function k() {
    if (C) {
      O(true)
      g('')
      try {
        if (h?.format === 'wide' && m === OTHER) {
          const I = v.trim()
          if (!I) throw new Error('Type the country this file is for.')
          if (!countries.some((x) => x.toLowerCase() === I.toLowerCase())) {
            if (!canAdmin) throw new Error(`${I} is not in the country list. Ask an admin to add it, then upload again.`)
            await onCountryAdded(I)
          }
        }
        const A = await be.saveInput($.trim() || d, h?.format === 'long' ? 'upload_long' : 'upload_wide', C.hm)
        if (C.aht && Object.keys(C.aht).length) onAht(C.aht)
        onSaved(A)
      } catch (A: any) {
        g(A.message)
      } finally {
        O(false)
      }
    }
  }
  return (
    <dialog ref={i} className="hm-dialog" aria-labelledby="hm-up" onClose={onClose} onCancel={onClose}>
      <h2 id="hm-up" className="hm-h2">Upload a heatmap</h2>
      <p className="hm-hint">Use volumes you prepared elsewhere. Headcount is worked out from them the same way, with the assumptions on this page.</p>
      <label className="hm-drop">
        {/* kept raw:hm-drop is a bespoke file dropzone (hidden input + dashed frame), not a ui control */}
        <input type="file" accept=".csv,.xlsx" onChange={(A) => T(A.currentTarget.files?.[0] ?? undefined)} />
        <span>{d || 'Choose a .csv or .xlsx file'}</span>
      </label>
      {c ? <p className="hm-hint">Reading the file…</p> : null}
      {h ? (
        <div className="hm-up-opts">
          <fieldset className="hm-chips">
            <legend>Each row covers</legend>
            {[60, 30].map((A) => (
              <label key={A} className={`hm-chip ${w === A ? 'is-on' : ''}`}>
                {/* kept raw:hm-chip is a bespoke chip radio (is-on class + hidden input), not a ui/Seg */}
                <input type="radio" name="hm-int" checked={w === A} onChange={() => M(A)} />
                {A === 60 ? 'One hour' : 'Half an hour'}
              </label>
            ))}
          </fieldset>
          {w === 60 ? <p className="hm-hint">Hourly values are split evenly into half hours. A half-hour file removes that assumption.</p> : null}
          {h.format === 'wide' ? (
            <fieldset className="hm-chips">
              <legend>This file is for</legend>
              {['*', ...countries, OTHER].map((A) => (
                <label key={A} className={`hm-chip ${m === A ? 'is-on' : ''}`}>
                  {/* kept raw:hm-chip is a bespoke chip radio (is-on class + hidden input), not a ui/Seg */}
                  <input type="radio" name="hm-c" checked={m === A} onChange={() => b(A)} />
                  {A === '*' ? 'All countries together' : A === OTHER ? 'Other…' : A}
                </label>
              ))}
              {m === OTHER ? (
                <Input className="input hm-other" placeholder="Country name" maxLength={40} value={v} onInput={(A) => y(A.currentTarget.value)} aria-label="Other country" />
              ) : null}
            </fieldset>
          ) : null}
          {q ? (
            <p className="field-error" role="alert">{q}</p>
          ) : (
            <p className="hm-read">
              Read {N.length} cells: {E.length} channel{E.length === 1 ? '' : 's'}, {R.filter((A) => A !== '*').length || 'no'} named countr
              {R.filter((A) => A !== '*').length === 1 ? 'y' : 'ies'}
              {R.includes('*') ? ' plus unattributed volume' : ''}.
              {C?.aht && Object.keys(C.aht).length ? ' Its handling-time table will be loaded into the assumptions.' : ''}
            </p>
          )}
          <div className="field">
            <label className="field-label" htmlFor="hm-up-name">Name</label>
            <Input id="hm-up-name" className="input" maxLength={80} value={$} onInput={(A) => L(A.currentTarget.value)} />
          </div>
        </div>
      ) : null}
      <details className="hm-need" open={!h}>
        <summary>What the file needs</summary>
        <p>
          A <strong>.csv</strong> or <strong>.xlsx</strong> of average contacts per interval, in <strong>Kuwait time</strong>. Pick whichever layout is
          easier to prepare, then download the example and replace its numbers.
        </p>
        <p className="hm-need-h">Layout 1: one row per value (easiest to build from a pivot or a script)</p>
        <div className="hm-need-scroll">
          <table className="hm-need-table">
            <thead>
              <tr>
                <th>country</th>
                <th>channel</th>
                <th>day</th>
                <th>interval</th>
                <th>volume</th>
                <th>aht_sec (optional)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Kuwait</td>
                <td>Inbound</td>
                <td>Sun</td>
                <td>09:00</td>
                <td>6</td>
                <td>240</td>
              </tr>
              <tr>
                <td>Kuwait</td>
                <td>WA</td>
                <td>Mon</td>
                <td>10:00</td>
                <td>5</td>
                <td>150</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="hm-need-list">
          <li>
            <code>day</code> is Sun, Mon, Tue, Wed, Thu, Fri or Sat. <code>interval</code> is the start of the hour, like 09:00 (or 09:30 for half-hour
            files).
          </li>
          <li>
            <code>country</code> may be <code>*</code> when the volume is not split by country. <code>volume</code> is the average number of contacts
            arriving in that interval, not a total for the month.
          </li>
          <li>Channels it recognises: Inbound, Social Media, In-App, WA, Customer Didn&apos;t Answer, Internal Tickets. Any other name is kept as its own channel.</li>
        </ul>
        <p className="hm-need-h">Layout 2: the HeatMap tab (one block per channel, side by side)</p>
        <p>
          Row 1 names each block, row 2 is <code>Interval, Sun, Mon … Sat</code>, then one row per hour. Leave one empty column between blocks. One
          file is one country; you choose which after choosing the file.
        </p>
        <div className="hm-need-actions">
          <Button variant="quiet" onClick={() => hmDownload_('heatmap-example-rows.csv', hmExampleLong_())}>
            Download example: one row per value
          </Button>
          <Button variant="quiet" onClick={() => hmDownload_('heatmap-example-blocks.csv', hmExampleWide_())}>
            Download example: HeatMap tab layout
          </Button>
        </div>
      </details>
      {f ? (
        <p className="field-error" role="alert">{f}</p>
      ) : null}
      <div className="hm-dialog-actions">
        <Button variant="quiet" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!C || !!q || H || !N.length} onClick={k}>
          {H ? 'Saving…' : 'Use this heatmap'}
        </Button>
      </div>
    </dialog>
  )
}

/** wl: the page. */
export function HeatmapPage({ route }: { route: { title: string } }) {
  const [n, s] = useState<any>(null)
  const [a, l] = useState<any>(null)
  const [r, i] = useState<any>(null)
  const [h, p] = useState('')
  const [d, u] = useState<any>({})
  const [c, o] = useState<string[]>([])
  const [f, g] = useState('rostered')
  const [m, b] = useState(false)
  const [v, y] = useState('')
  useEffect(() => {
    be.page().then(
      (S) => {
        s(S)
        l(S.current?.heatmap ?? null)
        i(S.current?.meta ?? null)
      },
      (S) => p(S.message)
    )
  }, [])
  const w = (S: string[], C: any) => u((q: any) => hmSetPath_(q, S, C))
  const M = useMemo(() => {
    const S = {
      countryList: n?.countries ?? null,
      countryAliases: n?.aliases ?? {},
      countries: c.length ? c : null,
    }
    return hmDeepMerge_(hmDefaults_(), { ...d, ...S })
  }, [d, c, n])
  const $ = useMemo(() => {
    if (!a || !a.cells.length) return { plan: null, err: '' }
    try {
      return { plan: hmPlan_(a, M), err: '' }
    } catch (S: any) {
      return { plan: null, err: S.message }
    }
  }, [a, M])
  async function L(S: string) {
    p('')
    try {
      const C = await be.input(S)
      l(C.heatmap)
      i(C.meta)
    } catch (C: any) {
      p(C.message)
    }
  }
  function H(S: Record<string, number>) {
    let C = d
    for (const [q, N] of Object.entries(S))
      for (const E of HM_AHT_GROUPS[q.trim().toLowerCase()] ?? [])
        C = hmSetPath_(C, ['channels', E, 'ahtSec'], Math.round(N * 60))
    u(C)
    y('Handling times from the file were loaded into the assumptions.')
  }
  const O = $.plan
  const T = hmChatSlotMin_(M)
  return (
    <section className="page hm-page" aria-labelledby="page-title">
      <header className="page-head hm-head">
        <div>
          <h1 id="page-title" className="page-title">{route.title}</h1>
          <p className="page-purpose">
            How many agents each half hour needs, and how many people to hire for each shift.
          </p>
        </div>
        <div className="hm-head-actions">
          {n && n.inputs.length ? (
            <div className="field hm-source">
              <label className="field-label" htmlFor="hm-src">Volumes</label>
              <Select id="hm-src" className="select" value={r?.id ?? ''} onChange={(S) => L(S.currentTarget.value)}>
                {n.inputs.map((S: any) => (
                  <option key={S.id} value={S.id}>{S.name}</option>
                ))}
              </Select>
            </div>
          ) : null}
          <Button variant="quiet" onClick={() => hmDownload_('heatmap-example-rows.csv', hmExampleLong_())} title="A small file in the format the upload expects. Replace its numbers with yours.">
            Download example file
          </Button>
          <Button variant="primary" onClick={() => b(true)} disabled={!n}>
            Upload heatmap
          </Button>
        </div>
      </header>
      {h ? (
        <p className="hm-banner hm-banner-error" role="alert">{h}</p>
      ) : null}
      {v ? (
        <p className="hm-banner" role="status">
          {v}{' '}
          <Button variant="quiet" onClick={() => y('')}>Dismiss</Button>
        </p>
      ) : null}
      <div className="hm-layout">
        <aside className="hm-side">
          <CountryChips
            page={n}
            selected={c}
            setSelected={o}
            onSaved={(S, C) => n && s({ ...n, countries: S, aliases: C })}
          />
          <AssumptionPanel a={M} set={w} chatSlotAuto={T} onReset={() => u({})} />
          {n ? <SavedSets page={n} over={d} setOver={u} onSets={(S) => s({ ...n, sets: S })} /> : null}
        </aside>
        <div className="hm-main">
          {!n && !h ? <div className="hm-skel" aria-hidden="true" /> : null}
          {n && !a ? (
            <div className="cx-panel">
              <Empty
                title="No volumes yet."
                body={
                  <>
                    Upload a heatmap{n.canAdmin ? ', or build one from the raw tabs below' : ''}. Not sure what the file looks like? Download an example,
                    replace its numbers with yours, then upload it.
                  </>
                }
                action={
                  <div className="hm-need-actions">
                    <Button variant="quiet" onClick={() => hmDownload_('heatmap-example-rows.csv', hmExampleLong_())}>
                      Example: one row per value
                    </Button>
                    <Button variant="quiet" onClick={() => hmDownload_('heatmap-example-blocks.csv', hmExampleWide_())}>
                      Example: HeatMap tab layout
                    </Button>
                  </div>
                }
              />
            </div>
          ) : null}
          {$.err ? (
            <p className="hm-banner hm-banner-error" role="alert">The numbers could not be worked out: {$.err}</p>
          ) : null}
          {O ? (
            <>
              <HmResult plan={O} meta={r} hm={a} />
              <HmGrid plan={O} layer={f} setLayer={g} />
            </>
          ) : null}
          {n?.canAdmin ? (
            <AdminBuild
              full={M}
              onLoaded={(S) => {
                l(S.heatmap)
                i(S.meta)
                s((C: any) => C && { ...C, inputs: [S.meta, ...C.inputs] })
              }}
            />
          ) : null}
        </div>
      </div>
      {m && n ? (
        <UploadDialog
          countries={n.countries}
          canAdmin={n.canAdmin}
          onClose={() => b(false)}
          onCountryAdded={async (S) => {
            const C = await be.setCountries([...n.countries, S], n.aliases)
            s({ ...n, countries: C.countries, aliases: C.aliases })
          }}
          onAht={H}
          onSaved={(S) => {
            l(S.heatmap)
            i(S.meta)
            s((C: any) => C && { ...C, inputs: [S.meta, ...C.inputs] })
            b(false)
          }}
        />
      ) : null}
    </section>
  )
}
