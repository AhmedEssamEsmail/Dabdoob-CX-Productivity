import { describe, expect, it } from 'vitest'
import { qaCtlScopeVisible_ } from '../../src/features/cx-quality/lib/core'

const tl = { email: 'tl@x.com', role: 'tl' }
const admin = { email: 'boss@x.com', role: 'admin' }

const ownRow = { ctl_id: 'c1', tl_email: 'TL@x.com', shift_tls: 'other@x.com' }
const shiftOnlyRow = { ctl_id: 'c2', tl_email: 'lead@x.com', shift_tls: 'tl@x.com' }
const otherRow = { ctl_id: 'c3', tl_email: 'lead@x.com', shift_tls: '' }
const adminRow = { ctl_id: 'c4', tl_email: 'boss@x.com', shift_tls: '' }

describe('qaCtlScopeVisible_', () => {
  it("admin + 'mine' sees only own tl_email rows; 'all' sees every row", () => {
    expect(qaCtlScopeVisible_(adminRow, admin, 'mine')).toBe(true)
    expect(qaCtlScopeVisible_(ownRow, admin, 'mine')).toBe(false)
    expect(qaCtlScopeVisible_(otherRow, admin, 'mine')).toBe(false)
    expect(qaCtlScopeVisible_(ownRow, admin, 'all')).toBe(true)
    expect(qaCtlScopeVisible_(adminRow, admin, 'all')).toBe(true)
  })
  it("TL + 'mine' sees own tl_email rows but not shift_tls-only rows", () => {
    expect(qaCtlScopeVisible_(ownRow, tl, 'mine')).toBe(true)
    expect(qaCtlScopeVisible_(shiftOnlyRow, tl, 'mine')).toBe(false)
    expect(qaCtlScopeVisible_(otherRow, tl, 'mine')).toBe(false)
  })
  it("TL + 'all' sees every row", () => {
    expect(qaCtlScopeVisible_(ownRow, tl, 'all')).toBe(true)
    expect(qaCtlScopeVisible_(shiftOnlyRow, tl, 'all')).toBe(true)
    expect(qaCtlScopeVisible_(otherRow, tl, 'all')).toBe(true)
  })
  it('unknown scope behaves as mine', () => {
    expect(qaCtlScopeVisible_(ownRow, tl, 'bogus')).toBe(true)
    expect(qaCtlScopeVisible_(shiftOnlyRow, tl, 'bogus')).toBe(false)
    expect(qaCtlScopeVisible_(ownRow, tl, undefined)).toBe(true)
  })
})
