import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import {
  filterPalettePages,
  groupPalettePages,
} from '@/features/shared/components/shell/CommandPalette'
import type { RouteDef } from '@/features/shared/components/shell/registry'

const page = (path: string, title: string, group: string): RouteDef => ({
  path,
  title,
  group,
  reqs: [],
  roles: ['admin'],
  purpose: '',
})

const PAGES_FIXTURE: RouteDef[] = [
  page('overview', 'Home', 'hub'),
  page('audit-queue', 'Audit Desk', 'quality'),
  page('queue', 'Queue health', 'queue'),
  page('my-audits', 'My audits', 'quality'),
]

describe('filterPalettePages', () => {
  it('matches on title substring', () => {
    expect(filterPalettePages(PAGES_FIXTURE, 'audit desk').map((p) => p.path)).toEqual([
      'audit-queue',
    ])
  })

  it('matches on path', () => {
    expect(filterPalettePages(PAGES_FIXTURE, 'my-audits').map((p) => p.path)).toEqual([
      'my-audits',
    ])
  })

  it('is case-insensitive', () => {
    expect(filterPalettePages(PAGES_FIXTURE, 'QUEUE HEALTH').map((p) => p.path)).toEqual([
      'queue',
    ])
  })

  it('empty query returns every page in input order', () => {
    expect(filterPalettePages(PAGES_FIXTURE, '')).toEqual(PAGES_FIXTURE)
    expect(filterPalettePages(PAGES_FIXTURE, '   ')).toEqual(PAGES_FIXTURE)
  })

  it('fuzzy subsequence matches across title/path/group', () => {
    expect(filterPalettePages(PAGES_FIXTURE, 'qh').map((p) => p.path)).toEqual(['queue'])
  })
})

describe('groupPalettePages', () => {
  it('orders groups by GROUP_ORDER, not input order', () => {
    const groups = groupPalettePages(PAGES_FIXTURE).map((g) => g.group)
    expect(groups).toEqual(['hub', 'quality', 'queue'])
    expect(groupPalettePages(PAGES_FIXTURE)[1].pages.map((p) => p.path)).toEqual([
      'audit-queue',
      'my-audits',
    ])
  })
})
