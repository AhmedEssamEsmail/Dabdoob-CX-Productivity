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
 * S13-05 split: detail/edit regions → audit-queue-detail.tsx,
 *   WeekCoverage + audit-form entry → audit-queue-coverage.tsx.
 * Shared: P/useSe/QaPage(de)/QaSection(D)/Chips(E,ae,Ie,oe,U)/TicketRef(ne)/
 *   AuditForm(Zn)/SortTh(M)/useQaSort(_e)/dates(dl,he,ul,Rt)/toast(Q). */
import { Fragment, useMemo, useRef, useState } from 'react'
import { Chip } from '@/features/shared/components/shell/ui'
import { Button, ConfirmInline, Empty, PageShell, Seg, Select, TableScroll } from '@/features/shared/components/ui'
import {
  LinesSkeleton,
  LoadError,
  P,
  Q,
  QaSection,
  SortTh,
  StatusChip,
  TicketRef,
  useQaSort,
  useSe,
  type QaSortCols,
} from './qa-shared'
import { AuditEntry, WeekCoverage } from './audit-queue-coverage'
import {
  AccessPanel,
  NonTicketAudits,
  OffQueueAudits,
  PassForm,
  RequestedAudits,
  SamplingPanel,
} from './audit-queue-detail'

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
        <option value={d.selfEmail}>You, with admin tools</option>
        {d.auditors.map((s: any) => (
          <option value={s.email} key={s.email}>
            {s.name}
          </option>
        ))}
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
  const [actMode, setActMode] = useState<'active' | 'all'>('active')
  const { data: s, error: i, reload: c } = useSe(() => P.queuePage(who, actMode))
  const [l, p] = useState<{ queueId: string; startedAt: string } | null>(null)
  const [m, r] = useState('')
  const [u, d] = useState(false)
  const [o, h] = useState('')
  const [b, x] = useState('')
  const [formDirty, setFormDirty] = useState(false)
  const [pendingAct, setPendingAct] = useState<'active' | 'all' | null>(null)
  const [pendingStart, setPendingStart] = useState<string | null>(null)
  const qaInvoker = useRef<HTMLElement | null>(null)
  const passInvoker = useRef<HTMLElement | null>(null)
  const f = useQaSort(QUEUE_COLS)
  const g = useQaSort(PASSED_COLS)
  const start = (w: string) => {
    r(w)
    P.startAudit(w).then(
      (A) => {
        r('')
        p({ queueId: w, startedAt: A.startedAt })
        requestAnimationFrame(() => {
          const el = document.getElementById('qa-audit-open')
          el?.scrollIntoView({ block: 'start' })
          const form = el?.querySelector('form')
          if (form instanceof HTMLElement) form.focus()
        })
      },
      (A) => (r(''), Q(A.message, 'error'))
    )
  }
  const y = (w: string) => {
    qaInvoker.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (l && formDirty) {
      setPendingStart(w)
      setPendingAct(null)
      return
    }
    start(w)
  }
  const sRows = s?.rows
  const sRequests = s?.requests
  const sToday = s?.today
  const sPassed = s?.passed
  const _ = useMemo(
    () =>
      l && sRows
        ? (sRows.find((w: any) => w.queueId === l.queueId) ??
          (sRequests ?? []).find((w: any) => w.queueId === l.queueId))
        : null,
    [sRows, sRequests, l]
  )
  const T = _ && 'auditType' in _ ? _ : ({} as any)
  const k =
    _ && s
      ? (s.forms.find((w: any) => w.channel === _.channel) ??
        (T.auditType ? undefined : s.forms.find((w: any) => w.channel === '*')))
      : undefined
  const C = useMemo(
    () => (sRows ? sRows.filter((w: any) => !w.auditType && w.source !== 'offqueue') : []),
    [sRows]
  )
  const O = useMemo(
    () => C.filter((w: any) => w.date === sToday && w.status !== 'passed'),
    [C, sToday]
  )
  const v = O.filter((w: any) => w.status === 'done').length
  const { apply: applyQueue } = f
  const { apply: applyPassed } = g
  const sortedQueue = useMemo(() => applyQueue(C), [C, applyQueue])
  const sortedPassed = useMemo(() => applyPassed(sPassed ?? []), [sPassed, applyPassed])
  return (
    <PageShell
      id="page-title"
      className="cxp page"
      title={route.title}
      purpose="Tickets to audit today: audits team leads asked for first, then the daily sample of four per agent. Start audit opens the form with the ticket, agent and team lead filled in, and records when you started. Under 100% opens a CTL for the team lead."
      toolbar={
        <>
          {s ? (
            <Seg
              name="qa-queue-active"
              value={actMode}
              onChange={(v) => {
                const next = v as 'active' | 'all'
                if (l && formDirty) {
                  setPendingAct(next)
                  setPendingStart(null)
                  return
                }
                setActMode(next)
                c()
              }}
              options={[
                { value: 'active', label: 'Active only' },
                { value: 'all', label: 'All users' },
              ]}
              aria-label="Show agents"
            />
          ) : null}
          {pendingAct ? (
            <ConfirmInline
              label="Leave this audit? Your answers are not saved and will be lost."
              confirmLabel="Leave without saving"
              onConfirm={() => {
                const next = pendingAct
                setPendingAct(null)
                p(null)
                setActMode(next)
                c()
              }}
              onCancel={() => {
                setPendingAct(null)
                setPendingStart(null)
              }}
            />
          ) : null}
          {pendingStart ? (
            <ConfirmInline
              label="Leave this audit? Your answers are not saved and will be lost."
              confirmLabel="Leave without saving"
              onConfirm={() => {
                const w = pendingStart
                setPendingStart(null)
                setPendingAct(null)
                start(w)
              }}
              onCancel={() => {
                setPendingStart(null)
                setPendingAct(null)
              }}
            />
          ) : null}
        </>
      }
      actions={
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
      {i ? <LoadError message={i} onRetry={c} /> : null}
      {!s && !i ? <LinesSkeleton lines={6} /> : null}
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
          {s.unmatched?.length ? (
            <p className="cx-note" role="alert">
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
          {_ && k ? (
            <AuditEntry
              key={l!.queueId}
              d={s}
              row={_}
              form={k}
              startedAt={l!.startedAt}
              onCancel={() => {
                p(null)
                requestAnimationFrame(() => {
                  const back = qaInvoker.current
                  if (back?.isConnected) back.focus()
                  else document.getElementById('qq-h')?.focus()
                  document.getElementById('qq-h')?.scrollIntoView({ block: 'start' })
                })
              }}
              onSubmitted={() => {
                p(null)
                c()
              }}
              onDirtyChange={setFormDirty}
            />
          ) : _ ? (
            <p className="cx-note" role="alert" id="qa-audit-open">
              <span>
                {_.channel} has no active audit form. An admin adds one in Admin &gt;
                Audit forms; until then this item cannot be audited.
              </span>
            </p>
          ) : (
            <section className="cx-panel">
              <Empty title="Pick a queue item to start auditing." />
            </section>
          )}
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
            <TableScroll label="Today's audit queue" className="cx-panel cx-tablewrap">
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
                      <span className="cx-sr">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {C.length ? (
                    sortedQueue.map((w: any) => (
                      <Fragment key={w.queueId}>
                        <tr>
                          <td className="cx-num">
                            {w.actionAt || '–'}
                            <span className="cx-faint qa-sub">queued {w.date}</span>
                          </td>
                          <td className="cx-txt">
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
                                  onClick={(e) => {
                                    passInvoker.current = e.currentTarget
                                    h(o === w.queueId ? '' : w.queueId)
                                  }}
                                >
                                  Skip
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
                                onCancel={() => {
                                  h('')
                                  requestAnimationFrame(() => passInvoker.current?.focus())
                                }}
                                onDone={(A, S) => {
                                  h('')
                                  requestAnimationFrame(() => passInvoker.current?.focus())
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
            </TableScroll>
          </QaSection>
          <WeekCoverage d={s} />
          {s.passed.length ? (
            <details className="qa-details-panel cx-panel cx-panel--pad">
              <summary>Passed without an audit, last 30 days ({s.passed.length})</summary>
              <TableScroll label="Passed without an audit" className="cx-tablewrap">
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
                    {sortedPassed.map((w: any) => (
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
              </TableScroll>
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
    </PageShell>
  )
}

/* --- qs — route wrapper: admin view-as remounts the desk ------------------- */
export default function AuditQueueRoute({ route }: { route: { title: string } }) {
  const [n, a] = useState('')
  return <AuditQueuePage route={route} who={n} onPick={a} key={n} />
}
