'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality audit-queue page
 * (.devin/work/extract/quality/pages/audit-queue.closure.js):
 *   qs → AuditQueueRoute (admin view-as via key remount), As → AuditQueuePage,
 *   ks → ViewingAs, Cs → RequestedAudits, Is → WaiveForm, Xn → RequestForm,
 *   Ss → NonTicketAudits, Ns → NonTicketForm, $s → OffQueueAudits,
 *   Lt → PassForm, Ms → WeekCoverage, ms → SamplingPanel, ps → SamplingForm,
 *   hn → WeightInput, un → ShareDelta, Oe → shareOf, ct → sharePct,
 *   fs → AccessPanel, gs → via labels, Jn — non-ticket remove reasons,
 *   vs/_s/xs/ws/Ts — column sort maps.
 * Shared: P/useSe/QaPage(de)/QaSection(D)/Chips(E,ae,Ie,oe,U)/TicketRef(ne)/
 *   AuditForm(Zn)/SortTh(M)/useQaSort(_e)/dates(dl,he,ul,Rt)/toast(Q). */
import { Fragment, useState } from 'react'
import { Chip } from '@/features/shared/components/shell/ui'
import { getBoot } from '@/features/shared/shell/context'
import { Button, Input, Select } from '@/features/shared/components/ui'
import {
  AuditForm,
  P,
  Q,
  QaPage,
  QaSection,
  SortTh,
  StatusChip,
  TicketRef,
  qaAddDays,
  qaCovTone,
  qaDayName,
  qaTicketLabel,
  useQaSort,
  useSe,
  type QaSortCols,
} from './qa-shared'

/** Jn — canned remove reasons for off-queue / non-ticket rows. */
const REMOVE_REASONS = ['Added by mistake', 'Wrong agent', 'Duplicate of another item']

/* --- vs/_s/xs/ws/Ts — the column sort maps (verbatim) -------------------- */
const QUEUE_COLS: QaSortCols = {
  action: { get: (t) => t.actionAt, type: 'date' },
  agent: { get: (t) => t.agentName, type: 'text' },
  channel: { get: (t) => t.channel, type: 'text' },
  type: { get: (t) => t.contactType, type: 'text' },
  ticket: { get: (t) => t.ticketId, type: 'num' },
  agentStatus: { get: (t) => t.agentStatus, type: 'text' },
  ticketNow: { get: (t) => t.ticketStatus, type: 'text' },
  audit: { get: (t) => t.status, type: 'text' },
}
const PASSED_COLS: QaSortCols = {
  passed: { get: (t) => t.passedAt || t.date, type: 'date' },
  agent: { get: (t) => t.agentName, type: 'text' },
  ticket: { get: (t) => t.ticketId, type: 'num' },
  channel: { get: (t) => t.channel, type: 'text' },
  reason: { get: (t) => t.reason, type: 'text' },
  by: { get: (t) => t.passedByName, type: 'text' },
}
const REQUEST_COLS: QaSortCols = {
  requested: { get: (t) => t.requestedAt, type: 'date' },
  agent: { get: (t) => t.agentName, type: 'text' },
  channel: { get: (t) => t.channel, type: 'text' },
  ticket: { get: (t) => t.ticketId, type: 'num' },
  reason: { get: (t) => t.requestReason, type: 'text' },
  audit: { get: (t) => t.status, type: 'text' },
}
const WEEK_COLS: QaSortCols = {
  agent: { get: (t) => t.name, type: 'text' },
  done: { get: (t) => t.done, type: 'num' },
  requested: { get: (t) => t.requested, type: 'num' },
  waiting: { get: (t) => t.waiting, type: 'num' },
  remaining: { get: (t) => t.remaining, type: 'num' },
}
const NONTICKET_COLS: QaSortCols = {
  added: { get: (t) => t.createdAt ?? '', type: 'date' },
  agent: { get: (t) => t.agentName, type: 'text' },
  type: { get: (t) => t.auditType ?? '', type: 'text' },
  reference: { get: (t) => t.reference ?? '', type: 'text' },
  audit: { get: (t) => t.status, type: 'text' },
}

/* --- Lt — pass / remove row form ---------------------------------------- */
function PassForm({
  row,
  reasons,
  onCancel,
  onDone,
}: {
  row: any
  reasons: string[]
  onCancel: () => void
  onDone: (msg: string, note?: string) => void
}) {
  const [i, c] = useState('')
  const [l, p] = useState('')
  const m = [i, l.trim()].filter(Boolean).join(': ')
  const r = m.replace(/\s+/g, ' ').trim().length >= 5
  const [u, d] = useState(false)
  const [o, h] = useState('')
  const b = `qa-pass-${row.queueId.replace(/[^A-Za-z0-9_-]/g, '')}`
  const x = !!row.auditType || row.source === 'offqueue'
  return (
    <form
      className="qa-pass"
      onSubmit={(g) => {
        g.preventDefault()
        d(true)
        h('')
        P.passItem(row.queueId, m).then(
          (y) =>
            x
              ? onDone(`Removed ${qaTicketLabel(row.ticketId)} from the queue.`, '')
              : onDone(
                  `Passed #${row.ticketId}.` +
                    (y.replaced
                      ? ` ${row.agentName} gets #${y.ticketId} (${y.channel}) in its place.`
                      : ''),
                  y.replaced
                    ? ''
                    : `#${row.ticketId} was passed, but no replacement was drawn for ${row.agentName}: ${y.reason}. Their sample is one short today.`
                ),
          (y) => (d(false), h(y.message))
        )
      }}
    >
      <div className="cx-field">
        <label className="cx-label" htmlFor={`${b}-why`}>
          {x ? `Why remove ${qaTicketLabel(row.ticketId)}` : `Why not audit #${row.ticketId}`}
        </label>
        <Select
          id={`${b}-why`}
          value={i}
          onChange={(g) => c(g.currentTarget.value)}
        >
          <option value="">Choose a reason, or write one</option>
          {reasons.map((g) => (
            <option value={g} key={g}>
              {g}
            </option>
          ))}
        </Select>
      </div>
      <div className="cx-field qa-pass__note">
        <label className="cx-label" htmlFor={`${b}-note`}>
          {i ? 'Details (optional)' : 'Reason'}
        </label>
        <Input
          id={`${b}-note`}
          maxLength={450}
          placeholder="e.g. Omar handled the call, not this agent"
          value={l}
          aria-required={!i}
          onInput={(g) => p(g.currentTarget.value)}
        />
      </div>
      <div className="qa-actions">
        <Button type="submit" variant="primary" disabled={u || !r}>
          {u ? (x ? 'Removing…' : 'Passing…') : x ? 'Remove' : 'Confirm pass'}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="cx-faint qa-pass__hint">
        {x
          ? `It leaves the queue and does not count toward ${row.agentName}'s audits. It can be added again later.`
          : `#${row.ticketId} leaves the samples for good, for every agent. ${row.agentName} gets another ticket from today's sample in its place.`}
      </p>
      {o ? (
        <p className="cx-error" role="alert">
          {o}
        </p>
      ) : null}
    </form>
  )
}

/* --- Xn — request / off-queue add form ----------------------------------- */
function RequestForm({
  d,
  off,
  onDone,
}: {
  d: any
  off?: boolean
  onDone: (msg: string, queueId?: string) => void
}) {
  const [s, i] = useState('')
  const [c, l] = useState('')
  const [p, m] = useState('')
  const [r, u] = useState('')
  const [busy, o] = useState(false)
  const [h, b] = useState('')
  const x = [...d.quota].sort((_: any, T: any) => _.name.localeCompare(T.name))
  const f = /^#?\d{1,12}$/.test(s.trim()) && (off || c.replace(/\s+/g, ' ').trim().length >= 5)
  const g = off ? 'qa-off' : 'qa-req'
  return (
    <form
      className="qa-request cx-panel cx-panel--pad"
      onSubmit={(_) => {
        _.preventDefault()
        o(true)
        b('')
        const T = {
          ticketId: s.trim(),
          agentEmail: p || undefined,
          channel: r || undefined,
        }
        ;(off
          ? P.createOffQueue({ ...T, note: c || undefined })
          : P.requestAudit({ ...T, reason: c })
        ).then(
          (k) =>
            onDone(
              off
                ? `Added #${k.ticketId} off-queue (${k.agentName}, ${k.channel}).`
                : `Requested an audit of #${k.ticketId} (${k.agentName}, ${k.channel}).`,
              k.queueId
            ),
          (k) => (o(false), b(k.message))
        )
      }}
    >
      <div className="cx-field">
        <label className="cx-label" htmlFor={`${g}-ticket`}>
          Ticket number
        </label>
        <Input
          id={`${g}-ticket`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 245810"
          value={s}
          onInput={(_) => i(_.currentTarget.value)}
        />
      </div>
      <div className="cx-field qa-request__why">
        <label className="cx-label" htmlFor={`${g}-why`}>
          {off ? 'Note (optional)' : 'Why it needs an audit'}
        </label>
        <Input
          id={`${g}-why`}
          maxLength={500}
          placeholder={
            off
              ? 'e.g. Spotted while auditing another ticket'
              : 'e.g. Customer complained the agent ended the call'
          }
          value={c}
          onInput={(_) => l(_.currentTarget.value)}
        />
      </div>
      <div className="cx-field">
        <label className="cx-label" htmlFor={`${g}-agent`}>
          Agent
        </label>
        <Select
          id={`${g}-agent`}
          value={p}
          onChange={(_) => m(_.currentTarget.value)}
        >
          <option value="">Assigned agent on the ticket</option>
          {x.map((_: any) => (
            <option value={_.email} key={_.email}>
              {_.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="cx-field">
        <label className="cx-label" htmlFor={`${g}-channel`}>
          Channel
        </label>
        <Select
          id={`${g}-channel`}
          value={r}
          onChange={(_) => u(_.currentTarget.value)}
        >
          <option value="">From the ticket&apos;s group</option>
          {d.channels.map((_: string) => (
            <option value={_} key={_}>
              {_}
            </option>
          ))}
        </Select>
      </div>
      <div className="qa-actions">
        <Button type="submit" variant="primary" disabled={busy || !f}>
          {off ? (busy ? 'Adding…' : 'Add and start audit') : busy ? 'Requesting…' : 'Request audit'}
        </Button>
      </div>
      {h ? (
        <p className="cx-error" role="alert">
          {h}
        </p>
      ) : null}
    </form>
  )
}

/* --- Is — the waive-request row form ------------------------------------- */
function WaiveForm({
  row,
  onCancel,
  onDone,
}: {
  row: any
  onCancel: () => void
  onDone: () => void
}) {
  const [s, i] = useState('')
  const [c, l] = useState(false)
  const [p, m] = useState('')
  const r = `qa-waive-${row.ticketId}`
  return (
    <form
      className="qa-pass"
      onSubmit={(u) => {
        u.preventDefault()
        l(true)
        m('')
        P.waiveRequest(row.queueId, s).then(onDone, (d) => (l(false), m(d.message)))
      }}
    >
      <div className="cx-field qa-pass__note">
        <label className="cx-label" htmlFor={r}>
          Why waive the audit of #{row.ticketId}
        </label>
        <Input
          id={r}
          maxLength={500}
          placeholder="e.g. Customer withdrew the complaint"
          value={s}
          onInput={(u) => i(u.currentTarget.value)}
        />
      </div>
      <div className="qa-actions">
        <Button
          type="submit"
          variant="primary"
          disabled={c || s.replace(/\s+/g, ' ').trim().length < 5}
        >
          {c ? 'Waiving…' : 'Confirm waive'}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="cx-faint qa-pass__hint">
        Requested by {row.requestedByName}: {row.requestReason}
      </p>
      {p ? (
        <p className="cx-error" role="alert">
          {p}
        </p>
      ) : null}
    </form>
  )
}

/* --- Cs — Requested audits ----------------------------------------------- */
function RequestedAudits({
  d,
  busyId,
  openId,
  onStart,
  reload,
}: {
  d: any
  busyId: string
  openId: string
  onStart: (queueId: string) => void
  reload: () => void
}) {
  const [c, l] = useState(false)
  const [p, m] = useState('')
  const r = useQaSort(REQUEST_COLS)
  const u = d.requests.filter((x: any) => x.status === 'open' || x.status === 'in_progress').length
  return !d.requests.length && !d.canRequest ? null : (
    <QaSection
      id="qq-req"
      title={u ? `Requested audits, ${u} waiting` : 'Requested audits'}
      hint="Team leads asked for these. They count toward the agent's weekly audits and cannot be passed."
      aside={
        d.canRequest ? (
          <Button
            aria-expanded={c}
            onClick={() => l(!c)}
          >
            {c ? 'Close' : 'Request an audit'}
          </Button>
        ) : null
      }
    >
      {c ? (
        <RequestForm d={d} onDone={(x) => (l(false), Q(x), reload())} />
      ) : null}
      {d.requests.length ? (
        <div className="cx-panel cx-tablewrap">
          <table className="cx-table">
            <thead>
              <tr>
                <SortTh col="requested" sort={r}>
                  Requested
                </SortTh>
                <SortTh col="agent" sort={r}>
                  Agent
                </SortTh>
                <SortTh col="channel" sort={r}>
                  Channel
                </SortTh>
                <SortTh col="ticket" sort={r}>
                  Ticket
                </SortTh>
                <SortTh col="reason" sort={r}>
                  Why
                </SortTh>
                <SortTh col="audit" sort={r}>
                  Audit
                </SortTh>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {r.apply(d.requests).map((x: any) => {
                const o = x.status === 'open' || x.status === 'in_progress'
                return (
                  <Fragment key={x.queueId}>
                    <tr>
                      <td className="cx-num">
                        {x.requestedAt.slice(0, 16).replace('T', ' ')}
                        <span className="cx-faint qa-sub">by {x.requestedByName}</span>
                      </td>
                      <td>
                        {x.agentName}
                        <span className="cx-faint qa-sub">{x.tlName}</span>
                      </td>
                      <td>
                        {x.channel}
                        <span className="cx-faint qa-sub">{x.contactType}</span>
                      </td>
                      <td>
                        <TicketRef url={d.ticketUrl} id={x.ticketId} />
                      </td>
                      <td>{x.requestReason}</td>
                      <td>
                        <StatusChip s={x.status} />
                        {x.status === 'waived' ? (
                          <span className="cx-faint qa-sub">
                            {x.waiveReason} ({x.waivedByName})
                          </span>
                        ) : null}
                        {x.status === 'in_progress' && x.auditorName ? (
                          <span className="cx-faint qa-sub">{x.auditorName}</span>
                        ) : null}
                      </td>
                      <td>
                        {!o || d.readOnly ? null : (
                          <div className="qa-actions">
                            {x.takenByOther ? (
                              <span className="cx-muted">Being audited</span>
                            ) : (
                              <Button
                                variant="primary"
                                disabled={!!busyId || openId === x.queueId}
                                onClick={() => onStart(x.queueId)}
                              >
                                {busyId === x.queueId
                                  ? 'Opening…'
                                  : x.status === 'in_progress'
                                    ? 'Continue audit'
                                    : 'Start audit'}
                              </Button>
                            )}
                            {d.canWaive ? (
                              <Button
                                aria-expanded={p === x.queueId}
                                onClick={() => m(p === x.queueId ? '' : x.queueId)}
                              >
                                Waive
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                    {p === x.queueId ? (
                      <tr className="qa-passrow">
                        <td colSpan={7}>
                          <WaiveForm
                            row={x}
                            onCancel={() => m('')}
                            onDone={() => (m(''), Q(`Waived the request for #${x.ticketId}.`), reload())}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="cx-muted">No audit requests this week.</p>
      )}
    </QaSection>
  )
}

/* --- Ns — the new non-ticket audit form ---------------------------------- */
function NonTicketForm({ d, onDone }: { d: any; onDone: (msg: string) => void }) {
  const [a, s] = useState(d.auditTypes.length === 1 ? d.auditTypes[0] : '')
  const [i, c] = useState('')
  const [l, p] = useState('')
  const [m, r] = useState('')
  const [u, busy] = useState(false)
  const [o, h] = useState('')
  const b = [...d.quota].sort((y: any, _: any) => y.name.localeCompare(_.name))
  const x = i.replace(/\s+/g, ' ').trim().length
  const f = !!a && !!l && x >= 3 && x <= 200
  return (
    <form
      className="qa-request cx-panel cx-panel--pad"
      onSubmit={(y) => {
        y.preventDefault()
        busy(true)
        h('')
        P.createNonTicket({
          type: a,
          reference: i,
          agentEmail: l,
          note: m || undefined,
        }).then(
          (_) => onDone(`Added ${_.ticketId} for ${_.agentName}. Start the audit from the list.`),
          (_) => (busy(false), h(_.message))
        )
      }}
    >
      <div className="cx-field">
        <label className="cx-label" htmlFor="qa-nt-type">
          Type
        </label>
        <Select
          id="qa-nt-type"
          value={a}
          onChange={(y) => s(y.currentTarget.value)}
        >
          {d.auditTypes.length === 1 ? null : <option value="">Choose…</option>}
          {d.auditTypes.map((y: string) => (
            <option value={y} key={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      <div className="cx-field qa-request__why">
        <label className="cx-label" htmlFor="qa-nt-ref">
          Reference
        </label>
        <Input
          id="qa-nt-ref"
          maxLength={200}
          autoComplete="off"
          aria-describedby="qa-nt-ref-hint"
          placeholder="e.g. Refund form row 118, order 55120, 12.500 KWD"
          value={i}
          onInput={(y) => c(y.currentTarget.value)}
        />
        <span className="cx-faint qa-sub" id="qa-nt-ref-hint">
          What identifies it: the form row, order number or amount. Not a ticket number.
        </span>
      </div>
      <div className="cx-field">
        <label className="cx-label" htmlFor="qa-nt-agent">
          Agent
        </label>
        <Select
          id="qa-nt-agent"
          value={l}
          onChange={(y) => p(y.currentTarget.value)}
        >
          <option value="">Choose the agent…</option>
          {b.map((y: any) => (
            <option value={y.email} key={y.email}>
              {y.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="cx-field qa-request__why">
        <label className="cx-label" htmlFor="qa-nt-note">
          Note (optional)
        </label>
        <Input
          id="qa-nt-note"
          maxLength={500}
          placeholder="e.g. Paid by bank transfer"
          value={m}
          onInput={(y) => r(y.currentTarget.value)}
        />
      </div>
      <div className="qa-actions">
        <Button type="submit" variant="primary" disabled={u || !f}>
          {u ? 'Adding…' : 'Add to the queue'}
        </Button>
      </div>
      {o ? (
        <p className="cx-error" role="alert">
          {o}
        </p>
      ) : null}
    </form>
  )
}

/* --- Ss — Non-ticket audits ---------------------------------------------- */
function NonTicketAudits({
  d,
  busyId,
  openId,
  onStart,
  onRemoved,
  reload,
}: {
  d: any
  busyId: string
  openId: string
  onStart: (queueId: string) => void
  onRemoved: (queueId: string) => void
  reload: () => void
}) {
  const [l, p] = useState(false)
  const [m, r] = useState('')
  const u = useQaSort(NONTICKET_COLS)
  const rows = d.rows.filter((h: any) => h.auditType)
  const o = rows.filter((h: any) => h.status === 'open' || h.status === 'in_progress').length
  return !rows.length && !d.auditTypes?.length ? null : (
    <QaSection
      id="qq-nt"
      title={o ? `Non-ticket audits, ${o} to do` : 'Non-ticket audits'}
      hint="Actions that are not Freshdesk tickets, such as cash refunds. Each type has its own audit form. They count toward the agent's weekly audits."
      aside={
        d.auditTypes?.length && !d.readOnly ? (
          <Button
            aria-expanded={l}
            onClick={() => p(!l)}
          >
            {l ? 'Close' : 'New non-ticket audit'}
          </Button>
        ) : null
      }
    >
      {l ? <NonTicketForm d={d} onDone={(h) => (p(false), Q(h), reload())} /> : null}
      {rows.length ? (
        <div className="cx-panel cx-tablewrap">
          <table className="cx-table">
            <thead>
              <tr>
                <SortTh col="added" sort={u}>
                  Added
                </SortTh>
                <SortTh col="agent" sort={u}>
                  Agent
                </SortTh>
                <SortTh col="type" sort={u}>
                  Type
                </SortTh>
                <SortTh col="reference" sort={u}>
                  Reference
                </SortTh>
                <SortTh col="audit" sort={u}>
                  Audit
                </SortTh>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {u.apply(rows).map((h: any) => {
                const b = h.status === 'open' || h.status === 'in_progress'
                return (
                  <Fragment key={h.queueId}>
                    <tr>
                      <td className="cx-num">
                        {(h.createdAt || h.date).slice(0, 16).replace('T', ' ')}
                        {h.createdByName ? (
                          <span className="cx-faint qa-sub">by {h.createdByName}</span>
                        ) : null}
                      </td>
                      <td>
                        {h.agentName}
                        <span className="cx-faint qa-sub">{h.tlName}</span>
                      </td>
                      <td>
                        <Chip status="neutral">{h.auditType}</Chip>
                      </td>
                      <td className="qa-ref">
                        {h.reference}
                        {h.note ? <span className="cx-faint qa-sub">{h.note}</span> : null}
                      </td>
                      <td>
                        <StatusChip s={h.status} />
                        {h.status === 'passed' && h.passReason ? (
                          <span className="cx-faint qa-sub">Removed: {h.passReason}</span>
                        ) : null}
                        {h.status === 'in_progress' && h.auditorName ? (
                          <span className="cx-faint qa-sub">{h.auditorName}</span>
                        ) : null}
                      </td>
                      <td>
                        {!b || d.readOnly ? null : h.takenByOther ? (
                          <span className="cx-muted">Being audited</span>
                        ) : (
                          <div className="qa-actions">
                            <Button
                              variant="primary"
                              disabled={!!busyId || openId === h.queueId}
                              onClick={() => onStart(h.queueId)}
                            >
                              {busyId === h.queueId
                                ? 'Opening…'
                                : h.status === 'in_progress'
                                  ? 'Continue audit'
                                  : 'Start audit'}
                            </Button>
                            <Button
                              aria-expanded={m === h.queueId}
                              disabled={!!busyId}
                              onClick={() => r(m === h.queueId ? '' : h.queueId)}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {m === h.queueId ? (
                      <tr className="qa-passrow">
                        <td colSpan={6}>
                          <PassForm
                            row={h}
                            reasons={REMOVE_REASONS}
                            onCancel={() => r('')}
                            onDone={(x) => (r(''), Q(x), onRemoved(h.queueId))}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="cx-muted">
          None yet. Add a cash refund or another non-ticket action to audit it.
        </p>
      )}
    </QaSection>
  )
}

/* --- $s — Off-queue audits ------------------------------------------------ */
function OffQueueAudits({
  d,
  busyId,
  openId,
  onStart,
  onRemoved,
  reload,
}: {
  d: any
  busyId: string
  openId: string
  onStart: (queueId: string) => void
  onRemoved: (queueId: string) => void
  reload: () => void
}) {
  const [l, p] = useState(false)
  const [m, r] = useState('')
  const u = d.rows.filter((o: any) => o.source === 'offqueue')
  const x = u.filter((o: any) => o.status === 'open' || o.status === 'in_progress').length
  return (
    <QaSection
      id="qq-off"
      title={x ? `Off-queue audits, ${x} to do` : 'Off-queue audits'}
      hint="A ticket that is not in your queue. It is scored and sent like any audit, but does not use up a queue slot, does not count toward the agent's weekly audits, and stays out of the headline scores."
      aside={
        d.readOnly ? null : (
          <Button
            aria-expanded={l}
            onClick={() => p(!l)}
          >
            {l ? 'Close' : 'Audit a ticket off-queue'}
          </Button>
        )
      }
    >
      {l ? (
        <RequestForm
          d={d}
          off
          onDone={(o, h) => (p(false), Q(o), reload(), onStart(h as string))}
        />
      ) : null}
      {u.length ? (
        <div className="cx-panel cx-tablewrap">
          <table className="cx-table">
            <thead>
              <tr>
                <th scope="col">Added</th>
                <th scope="col">Agent</th>
                <th scope="col">Channel</th>
                <th scope="col">Ticket</th>
                <th scope="col">Audit</th>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {u.map((o: any) => {
                const h = o.status === 'open' || o.status === 'in_progress'
                return (
                  <Fragment key={o.queueId}>
                    <tr>
                      <td className="cx-num">
                        {(o.createdAt || o.date).slice(0, 16).replace('T', ' ')}
                        {o.createdByName ? (
                          <span className="cx-faint qa-sub">by {o.createdByName}</span>
                        ) : null}
                      </td>
                      <td>
                        {o.agentName}
                        <span className="cx-faint qa-sub">{o.tlName}</span>
                      </td>
                      <td>
                        {o.channel}
                        <span className="cx-faint qa-sub">{o.contactType}</span>
                      </td>
                      <td>
                        <TicketRef url={d.ticketUrl} id={o.ticketId} />
                        {o.note ? <span className="cx-faint qa-sub">{o.note}</span> : null}
                      </td>
                      <td>
                        <StatusChip s={o.status} />
                        {o.status === 'passed' && o.passReason ? (
                          <span className="cx-faint qa-sub">Removed: {o.passReason}</span>
                        ) : null}
                        {o.status === 'in_progress' && o.auditorName ? (
                          <span className="cx-faint qa-sub">{o.auditorName}</span>
                        ) : null}
                      </td>
                      <td>
                        {!h || d.readOnly ? null : o.takenByOther ? (
                          <span className="cx-muted">Being audited</span>
                        ) : (
                          <div className="qa-actions">
                            <Button
                              variant="primary"
                              disabled={!!busyId || openId === o.queueId}
                              onClick={() => onStart(o.queueId)}
                            >
                              {busyId === o.queueId
                                ? 'Opening…'
                                : o.status === 'in_progress'
                                  ? 'Continue audit'
                                  : 'Start audit'}
                            </Button>
                            <Button
                              aria-expanded={m === o.queueId}
                              disabled={!!busyId}
                              onClick={() => r(m === o.queueId ? '' : o.queueId)}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {m === o.queueId ? (
                      <tr className="qa-passrow">
                        <td colSpan={6}>
                          <PassForm
                            row={o}
                            reasons={REMOVE_REASONS}
                            onCancel={() => r('')}
                            onDone={(b) => (r(''), Q(b), onRemoved(o.queueId))}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </QaSection>
  )
}

/* --- Ms — week coverage ---------------------------------------------------- */
function WeekCoverage({ d }: { d: any }) {
  const n = useQaSort(WEEK_COLS)
  const [a, s] = useState(0)
  const i = d.quotaWeeks[a]
  if (!i || !i.rows.length) return null
  const c = i.rows
  const l = a === 0
  const p = [0, 1, 2, 3, 4, 5, 6].map((u) => qaAddDays(i.weekStart, u))
  const m = c.reduce((u: number, x: any) => u + x.done, 0)
  const r = c.reduce((u: number, x: any) => u + x.remaining, 0)
  return (
    <QaSection
      id="qq-week"
      title={`${l ? 'This week' : `Week from ${i.weekStart}`}, ${m} audited and ${r} ${l ? 'to go' : 'not done'}`}
      hint="Day by day against the daily audits per agent. Requested audits count toward each agent's weekly audits."
    >
      <div className="qa-weekstep" role="group" aria-label="Choose the week">
        <Button
          variant="quiet"
          disabled={a >= d.quotaWeeks.length - 1}
          onClick={() => s(a + 1)}
        >
          Previous week
        </Button>
        <span aria-live="polite">
          {qaDayName(p[0])} {p[0]} to {qaDayName(p[6])} {p[6]}
        </span>
        <Button
          variant="quiet"
          disabled={l}
          onClick={() => s(a - 1)}
        >
          Next week
        </Button>
      </div>
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table qa-cov">
          <thead>
            <tr>
              <SortTh col="agent" sort={n}>
                Agent
              </SortTh>
              {p.map((u) => (
                <th scope="col" className="qa-cov__day" key={u}>
                  {qaDayName(u)}
                  <span>{u.slice(8)}</span>
                </th>
              ))}
              <SortTh col="done" sort={n}>
                Done
              </SortTh>
              <SortTh col="requested" sort={n}>
                Of which requested
              </SortTh>
              {l ? (
                <SortTh col="waiting" sort={n}>
                  Requests waiting
                </SortTh>
              ) : null}
              <SortTh col="remaining" sort={n}>
                Remaining
              </SortTh>
            </tr>
          </thead>
          <tbody>
            {n.apply(c).map((u: any) => (
              <tr key={u.email}>
                <th scope="row" className="qa-cov__name">
                  {u.name}
                </th>
                {u.days.map((x: number, o: number) =>
                  p[o] > d.today ? (
                    <td className="qa-cov__cell cx-faint" key={p[o]}>
                      –
                    </td>
                  ) : (
                    <td
                      className="qa-cov__cell"
                      data-l={qaCovTone(x, u.perDay)}
                      title={`${u.name}, ${qaDayName(p[o])} ${p[o]}: ${x} of ${u.perDay} audited`}
                      key={p[o]}
                    >
                      {x}
                    </td>
                  )
                )}
                <td className="cx-num">{u.done}</td>
                <td className="cx-num">{u.requested || '–'}</td>
                {l ? <td className="cx-num">{u.waiting || '–'}</td> : null}
                <td className="cx-num">
                  {u.remaining ? (
                    `${u.remaining} of ${u.quota}`
                  ) : (
                    <Chip status="ok">All {u.quota} done</Chip>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </QaSection>
  )
}

/* --- ks — the "Audit Desk of" view-as bar ---------------------------------- */
function ViewingAs({ d, onPick }: { d: any; onPick: (email: string) => void }) {
  if (!d.auditors) return null
  const a = (
    <span className="qa-viewing__pick">
      <label className="cx-label" htmlFor="qa-desk">
        Audit Desk of
      </label>
      <Select
        id="qa-desk"
        value={d.viewing?.email ?? d.selfEmail}
        onChange={(s) => onPick(s.currentTarget.value)}
      >
        {d.auditors.map((s: any) => (
          <option value={s.email} key={s.email}>
            {s.name}
          </option>
        ))}
        <option value={d.selfEmail}>You, with admin tools</option>
      </Select>
    </span>
  )
  return d.viewing ? (
    <div className="cx-note qa-viewing" data-status="info" role="status">
      <span>
        Viewing <strong>{d.viewing.name}</strong>&rsquo;s Audit Desk — read only. What they
        see, without the buttons: nothing here can be started, passed or waived.
      </span>
      {a}
    </div>
  ) : (
    <div className="qa-viewing qa-viewing--self">{a}</div>
  )
}

/* --- Oe/hn/ct/un — the share-of-picks estimators ---------------------------- */
function shareOf(t: any[], n: (s: any) => number) {
  const a = t.reduce((s, i) => s + i.seen * n(i), 0)
  return new Map<string, number>(t.map((s) => [s.name, a ? (s.seen * n(s)) / a : 0]))
}

function WeightInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: number
  disabled?: boolean
  onChange: (v: number) => void
}) {
  return (
    <Input
      className="qa-w"
      type="number"
      min={0.1}
      max={20}
      step={0.1}
      aria-label={label}
      disabled={disabled}
      value={disabled ? '' : value}
      onInput={(i) => onChange(Number(i.currentTarget.value))}
    />
  )
}

/** ct — 0.87 → "87%", under 10% keeps one decimal. */
const sharePct = (t: number): string =>
  t >= 0.1 ? `${Math.round(t * 100)}%` : t > 0 ? `${(t * 100).toFixed(1)}%` : '0%'

function ShareDelta({ before, after }: { before: number; after: number }) {
  const a = Math.abs(after - before) >= 5e-4
  return (
    <span
      className="qa-share"
      data-up={a && after > before ? 'true' : undefined}
      data-down={a && after < before ? 'true' : undefined}
    >
      {a ? `${sharePct(before)} → ${sharePct(after)}` : sharePct(after)}
    </span>
  )
}

/* --- ps — the sampling weights form ---------------------------------------- */
function SamplingForm({ page, onSaved }: { page: any; onSaved: () => void }) {
  const [a, s] = useState<any[]>(page.contactTypes.map((v: any) => ({ ...v })))
  const [i, c] = useState<any[]>(
    page.statuses.map((v: any) => ({
      name: v.name,
      seen: v.seen + v.agentSeen,
      weight: v.weight,
      excluded: v.excluded,
      excludedAgent: v.excludedAgent,
    }))
  )
  const [l, p] = useState('')
  const [m, r] = useState(false)
  const [u, d] = useState('')
  const o = new Map<string, number>(page.contactTypes.map((v: any) => [v.name, v.weight]))
  const h = new Map<string, any>(page.statuses.map((v: any) => [v.name, v]))
  const b = shareOf(page.contactTypes, (v) => v.weight)
  const x = shareOf(a, (v) => (v.weight > 0 ? v.weight : 1))
  const f = shareOf(
    page.statuses.map((v: any) => ({ ...v, seen: v.seen + v.agentSeen })),
    (v) => (v.excluded ? 0 : v.weight)
  )
  const g = shareOf(i, (v) => (v.excluded ? 0 : v.weight > 0 ? v.weight : 1))
  const y = l.trim().toLowerCase()
  const _ = y ? a.filter((v) => v.name.toLowerCase().includes(y)) : a
  const T =
    a.some((v) => v.weight !== o.get(v.name)) ||
    i.some(
      (v) =>
        v.weight !== h.get(v.name)?.weight ||
        !!v.excluded !== h.get(v.name)?.excluded ||
        !!v.excludedAgent !== h.get(v.name)?.excludedAgent
    )
  const k = (v: string, w: number) =>
    s((A) => A.map((S) => (S.name === v ? { ...S, weight: w } : S)))
  const C = (v: string, w: any) =>
    c((A) => A.map((S) => (S.name === v ? { ...S, ...w } : S)))
  return (
    <form
      className="qa-sampling__body"
      onSubmit={(v) => {
        v.preventDefault()
        const w: Record<string, number> = {},
          A: Record<string, number> = {}
        a.forEach((S) => {
          if (S.weight !== 1) w[S.name] = S.weight
        })
        i.forEach((S) => {
          if (!S.excluded && S.weight !== 1) A[S.name] = S.weight
        })
        r(true)
        d('')
        P.saveSampling({
          contactTypeWeights: w,
          statusWeights: A,
          excludeStatuses: i.filter((S) => S.excluded).map((S) => S.name),
          excludeAgentStatuses: i.filter((S) => S.excludedAgent).map((S) => S.name),
        }).then(
          (S) => {
            r(false)
            Q(
              `Saved: ${S.contactTypes} contact type and ${S.statuses} status weights, ${S.excluded.length + S.excludedAgent.length} exclusions. The next build uses them; Build the queue now applies them today.`
            )
            onSaved()
          },
          (S) => (r(false), d(S.message))
        )
      }}
    >
      <p className="cx-muted">
        A weight multiplies how likely a ticket is to be drawn: 2 is twice as
        likely, 0.5 half, 1 is normal (most 20). The share columns estimate each
        line&apos;s part of the picks from how often it was in the pool
        {page.lastBuild ? ` (builds up to ${page.lastBuild})` : ''}; tier, channel
        and status balance still apply on top.
      </p>
      <section aria-labelledby="qs-ct">
        <div className="qa-row">
          <h3 id="qs-ct" className="cx-section__title">
            Contact types
          </h3>
          <Input
            className="qa-narrow"
            type="search"
            aria-label="Find a contact type"
            placeholder="Find a contact type"
            value={l}
            onInput={(v) => p(v.currentTarget.value)}
          />
        </div>
        {page.typesExact ? null : (
          <p className="cx-faint">
            No build has recorded the queue&apos;s own contact types yet, so Contact
            Type 2 and 3 names are listed. The queue uses Contact Type 3, else 2,
            else 1.
          </p>
        )}
        <div className="cx-panel cx-tablewrap">
          <table className="cx-table">
            <thead>
              <tr>
                <th scope="col">Contact type</th>
                <th scope="col">In the pool</th>
                <th scope="col">Weight</th>
                <th scope="col">Share of picks</th>
              </tr>
            </thead>
            <tbody>
              {_.length ? (
                _.map((v) => (
                  <tr key={v.name}>
                    <td>{v.name}</td>
                    <td className="cx-num">{v.seen.toLocaleString()}</td>
                    <td>
                      <WeightInput
                        label={`Weight for ${v.name}`}
                        value={v.weight}
                        onChange={(w) => k(v.name, w)}
                      />
                    </td>
                    <td className="cx-num">
                      <ShareDelta before={b.get(v.name) ?? 0} after={x.get(v.name) ?? 0} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No contact type matches “{l}”.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="qs-st">
        <h3 id="qs-st" className="cx-section__title">
          Statuses
        </h3>
        <p className="cx-faint">
          “Status now” leaves a ticket out by the status it has today. “Agent
          set” leaves it out when the agent&apos;s own last status change was that
          status, even if the ticket moved on since (use it for No Response From
          customer). Names match ignoring case and spacing.
        </p>
        <div className="cx-panel cx-tablewrap">
          <table className="cx-table">
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">In the pool</th>
                <th scope="col">Weight</th>
                <th scope="col">Share of picks</th>
                <th scope="col">Exclude by</th>
              </tr>
            </thead>
            <tbody>
              {i.map((v) => (
                <tr data-excluded={v.excluded ? 'true' : undefined} key={v.name}>
                  <td>{v.name}</td>
                  <td className="cx-num">{v.seen.toLocaleString()}</td>
                  <td>
                    <WeightInput
                      label={`Weight for ${v.name}`}
                      value={v.weight}
                      disabled={v.excluded}
                      onChange={(w) => C(v.name, { weight: w })}
                    />
                  </td>
                  <td className="cx-num">
                    <ShareDelta before={f.get(v.name) ?? 0} after={g.get(v.name) ?? 0} />
                  </td>
                  <td>
                    <div className="qa-actions">
                      <label className="cx-toggle">
                        {/* eslint-disable-next-line -- kept raw: Toggle drops aria-label; label text alone is ambiguous here */}
                        <input
                          type="checkbox"
                          aria-label={`Exclude tickets whose status now is ${v.name}`}
                          checked={!!v.excluded}
                          onChange={(w) => C(v.name, { excluded: w.currentTarget.checked })}
                        />
                        <span>Status now</span>
                      </label>
                      <label className="cx-toggle">
                        {/* eslint-disable-next-line -- kept raw: Toggle drops aria-label; label text alone is ambiguous here */}
                        <input
                          type="checkbox"
                          aria-label={`Exclude tickets the agent set to ${v.name}`}
                          checked={!!v.excludedAgent}
                          onChange={(w) => C(v.name, { excludedAgent: w.currentTarget.checked })}
                        />
                        <span>Agent set</span>
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {u ? (
        <p className="cx-error" role="alert">
          {u}
        </p>
      ) : null}
      <div className="qa-actions">
        <Button type="submit" variant="primary" disabled={m || !T}>
          {m ? 'Saving…' : 'Save weights'}
        </Button>
        {page.engineLive ? null : (
          <span className="cx-muted">
            These apply once Quality builds the queue itself (qa_engine_live).
          </span>
        )}
      </div>
    </form>
  )
}

/* --- ms — the sampling <details> panel ------------------------------------- */
function SamplingPanel() {
  const [t, n] = useState<any>(null)
  const [a, s] = useState('')
  const i = () => {
    s('')
    P.samplingPage().then(n, (c) => s(c.message))
  }
  return (
    <details
      className="qa-sampling cx-panel cx-panel--pad"
      onToggle={(c) => {
        if (c.currentTarget.open && !t) i()
      }}
    >
      <summary>Sampling weights: contact types and statuses</summary>
      {a ? (
        <p className="cx-error" role="alert">
          {a}{' '}
          <Button variant="quiet" onClick={i}>
            Try again
          </Button>
        </p>
      ) : t ? (
        <SamplingForm
          page={t}
          onSaved={i}
          key={t.lastBuild + JSON.stringify(t.statuses.map((c: any) => [c.weight, c.excluded, c.excludedAgent]))}
        />
      ) : (
        <p className="cx-muted">Loading…</p>
      )}
    </details>
  )
}

/* --- gs/fs — audit access panel -------------------------------------------- */
const ACCESS_VIA: Record<string, string> = {
  granted: 'Granted by an admin',
  'team lead': 'Team lead',
}

function AccessPanel() {
  const [t, n] = useState<any>(null)
  const [a, s] = useState('')
  const [i, c] = useState('')
  const [l, p] = useState('')
  const m = () => {
    s('')
    P.access().then(n, (o) => s(o.message))
  }
  const r = (o: string, h: string, b: boolean) => {
    c(o)
    P.setAuditorGrant(o, b).then(
      (x) => (
        c(''),
        n(x),
        Q(b ? `${h} can now open the Audit Desk.` : `${h} can no longer open the Audit Desk.`)
      ),
      (x) => (c(''), Q(x.message, 'error'))
    )
  }
  const u = l.trim().toLowerCase()
  const d = t
    ? t.people.filter(
        (o: any) => !u || `${o.name} ${o.email} ${o.position}`.toLowerCase().includes(u)
      )
    : []
  return (
    <details
      className="qa-sampling cx-panel cx-panel--pad"
      onToggle={(o) => {
        if (o.currentTarget.open && !t) m()
      }}
    >
      <summary>Audit access: who can open the Audit Desk</summary>
      {a ? (
        <p className="cx-error" role="alert">
          {a}{' '}
          <Button variant="quiet" onClick={m}>
            Try again
          </Button>
        </p>
      ) : t ? (
        <>
          <p className="cx-faint">
            Team leads
            {t.positions.length
              ? ` and people whose position contains ${t.positions.map((o: string) => `"${o}"`).join(' or ')}`
              : ''}{' '}
            can audit automatically. Grant anyone else here: they can open the
            Audit Desk, audit, pass tickets, calibrate and add KB gaps. It gives
            nothing else.
          </p>
          <div className="cx-field">
            <label className="cx-label" htmlFor="qa-access-find">
              Find a person
            </label>
            <Input
              id="qa-access-find"
              value={l}
              onInput={(o) => p(o.currentTarget.value)}
              placeholder="Name, email or position"
            />
          </div>
          <div className="cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Role</th>
                  <th scope="col">Position</th>
                  <th scope="col">Audit access</th>
                  <th scope="col">
                    <span className="sr-only">Change</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.map((o: any) => (
                  <tr key={o.email}>
                    <td>
                      {o.name}
                      <span className="cx-faint qa-sub">{o.email}</span>
                    </td>
                    <td>{o.role}</td>
                    <td className="cx-muted">{o.position || '–'}</td>
                    <td>
                      {o.via ? (
                        (ACCESS_VIA[o.via] ?? `Position contains ${o.via.slice(9)}`)
                      ) : (
                        <span className="cx-muted">No</span>
                      )}
                    </td>
                    <td>
                      {o.via === 'granted' ? (
                        <Button
                          disabled={!!i}
                          onClick={() => r(o.email, o.name, false)}
                        >
                          {i === o.email ? 'Removing…' : 'Remove'}
                        </Button>
                      ) : o.via ? null : (
                        <Button
                          variant="primary"
                          disabled={!!i}
                          onClick={() => r(o.email, o.name, true)}
                        >
                          {i === o.email ? 'Granting…' : 'Grant audit access'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {d.length ? null : (
                  <tr>
                    <td colSpan={5}>No one matches.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {t.log.length ? (
            <>
              <h3 className="cx-label">Recent changes</h3>
              <ul className="qa-access-log">
                {t.log.map((o: any, h: number) => (
                  <li key={h}>
                    {o.at.slice(0, 16).replace('T', ' ')}: {o.by} {o.action} for {o.name}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : (
        <p className="cx-muted">Loading…</p>
      )}
    </details>
  )
}

/* --- As — the Audit Desk page ---------------------------------------------- */
function AuditQueuePage({
  route,
  who,
  onPick,
}: {
  route: { title: string }
  who: string
  onPick: (who: string) => void
}) {
  const { data: s, error: i, reload: c } = useSe(() => P.queuePage(who))
  const [l, p] = useState<{ queueId: string; startedAt: string } | null>(null)
  const [m, r] = useState('')
  const [u, d] = useState(false)
  const [o, h] = useState('')
  const [b, x] = useState('')
  const f = useQaSort(QUEUE_COLS)
  const g = useQaSort(PASSED_COLS)
  const y = (w: string) => {
    r(w)
    P.startAudit(w).then(
      (A) => {
        r('')
        p({ queueId: w, startedAt: A.startedAt })
        requestAnimationFrame(() =>
          document.getElementById('qa-audit-open')?.scrollIntoView({ block: 'start' })
        )
      },
      (A) => (r(''), Q(A.message, 'error'))
    )
  }
  const _ =
    s && l
      ? (s.rows.find((w: any) => w.queueId === l.queueId) ??
        s.requests.find((w: any) => w.queueId === l.queueId))
      : null
  const T = _ && 'auditType' in _ ? _ : ({} as any)
  const k =
    _ && s
      ? (s.forms.find((w: any) => w.channel === _.channel) ??
        (T.auditType ? undefined : s.forms.find((w: any) => w.channel === '*')))
      : undefined
  const C = s ? s.rows.filter((w: any) => !w.auditType && w.source !== 'offqueue') : []
  const O = C.filter((w: any) => w.date === s.today && w.status !== 'passed')
  const v = O.filter((w: any) => w.status === 'done').length
  return (
    <QaPage
      route={route}
      d={s}
      error={i}
      reload={c}
      sub="Tickets to audit today: audits team leads asked for first, then the daily sample of four per agent. Start audit opens the form with the ticket, agent and team lead filled in, and records when you started. Under 100% opens a CTL for the team lead."
      aside={
        s?.isAdmin ? (
          <Button
            disabled={u}
            onClick={() => {
              d(true)
              P.importNow().then(
                (w) => (d(false), Q(w.note || w.skipped || 'Imported.'), c()),
                (w) => (d(false), Q(w.message, 'error'))
              )
            }}
          >
            {u
              ? s?.engineLive
                ? 'Building…'
                : 'Importing…'
              : s?.engineLive
                ? 'Build the queue now'
                : 'Import the queue now'}
          </Button>
        ) : null
      }
    >
      {s ? (
        <>
          <ViewingAs d={s} onPick={onPick} />
          <p className="qa-mine" role="status">
            {s.viewing ? `${s.viewing.name} has` : 'You have'} done{' '}
            <strong>{s.mine.week}</strong> {s.mine.week === 1 ? 'audit' : 'audits'} this
            week, <strong>{s.mine.month}</strong> this month.
          </p>
          {!s.engineLive && s.isAdmin ? (
            <p className="cx-note">
              <span>
                This queue is still drawn by the old Quality Queue app and imported
                here each morning. Set qa_engine_live in Hub Admin once the history is
                migrated, and Quality draws it itself.
              </span>
            </p>
          ) : null}
          {_ && k ? (
            <div id="qa-audit-open">
              <AuditForm
                form={k}
                submitLabel="Submit audit"
                askReasons
                interactionAt={'interactionAt' in _ ? _.interactionAt : ''}
                memory={s.failMemory?.[_.agentEmail.toLowerCase()]}
                facts={
                  <dl className="qa-facts">
                    {T.auditType ? (
                      <>
                        <div>
                          <dt>Audit type</dt>
                          <dd>{T.auditType}</dd>
                        </div>
                        <div>
                          <dt>Reference</dt>
                          <dd className="qa-ref">{T.reference}</dd>
                        </div>
                      </>
                    ) : (
                      <div>
                        <dt>Ticket</dt>
                        <dd>
                          <TicketRef url={s.ticketUrl} id={_.ticketId} />
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>Agent</dt>
                      <dd>{_.agentName}</dd>
                    </div>
                    <div>
                      <dt>Team lead</dt>
                      <dd>{_.tlName || '–'}</dd>
                    </div>
                    {T.auditType ? (
                      T.note ? (
                        <div>
                          <dt>Note</dt>
                          <dd>{T.note}</dd>
                        </div>
                      ) : null
                    ) : (
                      <>
                        <div>
                          <dt>Channel</dt>
                          <dd>{_.channel}</dd>
                        </div>
                        <div>
                          <dt>Contact type</dt>
                          <dd>{_.contactType || '–'}</dd>
                        </div>
                      </>
                    )}
                    <div>
                      <dt>Started</dt>
                      <dd className="cx-num">
                        {new Date(l!.startedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </dd>
                    </div>
                  </dl>
                }
                backLabel="Back to the queue"
                onCancel={() => {
                  p(null)
                  requestAnimationFrame(() =>
                    document.getElementById('qq-h')?.scrollIntoView({ block: 'start' })
                  )
                }}
                onSubmit={(w, A, S, R) =>
                  P.submitAudit({
                    queueId: _.queueId,
                    formId: k.formId,
                    formVersion: k.version,
                    answers: w,
                    reasons: S,
                    comment: A,
                    interactionAt: R,
                  }).then((Z) => {
                    Q(
                      `Saved: ${Z.score}%. ${_.agentName} and their team lead were emailed; ${Z.ctlDue ? `CTL opened for the team lead, due ${Z.ctlDue}` : 'full marks, so it is settled with no CTL'}.`
                    )
                    p(null)
                    c()
                  })
                }
              />
            </div>
          ) : _ ? (
            <p className="cx-note" role="alert" id="qa-audit-open">
              <span>
                {_.channel} has no active audit form. An admin adds one in Admin &gt;
                Audit forms; until then this item cannot be audited.
              </span>
            </p>
          ) : null}
          {s.unmatched?.length ? (
            <p className="cx-note qa-unmatched" role="alert">
              <span>
                Not shown:{' '}
                {s.unmatched
                  .map((w: any) => `${w.name} (${w.items} ${w.items === 1 ? 'item' : 'items'})`)
                  .join(', ')}
                . The queue drew tickets for{' '}
                {s.unmatched.length === 1 ? 'this agent' : 'these agents'}, but no one
                active on the roster matches by Freshdesk id, email or name. Add or
                fix them in People &amp; holidays (name, Freshdesk id), then import
                again.
              </span>
            </p>
          ) : null}
          {b ? (
            <p className="cx-note" role="status">
              <span>{b}</span>{' '}
              <Button variant="quiet" onClick={() => x('')}>
                Dismiss
              </Button>
            </p>
          ) : null}
          <RequestedAudits
            d={s}
            busyId={m}
            openId={l?.queueId ?? ''}
            onStart={y}
            reload={c}
          />
          <NonTicketAudits
            d={s}
            busyId={m}
            openId={l?.queueId ?? ''}
            onStart={y}
            onRemoved={(w) => (l?.queueId === w && p(null), c())}
            reload={c}
          />
          <OffQueueAudits
            d={s}
            busyId={m}
            openId={l?.queueId ?? ''}
            onStart={y}
            onRemoved={(w) => (l?.queueId === w && p(null), c())}
            reload={c}
          />
          <QaSection
            id="qq-h"
            title={`Today, ${v} of ${O.length} audited`}
            hint={
              s.importedAt
                ? `${s.engineLive ? 'Built' : 'Imported'} ${s.importedAt.slice(0, 16).replace('T', ' ')} UTC`
                : s.engineLive
                  ? 'Not built yet today'
                  : 'Not imported yet today'
            }
          >
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <SortTh col="action" sort={f}>
                      Action time
                    </SortTh>
                    <SortTh col="agent" sort={f}>
                      Agent
                    </SortTh>
                    <SortTh col="channel" sort={f}>
                      Channel
                    </SortTh>
                    <SortTh col="type" sort={f}>
                      Contact type
                    </SortTh>
                    <SortTh col="ticket" sort={f}>
                      Ticket
                    </SortTh>
                    <SortTh col="agentStatus" sort={f}>
                      Agent set status
                    </SortTh>
                    <SortTh col="ticketNow" sort={f}>
                      Ticket now
                    </SortTh>
                    <SortTh col="audit" sort={f}>
                      Audit
                    </SortTh>
                    <th scope="col">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {C.length ? (
                    f.apply(C).map((w: any) => (
                      <Fragment key={w.queueId}>
                        <tr>
                          <td className="cx-num">
                            {w.actionAt || '–'}
                            <span className="cx-faint qa-sub">queued {w.date}</span>
                          </td>
                          <td>
                            {w.agentName}
                            <span className="cx-faint qa-sub">{w.tlName}</span>
                            {w.repeatFails ? (
                              <Chip status="warn">
                                {w.repeatFails === 1 ? '1 repeat fail' : `${w.repeatFails} repeat fails`}
                              </Chip>
                            ) : null}
                          </td>
                          <td>{w.channel}</td>
                          <td className="cx-muted">{w.contactType}</td>
                          <td>
                            <TicketRef url={s.ticketUrl} id={w.ticketId} />
                          </td>
                          <td
                            title={
                              w.agentStatusLog
                                ? `This agent's status changes: ${w.agentStatusLog}`
                                : undefined
                            }
                          >
                            {w.agentStatus || '–'}
                            {w.agentStatusLog && w.agentStatusLog.includes(';') ? (
                              <span className="cx-faint qa-sub">
                                {w.agentStatusLog.split('; ').length} changes
                              </span>
                            ) : null}
                          </td>
                          <td className="cx-muted">{w.ticketStatus || '–'}</td>
                          <td
                            title={
                              w.status === 'passed' && w.passReason
                                ? `Passed: ${w.passReason}`
                                : undefined
                            }
                          >
                            <StatusChip s={w.status} />
                            {w.status === 'passed' ? (
                              <span className="cx-faint qa-sub">
                                {w.passReason}
                                {w.passedByName ? ` (${w.passedByName})` : ''}
                              </span>
                            ) : null}
                          </td>
                          <td>
                            {w.status === 'done' || w.status === 'passed' || s.readOnly ? null : w.takenByOther ? (
                              <span className="cx-muted">Being audited</span>
                            ) : (
                              <div className="qa-actions">
                                <Button
                                  variant="primary"
                                  disabled={!!m || l?.queueId === w.queueId}
                                  onClick={() => y(w.queueId)}
                                >
                                  {m === w.queueId
                                    ? 'Opening…'
                                    : w.status === 'in_progress'
                                      ? 'Continue audit'
                                      : 'Start audit'}
                                </Button>
                                <Button
                                  aria-expanded={o === w.queueId}
                                  disabled={!!m}
                                  onClick={() => h(o === w.queueId ? '' : w.queueId)}
                                >
                                  Pass
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {o === w.queueId ? (
                          <tr className="qa-passrow">
                            <td colSpan={9}>
                              <PassForm
                                row={w}
                                reasons={s.passReasons}
                                onCancel={() => h('')}
                                onDone={(A, S) => {
                                  h('')
                                  x(S ?? '')
                                  Q(A)
                                  if (l?.queueId === w.queueId) p(null)
                                  c()
                                }}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9}>
                        Nothing in your queue. The queue is imported every morning at
                        about 08:30 Kuwait.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </QaSection>
          <WeekCoverage d={s} />
          {s.passed.length ? (
            <details className="qa-sampling cx-panel cx-panel--pad">
              <summary>Passed without an audit, last 30 days ({s.passed.length})</summary>
              <div className="cx-tablewrap">
                <table className="cx-table">
                  <thead>
                    <tr>
                      <SortTh col="passed" sort={g}>
                        Passed
                      </SortTh>
                      <SortTh col="agent" sort={g}>
                        Agent
                      </SortTh>
                      <SortTh col="ticket" sort={g}>
                        Ticket
                      </SortTh>
                      <SortTh col="channel" sort={g}>
                        Channel
                      </SortTh>
                      <SortTh col="reason" sort={g}>
                        Reason
                      </SortTh>
                      <SortTh col="by" sort={g}>
                        By
                      </SortTh>
                    </tr>
                  </thead>
                  <tbody>
                    {g.apply(s.passed).map((w: any) => (
                      <tr key={w.queueId}>
                        <td className="cx-num">
                          {w.passedAt ? w.passedAt.slice(0, 16).replace('T', ' ') : w.date}
                          <span className="cx-faint qa-sub">queued {w.date}</span>
                        </td>
                        <td>{w.agentName}</td>
                        <td>
                          <TicketRef url={s.ticketUrl} id={w.ticketId} />
                        </td>
                        <td>{w.channel}</td>
                        <td>{w.reason || '–'}</td>
                        <td>{w.passedByName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
          {s.isAdmin ? (
            <>
              <SamplingPanel />
              <AccessPanel />
            </>
          ) : null}
        </>
      ) : null}
    </QaPage>
  )
}

/* --- qs — route wrapper: admin view-as remounts the desk ------------------- */
export default function AuditQueueRoute({ route }: { route: { title: string } }) {
  const [n, a] = useState(() => (getBoot()?.user.role === 'admin' ? '*' : ''))
  return <AuditQueuePage route={route} who={n} onPick={a} key={n} />
}
