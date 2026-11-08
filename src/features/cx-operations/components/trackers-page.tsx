'use client'

/**
 * Trackers page — verbatim port of the legacy Operations page
 * (.devin/work/extract/operations/pages/trackers.closure.js): the tracker
 * switcher, the records grid + search, the new-record form, the field editor
 * dialog (Kt/Jn), the tracker builder (er) and the skeleton (Kn).
 * Server calls keep the legacy names via the /api/trackers routes.
 */

import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,

} from 'react'
import { fetchJson } from '@/features/cx-productivity/components/pv-shared'
import { pageParams } from '@/features/shared/shell/gates'
import { Button, Input, Select } from '@/features/shared/components/ui'

// ---------------------------------------------------------------- API surface
// (ee in the closure: getTrackersPage / getTrackerRecords / addTrackerRecord /
//  addTrackerField / updateTrackerField / createTracker)

const ee = {
  page: (t: string) => fetchJson('/api/trackers?t=' + encodeURIComponent(t ?? '')) as Promise<PageData>,
  records: (id: string) => fetchJson('/api/trackers/records?tracker=' + encodeURIComponent(id)) as Promise<TrackerData>,
  addRecord: (id: string, values: Record<string, string>) =>
    fetchJson('/api/trackers/records', {
      method: 'POST',
      body: JSON.stringify({ trackerId: id, values }),
    }) as Promise<{ recordId: string; submittedBy: string; submittedAt: string }>,
  addField: (id: string, def: FieldDefIn) =>
    fetchJson('/api/trackers/fields', { method: 'POST', body: JSON.stringify({ trackerId: id, def }) }) as Promise<TrackerData>,
  updateField: (id: string, fieldId: string, def: FieldDefIn) =>
    fetchJson('/api/trackers/fields', { method: 'PATCH', body: JSON.stringify({ trackerId: id, fieldId, def }) }) as Promise<TrackerData>,
  create: (def: { name: string; fields: FieldDefIn[] }) =>
    fetchJson('/api/trackers', { method: 'POST', body: JSON.stringify(def) }) as Promise<PageData>,
}

// Dropdown options (G.getDropdownOptions / addDropdownOption — the shared picklists API).
// The route answers { listKey, options } — getDropdownOptions returns the bare list.
const G = {
  getDropdownOptions: (listKey: string) =>
    (fetchJson('/api/options/' + encodeURIComponent(listKey)) as Promise<{ options: string[] }>).then((r) => r.options),
  addDropdownOption: (listKey: string, value: string) =>
    fetchJson('/api/options/' + encodeURIComponent(listKey), {
      method: 'POST',
      body: JSON.stringify({ value }),
    }) as Promise<{ options: string[]; value: string }>,
}

// --------------------------------------------------------------------- types

type TrackerSummary = {
  id: string
  name: string
  accessMode: string
  storage: string
  canAdd: boolean
  canBuild: boolean
  seesAll: boolean
  sourceUrl: string
}
type FieldOut = { id: string; label: string; type: string; required: boolean; listKey: string; parentFieldId: string; auto: string }
export type TrackerRow = { recordId: string; values: Record<string, unknown>; submittedBy: string; submittedAt: string; outside: boolean }
export type TrackerData = {
  tracker: TrackerSummary
  fields: FieldOut[]
  rows: TrackerRow[]
  total: number
  limited: boolean
  headerProblems: string[]
  choices: Record<string, string[]>
}
type PageData = {
  trackers: TrackerSummary[]
  current: TrackerData | null
  error: string
  canCreate: boolean
  me: { email: string; name: string }
}
type FieldDefIn = {
  label: string
  type: string
  required: boolean
  choices?: string[]
  parentFieldId?: string
  choicesByParent?: Record<string, string[]>
}
type Draft = {
  label: string
  type: string
  required: boolean
  choicesText: string[]
  parentRef: string
  depText: Record<string, string>
  locked?: number
}
type ParentRef = { ref: string; label: string; choices: string[] }

// ---------------------------------------------------- verbatim pure helpers

const Ie = (): Draft => ({ label: '', type: 'text', required: false, choicesText: ['', ''], parentRef: '', depText: {} })

const Vn = [
  { type: 'date', name: 'Date', desc: 'A date picker' },
  { type: 'text', name: 'Free text', desc: 'Anything typed' },
  { type: 'number', name: 'Number', desc: 'A count or quantity' },
  { type: 'money', name: 'Money', desc: 'An amount, shown as 1,250.500' },
  { type: 'link', name: 'Link', desc: 'A web address people can open' },
  { type: 'dropdown', name: 'Dropdown', desc: 'Pick from choices you set' },
  { type: 'dependent', name: 'Dependent', desc: 'Choices change with another field' },
]

const jn: Record<string, string> = {
  date: 'People pick a date. It is stored as year-month-day so it sorts and filters correctly.',
  text: 'People type whatever they need to. Use a dropdown instead if you will want to count or filter by this answer.',
  number: 'People type a number. It is saved as a number, so the sheet can add it up. 1,250 and 1250 both work.',
  money: 'People type an amount with up to 3 decimals. Keep the currency in its own field if records mix currencies.',
  link: 'People paste a web address starting with http:// or https://. It opens in a new tab from the table.',
  dropdown: '"Other" is added for you. When someone types a new value there, it joins this list for everyone.',
  dependent: 'Pick the dropdown it follows, then the choices for each of its answers. "Other" works here too, per answer.',
}

const jt = (e: string) => e.split(',').map((t) => t.trim()).filter(Boolean)

function Bt(e: Draft, t: ParentRef[]): FieldDefIn {
  const n: FieldDefIn = { label: e.label.trim(), type: e.type, required: e.required }
  if (e.type === 'dropdown') n.choices = e.choicesText.map((s) => s.trim()).filter(Boolean)
  if (e.type === 'dependent') {
    n.parentFieldId = e.parentRef
    const s = t.find((a) => a.ref === e.parentRef)
    n.choicesByParent = Object.fromEntries((s?.choices ?? []).map((a) => [a, jt(e.depText[a] ?? '')]))
  }
  return n
}

const Gn: Record<string, string> = { date: 'date', number: 'number', money: 'number', link: 'web link', dropdown: 'choice' }

const Dn = (e: unknown) => /^https?:\/\/[^\s/?#]+\S*$/i.test(String(e ?? ''))
const In = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
const Fn = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 })

function Nn(e: unknown): number | null {
  if (typeof e === 'number') return Number.isFinite(e) ? e : null
  let t = String(e ?? '').replace(/\s+/g, '')
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '')
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null
}

function We(e: string, t: unknown): { text: string; misfit: boolean } {
  const n = t == null ? '' : String(t)
  if (!n.trim()) return { text: '', misfit: false }
  if (e === 'number' || e === 'money') {
    const s = Nn(t)
    return s === null ? { text: n, misfit: true } : { text: (e === 'money' ? In : Fn).format(s), misfit: false }
  }
  return e === 'link'
    ? { text: n, misfit: !Dn(n) }
    : e === 'date'
      ? { text: n, misfit: !/^\d{4}-\d{2}-\d{2}/.test(n) }
      : { text: n, misfit: false }
}

function Yn(e: FieldOut[], t: Record<string, string[]>, n = ''): ParentRef[] {
  return e
    .filter((s) => s.type === 'dropdown' && s.id !== n)
    .map((s) => ({ ref: s.id, label: s.label, choices: t[s.listKey] ?? [] }))
}

function Rn(e: unknown): string {
  const t = String(e ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  let n = 5381
  for (let s = 0; s < t.length; s++) n = ((n * 33) ^ t.charCodeAt(s)) >>> 0
  return ('000000' + n.toString(36)).slice(-6)
}

const Vt = (e: string, t: unknown) => `${e}.${Rn(t)}`

function Zn(e: FieldOut, t: TrackerData): Draft {
  const n = t.choices ?? {}
  const s = n[e.listKey] ?? []
  const a = t.fields.find((c) => c.id === e.parentFieldId)
  const i =
    e.type === 'dependent' && a
      ? Object.fromEntries((n[a.listKey] ?? []).map((c) => [c, (n[Vt(e.listKey, c)] ?? []).join(', ')]))
      : {}
  return {
    label: e.label,
    type: e.type === 'computed' ? 'text' : e.type,
    required: e.required,
    choicesText: [...s, ''],
    parentRef: e.parentFieldId,
    depText: i,
    locked: s.length,
  }
}

function Ut(e: Draft): string {
  return e.label.trim()
    ? e.type === 'dropdown' && !e.choicesText.some((t) => t.trim())
      ? 'Add at least one choice, or pick Free text.'
      : e.type === 'dependent' && !e.parentRef
        ? 'Pick the field this one depends on.'
        : e.type === 'dependent' && !Object.values(e.depText).some((t) => jt(t).length)
          ? 'Add choices for at least one answer.'
          : ''
    : 'Give the field a name so people know what to enter.'
}

// ------------------------------------------------------- options store (ve)

const listeners = new Set<() => void>()
let ve: Record<string, string[] | undefined> = {}
function Re(e: string, t: string[]) {
  ve = { ...ve, [e]: t }
  listeners.forEach((f) => f())
}
function useOpt(listKey: string): string[] | undefined {
  const [v, setV] = useState(() => ve[listKey])
  useEffect(() => {
    const a = () => setV(ve[listKey])
    listeners.add(a)
    a()
    return () => {
      listeners.delete(a)
    }
  }, [listKey])
  return v
}
const Ce = new Map<string, Promise<string[]>>()

function de(e: TrackerData | null | undefined) {
  if (e) for (const [t, n] of Object.entries(e.choices ?? {})) Re(t, n)
}

function Bn(e: string): string {
  if (!e) return ''
  const t = new Date(e)
  return isNaN(t.getTime())
    ? e
    : t.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuwait' })
}

const Wn = (e: FieldOut) => e.type !== 'computed' && !e.auto

// ------------------------------------------------------------------- pieces

/** Kt: one field draft (name, kind picker, choices/dependent editors, required). */
function Kt({ draft: e, onChange: t, parents: n, showErrors: s }: { draft: Draft; onChange: (d: Draft) => void; parents: ParentRef[]; showErrors: boolean }) {
  const a = useId()
  const i = (u: Partial<Draft>) => t({ ...e, ...u })
  const c = n.find((u) => u.ref === e.parentRef)
  const h = s && !e.label.trim()
  return (
    <div className="trk-fe">
      <div className="field">
        <label className="field-label" htmlFor={`${a}-n`}>Field name</label>
        <Input id={`${a}-n`} className="input" maxLength={60} value={e.label} aria-invalid={h || undefined}
          onInput={(u) => i({ label: u.currentTarget.value })} />
        {h ? <p className="field-error">Give the field a name so people know what to enter.</p> : null}
      </div>
      <fieldset className="trk-kinds">
        <legend className="field-label">What kind of answer?</legend>
        {Vn.map((u) => {
          const d = u.type === 'dependent' && !n.length
          return (
            <label key={u.type} className={`trk-kind ${e.type === u.type ? 'is-on' : ''} ${d ? 'is-off' : ''}`}>
              {/* eslint-disable-next-line -- kept raw: visually-hidden radio covering the .trk-kind card (CSS: .trk-kind input) */}
              <input type="radio" name={`${a}-k`} value={u.type} checked={e.type === u.type} disabled={d}
                onChange={() => i({ type: u.type })} />
              <span className="trk-kind-name">{u.name}</span>
              <span className="trk-kind-desc">{d ? 'Needs a dropdown field first' : u.desc}</span>
            </label>
          )
        })}
      </fieldset>
      <p className="field-hint">{jn[e.type]}</p>
      {e.type === 'dropdown' ? (
        <div className="field">
          <span className="field-label">Choices</span>
          <ul className="trk-choices">
            {e.choicesText.map((u, d) => (
              <li key={d}>
                <Input className="input" aria-label={`Choice ${d + 1}`} value={u}
                  readOnly={d < (e.locked ?? 0)}
                  title={d < (e.locked ?? 0) ? 'Saved choice: it stays, so records that use it keep their answer' : undefined}
                  maxLength={120}
                  onInput={(m) => {
                    const f = [...e.choicesText]
                    f[d] = m.currentTarget.value
                    i({ choicesText: f })
                  }} />
                {e.choicesText.length > 1 && d >= (e.locked ?? 0) ? (
                  <Button variant="quiet" aria-label={`Remove choice ${d + 1}`}
                    onClick={() => i({ choicesText: e.choicesText.filter((m, f) => f !== d) })}>
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <Button variant="quiet" className="trk-add-choice" onClick={() => i({ choicesText: [...e.choicesText, ''] })}>
            Add another choice
          </Button>
          {s && !e.choicesText.some((u) => u.trim()) ? <p className="field-error">Add at least one choice, or pick Free text.</p> : null}
        </div>
      ) : null}
      {e.type === 'dependent' ? (
        <Fragment>
          <div className="field">
            <label className="field-label" htmlFor={`${a}-p`}>Depends on</label>
            <Select id={`${a}-p`} className="select" value={e.parentRef}
              onChange={(u) => i({ parentRef: u.currentTarget.value, depText: {} })}>
              <option value="">Choose a dropdown field…</option>
              {n.map((u) => (
                <option key={u.ref} value={u.ref}>{u.label}</option>
              ))}
            </Select>
          </div>
          {c ? (
            <div className="field">
              <span className="field-label">Choices for each answer of {c.label}</span>
              {c.choices.length ? (
                <dl className="trk-dep">
                  {c.choices.map((u) => (
                    <div key={u} className="trk-dep-row">
                      <dt>{u}</dt>
                      <dd>
                        <Input className="input" aria-label={`Choices when ${c.label} is ${u}, separated by commas`}
                          placeholder="Choices to offer, separated by commas" value={e.depText[u] ?? ''}
                          onInput={(d) => i({ depText: { ...e.depText, [u]: d.currentTarget.value } })} />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="field-hint">{c.label} has no choices yet. Add some to it first.</p>
              )}
            </div>
          ) : null}
        </Fragment>
      ) : null}
      <label className="trk-check">
        {/* eslint-disable-next-line -- kept raw: native checkbox inside .trk-check label */}
        <input type="checkbox" checked={e.required} onChange={(u) => i({ required: u.currentTarget.checked })} />
        People must fill this in
      </label>
    </div>
  )
}

/** Jn: the add/edit field dialog. */
function Jn({ data: e, field: t, onClose: n, onSaved: s }: { data: TrackerData; field: FieldOut | null; onClose: () => void; onSaved: (d: TrackerData) => void }) {
  const a = useRef<HTMLDialogElement>(null)
  const [i, c] = useState<Draft>(() => (t ? Zn(t, e) : Ie()))
  const [h, u] = useState(false)
  const [d, m] = useState(false)
  const [f, o] = useState('')
  const _ = Yn(e.fields, e.choices ?? {}, t?.id)
  useEffect(() => {
    const p = a.current
    if (p && !p.open) p.showModal?.()
  }, [])
  const l = useMemo(() => {
    if (!t || i.type === t.type) return 0
    const p = new Set(i.choicesText.map((w) => w.trim().toLowerCase()).filter(Boolean))
    return e.rows.filter((w) => {
      const q = String(w.values[t.id] ?? '').trim()
      return q ? (i.type === 'dropdown' ? !p.has(q.toLowerCase()) : We(i.type, q).misfit) : false
    }).length
  }, [t, i.type, i.choicesText, e.rows])
  function v(p: Draft) {
    if (t && p.type === 'dropdown' && i.type !== 'dropdown' && !(p.locked ?? 0) && !p.choicesText.some((w) => w.trim())) {
      const w = new Map<string, string>()
      for (const q of e.rows) {
        const k = String(q.values[t.id] ?? '').replace(/\s+/g, ' ').trim()
        if (k && k.length <= 120 && k.toLowerCase() !== 'other' && !w.has(k.toLowerCase())) w.set(k.toLowerCase(), k)
      }
      if (w.size) p = { ...p, choicesText: [...w.values()].slice(0, 50) }
    }
    c(p)
  }
  async function g() {
    u(true)
    if (Ut(i)) return
    m(true)
    o('')
    try {
      const p = Bt(i, _)
      s(await (t ? ee.updateField(e.tracker.id, t.id, p) : ee.addField(e.tracker.id, p)))
    } catch (p) {
      o((p as Error).message)
    } finally {
      m(false)
    }
  }
  const y = t ? 'Save changes' : 'Add field'
  return (
    <dialog ref={a} className="trk-dialog" aria-labelledby="trk-af" onClose={n} onCancel={n}>
      <h2 id="trk-af" className="trk-form-title">{t ? `Edit ${t.label}` : `Add a field to ${e.tracker.name}`}</h2>
      <p className="field-hint">
        {t
          ? 'Records already saved keep their values exactly as they are, whatever you change here. Saved choices stay; you can add more.'
          : 'The field appears as a column and in the new-record form. Existing records stay empty for it.'}
      </p>
      <Kt draft={i} onChange={v} parents={_} showErrors={h} />
      {l ? (
        <p className="trk-banner" role="status">
          {l} of the {e.rows.length} loaded record{e.rows.length === 1 ? '' : 's'} hold{l === 1 ? 's' : ''} a value that is not a{' '}
          {Gn[i.type] ?? i.type}. Saving keeps every value as entered and marks the ones that do not fit in the table.
        </p>
      ) : null}
      {f ? <p className="field-error" role="alert">{f}</p> : null}
      <div className="trk-dialog-actions">
        <Button variant="quiet" onClick={n}>Cancel</Button>
        <Button variant="primary" onClick={g} disabled={d}>{d ? 'Saving…' : y}</Button>
      </div>
    </dialog>
  )
}

/** Kn: the skeleton. */
function Kn() {
  return (
    <div className="trk-grid" aria-hidden="true">
      <div className="trk-records">
        {[0, 1, 2, 3, 4].map((e) => (
          <div key={e} className="trk-skel trk-skel-row" />
        ))}
      </div>
      <div className="trk-skel trk-skel-form" />
    </div>
  )
}

const OTHER = '__other__'

/** ut: a dropdown field with "Other…" (addOption_ writes the new choice). */
function Ut2({ listKey: e, label: t, value: n, onChange: s, placeholder: a = 'Choose…', required: i, disabled: c, hint: h }: {
  listKey: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; disabled?: boolean; hint?: string
}) {
  const u = useId()
  const d = useOpt(e)
  const [m, f] = useState(false)
  const [o, _] = useState('')
  const [l, v] = useState(false)
  const [g, y] = useState('')
  const [p, w] = useState('')
  const q = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (d !== undefined) return
    let T = Ce.get(e)
    if (!T) {
      T = G.getDropdownOptions(e).then((Q) => {
        Re(e, Q)
        return Q
      })
      Ce.set(e, T)
      T.catch(() => Ce.delete(e))
    }
    T.catch((Q) => w((Q as Error).message))
  }, [e, d])
  useEffect(() => {
    if (m) q.current?.focus()
  }, [m])
  const k = d ?? []
  const $ = n && !k.includes(n) ? [n, ...k] : k
  function H(T: FormEvent<HTMLSelectElement>) {
    const Q = T.currentTarget.value
    if (Q === OTHER) {
      f(true)
      y('')
      return
    }
    f(false)
    s(Q)
  }
  async function F() {
    if (l) return
    v(true)
    y('')
    try {
      const T = await G.addDropdownOption(e, o)
      Re(e, T.options)
      s(T.value)
      f(false)
      _('')
    } catch (T) {
      y((T as Error).message)
    } finally {
      v(false)
    }
  }
  function j() {
    f(false)
    _('')
    y('')
  }
  const L = h ? `${u}-hint` : undefined
  const R = g || p ? `${u}-err` : undefined
  return (
    <div className="field">
      <label htmlFor={u} className="field-label">
        {t}
        {i ? <span className="req" aria-hidden="true"> *</span> : null}
      </label>
      <Select id={u} className="select" value={m ? OTHER : n} onChange={H}
        disabled={c || d === undefined} required={i}
        aria-describedby={[L, R].filter(Boolean).join(' ') || undefined}>
        <option value="" disabled={i}>{d === undefined ? 'Loading choices…' : a}</option>
        {$.map((T) => (
          <option key={T} value={T}>{T}</option>
        ))}
        <option value={OTHER}>Other…</option>
      </Select>
      {h ? <p id={L} className="field-hint">{h}</p> : null}
      {m ? (
        <div className="other-row">
          <Input ref={q} className="input" type="text" maxLength={120} value={o}
            aria-label={`New choice for ${t}`} placeholder="Type the new choice"
            onInput={(T) => _(T.currentTarget.value)}
            onKeyDown={(T) => {
              if (T.key === 'Enter') {
                T.preventDefault()
                F()
              } else if (T.key === 'Escape') j()
            }} />
          <Button variant="primary" onClick={F} disabled={l || !o.trim()}>{l ? 'Adding…' : 'Add choice'}</Button>
          <Button variant="quiet" onClick={j} disabled={l}>Cancel</Button>
        </div>
      ) : null}
      {g || p ? (
        <p id={R} className="field-error" role="alert">{g || `Choices did not load: ${p}`}</p>
      ) : null}
    </div>
  )
}

/** Xn: the new-record form. */
function Xn({ data: e, me: t, onSaved: n }: { data: TrackerData; me: string; onSaved: (r: TrackerRow) => void }) {
  const [s, a] = useState<Record<string, string>>({})
  const [i, c] = useState(false)
  const [h, u] = useState('')
  const [d, m] = useState('')
  const f = (l: string, v: string) =>
    a((g) => {
      const y = { ...g, [l]: v }
      for (const p of e.fields) if (p.type === 'dependent' && p.parentFieldId === l) delete y[p.id]
      return y
    })
  async function o(l: FormEvent) {
    l.preventDefault()
    c(true)
    u('')
    m('')
    try {
      const v: Record<string, string> = {}
      for (const y of e.fields) if (s[y.id]) v[y.id] = s[y.id]
      const g = await ee.addRecord(e.tracker.id, v)
      n({ recordId: g.recordId, values: v, submittedBy: g.submittedBy, submittedAt: g.submittedAt, outside: false })
      a({})
      m(`Added as ${g.recordId}.`)
    } catch (v) {
      u((v as Error).message)
    } finally {
      c(false)
    }
  }
  const _ = e.fields.filter((l) => l.type !== 'computed')
  return (
    <form className="trk-form" onSubmit={o} aria-labelledby="trk-new">
      <h2 id="trk-new" className="trk-form-title">New record</h2>
      <p className="trk-form-meta">Saved with your email: {t}</p>
      {_.map((l) => {
        if (l.auto === 'actor_name')
          return (
            <p key={l.id} className="field-hint">{l.label} is filled with your name.</p>
          )
        if (l.type === 'dropdown')
          return <Ut2 key={l.id} listKey={l.listKey} label={l.label} value={s[l.id] ?? ''} required={l.required} onChange={(g) => f(l.id, g)} />
        if (l.type === 'dependent') {
          const g = e.fields.find((p) => p.id === l.parentFieldId)
          const y = s[l.parentFieldId] ?? ''
          return y ? (
            <Ut2 key={l.id + y} listKey={Vt(l.listKey, y)} label={l.label} value={s[l.id] ?? ''} required={l.required}
              onChange={(p) => f(l.id, p)} hint={`Choices for ${y}`} />
          ) : (
            <div key={l.id} className="field">
              <span className="field-label">
                {l.label}
                {l.required ? <span className="req" aria-hidden="true"> *</span> : null}
              </span>
              <p className="field-hint">Choose {g?.label ?? 'the field above'} first.</p>
            </div>
          )
        }
        const v = `trk-f-${l.id}`
        return (
          <div key={l.id} className="field">
            <label className="field-label" htmlFor={v}>
              {l.label}
              {l.required ? <span className="req" aria-hidden="true"> *</span> : null}
            </label>
            <Input id={v} className={`input ${l.type === 'number' || l.type === 'money' ? 'trk-num' : ''}`}
              type={l.type === 'date' ? 'date' : l.type === 'link' ? 'url' : 'text'}
              inputMode={l.type === 'number' || l.type === 'money' ? 'decimal' : undefined}
              placeholder={l.type === 'link' ? 'https://' : l.type === 'money' ? '0.000' : undefined}
              required={l.required} maxLength={2000} value={s[l.id] ?? ''}
              onInput={(g) => f(l.id, g.currentTarget.value)} />
          </div>
        )
      })}
      {h ? <p className="field-error" role="alert">{h}</p> : null}
      {d ? <p className="trk-saved" role="status">{d}</p> : null}
      <Button type="submit" variant="primary" disabled={i}>{i ? 'Adding…' : 'Add record'}</Button>
    </form>
  )
}

/** er: the create-a-tracker form. */
function Er({ onCancel: e, onCreated: t }: { onCancel: () => void; onCreated: (d: PageData) => void }) {
  const [n, s] = useState('')
  const [a, i] = useState<Draft[]>([Ie()])
  const [c, h] = useState(false)
  const [u, d] = useState(false)
  const [m, f] = useState('')
  const o = (l: number): ParentRef[] =>
    a
      .slice(0, l)
      .map((v, g) => ({ d: v, j: g }))
      .filter(({ d: v }) => v.type === 'dropdown' && v.label.trim())
      .map(({ d: v, j: g }) => ({ ref: `#${g}`, label: v.label.trim(), choices: v.choicesText.map((y) => y.trim()).filter(Boolean) }))
  async function _() {
    h(true)
    if (!n.trim() || a.some((l) => Ut(l))) return
    d(true)
    f('')
    try {
      t(await ee.create({ name: n.trim(), fields: a.map((l, v) => Bt(l, o(v))) }))
    } catch (l) {
      f((l as Error).message)
    } finally {
      d(false)
    }
  }
  return (
    <div className="trk-create">
      <div className="field">
        <label className="field-label" htmlFor="trk-name">Name of the new tracker</label>
        <Input id="trk-name" className="input" maxLength={60} value={n} onInput={(l) => s(l.currentTarget.value)} />
        <p className="field-hint">It is added to the tracker list for everyone.</p>
        {c && !n.trim() ? <p className="field-error">Give the tracker a name.</p> : null}
      </div>
      <ol className="trk-create-fields">
        {a.map((l, v) => (
          <li key={v} className="trk-create-field">
            <div className="trk-create-field-head">
              <span>Field {v + 1}</span>
              {a.length > 1 ? (
                <Button variant="quiet" onClick={() => i(a.filter((g, y) => y !== v))}>Remove field</Button>
              ) : null}
            </div>
            <Kt draft={l} parents={o(v)} showErrors={c} onChange={(g) => i(a.map((y, p) => (p === v ? g : y)))} />
          </li>
        ))}
      </ol>
      <Button variant="quiet" onClick={() => i([...a, Ie()])}>Add another field</Button>
      {m ? <p className="field-error" role="alert">{m}</p> : null}
      <div className="trk-dialog-actions">
        <Button variant="quiet" onClick={e}>Cancel</Button>
        <Button variant="primary" onClick={_} disabled={u}>{u ? 'Creating…' : 'Create tracker'}</Button>
      </div>
    </div>
  )
}

const NEW_TRACKER = '__new__'

/** Qn: one record cell (misfit mark, link rendering, numeric alignment). */
function Qn({ f: e, r: t }: { f: FieldOut; r: TrackerRow }) {
  const { text: n, misfit: s } = We(e.type, t.values[e.id])
  const a = e.type === 'number' || e.type === 'money'
  return s ? (
    <td className="trk-misfit" title={`Kept as entered: not a valid ${e.type === 'link' ? 'web link' : e.type}`}>{n}</td>
  ) : e.type === 'link' && n ? (
    <td title={n}>
      <a href={n} target="_blank" rel="noopener noreferrer">{n.replace(/^https?:\/\/(www\.)?/i, '')}</a>
    </td>
  ) : (
    <td className={a ? 'trk-num' : undefined} title={n.length > 40 ? n : undefined}>{n}</td>
  )
}

/** zn: the records table (or its empty states). */
function Zn2({ fields: e, rows: t, empty: n, onEdit: s }: { fields: FieldOut[]; rows: TrackerRow[]; empty: boolean; onEdit?: (f: FieldOut | 'new') => void }) {
  return n ? (
    <p className="trk-empty">No records yet. Add the first one with the form.</p>
  ) : t.length ? (
    <div className="trk-table-wrap" tabIndex={0} role="region" aria-label="Records">
      <table className="trk-table">
        <thead>
          <tr>
            {e.map((a) => (
              <th key={a.id} scope="col" className={a.type === 'number' || a.type === 'money' ? 'trk-num' : undefined}>
                {s && Wn(a) ? (
                  <>
                    {/* eslint-disable-next-line -- kept raw: .trk-th-edit is an all:unset inline header button, not a cx-btn */}
                    <button type="button" className="trk-th-edit" onClick={() => s(a)} title="Edit this field">{a.label}</button>
                  </>
                ) : (
                  a.label
                )}
              </th>
            ))}
            <th scope="col">Added by</th>
          </tr>
        </thead>
        <tbody>
          {t.map((a) => (
            <tr key={a.recordId}>
              {e.map((i) => (
                <Qn key={i.id} f={i} r={a} />
              ))}
              <td className="trk-by">
                {a.outside ? (
                  <span className="trk-outside">Entered in the sheet</span>
                ) : (
                  <Fragment>
                    <span>{a.submittedBy}</span>
                    <span className="trk-when">{Bn(a.submittedAt)}</span>
                  </Fragment>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="trk-empty">Nothing matches that search.</p>
  )
}

/** Un: the page. */
export function TrackersPage({ route: e }: { route: { title: string } }) {
  const [t, n] = useState<PageData | null>(null)
  const [s, a] = useState<TrackerData | null>(null)
  const [i, c] = useState('')
  const [h, u] = useState(false)
  const [d, m] = useState(false)
  const [f, o] = useState<FieldOut | 'new' | null>(null)
  const [_, l] = useState('')
  useEffect(() => {
    /* ?t=<tracker> picks the initial tracker — '#/trackers?t=' in the legacy,
       '/trackers?t=' after the shim; pageParams reads both. */
    const p = pageParams().get('t') ?? ''
    ee.page(p).then(
      (w) => {
        de(w.current)
        n(w)
        a(w.current)
        if (w.error) c(w.error)
      },
      (w) => c((w as Error).message),
    )
  }, [])
  async function v(p: string) {
    if (p === NEW_TRACKER) {
      m(true)
      return
    }
    m(false)
    u(true)
    c('')
    l('')
    try {
      const w = await ee.records(p)
      de(w)
      a(w)
    } catch (w) {
      c((w as Error).message)
    } finally {
      u(false)
    }
  }
  const g = useMemo(() => {
    if (!s) return []
    const p = _.trim().toLowerCase()
    return p
      ? s.rows.filter(
          (w) =>
            s.fields.some((q) => {
              const k = w.values[q.id]
              return String(k ?? '').toLowerCase().includes(p) || We(q.type, k).text.toLowerCase().includes(p)
            }) || w.submittedBy.includes(p),
        )
      : s.rows
  }, [s, _])
  const y = s?.tracker
  return (
    <section className="page page-fill trk-page" aria-labelledby="page-title">
      <header className="page-head trk-head">
        <div>
          <h1 id="page-title" className="page-title">{e.title}</h1>
          <p className="page-purpose">Every record keeps the email of the person who added it.</p>
        </div>
        <div className="trk-switch field">
          <label className="field-label" htmlFor="trk-switch">Tracker</label>
          {t ? (
            <Select id="trk-switch" className="select trk-switch-select" value={d ? NEW_TRACKER : y?.id ?? ''}
              onChange={(p) => v(p.currentTarget.value)} disabled={h}>
              {t.trackers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.accessMode === 'view_only' ? ' (view only)' : ''}
                </option>
              ))}
              {t.canCreate ? <option value={NEW_TRACKER}>Other: create a new tracker…</option> : null}
            </Select>
          ) : (
            <div className="trk-skel trk-skel-select" aria-hidden="true" />
          )}
        </div>
      </header>
      {i ? <p className="trk-banner trk-banner-error" role="alert">{i}</p> : null}
      {!t && !i ? <Kn /> : null}
      {t && d ? <Er onCancel={() => m(false)} onCreated={(p) => { de(p.current); n(p); a(p.current); m(false) }} /> : null}
      {t && !d && s ? (
        <div className={`trk-body fill-grow ${h ? 'is-busy' : ''}`} aria-busy={h}>
          {s.tracker.accessMode === 'view_only' ? (
            <p className="trk-banner">
              View only. This tracker is calculated in its own sheet. To change a number, change it there.
              {s.tracker.sourceUrl ? (
                <Fragment>
                  {' '}
                  <a href={s.tracker.sourceUrl} target="_blank" rel="noopener">Open the source sheet</a>
                </Fragment>
              ) : null}
            </p>
          ) : null}
          {s.headerProblems.length ? (
            <div className="trk-banner trk-banner-error" role="alert">
              <p>{s.tracker.name} is paused: its sheet no longer matches the fields here, so nothing is read or saved until an admin fixes the mapping.</p>
              <ul>
                {s.headerProblems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="trk-grid">
            <div className="trk-records">
              <div className="trk-tools">
                <label className="trk-search">
                  <span className="sr-only">Search records</span>
                  <Input className="input" type="search" placeholder="Search records" value={_} onInput={(p) => l(p.currentTarget.value)} />
                </label>
                <p className="trk-count">
                  {g.length === s.total ? `${s.total} record${s.total === 1 ? '' : 's'}` : `${g.length} of ${s.total}`}
                  {s.limited ? ', newest 300 shown' : ''}
                  {s.tracker.seesAll ? '' : ', only the ones you added'}
                </p>
                {s.tracker.canBuild ? (
                  <Button variant="quiet" className="trk-addfield" onClick={() => o('new')}>Add field</Button>
                ) : null}
              </div>
              <Zn2 fields={s.fields} rows={g} empty={s.total === 0} onEdit={s.tracker.canBuild ? o : undefined} />
            </div>
            {s.tracker.canAdd && !s.headerProblems.length ? (
              <Xn key={s.tracker.id + s.fields.length} data={s} me={t.me.email}
                onSaved={(p) => a((w) => (w && { ...w, rows: [p, ...w.rows], total: w.total + 1 }))} />
            ) : null}
          </div>
        </div>
      ) : null}
      {f && s ? (
        <Jn key={f === 'new' ? 'new' : f.id} data={s} field={f === 'new' ? null : f} onClose={() => o(null)}
          onSaved={(p) => { de(p); a(p); o(null) }} />
      ) : null}
    </section>
  )
}
