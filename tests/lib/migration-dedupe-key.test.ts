/**
 * S09-01 — dedupe_key mints are content hashes of the row's natural identity
 * cells ('<prefix>'+sha1(cells joined '|')), not positional 'mig-<index>'.
 * Positional form survives only as the all-empty-identity fallback —
 * except refresh_log, positional by design (S10-01, finding data-1).
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ROW_TRANSFORMS as CORE } from '@/features/shared/migration/mappings/queue-quality'
import { ROW_TRANSFORMS as V1 } from '@/features/shared/migration/mappings/v1-ops-sched'

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex')
const ctx = (index: number, spreadsheet = 'core', table = 'sched_plan') =>
  ({ spreadsheet, table, index })

describe('sched_plan dedupe_key (core)', () => {
  const row: Record<string, unknown> = { month: '2026-08', tl_email: 'a@x.com', date: '2026-08-01', shift: 'AM' }

  it('same identity cells + different ctx.index -> same key', () => {
    const r1: Record<string, unknown> = { ...row }; CORE.sched_plan(r1, ctx(0))
    const r2: Record<string, unknown> = { ...row }; CORE.sched_plan(r2, ctx(41))
    expect(r1.dedupe_key).toBe(r2.dedupe_key)
    expect(r1.dedupe_key).toMatch(/^mig-[0-9a-f]{40}$/)
  })

  it('changed identity cell -> different key', () => {
    const r1: Record<string, unknown> = { ...row }; CORE.sched_plan(r1, ctx(0))
    const r2: Record<string, unknown> = { ...row, shift: 'PM' }; CORE.sched_plan(r2, ctx(0))
    expect(r1.dedupe_key).not.toBe(r2.dedupe_key)
  })

  it('fixed vector: mig- + sha1(month|tl_email|date|shift|variant)', () => {
    const r: Record<string, unknown> = { ...row }; CORE.sched_plan(r, ctx(7))
    expect(r.dedupe_key).toBe('mig-' + sha1('2026-08|a@x.com|2026-08-01|AM|'))
  })

  it('all-empty identity -> positional fallback', () => {
    const r: Record<string, unknown> = {}; CORE.sched_plan(r, ctx(9))
    expect(r.dedupe_key).toBe('mig-9')
  })

  it('existing dedupe_key is not overwritten', () => {
    const r: Record<string, unknown> = { ...row, dedupe_key: 'keep' }; CORE.sched_plan(r, ctx(0))
    expect(r.dedupe_key).toBe('keep')
  })
})

describe('QaAccessLog dedupe_key', () => {
  const row: Record<string, unknown> = { email: 'e@x.com', action: 'approve', submitted_by: 's@x.com', submitted_at: '2026-08-01T00:00:00Z' }

  it('hashes email|action|submitted_by|submitted_at', () => {
    const r: Record<string, unknown> = { ...row }; CORE.QaAccessLog(r, ctx(3, 'core', 'QaAccessLog'))
    expect(r.dedupe_key).toBe('mig-' + sha1('e@x.com|approve|s@x.com|2026-08-01T00:00:00Z'))
    const r2: Record<string, unknown> = { ...row }; CORE.QaAccessLog(r2, ctx(99, 'core', 'QaAccessLog'))
    expect(r.dedupe_key).toBe(r2.dedupe_key)
  })

  it('all-empty identity -> positional fallback', () => {
    const r: Record<string, unknown> = {}; CORE.QaAccessLog(r, ctx(4, 'core', 'QaAccessLog'))
    expect(r.dedupe_key).toBe('mig-4')
  })
})

describe('refresh_log log_id', () => {
  // S10-01: positional 'mig-<index>' — matches the 8,197 live WP-51 rows; the
  // pending UNIQUE(log_id) DDL has no refresh_log backfill, so the sha1 mint
  // was reverted (finding data-1). Sheet is append-only -> position stable.
  const row: Record<string, unknown> = {
    job: 'dq', started_at: 's', finished_at: 'f', rows_in: '1', rows_out: '2',
    source_cursor: 'c', status: 'ok', error: '', note: 'n',
  }

  it('mints positional mig-<index>, ignoring cell content', () => {
    const r: Record<string, unknown> = { ...row }; CORE.refresh_log(r, ctx(5, 'live', 'refresh_log'))
    expect(r.log_id).toBe('mig-5')
  })

  it('empty row -> still positional', () => {
    const r: Record<string, unknown> = {}; CORE.refresh_log(r, ctx(6, 'live', 'refresh_log'))
    expect(r.log_id).toBe('mig-6')
  })
})

describe('ShiftPlan dedupe_key (v1_ops)', () => {
  // Raw sheet keys: `tl` is sheetToDb-mapped to tl_email post-transform.
  const row: Record<string, unknown> = { month: '2026-08', date: '2026-08-01', tl: 'Name', shift: 'AM', start: '9' }
  const v1ctx = (index: number) => ctx(index, 'v1_ops', 'sched_plan')

  it('same identity cells + different ctx.index -> same key, v1-mig- prefix', () => {
    const r1: Record<string, unknown> = { ...row }; V1.ShiftPlan(r1, v1ctx(0))
    const r2: Record<string, unknown> = { ...row }; V1.ShiftPlan(r2, v1ctx(55))
    expect(r1.dedupe_key).toBe(r2.dedupe_key)
    expect(r1.dedupe_key).toMatch(/^v1-mig-[0-9a-f]{40}$/)
    expect(r1.dedupe_key).toBe('v1-mig-' + sha1('2026-08|Name|2026-08-01|AM|'))
  })

  it('changed tl -> different key', () => {
    const r1: Record<string, unknown> = { ...row }; V1.ShiftPlan(r1, v1ctx(0))
    const r2: Record<string, unknown> = { ...row, tl: 'Other' }; V1.ShiftPlan(r2, v1ctx(0))
    expect(r1.dedupe_key).not.toBe(r2.dedupe_key)
  })

  it('all-empty identity -> positional fallback', () => {
    const r: Record<string, unknown> = {}; V1.ShiftPlan(r, v1ctx(8))
    expect(r.dedupe_key).toBe('v1-mig-8')
  })

  it('does not run outside v1_ops', () => {
    const r: Record<string, unknown> = { ...row }; V1.ShiftPlan(r, ctx(0, 'core', 'sched_plan'))
    expect(r.dedupe_key).toBeUndefined()
  })
})
