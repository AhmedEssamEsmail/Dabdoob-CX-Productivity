/**
 * S05-02 — stored cells -> typed row -> cells round-trip for the backfill
 * parsers and the S04-01 adapter contract, both hosted in
 * migration/backfill-mirror-columns.ts until S04-01 lands src mirror-cells.ts.
 * Timestamp cells compare as instants (fd cell 0 is a display string whose
 * instant lives in ts_ms; the adapter emits ISO); text cells are verbatim.
 */
import { describe, expect, it } from 'vitest'
import { colsToRow, rowToCells } from '../../migration/backfill-mirror-columns'

/** Cell indexes that carry timestamps per table (instant-compare). */
const TS_CELL: Record<string, Set<number>> = {
  fd_activities: new Set([0]),
  maqsam_calls: new Set([0, 1]),
  freshchat: new Set([0, 3, 4]),
}
/** Cells with no typed column — dropped on purpose (S02-01: fd cell 9 unread). */
const UNMAPPED: Record<string, Set<number>> = { fd_activities: new Set([9]) }

/** Round-trips `cells` through colsToRow/rowToCells; fd's cell-0 instant is
 *  asserted against `tsMs` (its parsed form), every other cell verbatim. */
function roundTrip(table: string, cells: unknown[], tsMs: number | null, cellsChecked: number) {
  const row = colsToRow(table, cells, tsMs)
  expect(row, `${table} parse`).not.toBeNull()
  const back = rowToCells(table, row!)
  for (let i = 0; i < cellsChecked; i++) {
    const orig = cells[i] === null || cells[i] === undefined ? '' : String(cells[i])
    if (TS_CELL[table].has(i)) {
      const backMs = back[i] === '' ? null : Date.parse(String(back[i]))
      const origMs = table === 'fd_activities' ? tsMs : orig === '' || Number.isNaN(Date.parse(orig)) ? null : Date.parse(orig)
      expect(backMs, `${table} cell ${i}`).toBe(origMs)
    } else if (UNMAPPED[table]?.has(i)) {
      expect(back[i], `${table} cell ${i} unmapped`).toBe('')
    } else {
      expect(back[i], `${table} cell ${i}`).toBe(orig)
    }
  }
  return row!
}

describe('mirror cells -> typed -> cells round-trip', () => {
  it('fd_activities: display-timestamp row round-trips (cell 0 via ts_ms)', () => {
    const tsMs = Date.UTC(2026, 10, 5, 11, 30) // '11-05-2026 14:30:00' Asia/Kuwait
    const row = roundTrip('fd_activities',
      ['11-05-2026 14:30:00', '12345', 'Agent A', 'user', 'status_change', 'status', '2', '1', 'Cairo', 'ignored'],
      tsMs, 10)
    expect(row.performed_at).toBe(new Date(tsMs).toISOString())
    expect(row.group_name).toBe('Cairo')
  })

  it('maqsam_calls: ISO row round-trips exactly', () => {
    roundTrip('maqsam_calls',
      ['2026-10-01T09:00:00.000Z', '2026-10-01T09:05:00.000Z', '0:05:00', 'a@b.com', 'ANSWERED', 'inbound', '0.0035'],
      null, 7)
  })

  it('freshchat: ISO row round-trips exactly', () => {
    roundTrip('freshchat',
      ['2026-10-01T09:00:00.000Z', 'AGENT_RESOLVE', 'conv1-1759300800000', '2026-10-02T10:00:00.000Z',
        '2026-10-02T11:00:00.000Z', 'EMAIL', 'conv1'],
      null, 7)
  })

  it('blank cells -> NULL cols -> "" cells (blank-cell parity)', () => {
    const row = roundTrip('freshchat',
      ['2026-10-01T09:00:00.000Z', '', 'conv2-1759300800000', '2026-10-02T10:00:00.000Z', '', '', 'conv2'],
      null, 7)
    expect(row.resolved_at).toBeNull()
    expect(row.status).toBeNull()
    expect(row.channel).toBeNull()
  })

  it('unparseable timestamp cell -> NULL col -> "" cell (skipped field parity)', () => {
    const row = roundTrip('maqsam_calls', ['not-a-date', '', '0:00:10', 'b@c.com', '', '', ''], null, 7)
    expect(row.started_at).toBeNull()
    expect(row.ended_at).toBeNull()
  })

  it('non-array cols -> null (row counted skipped, typed cols stay NULL)', () => {
    expect(colsToRow('fd_activities', { 0: 'x' }, 123)).toBeNull()
    expect(colsToRow('maqsam_calls', null, null)).toBeNull()
    expect(colsToRow('freshchat', 'oops', null)).toBeNull()
  })
})
