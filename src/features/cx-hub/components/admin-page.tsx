'use client'

/* port of the legacy Nm admin page: the Pf pending shell with the
 * built blocks — Dropdown choices (oo x2), Connected apps (Im — read-only
 * per decision D1, the only deviation from verbatim), Appearance
 * (Tm + the ap-* localStorage theme controls) and Settings (Dm + Pm editor,
 * fed by getConfigRows/saveConfigSetting). */

import { useEffect, useState } from 'react'
import {
  applyAppearance,
  D,
  Ft,
  Ln,
  Oo,
  Pr,
  Ti,
  type ConfigRow,
} from './hub-shared'

/* Am / Cm / Rm — the setting value renderers + draft coercion, verbatim. */
const Am = (n: ConfigRow): string =>
  n.kind === 'list'
    ? (n.value as unknown[]).map((e) => (typeof e === 'string' ? e : JSON.stringify(e))).join(', ') || '(empty list)'
    : n.kind === 'json'
      ? JSON.stringify(n.value)
      : n.value === '' || n.value === null || n.value === undefined
        ? '(blank)'
        : String(n.value)
const Cm = (n: ConfigRow): string =>
  n.kind === 'list' || n.kind === 'json'
    ? JSON.stringify(n.value, null, 2)
    : n.value === null || n.value === undefined
      ? ''
      : String(n.value)
const Rm = (n: ConfigRow, e: string): unknown =>
  n.kind === 'boolean' ? e === 'true' : n.kind === 'number' ? (e.trim() === '' ? NaN : Number(e)) : e

function Pm({ row: n, onSaved: e, onCancel: t }: { row: ConfigRow; onSaved: (rows: ConfigRow[]) => void; onCancel: () => void }) {
  const [i, s] = useState(Cm(n))
  const [r, a] = useState(false)
  const [o, c] = useState('')
  const l = `cfg-${n.key}`
  const h = async (u: React.FormEvent) => {
    u.preventDefault()
    a(!0)
    c('')
    try {
      const d = Rm(n, i)
      if (n.kind === 'number' && !Number.isFinite(d)) throw new Error(`${n.key} is a number.`)
      e(await Ln.saveConfigSetting(n.key, d))
      Ti(`${n.key} saved`)
    } catch (d) {
      c((d as Error).message)
    } finally {
      a(!1)
    }
  }
  return (
    <form className="setting-edit" onSubmit={(u) => void h(u)}>
      {n.kind === 'boolean' ? (
        <select id={l} className="select" aria-label={n.key} value={i} onChange={(u) => s(u.target.value)}>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : n.kind === 'list' || n.kind === 'json' ? (
        <textarea
          id={l}
          className="input setting-json"
          aria-label={n.key}
          spellCheck={!1}
          rows={Math.min(14, i.split('\n').length + 1)}
          value={i}
          onInput={(u) => s((u.target as HTMLTextAreaElement).value)}
          aria-invalid={o ? !0 : void 0}
        />
      ) : (
        <input
          id={l}
          className="input"
          aria-label={n.key}
          type={n.kind === 'number' ? 'number' : 'text'}
          step="any"
          value={i}
          onInput={(u) => s((u.target as HTMLInputElement).value)}
          aria-invalid={o ? !0 : void 0}
        />
      )}
      {n.kind === 'list' || n.kind === 'json' ? (
        <p className="field-hint">
          JSON. {n.kind === 'list' ? 'A list: ["a", "b"].' : 'An object: {"key": "value"}.'}
        </p>
      ) : null}
      {o ? (
        <p className="field-error" role="alert">
          {o}
        </p>
      ) : null}
      <div className="setting-actions">
        <button type="submit" className="btn btn-primary btn-small" disabled={r}>
          {r ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-quiet btn-small" disabled={r} onClick={t}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function Dm({ initial: n }: { initial: ConfigRow[] }) {
  const [e, t] = useState(n)
  const [i, s] = useState('')
  const [r, a] = useState('')
  const [o, c] = useState('')
  const l = (() => {
    const h = i.trim().toLowerCase()
    return h ? e.filter((u) => u.key.includes(h) || u.description.toLowerCase().includes(h)) : e
  })()
  return (
    <Ft>
      <div className="field setting-find">
        <label className="field-label" htmlFor="cfg-find">
          Find a setting
        </label>
        <input
          id="cfg-find"
          className="input"
          type="search"
          placeholder="e.g. qa_ or quality"
          value={i}
          onInput={(h) => s((h.target as HTMLInputElement).value)}
        />
      </div>
      <p className="field-hint">
        {l.length} of {e.length}. A change applies here at once and in the other apps within 5 minutes.
      </p>
      <dl className="kv">
        {l.map((h) => (
          <div className="kv-row" key={h.key}>
            <dt>
              <span className="setting-key">{h.key}</span>
              {h.description ? <span className="setting-desc">{h.description}</span> : null}
            </dt>
            <dd>
              {r === h.key ? (
                <Pm
                  row={h}
                  onCancel={() => a('')}
                  onSaved={(u) => {
                    t(u)
                    a('')
                  }}
                />
              ) : (
                <div className="setting-view">
                  <span className="setting-value">{Am(h)}</span>
                  {h.kind === 'boolean' ? (
                    <button
                      type="button"
                      className="btn btn-quiet btn-small"
                      disabled={o === h.key}
                      aria-label={`Set ${h.key} to ${!h.value}`}
                      onClick={() => {
                        c(h.key)
                        Ln.saveConfigSetting(h.key, !h.value)
                          .then(
                            (u) => {
                              t(u)
                              Ti(`${h.key} is now ${!h.value}`)
                            },
                            (u) => Ti((u as Error).message, 'error')
                          )
                          .finally(() => c(''))
                      }}
                    >
                      {o === h.key ? 'Saving…' : `Set to ${!h.value}`}
                    </button>
                  ) : (
                    <button type="button" className="btn btn-quiet btn-small" onClick={() => a(h.key)} aria-label={`Edit ${h.key}`}>
                      Edit
                    </button>
                  )}
                </div>
              )}
              {h.updatedBy ? (
                <span className="setting-meta">
                  Changed by {h.updatedBy}
                  {h.updatedAt ? ` on ${h.updatedAt.slice(0, 16).replace('T', ' ')} UTC` : ''}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </Ft>
  )
}

/* Im — Connected apps. */
const Hr = 'hub'
const APPS: Record<string, { title: string }> = {
  hub: { title: 'CX Helm' },
  quality: { title: 'CX Helm Quality' },
  productivity: { title: 'CX Helm Productivity' },
  desk: { title: 'CX Helm Desk' },
  people: { title: 'CX Helm People' },
  operations: { title: 'CX Helm Operations' },
  queue: { title: 'CX Helm Queue' },
  fcr: { title: 'CX Helm FCR' },
}
const Lm = Object.keys(APPS)

/* Im — Connected apps, read-only per decision D1: one deployment serves every
 * app, so the per-app /exec URLs are retired. Same legacy block/field
 * vocabulary (block-title, block-text, form-grid, field, field-label, input,
 * field-hint incl. the not-connected line and the "(this app)" marker on hub);
 * the edit affordances (onInput, per-app errors, "Save link") are the only
 * things dropped. setAppUrl stays verbatim on the API surface. */
function Im() {
  const n = Pr()
  const e = n?.appUrls ?? {}
  return (
    <div className="block">
      <h2 className="block-title">Connected apps</h2>
      <p className="block-text">
        Each system opens inside this one app now, so there are no web app URLs to connect.
        The retired Apps Script addresses stay on record here, read-only.
      </p>
      <div className="form-grid">
        {Lm.map((h) => {
          const u = `app-url-${h}`
          return (
            <div className="field" key={h}>
              <label className="field-label" htmlFor={u}>
                {APPS[h].title}
                {h === Hr ? ' (this app)' : ''}
              </label>
              <input
                id={u}
                className="input"
                type="url"
                inputMode="url"
                value={e[h] ?? ''}
                readOnly
                aria-label={APPS[h].title}
              />
              {e[h] ? null : (
                <p className="field-hint">Not connected yet: links to this app are switched off.</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* Pf — the pending page shell (the unbuilt parts of Admin). */
function Pf({ route: n, narrow: e, children: t }: { route: { title: string; purpose?: string; reqs?: number[] }; narrow?: boolean; children?: React.ReactNode }) {
  return (
    <section className={e ? 'page page-narrow' : 'page'} aria-labelledby="page-title">
      <header className="page-head">
        <h1 id="page-title" className="page-title">
          {n.title}
        </h1>
        <p className="page-purpose">{n.purpose}</p>
      </header>
      <div className="pending">
        <p className="pending-line">
          Not built yet.
          {n.reqs && n.reqs.length
            ? ` Covers requirement${n.reqs.length > 1 ? 's' : ''} ${n.reqs.join(', ')} in the brief.`
            : ''}
        </p>
      </div>
      {t}
    </section>
  )
}

/* Tm — Appearance: the browser-local theme controls. */
const bm: [string, string][] = [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']]
const wm: [string, string][] = [['en', 'English'], ['ar', 'العربية']]
const Em: [string, string, string][] = [
  ['pine', 'Pine', '#1b4c45'],
  ['blue', 'Blue', '#2b5797'],
  ['plum', 'Plum', '#6b3a72'],
  ['rust', 'Rust', '#9a4a1f'],
]
const Mf = 'cx.appearance'
const iu = { theme: 'auto', accent: 'pine', solid: !1, still: !1, lang: 'en' }
function Sf() {
  try {
    return { ...iu, ...JSON.parse(localStorage.getItem(Mf) || '{}') }
  } catch {
    return iu
  }
}
function am(n: typeof iu) {
  applyAppearance(n)
  try {
    localStorage.setItem(Mf, JSON.stringify(n))
  } catch {
    /* storage unavailable */
  }
}
function Tm() {
  const [n, e] = useState(Sf)
  const t = (i: Partial<typeof iu>) =>
    e((s: typeof iu) => {
      const r = { ...s, ...i }
      am(r)
      return r
    })
  return (
    <div className="appearance">
      <fieldset>
        <legend>{D('Theme')}</legend>
        <div className="ap-themes">
          {bm.map(([i, s]) => (
            <label className="ap-theme" key={i}>
              <input type="radio" name="ap-theme" value={i} checked={n.theme === i} onChange={() => t({ theme: i })} />
              <span className="ap-swatch" data-t={i} aria-hidden="true" />
              {D(s)}
            </label>
          ))}
        </div>
        <p className="field-hint">{D("Auto follows your device's light or dark setting.")}</p>
      </fieldset>
      <fieldset>
        <legend>{D('Accent')}</legend>
        <div className="ap-dots">
          {Em.map(([i, s, r]) => (
            <label className="ap-dot" title={s} key={i}>
              <input type="radio" name="ap-accent" value={i} checked={n.accent === i} onChange={() => t({ accent: i })} aria-label={s} />
              <span style={{ background: r }} />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="ap-check">
        <input type="checkbox" checked={n.solid} onChange={(i) => t({ solid: i.target.checked })} />
        {D('Reduce transparency')}
      </label>
      <label className="ap-check">
        <input type="checkbox" checked={n.still} onChange={(i) => t({ still: i.target.checked })} />
        {D('Reduce motion')}
      </label>
      <fieldset>
        <legend>{D('Language')}</legend>
        <div className="ap-themes">
          {wm.map(([i, s]) => (
            <label className="ap-check" lang={i} key={i}>
              <input type="radio" name="ap-lang" value={i} checked={n.lang === i} onChange={() => t({ lang: i })} />
              {s}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="field-hint">{D('Saved in this browser only.')}</p>
    </div>
  )
}

/* Nm — the admin page itself. */
export function AdminPage({ route: n }: { route: { title: string; purpose?: string; reqs?: number[] } }) {
  const [e, t] = useState('')
  const [i, s] = useState('')
  const [r, a] = useState<ConfigRow[] | null>(null)
  const [o, c] = useState('')
  useEffect(() => {
    Ln.getConfigRows().then(a, (l) => c(l.message))
  }, [])
  return (
    <Pf route={n} narrow={!0}>
      <div className="block">
        <h2 className="block-title">Dropdown choices</h2>
        <p className="block-text">
          Every dropdown ends with Other. A value typed there is added to that dropdown for everyone.
          Try it below.
        </p>
        <div className="form-grid">
          <Oo
            listKey="one_on_one.topic"
            label="1:1 topic"
            value={e}
            onChange={(l) => {
              t(l)
              Ti(`Topic set to ${l}`)
            }}
          />
          <Oo listKey="queue.channel" label="Channel" value={i} onChange={s} />
        </div>
      </div>
      <Im />
      <div className="block">
        <h2 className="block-title">Appearance</h2>
        <Tm />
      </div>
      <div className="block">
        <h2 className="block-title">Settings</h2>
        {o ? (
          <p className="field-error" role="alert">
            Settings did not load: {o}
          </p>
        ) : r ? (
          <Dm initial={r} />
        ) : (
          <p className="block-text">Loading settings…</p>
        )}
      </div>
    </Pf>
  )
}
export default AdminPage
