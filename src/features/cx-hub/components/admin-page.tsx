'use client'

/* port of the legacy Nm admin page: the Pf pending shell with the
 * built blocks — Dropdown choices (oo x2), Appearance
 * (Tm + the ap-* localStorage theme controls) and Settings (Dm + Pm editor,
 * fed by getConfigRows/saveConfigSetting). */

import { useCallback, useEffect, useState } from 'react'
import { Button, Chip, Empty, Input, PageShell, Select, SettingsSection, SettingsToc, Textarea, Toggle } from '@/features/shared/components/ui'
import {
  applyAppearance,
  D,
  Ft,
  Ln,
  Oo,
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
const Sm = (n: ConfigRow): string | null => {
  const v = n.value
  if (typeof v !== 'string') return null
  const t = v.trim()
  return /^https?:\/\//i.test(t) ? t : null
}
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
        <Select id={l} className="select" aria-label={n.key} value={i} onChange={(u) => s(u.target.value)}>
          <option value="true">true</option>
          <option value="false">false</option>
        </Select>
      ) : n.kind === 'list' || n.kind === 'json' ? (
        <Textarea
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
        <Input
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
        <Button type="submit" className="btn btn-primary btn-small" disabled={r}>
          {r ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" className="btn btn-quiet btn-small" disabled={r} onClick={t}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function Dm({ rows, onSaved }: { rows: ConfigRow[]; onSaved: (rows: ConfigRow[]) => void }) {
  const [i, s] = useState('')
  const [r, a] = useState('')
  const [o, c] = useState('')
  const l = (() => {
    const h = i.trim().toLowerCase()
    return h ? rows.filter((u) => u.key.includes(h) || u.description.toLowerCase().includes(h)) : rows
  })()
  return (
    <Ft>
      <div className="field setting-find">
        <label className="field-label" htmlFor="cfg-find">
          Find a setting
        </label>
        <Input
          id="cfg-find"
          className="input"
          type="search"
          placeholder="e.g. qa_ or quality"
          value={i}
          onInput={(h) => s((h.target as HTMLInputElement).value)}
        />
      </div>
      <p className="field-hint">
        {l.length} of {rows.length}. A change applies here at once and in the other apps within 5 minutes.
      </p>
      <dl className="kv">
        {l.map((h) => {
          const url = Sm(h)
          return (
          <div className="kv-row" key={h.key}>
            <dt>
              <span className="setting-key" title={h.key}>{h.key}</span>
              {h.description ? <span className="setting-desc">{h.description}</span> : null}
            </dt>
            <dd>
              {r === h.key ? (
                <Pm
                  row={h}
                  onCancel={() => a('')}
                  onSaved={(u) => {
                    onSaved(u)
                    a('')
                  }}
                />
              ) : (
                <div className="setting-view">
                  <span className="setting-value">
                    {url ? (
                      <a className="cx-link" href={url} target="_blank" rel="noopener noreferrer" title={url}>
                        {h.key.startsWith('app_url_') ? `Open the ${h.key.slice(8) || 'app'} app` : 'Open link'}
                      </a>
                    ) : (
                      Am(h)
                    )}
                  </span>
                  {h.kind === 'boolean' ? (
                    <Button
                      type="button"
                      className="btn btn-quiet btn-small"
                      disabled={o === h.key}
                      aria-label={`Set ${h.key} to ${!h.value}`}
                      onClick={() => {
                        c(h.key)
                        Ln.saveConfigSetting(h.key, !h.value)
                          .then(
                            (u) => {
                              onSaved(u)
                              Ti(`${h.key} is now ${!h.value}`)
                            },
                            (u) => Ti((u as Error).message, 'error')
                          )
                          .finally(() => c(''))
                      }}
                    >
                      {o === h.key ? 'Saving…' : `Set to ${!h.value}`}
                    </Button>
                  ) : (
                    <Button type="button" className="btn btn-quiet btn-small" onClick={() => a(h.key)} aria-label={`Edit ${h.key}`}>
                      Edit
                    </Button>
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
          )
        })}
      </dl>
      {l.length === 0 ? (
        <Empty
          icon={
            <svg className="cx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
          }
          title="No settings found"
          body="Try a different search."
        />
      ) : null}
    </Ft>
  )
}

/* Pf — the pending page shell (the unbuilt parts of Admin). */
function Pf({ route: n, children: t }: { route: { title: string; purpose?: string; reqs?: number[] }; children?: React.ReactNode }) {
  return (
    <PageShell title={n.title} purpose={n.purpose} id="page-title">
      {t}
    </PageShell>
  )
}

/* Tm — Appearance: the browser-local theme controls. */
const bm: [string, string][] = [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']]
const wm: [string, string][] = [['en', 'English'], ['ar', 'العربية']]
const Em: [string, string][] = [
  ['pine', 'Pine'],
  ['blue', 'Blue'],
  ['plum', 'Plum'],
  ['rust', 'Rust'],
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
              {/* intentionally raw: swatch radio, styled by .ap-theme/.ap-swatch with focus ring */}
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
          {Em.map(([i, s]) => (
            <label className="ap-dot" title={s} key={i}>
              {/* intentionally raw: swatch radio, styled by .ap-dot/[data-accent-preview] with focus ring */}
              <input type="radio" name="ap-accent" value={i} checked={n.accent === i} onChange={() => t({ accent: i })} aria-label={s} />
              <span data-accent-preview={i} />
            </label>
          ))}
        </div>
      </fieldset>
      <Toggle className="ap-check" checked={n.solid} onChange={(v) => t({ solid: v })}>
        {D('Reduce transparency')}
      </Toggle>
      <Toggle className="ap-check" checked={n.still} onChange={(v) => t({ still: v })}>
        {D('Reduce motion')}
      </Toggle>
      <fieldset>
        <legend>{D('Language')}</legend>
        <div className="ap-themes">
          {wm.map(([i, s]) => (
            <label className="ap-check" lang={i} key={i}>
              {/* intentionally raw: swatch radio, styled by .ap-check label + lang attr */}
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

function Rb({ rows, error, onSaved, onRetry }: { rows: ConfigRow[] | null; error: string; onSaved: (rows: ConfigRow[]) => void; onRetry: () => void }) {
  const [pending, setPending] = useState<boolean | null>(null)
  const busy = pending !== null
  const row = rows?.find((x) => x.key === 'reminders_enabled')
  const on = row ? row.value === true : true
  return (
    <SettingsSection id="reminders" title="Reminders">
      {rows === null ? (
        <>
          <p className="cx-section__hint">
            Master switch: stops all reminder popups, in-app alerts and reminder emails for everyone.
          </p>
          {error ? (
            <>
              <Chip status="bad">error</Chip>{' '}
              <Button type="button" className="btn btn-quiet btn-small" onClick={onRetry}>
                Try again
              </Button>
            </>
          ) : (
            <Chip>loading</Chip>
          )}
        </>
      ) : (
        <div className="between">
          <span className="cx-section__hint">
            <Chip status={on ? 'ok' : undefined}>{on ? 'on' : 'off'}</Chip>{' '}
            Master switch: stops all reminder popups, in-app alerts and reminder emails for everyone.
          </span>
          <Toggle
            checked={pending ?? on}
            disabled={busy || !row}
            onChange={(next) => {
              setPending(next)
              Ln.saveConfigSetting('reminders_enabled', next)
                .then(
                  (updated) => {
                    onSaved(updated)
                    Ti(`Reminders are ${next ? 'on' : 'off'}`)
                  },
                  (error) => Ti((error as Error).message, 'error')
                )
                .finally(() => setPending(null))
            }}
          >
            Reminders
          </Toggle>
        </div>
      )}
    </SettingsSection>
  )
}

/* Nm — the admin page itself. */
export function AdminPage({ route: n }: { route: { title: string; purpose?: string; reqs?: number[] } }) {
  const [e, t] = useState('')
  const [i, s] = useState('')
  const [r, a] = useState<ConfigRow[] | null>(null)
  const [o, c] = useState('')
  const loadConfig = useCallback(() => {
    c('')
    Ln.getConfigRows().then(a, (l) => c(l.message))
  }, [])
  useEffect(() => {
    Ln.getConfigRows().then(a, (l) => c(l.message))
  }, [])
  return (
    <Pf route={n}>
      <SettingsToc
        label="Admin sections"
        items={[
          { id: 'dropdown-choices', label: 'Dropdown choices' },
          { id: 'reminders', label: 'Reminders' },
          { id: 'appearance', label: 'Appearance' },
          { id: 'settings', label: 'Settings' },
        ]}
      />
      <SettingsSection id="dropdown-choices" title="Dropdown choices">
        <p className="cx-section__hint">
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
      </SettingsSection>
      <Rb rows={r} error={o} onSaved={a} onRetry={loadConfig} />
      <SettingsSection id="appearance" title="Appearance">
        <Tm />
      </SettingsSection>
      <SettingsSection id="settings" title="Settings">
        {o ? (
          <>
            <p className="field-error" role="alert">
              Settings did not load: {o}
            </p>
            <Button type="button" className="btn btn-quiet btn-small" onClick={loadConfig}>
              Try again
            </Button>
          </>
        ) : r ? (
          <Dm rows={r} onSaved={a} />
        ) : (
          <p className="cx-section__hint">Loading settings…</p>
        )}
      </SettingsSection>
    </Pf>
  )
}
export default AdminPage
