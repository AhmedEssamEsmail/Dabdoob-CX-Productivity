/**
 * fdFloorCursor_ — the D4 purge-floor clamp on the FD ticket sync fetch
 * cursor: any cursor below 2026-09-01T00:00:00Z (incl. unparseable input and
 * the '2000-01-01' full-sync fallback) is raised to the floor so purged
 * tickets can never be re-fetched/re-inserted.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/shared/platform/settings', () => ({
  getConfig: async () => undefined,
  setConfig: async () => undefined,
}))

vi.mock('@/features/shared/platform/repo', () => ({
  db: () => ({ from: () => ({ select: async () => ({ data: [], error: null }) }) }),
  appendRow: async () => undefined,
  cacheGet: () => null,
  cachePut: () => undefined,
}))

import { fdFloorCursor_ } from '@/features/shared/jobs/freshdesk'

const FLOOR = '2026-09-01T00:00:00Z'

describe('fdFloorCursor_', () => {
  it('raises a below-floor cursor to the floor', () => {
    expect(fdFloorCursor_('2026-04-20T00:00:00Z')).toBe(FLOOR) // freshdesk_full_sync_start default
    expect(fdFloorCursor_('2026-08-31T23:59:59Z')).toBe(FLOOR)
  })

  it('raises the Sep-1 cursor minus the 5-min incremental overlap to the floor', () => {
    expect(fdFloorCursor_('2026-08-31T23:55:00Z')).toBe(FLOOR)
  })

  it('leaves an above-floor cursor unchanged', () => {
    expect(fdFloorCursor_('2026-10-15T08:30:00Z')).toBe('2026-10-15T08:30:00Z')
    expect(fdFloorCursor_('2026-09-01T00:00:01Z')).toBe('2026-09-01T00:00:01Z')
  })

  it('returns the floor for exactly the floor', () => {
    expect(fdFloorCursor_(FLOOR)).toBe(FLOOR)
  })

  it('returns the floor for empty/garbage cursors — floor wins over 2000-01-01', () => {
    expect(fdFloorCursor_('')).toBe(FLOOR)
    expect(fdFloorCursor_('not-a-date')).toBe(FLOOR)
    expect(fdFloorCursor_('2000-01-01T00:00:00Z')).toBe(FLOOR)
  })
})
