'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */

/* verbatim port of the legacy Ig people-holidays page: the roster table with
 * the inline editor (role/TL overrides + based-in + days off), the HCT sync
 * button + result note, and the holiday form/table. */

import { useState } from 'react'
import { Button, Chip, Empty, Input, Select } from '@/features/shared/components/ui'
import { Eo, Ft, jl, Oo, sh, Ti, To, Vf, Vi, Yn } from './hub-shared'

type Q = Record<string, any>

const Ff = 'person.country'
const Gi: Record<string, string> = {
  admin: 'Admin',
  tl: 'Team lead',
  agent: 'Agent',
  specialist: 'Specialist (not an agent)',
}
const qo = (n: Q) => (n.source === 'hct' ? 'From the HCT' : 'Without override')

/** Pg — would picking `e` as n's manager loop back to n? */
function Pg(n: string, e: string, t: Q[]): boolean {
  for (let i: string | undefined = n, s = 0; i && s < 20; s++) {
    if (i === e) return !0
    i = t.find((r) => r.email === i)?.tlEmail
  }
  return !1
}

/** Dg — the last-sync note. */
function Dg({ r: n, nameOf: e }: { r: Q; nameOf: (x: string) => string }) {
  return (
    <div className="cx-note" data-status={n.unresolved.length ? 'warn' : 'info'} role="status">
      <div>
        <strong>
          Last HCT sync{n.at ? `, ${To(n.at)} ${Yn(n.at)}` : ''}: {n.synced} people, {n.added} added,{' '}
          {n.changed} changed.
        </strong>
        {n.addedPeople?.length ? <p>Added: {n.addedPeople.join(', ')}.</p> : null}
        {n.changes?.length ? (
          <ul>
            {n.changes.map((t: Q) => (
              <li key={t.email}>
                {t.name}: {t.fields.join('; ')}
              </li>
            ))}
          </ul>
        ) : null}
        {n.unresolved.length ? (
          <Ft>
            <p>Manager not found in the HCT for:</p>
            <ul>
              {n.unresolved.map((t: Q) => (
                <li key={t.email}>
                  {e(t.email)}: &quot;{t.manager}&quot; ({t.reason}). If {t.manager} is on the roster
                  below, pick them under Reports to. If not (for example a manager outside CX), add{' '}
                  <code>{'"' + t.manager + '": "their email"'}</code> to{' '}
                  <a href="#/admin">roster_manager_aliases in Admin</a>; an override can only pick
                  someone on the roster.
                </li>
              ))}
            </ul>
          </Ft>
        ) : null}
      </div>
    </div>
  )
}

/** Lg — the inline person editor. */
function Lg({ p: n, people: e, weekdays: t, onSaved: i, onCancel: s }: {
  p: Q
  people: Q[]
  weekdays: string[]
  onSaved: (p: Q) => void
  onCancel: () => void
}) {
  const [r, a] = useState<string>(n.basedInCountry)
  const [o, c] = useState<string[]>(n.daysOff)
  const [l, h] = useState<string>(n.roleOverride)
  const [u, d] = useState<string>(n.tlOverride)
  const [p2, g] = useState('')
  const [y, v] = useState(!1)
  const m = (x: string) => e.find((b) => b.email === x)?.name || x
  const E = e.filter(
    (x) => x.active && x.email !== n.email && (x.role === 'tl' || x.role === 'admin') && !Pg(x.email, n.email, e)
  )
  if (n.tlOverride && !E.some((x) => x.email === n.tlOverride))
    E.push({ ...n, email: n.tlOverride, name: m(n.tlOverride) })
  async function C() {
    if (
      !(
        l === 'admin' &&
        n.role !== 'admin' &&
        !window.confirm(
          `Give ${n.name} admin access? Admins see every team, every 1:1 record and every setting.`
        )
      )
    ) {
      v(!0)
      g('')
      try {
        const x = await Vi.setPerson(n.email, { basedInCountry: r, daysOff: o })
        let b: any = { ...n, basedInCountry: x.basedInCountry, daysOff: x.daysOff }
        let w = ''
        if (l !== n.roleOverride || u !== n.tlOverride) {
          const S = await Vi.setOverrides(n.email, { role: l, tlEmail: u })
          b = {
            ...b,
            role: S.role,
            tlEmail: S.tlEmail,
            roleOverride: S.roleOverride,
            tlOverride: S.tlOverride,
            hctRole: b.hctRole || S.baseRole || '',
            hctTlEmail: b.hctTlEmail || S.baseTlEmail || '',
          }
          if (S.tlEmail !== n.tlEmail)
            w += ` Home, Aging and 1:1s now follow ${S.tlEmail ? m(S.tlEmail) : 'no team lead'}.`
          if (S.role !== n.role) w += ` Access is now ${Gi[S.role] || S.role} from their next page load.`
          if (S.baseKnown === !1 && !l)
            w += ' No earlier role was on record, so they are now an agent; set the right role if that is wrong.'
        }
        i(b)
        Ti(`Saved ${n.name}.${w}`)
      } catch (x) {
        g((x as Error).message)
      } finally {
        v(!1)
      }
    }
  }
  return (
    <div className="dq-editor">
      <div className="cx-field">
        <label className="cx-label" htmlFor={`role-${n.email}`}>
          Role
        </label>
        <Select className="cx-input" id={`role-${n.email}`} value={l} onChange={(x) => h(x.currentTarget.value)}>
          <option value="">
            {qo(n)}: {Gi[n.hctRole] || n.hctRole || (n.roleOverride ? 'none recorded, becomes Agent' : Gi[n.role] || n.role)}
          </option>
          {Object.keys(Gi)
            .filter((x) => x !== (n.hctRole || (n.roleOverride ? '' : n.role)))
            .map((x) => (
              <option key={x} value={x}>
                {Gi[x]} (override)
              </option>
            ))}
        </Select>
      </div>
      <div className="cx-field">
        <label className="cx-label" htmlFor={`tl-${n.email}`}>
          Reports to
        </label>
        <Select className="cx-input" id={`tl-${n.email}`} value={u} onChange={(x) => d(x.currentTarget.value)}>
          <option value="">
            {qo(n)}: {n.hctTlEmail || (!n.tlOverride && n.tlEmail) ? m(n.hctTlEmail || n.tlEmail) : 'nobody'}
          </option>
          {E.filter((x) => x.email !== (n.hctTlEmail || (n.tlOverride ? '' : n.tlEmail))).map((x) => (
            <option key={x.email} value={x.email}>
              {x.name} (override)
            </option>
          ))}
        </Select>
      </div>
      <span className="cx-hint">
        Overrides stay through every HCT sync until you set them back to &quot;{qo(n)}&quot;. Changes
        show on Home, Aging and 1:1s straight away.
      </span>
      <Oo listKey={Ff} label="Based in" value={r} onChange={a} hint="Public holidays follow this country." />
      <fieldset className="cx-fieldset">
        <legend className="cx-label">Days off</legend>
        <div className="dq-days">
          {t.map((x) => (
            <label className="cx-toggle" key={x}>
              <input
                type="checkbox"
                checked={o.includes(x)}
                onChange={(b) => {
                  const w = b.currentTarget.checked
                  c((S) => (w ? t.filter((_) => _ === x || S.includes(_)) : S.filter((_) => _ !== x)))
                }}
              />
              <span>{x}</span>
            </label>
          ))}
        </div>
        <span className="cx-hint">None ticked = the country or default pattern.</span>
      </fieldset>
      {p2 ? (
        <p className="cx-error" role="alert">
          {p2}
        </p>
      ) : null}
      <div className="dq-editor__actions">
        <Button variant="primary" className="cx-btn" disabled={y} onClick={C}>
          {y ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="quiet" className="cx-btn" onClick={s}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function PeopleHolidaysPage({ route: n }: { route: { title: string } }) {
  const { data: e, error: t, reload: i, setData: s } = Eo(Vi.rosterAdmin)
  const [r, a] = useState('')
  const [o, c] = useState({ country: '', date: '', name: '' })
  const [l, h] = useState('')
  const [u, d] = useState('')
  const [p, g] = useState(!1)
  const [y, v] = useState(!1)
  const m = (S: (e: Q) => Q) => e && s(S(e))
  async function E(S: React.FormEvent) {
    S.preventDefault()
    h('')
    try {
      const _ = await Vi.addHoliday(o)
      m((T: Q) => ({ ...T, holidays: [...T.holidays, _].sort((R: Q, D: Q) => R.date.localeCompare(D.date)) }))
      c({ country: o.country, date: '', name: '' })
      Ti(`Added ${_.name}, ${_.country}.`)
    } catch (_) {
      h((_ as Error).message)
    }
  }
  async function C(S: string) {
    try {
      await Vi.removeHoliday(S)
      m((_: Q) => ({ ..._, holidays: _.holidays.filter((T: Q) => T.id !== S) }))
    } catch (_) {
      Ti((_ as Error).message, 'error')
    }
  }
  async function x() {
    g(!0)
    d('')
    try {
      await Vi.syncRoster()
      i()
    } catch (S) {
      d((S as Error).message)
    } finally {
      g(!1)
    }
  }
  const b = e ? e.people.filter((S: Q) => y || S.active) : []
  const w = (S: string) => e?.people.find((_: Q) => _.email === S)?.name || S
  return (
    <section className="cxp page" aria-labelledby="page-title" aria-busy={!e && !t}>
      <Vf
        title={n.title}
        sub="Role, who each person reports to, where they are based, their days off, and public holidays by country. The daily HCT sync never changes what you set here."
        aside={
          <Button className="cx-btn" disabled={p} onClick={x}>
            {p ? 'Syncing…' : 'Sync roster from HCT now'}
          </Button>
        }
      />
      {u ? (
        <p className="cx-error" role="alert">
          {u}
        </p>
      ) : null}
      {e?.lastSync ? <Dg r={e.lastSync} nameOf={w} /> : null}
      {e && e.people.some((S: Q) => S.active && !S.basedInCountry) ? (
        <p className="cx-note" data-status="warn">
          <span>
            {e.people.filter((S: Q) => S.active && !S.basedInCountry).length} people have no
            &quot;Based in&quot; country, so public holidays never excuse a missed 1:1 or a task day
            for them. Set it with Edit.
          </span>
        </p>
      ) : null}
      {t ? sh({ message: t, onRetry: i }) : null}
      {e ? (
        <Ft>
          <section className="cx-panel" aria-labelledby="ppl-h">
            <div className="cx-section__head">
              <div>
                <div className="cx-section__title" id="ppl-h">
                  People
                </div>
                <div className="cx-section__hint">
                  Roles, who each person reports to, where they are based, and their days off.
                </div>
              </div>
              <label className="cx-toggle">
                <input type="checkbox" checked={y} onChange={(S) => v(S.currentTarget.checked)} />
                <span>Show people who left</span>
              </label>
            </div>
            {b.length ? (
            <div className="cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Role</th>
                    <th scope="col">Reports to</th>
                    <th scope="col">Based in</th>
                    <th scope="col">Days off</th>
                    <th scope="col">
                      <span className="cx-sr">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {b.map((S: Q) =>
                    r === S.email ? (
                      <tr key={S.email}>
                        <td colSpan={6}>
                          <strong>{S.name}</strong> <span className="cx-faint">{S.email}</span>
                          <Lg
                            p={S}
                            people={e.people}
                            weekdays={e.weekdays}
                            onCancel={() => a('')}
                            onSaved={(_) => {
                              m((T: Q) => ({ ...T, people: T.people.map((R: Q) => (R.email === _.email ? _ : R)) }))
                              a('')
                            }}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr key={S.email}>
                        <th scope="row" className="cx-rowhead">
                          {S.name}
                          <span className="cx-faint cx-sub">
                            {S.email}
                            {S.active ? '' : ', left'}
                          </span>
                        </th>
                        <td>
                          {Gi[S.role] || S.role}
                          {S.roleOverride ? (
                            <span className="cx-faint cx-sub">
                              set in V2, {S.source === 'hct' ? 'HCT says' : 'without it'}{' '}
                              {Gi[S.hctRole] || S.hctRole || 'Agent'}
                            </span>
                          ) : null}
                        </td>
                        <td className="cx-muted">
                          {S.tlEmail ? (
                            w(S.tlEmail)
                          ) : e.lastSync?.unresolved.some((_: Q) => _.email === S.email) ? (
                            <Chip status="warn">Not found in the HCT</Chip>
                          ) : (
                            '–'
                          )}
                          {S.tlOverride ? (
                            <span className="cx-faint cx-sub">
                              set in V2, {S.source === 'hct' ? 'HCT says' : 'without it'}{' '}
                              {S.hctTlEmail ? w(S.hctTlEmail) : 'nobody'}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          {S.basedInCountry || (
                            <Chip
                              status="warn"
                              title="Public holidays are not excused for this person until you set it"
                            >
                              Not set
                            </Chip>
                          )}
                        </td>
                        <td>
                          {S.daysOff.length ? (
                            S.daysOff.join(', ')
                          ) : (
                            <span className="cx-faint">
                              {(e.daysOffByCountry[S.basedInCountry] || e.daysOffDefault).length
                                ? `Default (${(e.daysOffByCountry[S.basedInCountry] || e.daysOffDefault).join(', ')})`
                                : 'Rotational (no fixed days)'}
                            </span>
                          )}
                        </td>
                        <td>
                          <Button variant="quiet" className="cx-btn" onClick={() => a(S.email)} aria-label={`Edit ${S.name}`}>
                            Edit
                          </Button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
            ) : (
              <Empty
                icon={
                  <svg className="cx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                }
                title="No people to show"
                body={'Tick "Show people who left" to include people who have left.'}
              />
            )}
          </section>
          <section className="cx-panel" aria-labelledby="hol-h">
            <div className="cx-section__head">
              <div>
                <div className="cx-section__title" id="hol-h">
                  Public holidays
                </div>
                <div className="cx-section__hint">
                  A 1:1 due on a holiday in the person&apos;s country is never counted as missed.
                </div>
              </div>
            </div>
            <form className="cx-panel--pad dq-holform" onSubmit={E} noValidate={!0}>
              <Oo listKey={Ff} label="Country" value={o.country} onChange={(S) => c((_) => ({ ..._, country: S }))} />
              <div className="cx-field">
                <label className="cx-label" htmlFor="hol-date">
                  Date
                </label>
                <Input
                  className="cx-input"
                  id="hol-date"
                  type="date"
                  value={o.date}
                  onInput={(S) => {
                    const _ = S.currentTarget.value
                    c((T) => ({ ...T, date: _ }))
                  }}
                />
              </div>
              <div className="cx-field">
                <label className="cx-label" htmlFor="hol-name">
                  Holiday
                </label>
                <Input
                  className="cx-input"
                  id="hol-name"
                  maxLength={80}
                  value={o.name}
                  placeholder="For example: Revolution Day"
                  onInput={(S) => {
                    const _ = S.currentTarget.value
                    c((T) => ({ ...T, name: _ }))
                  }}
                />
              </div>
              <Button type="submit" variant="primary" className="cx-btn">
                Add holiday
              </Button>
              {l ? (
                <p className="cx-error" role="alert">
                  {l}
                </p>
              ) : null}
            </form>
            {e.holidays.length ? (
            <div className="cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Country</th>
                    <th scope="col">Holiday</th>
                    <th scope="col">Added by</th>
                    <th scope="col">
                      <span className="cx-sr">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {e.holidays.map((S: Q) => (
                    <tr key={S.id}>
                      <td className="cx-num">{S.date}</td>
                      <td>{S.country}</td>
                      <td>{S.name}</td>
                      <td className="cx-muted">{S.addedBy}</td>
                      <td>
                        <Button variant="quiet" className="cx-btn" onClick={() => C(S.id)} aria-label={`Remove ${S.name}`}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : (
              <Empty
                icon={
                  <svg className="cx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                }
                title="No holidays yet"
                body="Add each country's public holidays above."
              />
            )}
          </section>
        </Ft>
      ) : (
        jl({ lines: 10 })
      )}
    </section>
  )
}
export default PeopleHolidaysPage
