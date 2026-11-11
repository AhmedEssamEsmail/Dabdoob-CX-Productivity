'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality audit-queue page — coverage regions
 * extracted from audit-queue-page.tsx (S13-05 split):
 *   Ms → WeekCoverage, ws → WEEK_COLS, Zn → AuditForm entry block. */
import { memo, useMemo, useState } from 'react'
import { Chip } from '@/features/shared/components/shell/ui'
import { Button, TableScroll } from '@/features/shared/components/ui'
import {
  AuditForm,
  P,
  Q,
  QaSection,
  SortTh,
  TicketRef,
  qaAddDays,
  qaCovTone,
  qaDayName,
  useQaSort,
  type QaSortCols,
} from './qa-shared'

const WEEK_COLS: QaSortCols = {
  agent: { get: (t) => t.name, type: 'text' },
  done: { get: (t) => t.done, type: 'num' },
  requested: { get: (t) => t.requested, type: 'num' },
  waiting: { get: (t) => t.waiting, type: 'num' },
  remaining: { get: (t) => t.remaining, type: 'num' },
}

const CoverageDayCell = memo(function CoverageDayCell({
  date,
  count,
  perDay,
  name,
  today,
}: {
  date: string
  count: number
  perDay: number
  name: string
  today: string
}) {
  const label = `${name}, ${qaDayName(date)} ${date}: ${count} of ${perDay} audited`
  return date > today ? (
    <td className="qa-cov__cell cx-faint">–</td>
  ) : (
    <td className="qa-cov__cell" data-l={qaCovTone(count, perDay)} title={label} tabIndex={0} aria-label={label}>
      {count}
    </td>
  )
})

const CoverageRow = memo(function CoverageRow({
  row,
  days,
  today,
  currentWeek,
}: {
  row: any
  days: string[]
  today: string
  currentWeek: boolean
}) {
  return (
    <tr>
      <th scope="row" className="qa-cov__name">
        {row.name}
      </th>
      {row.days.map((count: number, index: number) => (
        <CoverageDayCell
          key={days[index]}
          date={days[index]}
          count={count}
          perDay={row.perDay}
          name={row.name}
          today={today}
        />
      ))}
      <td className="cx-num">{row.done}</td>
      <td className="cx-num">{row.requested || '–'}</td>
      {currentWeek ? <td className="cx-num">{row.waiting || '–'}</td> : null}
      <td className="cx-num">
        {row.remaining ? `${row.remaining} of ${row.quota}` : <Chip status="ok">All {row.quota} done</Chip>}
      </td>
    </tr>
  )
})

/* --- Ms — week coverage ---------------------------------------------------- */
export const WeekCoverage = memo(function WeekCoverage({ d }: { d: any }) {
  const n = useQaSort(WEEK_COLS)
  const [a, s] = useState(0)
  const week = useMemo(() => d.quotaWeeks[a], [d.quotaWeeks, a])
  const rows = useMemo(() => week?.rows ?? [], [week])
  const days = useMemo(() => (week ? [0, 1, 2, 3, 4, 5, 6].map((u) => qaAddDays(week.weekStart, u)) : []), [week])
  const totals = useMemo(
    () => ({
      done: rows.reduce((u: number, x: any) => u + x.done, 0),
      remaining: rows.reduce((u: number, x: any) => u + x.remaining, 0),
    }),
    [rows]
  )
  const sortedRows = useMemo(() => (week ? n.apply(rows) : []), [week, rows, n])
  if (!week || !rows.length) return null
  const currentWeek = a === 0
  return (
    <QaSection
      id="qq-week"
      title={`${currentWeek ? 'This week' : `Week from ${week.weekStart}`}, ${totals.done} audited and ${totals.remaining} ${currentWeek ? 'to go' : 'not done'}`}
      hint="Day by day against the daily audits per agent. Requested audits count toward each agent's weekly audits."
    >
      <div className="qa-weekstep" role="group" aria-label="Choose the week">
        <Button variant="quiet" disabled={a >= d.quotaWeeks.length - 1} onClick={() => s(a + 1)}>
          Previous week
        </Button>
        <span aria-live="polite">
          {qaDayName(days[0])} {days[0]} to {qaDayName(days[6])} {days[6]}
        </span>
        <Button variant="quiet" disabled={currentWeek} onClick={() => s(a - 1)}>
          Next week
        </Button>
      </div>
      <TableScroll label="Weekly audit coverage" className="cx-panel cx-tablewrap">
        <table className="cx-table qa-cov">
          <thead>
            <tr>
              <SortTh col="agent" sort={n}>
                Agent
              </SortTh>
              {days.map((u) => (
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
              {currentWeek ? (
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
            {sortedRows.map((u: any) => (
              <CoverageRow key={u.email} row={u} days={days} today={d.today} currentWeek={currentWeek} />
            ))}
          </tbody>
        </table>
      </TableScroll>
    </QaSection>
  )
})

/* --- audit-form entry (the #qa-audit-open block, verbatim move) ------------- */
export function AuditEntry({
  d,
  row,
  form,
  startedAt,
  onCancel,
  onSubmitted,
}: {
  d: any
  row: any
  form: any
  startedAt: string
  onCancel: () => void
  onSubmitted: () => void
}) {
  const T = 'auditType' in row ? row : ({} as any)
  return (
    <div id="qa-audit-open">
      <AuditForm
        form={form}
        submitLabel="Submit audit"
        askReasons
        interactionAt={'interactionAt' in row ? row.interactionAt : ''}
        memory={d.failMemory?.[row.agentEmail.toLowerCase()]}
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
                  <TicketRef url={d.ticketUrl} id={row.ticketId} />
                </dd>
              </div>
            )}
            <div>
              <dt>Agent</dt>
              <dd>{row.agentName}</dd>
            </div>
            <div>
              <dt>Team lead</dt>
              <dd>{row.tlName || '–'}</dd>
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
                  <dd>{row.channel}</dd>
                </div>
                <div>
                  <dt>Contact type</dt>
                  <dd>{row.contactType || '–'}</dd>
                </div>
              </>
            )}
            <div>
              <dt>Started</dt>
              <dd className="cx-num">
                {new Date(startedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </dd>
            </div>
          </dl>
        }
        backLabel="Back to the queue"
        onCancel={onCancel}
        onSubmit={(w, A, S, R) =>
          P.submitAudit({
            queueId: row.queueId,
            formId: form.formId,
            formVersion: form.version,
            answers: w,
            reasons: S,
            comment: A,
            interactionAt: R,
          }).then((Z) => {
            Q(
              `Saved: ${Z.score}%. ${row.agentName} and their team lead were emailed; ${Z.ctlDue ? `CTL opened for the team lead, due ${Z.ctlDue}` : 'full marks, so it is settled with no CTL'}.`
            )
            onSubmitted()
          })
        }
      />
    </div>
  )
}
