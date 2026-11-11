'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality audit-queue page — detail/edit regions
 * extracted from audit-queue-page.tsx (S13-05 split):
 *   Lt → PassForm, Xn → RequestForm, Is → WaiveForm, Cs → RequestedAudits,
 *   Ns → NonTicketForm, Ss → NonTicketAudits, $s → OffQueueAudits,
 *   Oe → shareOf, ct → sharePct, hn → WeightInput, un → ShareDelta,
 *   ps → SamplingForm, ms → SamplingPanel, fs → AccessPanel, gs → via labels,
 *   Jn — non-ticket remove reasons, REQUEST/NONTICKET sort maps. */
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chip } from '@/features/shared/components/shell/ui'
import { Button, Input, Select } from '@/features/shared/components/ui'
import {
  P,
  Q,
  QaSection,
  SortTh,
  StatusChip,
  TicketRef,
  qaTicketLabel,
  useQaSort,
  type QaSortCols,
} from './qa-shared'

/** Jn — canned remove reasons for off-queue / non-ticket rows. */
const REMOVE_REASONS = ['Added by mistake', 'Wrong agent', 'Duplicate of another item']

const REQUEST_COLS: QaSortCols = {
  requested: { get: (t) => t.requestedAt, type: 'date' },
  agent: { get: (t) => t.agentName, type: 'text' },
  channel: { get: (t) => t.channel, type: 'text' },
  ticket: { get: (t) => t.ticketId, type: 'num' },
  reason: { get: (t) => t.requestReason, type: 'text' },
  audit: { get: (t) => t.status, type: 'text' },
}
const NONTICKET_COLS: QaSortCols = {
  added: { get: (t) => t.createdAt ?? '', type: 'date' },
  agent: { get: (t) => t.agentName, type: 'text' },
  type: { get: (t) => t.auditType ?? '', type: 'text' },
  reference: { get: (t) => t.reference ?? '', type: 'text' },
  audit: { get: (t) => t.status, type: 'text' },
}

/* --- Lt — pass / remove row form ---------------------------------------- */
export function PassForm({
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
      <div className="cx-field">
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
      <div className="cx-field">
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

const RequestedAuditRow = memo(function RequestedAuditRow({
  row,
  ticketUrl,
  canWaive,
  readOnly,
  busyId,
  openId,
  waiveOpen,
  onStart,
  onToggleWaive,
  onWaiveDone,
}: {
  row: any
  ticketUrl: string
  canWaive: boolean
  readOnly: boolean
  busyId: string
  openId: string
  waiveOpen: boolean
  onStart: (queueId: string) => void
  onToggleWaive: (queueId: string) => void
  onWaiveDone: (queueId: string, ticketId: string) => void
}) {
  const open = row.status === 'open' || row.status === 'in_progress'
  return (
    <Fragment>
      <tr>
        <td className="cx-num">
          {row.requestedAt.slice(0, 16).replace('T', ' ')}
          <span className="cx-faint qa-sub">by {row.requestedByName}</span>
        </td>
        <td>
          {row.agentName}
          <span className="cx-faint qa-sub">{row.tlName}</span>
        </td>
        <td>
          {row.channel}
          <span className="cx-faint qa-sub">{row.contactType}</span>
        </td>
        <td>
          <TicketRef url={ticketUrl} id={row.ticketId} />
        </td>
        <td>{row.requestReason}</td>
        <td>
          <StatusChip s={row.status} />
          {row.status === 'waived' ? (
            <span className="cx-faint qa-sub">
              {row.waiveReason} ({row.waivedByName})
            </span>
          ) : null}
          {row.status === 'in_progress' && row.auditorName ? (
            <span className="cx-faint qa-sub">{row.auditorName}</span>
          ) : null}
        </td>
        <td>
          {!open || readOnly ? null : (
            <div className="qa-actions">
              {row.takenByOther ? (
                <span className="cx-muted">Being audited</span>
              ) : (
                <Button
                  variant="primary"
                  disabled={!!busyId || openId === row.queueId}
                  onClick={() => onStart(row.queueId)}
                >
                  {busyId === row.queueId
                    ? 'Opening…'
                    : row.status === 'in_progress'
                      ? 'Continue audit'
                      : 'Start audit'}
                </Button>
              )}
              {canWaive ? (
                <Button aria-expanded={waiveOpen} onClick={() => onToggleWaive(row.queueId)}>
                  Waive
                </Button>
              ) : null}
            </div>
          )}
        </td>
      </tr>
      {waiveOpen ? (
        <tr className="qa-passrow">
          <td colSpan={7}>
            <WaiveForm
              row={row}
              onCancel={() => onToggleWaive(row.queueId)}
              onDone={() => onWaiveDone(row.queueId, row.ticketId)}
            />
          </td>
        </tr>
      ) : null}
    </Fragment>
  )
})

/* --- Cs — Requested audits ----------------------------------------------- */
export function RequestedAudits({
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
  const requests = useMemo(() => d.requests, [d.requests])
  const waiting = useMemo(
    () => requests.filter((x: any) => x.status === 'open' || x.status === 'in_progress').length,
    [requests]
  )
  const sortedRequests = useMemo(() => r.apply(requests), [requests, r])
  const onStartRef = useRef(onStart)
  const reloadRef = useRef(reload)
  useEffect(() => {
    onStartRef.current = onStart
    reloadRef.current = reload
  }, [onStart, reload])
  const startAudit = useCallback((queueId: string) => onStartRef.current(queueId), [])
  const reloadData = useCallback(() => reloadRef.current(), [])
  const toggleWaive = useCallback(
    (queueId: string) => m((prev) => (prev === queueId ? '' : queueId)),
    []
  )
  const waiveDone = useCallback(
    (_queueId: string, ticketId: string) => {
      m('')
      Q(`Waived the request for #${ticketId}.`)
      reloadData()
    },
    [reloadData]
  )
  return !requests.length && !d.canRequest ? null : (
    <QaSection
      id="qq-req"
      title={waiting ? `Requested audits, ${waiting} waiting` : 'Requested audits'}
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
      {requests.length ? (
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
                  <span className="cx-sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRequests.map((x: any) => (
                <RequestedAuditRow
                  key={x.queueId}
                  row={x}
                  ticketUrl={d.ticketUrl}
                  canWaive={!!d.canWaive}
                  readOnly={!!d.readOnly}
                  busyId={busyId}
                  openId={openId}
                  waiveOpen={p === x.queueId}
                  onStart={startAudit}
                  onToggleWaive={toggleWaive}
                  onWaiveDone={waiveDone}
                />
              ))}
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

const NonTicketAuditRow = memo(function NonTicketAuditRow({
  row,
  readOnly,
  busyId,
  openId,
  removeOpen,
  onStart,
  onToggleRemove,
  onPassDone,
}: {
  row: any
  readOnly: boolean
  busyId: string
  openId: string
  removeOpen: boolean
  onStart: (queueId: string) => void
  onToggleRemove: (queueId: string) => void
  onPassDone: (queueId: string, message: string) => void
}) {
  const open = row.status === 'open' || row.status === 'in_progress'
  return (
    <Fragment>
      <tr>
        <td className="cx-num">
          {(row.createdAt || row.date).slice(0, 16).replace('T', ' ')}
          {row.createdByName ? <span className="cx-faint qa-sub">by {row.createdByName}</span> : null}
        </td>
        <td>
          {row.agentName}
          <span className="cx-faint qa-sub">{row.tlName}</span>
        </td>
        <td>
          <Chip status="neutral">{row.auditType}</Chip>
        </td>
        <td className="qa-ref">
          {row.reference}
          {row.note ? <span className="cx-faint qa-sub">{row.note}</span> : null}
        </td>
        <td>
          <StatusChip s={row.status} />
          {row.status === 'passed' && row.passReason ? (
            <span className="cx-faint qa-sub">Removed: {row.passReason}</span>
          ) : null}
          {row.status === 'in_progress' && row.auditorName ? (
            <span className="cx-faint qa-sub">{row.auditorName}</span>
          ) : null}
        </td>
        <td>
          {!open || readOnly ? null : row.takenByOther ? (
            <span className="cx-muted">Being audited</span>
          ) : (
            <div className="qa-actions">
              <Button
                variant="primary"
                disabled={!!busyId || openId === row.queueId}
                onClick={() => onStart(row.queueId)}
              >
                {busyId === row.queueId
                  ? 'Opening…'
                  : row.status === 'in_progress'
                    ? 'Continue audit'
                    : 'Start audit'}
              </Button>
              <Button
                aria-expanded={removeOpen}
                disabled={!!busyId}
                onClick={() => onToggleRemove(row.queueId)}
              >
                Remove
              </Button>
            </div>
          )}
        </td>
      </tr>
      {removeOpen ? (
        <tr className="qa-passrow">
          <td colSpan={6}>
            <PassForm
              row={row}
              reasons={REMOVE_REASONS}
              onCancel={() => onToggleRemove(row.queueId)}
              onDone={(message) => onPassDone(row.queueId, message)}
            />
          </td>
        </tr>
      ) : null}
    </Fragment>
  )
})

/* --- Ss — Non-ticket audits ---------------------------------------------- */
export function NonTicketAudits({
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
  const sourceRows = useMemo(() => d.rows, [d.rows])
  const rows = useMemo(() => sourceRows.filter((h: any) => h.auditType), [sourceRows])
  const waiting = useMemo(
    () => rows.filter((h: any) => h.status === 'open' || h.status === 'in_progress').length,
    [rows]
  )
  const sortedRows = useMemo(() => u.apply(rows), [rows, u])
  const onStartRef = useRef(onStart)
  const onRemovedRef = useRef(onRemoved)
  const reloadRef = useRef(reload)
  useEffect(() => {
    onStartRef.current = onStart
    onRemovedRef.current = onRemoved
    reloadRef.current = reload
  }, [onStart, onRemoved, reload])
  const startAudit = useCallback((queueId: string) => onStartRef.current(queueId), [])
  const reloadData = useCallback(() => reloadRef.current(), [])
  const toggleRemove = useCallback(
    (queueId: string) => r((prev) => (prev === queueId ? '' : queueId)),
    []
  )
  const passDone = useCallback(
    (queueId: string, message: string) => {
      r('')
      Q(message)
      onRemovedRef.current(queueId)
    },
    []
  )
  return !rows.length && !d.auditTypes?.length ? null : (
    <QaSection
      id="qq-nt"
      title={waiting ? `Non-ticket audits, ${waiting} to do` : 'Non-ticket audits'}
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
      {l ? <NonTicketForm d={d} onDone={(h) => (p(false), Q(h), reloadData())} /> : null}
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
                  <span className="cx-sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((h: any) => (
                <NonTicketAuditRow
                  key={h.queueId}
                  row={h}
                  readOnly={!!d.readOnly}
                  busyId={busyId}
                  openId={openId}
                  removeOpen={m === h.queueId}
                  onStart={startAudit}
                  onToggleRemove={toggleRemove}
                  onPassDone={passDone}
                />
              ))}
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

const OffQueueAuditRow = memo(function OffQueueAuditRow({
  row,
  ticketUrl,
  readOnly,
  busyId,
  openId,
  removeOpen,
  onStart,
  onToggleRemove,
  onPassDone,
}: {
  row: any
  ticketUrl: string
  readOnly: boolean
  busyId: string
  openId: string
  removeOpen: boolean
  onStart: (queueId: string) => void
  onToggleRemove: (queueId: string) => void
  onPassDone: (queueId: string, message: string) => void
}) {
  const open = row.status === 'open' || row.status === 'in_progress'
  return (
    <Fragment>
      <tr>
        <td className="cx-num">
          {(row.createdAt || row.date).slice(0, 16).replace('T', ' ')}
          {row.createdByName ? <span className="cx-faint qa-sub">by {row.createdByName}</span> : null}
        </td>
        <td>
          {row.agentName}
          <span className="cx-faint qa-sub">{row.tlName}</span>
        </td>
        <td>
          {row.channel}
          <span className="cx-faint qa-sub">{row.contactType}</span>
        </td>
        <td>
          <TicketRef url={ticketUrl} id={row.ticketId} />
          {row.note ? <span className="cx-faint qa-sub">{row.note}</span> : null}
        </td>
        <td>
          <StatusChip s={row.status} />
          {row.status === 'passed' && row.passReason ? (
            <span className="cx-faint qa-sub">Removed: {row.passReason}</span>
          ) : null}
          {row.status === 'in_progress' && row.auditorName ? (
            <span className="cx-faint qa-sub">{row.auditorName}</span>
          ) : null}
        </td>
        <td>
          {!open || readOnly ? null : row.takenByOther ? (
            <span className="cx-muted">Being audited</span>
          ) : (
            <div className="qa-actions">
              <Button
                variant="primary"
                disabled={!!busyId || openId === row.queueId}
                onClick={() => onStart(row.queueId)}
              >
                {busyId === row.queueId
                  ? 'Opening…'
                  : row.status === 'in_progress'
                    ? 'Continue audit'
                    : 'Start audit'}
              </Button>
              <Button
                aria-expanded={removeOpen}
                disabled={!!busyId}
                onClick={() => onToggleRemove(row.queueId)}
              >
                Remove
              </Button>
            </div>
          )}
        </td>
      </tr>
      {removeOpen ? (
        <tr className="qa-passrow">
          <td colSpan={6}>
            <PassForm
              row={row}
              reasons={REMOVE_REASONS}
              onCancel={() => onToggleRemove(row.queueId)}
              onDone={(message) => onPassDone(row.queueId, message)}
            />
          </td>
        </tr>
      ) : null}
    </Fragment>
  )
})

/* --- $s — Off-queue audits ------------------------------------------------ */
export function OffQueueAudits({
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
  const sourceRows = useMemo(() => d.rows, [d.rows])
  const rows = useMemo(() => sourceRows.filter((o: any) => o.source === 'offqueue'), [sourceRows])
  const waiting = useMemo(
    () => rows.filter((o: any) => o.status === 'open' || o.status === 'in_progress').length,
    [rows]
  )
  const onStartRef = useRef(onStart)
  const onRemovedRef = useRef(onRemoved)
  const reloadRef = useRef(reload)
  useEffect(() => {
    onStartRef.current = onStart
    onRemovedRef.current = onRemoved
    reloadRef.current = reload
  }, [onStart, onRemoved, reload])
  const startAudit = useCallback((queueId: string) => onStartRef.current(queueId), [])
  const reloadData = useCallback(() => reloadRef.current(), [])
  const requestDone = useCallback((message: string, queueId?: string) => {
    p(false)
    Q(message)
    reloadData()
    startAudit(queueId as string)
  }, [reloadData, startAudit])
  const toggleRemove = useCallback(
    (queueId: string) => r((prev) => (prev === queueId ? '' : queueId)),
    []
  )
  const passDone = useCallback(
    (queueId: string, message: string) => {
      r('')
      Q(message)
      onRemovedRef.current(queueId)
    },
    []
  )
  return (
    <QaSection
      id="qq-off"
      title={waiting ? `Off-queue audits, ${waiting} to do` : 'Off-queue audits'}
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
        <RequestForm d={d} off onDone={requestDone} />
      ) : null}
      {rows.length ? (
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
                  <span className="cx-sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o: any) => (
                <OffQueueAuditRow
                  key={o.queueId}
                  row={o}
                  ticketUrl={d.ticketUrl}
                  readOnly={!!d.readOnly}
                  busyId={busyId}
                  openId={openId}
                  removeOpen={m === o.queueId}
                  onStart={startAudit}
                  onToggleRemove={toggleRemove}
                  onPassDone={passDone}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </QaSection>
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
      className="qa-details-panel__body"
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
                        <input
                          type="checkbox"
                          aria-label={`Exclude tickets whose status now is ${v.name}`}
                          checked={!!v.excluded}
                          onChange={(w) => C(v.name, { excluded: w.currentTarget.checked })}
                        />
                        <span>Status now</span>
                      </label>
                      <label className="cx-toggle">
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
export function SamplingPanel() {
  const [t, n] = useState<any>(null)
  const [a, s] = useState('')
  const i = () => {
    s('')
    P.samplingPage().then(n, (c) => s(c.message))
  }
  return (
    <details
      className="qa-details-panel cx-panel cx-panel--pad"
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

export function AccessPanel() {
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
      className="qa-details-panel cx-panel cx-panel--pad"
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
                    <span className="cx-sr">Change</span>
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
              <ul>
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
