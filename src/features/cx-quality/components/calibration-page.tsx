'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality Calibration page
 * (calibration.closure.js symbols Us page, Ws assign, Hs trend, Qs diff,
 *  AuditForm Zn via qa-shared).
 */
import { useState } from 'react'
import {
  AuditForm,
  Chip,
  ListSelect,
  P,
  QaPage,
  QaSection,
  TicketRef,
  qaPct,
  useSe,
} from './qa-shared'
import {
  useTip,
  vsPrev,
} from '@/features/shared/components/shell/ui'
import { toast } from '@/features/shared/components/shell/Toasts'
import {
  Button,
  Empty,
  Input,
  Select,
  TableScroll,
} from '@/features/shared/components/ui'

/** Qs — where the auditor and reference differ (verbatim). */
function DiffList({ c: t }: { c: any }) {
  if (!t.auditorAnswers || !t.referenceAnswers) return null
  const n = t.questions.filter(
    (a: any) => t.auditorAnswers[a.id] !== t.referenceAnswers[a.id]
  )
  return n.length ? (
    <ul className="qa-diff">
      {n.map((a: any) => (
        <li key={a.id}>
          {a.text}: auditor <b>{t.auditorAnswers[a.id]}</b>, reference{' '}
          <b>{t.referenceAnswers[a.id]}</b>
        </li>
      ))}
    </ul>
  ) : (
    <p className="cx-muted">Full agreement.</p>
  )
}

/** Hs — the alignment trend (verbatim svg chart). */
function TrendChart({ trend: t }: { trend: any[] }) {
  const { ref: n, tipFor: a, tipEl: s } = useTip<HTMLElement>()
  const i = [...new Set(t.map((f: any) => f.month))].sort()
  const c = [...new Set(t.map((f: any) => f.auditorName))]
  if (!i.length)
    return (
      <Empty title="No finished calibrations yet." />
    )
  const l = 560,
    p = 200,
    m = 36,
    r = 24,
    u = 10,
    d = 12,
    o = Math.min(60, ...t.map((f: any) => f.alignmentPct)),
    h = 100,
    b = (f: string) =>
      m +
      (i.length === 1
        ? (l - m - d) / 2
        : (i.indexOf(f) * (l - m - d)) / (i.length - 1)),
    x = (f: number) => u + ((h - f) * (p - u - r)) / (h - o)

  return (
    <figure className="qa-trend cc-chart" ref={n as any}>
      {s}
      <div className="qa-trend__scroll">
        <svg
          viewBox={`0 0 ${l} ${p}`}
          role="group"
          aria-label="Alignment with the team lead reference by month"
        >
          {[o, Math.round((o + 100) / 2), 100].map((f) => (
            <g key={f}>
              <line
                x1={m}
                x2={l - d}
                y1={x(f)}
                y2={x(f)}
                className="qa-trend__grid"
              />
              <text
                x={m - 6}
                y={x(f) + 4}
                textAnchor="end"
                className="qa-trend__lbl"
              >
                {Math.round(f)}
              </text>
            </g>
          ))}
          {i.map((f) => (
            <text
              x={b(f)}
              y={p - 6}
              textAnchor="middle"
              className="qa-trend__lbl"
              key={f}
            >
              {f}
            </text>
          ))}
          {c.map((f, g) => {
            const y = t
              .filter((_: any) => _.auditorName === f)
              .sort((_: any, T: any) => _.month.localeCompare(T.month))
            return (
              <g className={`qa-trend__s qa-trend__s${g % 8}`} key={f}>
                <polyline
                  className="cc-sweep-line"
                  pathLength={1}
                  points={y
                    .map(
                      (_: any) => `${b(_.month)},${x(_.alignmentPct)}`
                    )
                    .join(' ')}
                  fill="none"
                />
                {y.map((_: any, T: number) => (
                  <circle
                    className="cc-sweep-fade"
                    cx={b(_.month)}
                    cy={x(_.alignmentPct)}
                    r={3.5}
                    tabIndex={0}
                    role="img"
                    key={_.month}
                    {...a(
                      [
                        `${f}, ${_.month}: ${_.alignmentPct}%`,
                        vsPrev(
                          _.alignmentPct,
                          y[T - 1]?.alignmentPct
                        ),
                      ]
                        .filter(Boolean)
                        .join(', ')
                    )}
                  />
                ))}
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className="qa-trend__legend">
        {c.map((f, g) => (
          <span className={`qa-trend__key qa-trend__s${g % 8}`} key={f}>
            {f}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

/** Ws — assign a calibration (verbatim). */
function AssignForm({ d: t, onDone: n }: { d: any; onDone: () => void }) {
  const [a, s] = useState('')
  const [i, c] = useState('')
  const [l, p] = useState('')
  const [m, r] = useState('')
  const [u, d] = useState('')
  const [o, h] = useState(false)
  const [b, x] = useState('')

  const f = (
    g: string,
    y: React.ReactNode,
    _: string,
    T: (v: string) => void,
    k: any[],
    C: React.ReactNode
  ) => (
    <div className="cx-field" key={g}>
      <label className="cx-label" htmlFor={g}>
        {y}
      </label>
      <Select
        id={g}
        value={_}
        onChange={(O) => T(O.currentTarget.value)}
      >
        <option value="">{C}</option>
        {k.map((O: any) => (
          <option value={O.email} key={O.email}>
            {O.name}
          </option>
        ))}
      </Select>
    </div>
  )

  return (
    <form
      className="cx-panel cx-panel--pad qa-grid"
      onSubmit={(g) => {
        g.preventDefault()
        h(true)
        x('')
        P.createCalibration({
          ticketId: a,
          channel: i,
          auditorEmail: l,
          tlEmail: m,
          agentEmail: u,
        }).then(
          () => {
            h(false)
            s('')
            toast(
              'Assigned. Both were emailed; neither sees the other audit until both are in.'
            )
            n()
          },
          (y) => {
            h(false)
            x(y.message)
          }
        )
      }}
    >
      <div className="cx-field">
        <label className="cx-label" htmlFor="cal-t">
          Ticket number
        </label>
        <Input
          id="cal-t"
          inputMode="numeric"
          value={a}
          onInput={(g) => s(g.currentTarget.value)}
        />
      </div>
      <ListSelect
        listKey="qa.channel"
        label="Channel"
        value={i}
        onChange={c}
        required
      />
      {f('cal-a', 'Auditor', l, p, t.auditors, 'Choose an auditor')}
      {f('cal-r', 'Reference (team lead)', m, r, t.tls, 'Choose a team lead')}
      {f('cal-g', 'Agent on the ticket (optional)', u, d, t.agents, 'Not set')}
      {b ? (
        <p className="cx-error" role="alert">
          {b}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        disabled={o}
      >
        {o ? 'Assigning…' : 'Assign calibration'}
      </Button>
    </form>
  )
}

/** Us — the page (verbatim). */
export function CalibrationPage({ route }: { route: { title: string } }) {
  const { data: n, error: a, reload: s } = useSe(P.calibrationPage)
  const [i, c] = useState<any>(null)
  const l = n ? n.calibrations.filter((u: any) => u.myPart && u.status === 'open') : []
  const p = n ? n.calibrations.filter((u: any) => u.status === 'done') : []
  const m = n ? n.calibrations.filter((u: any) => u.status === 'open' && !u.myPart) : []
  const r =
    i && n ? n.forms.find((u: any) => u.formId === i.c.formId) : undefined

  return (
    <QaPage
      route={route}
      d={n}
      error={a}
      reload={s}
      sub="An auditor and a team lead audit the same ticket without seeing each other's answers. The team lead is the reference; alignment is the auditor's weighted agreement with it."
    >
      {n ? (
        <>
          {i && r ? (
            <AuditForm
              form={r}
              submitLabel="Submit calibration audit"
              backLabel="Back to calibration"
              onCancel={() => c(null)}
              facts={
                <dl className="qa-facts">
                  <div>
                    <dt>Ticket</dt>
                    <dd>
                      <TicketRef url={n.ticketUrl} id={i.c.ticketId} />
                    </dd>
                  </div>
                  <div>
                    <dt>Channel</dt>
                    <dd>{i.c.channel}</dd>
                  </div>
                  <div>
                    <dt>Your part</dt>
                    <dd>{i.c.mineAs === 'tl' ? 'Reference' : 'Auditor'}</dd>
                  </div>
                </dl>
              }
              onSubmit={(u, d, o, h) =>
                P.submitCalibration({
                  calibrationId: i.c.calibrationId,
                  answers: u,
                  comment: d,
                  startedAt: i.startedAt,
                  interactionAt: h,
                }).then((b) => {
                  toast(
                    b.alignmentPct === null
                      ? 'Saved. The result shows once the other audit is in.'
                      : `Both audits are in: ${b.alignmentPct}% aligned.`
                  )
                  c(null)
                  s()
                })
              }
            />
          ) : null}
          {l.length ? (
            <QaSection id="calm-h" title="Your calibration audits">
              <ul className="cx-panel cx-list">
                {l.map((u: any) => (
                  <li className="cx-list__row qa-row" key={u.calibrationId}>
                    <span>
                      Ticket <TicketRef url={n.ticketUrl} id={u.ticketId} />,{' '}
                      {u.channel}, as{' '}
                      {u.mineAs === 'tl' ? 'reference' : 'auditor'}
                    </span>
                    <Button
                      variant="primary"
                      onClick={() =>
                        c({ c: u, startedAt: new Date().toISOString() })
                      }
                    >
                      Audit
                    </Button>
                  </li>
                ))}
              </ul>
            </QaSection>
          ) : null}
          <QaSection id="calt-h" title="Alignment by month">
            <div className="cx-panel cx-panel--pad">
              <TrendChart trend={n.trend} />
            </div>
          </QaSection>
          {n.canAssign ? (
            <QaSection id="cala-h" title="Assign a calibration">
              <AssignForm d={n} onDone={s} />
            </QaSection>
          ) : null}
          <QaSection
            id="calr-h"
            title="Results"
            hint={m.length ? `${m.length} waiting for one or both audits` : undefined}
          >
            <div className="cx-panel">
              {p.length ? (
                <TableScroll label="Calibration results">
                  <table className="cx-table">
                    <thead>
                      <tr>
                        <th scope="col">Month</th>
                        <th scope="col">Ticket</th>
                        <th scope="col">Auditor</th>
                        <th scope="col">Reference</th>
                        <th scope="col">Alignment</th>
                        <th scope="col">Where they differ</th>
                      </tr>
                    </thead>
                  <tbody>
                    {p.map((u: any) => (
                      <tr key={u.calibrationId}>
                        <td className="cx-num">{u.month}</td>
                        <td>
                          <TicketRef url={n.ticketUrl} id={u.ticketId} />
                        </td>
                        <td>{u.auditorName}</td>
                        <td>{u.tlName}</td>
                        <td>
                          <Chip
                            status={
                              u.alignmentPct === null
                                ? 'neutral'
                                : u.alignmentPct >= n.target
                                  ? 'ok'
                                  : 'bad'
                            }
                          >
                            {qaPct(u.alignmentPct)}
                          </Chip>
                        </td>
                        <td>
                          <DiffList c={u} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </TableScroll>
              ) : (
                <Empty title="No finished calibrations yet." />
              )}
            </div>
          </QaSection>
        </>
      ) : null}
    </QaPage>
  )
}
