import { describe, expect, it, vi } from 'vitest'
import AuditQueueRoute from '@/features/cx-quality/components/audit-queue-page'

const stub = vi.hoisted(() => ({
  useState(init: unknown) {
    return [typeof init === 'function' ? (init as () => unknown)() : init, () => {}]
  },
  useRef(init: unknown) {
    return { current: init }
  },
  useMemo(fn: () => unknown) {
    return fn()
  },
  Fragment: 'fragment',
}))

const harness = vi.hoisted(() => ({
  data: { current: null as unknown },
}))

vi.mock('react', () => stub)
vi.mock('react/jsx-runtime', () => {
  const jsx = (type: unknown, props: unknown) => ({ type, props })
  return { jsx, jsxs: jsx, Fragment: 'fragment' }
})
vi.mock('react/jsx-dev-runtime', () => {
  const jsx = (type: unknown, props: unknown) => ({ type, props })
  return { jsxDEV: jsx, Fragment: 'fragment' }
})
vi.mock('@/features/shared/shell/context', () => ({
  getBoot: () => ({ user: { role: 'admin' } }),
}))
vi.mock('@/features/shared/components/shell/ui', () => ({ Chip: 'chip' }))
vi.mock('@/features/shared/components/ui', () => ({
  Button: 'button',
  ConfirmInline: 'confirm-inline',
  Empty: 'empty',
  PageShell: 'page-shell',
  Seg: 'seg',
  Select: 'select',
  TableScroll: 'table-scroll',
}))
vi.mock('@/features/cx-quality/components/qa-shared', () => ({
  LinesSkeleton: 'lines-skeleton',
  LoadError: 'load-error',
  P: { queuePage: vi.fn(), startAudit: vi.fn(), importNow: vi.fn() },
  Q: vi.fn(),
  QaSection: 'qa-section',
  SortTh: 'sort-th',
  StatusChip: 'status-chip',
  TicketRef: 'ticket-ref',
  qaTicketLabel: (id: unknown) => `#${id}`,
  useQaSort: () => ({ s: null, toggle: () => {}, apply: (rows: unknown[]) => rows }),
  useSe: () => ({ data: harness.data.current, error: null, reload: () => {} }),
}))
vi.mock('@/features/cx-quality/components/audit-queue-coverage', () => ({
  AuditEntry: 'audit-entry',
  WeekCoverage: 'week-coverage',
}))
vi.mock('@/features/cx-quality/components/audit-queue-detail', () => ({
  AccessPanel: 'access-panel',
  NonTicketAudits: 'non-ticket-audits',
  OffQueueAudits: 'off-queue-audits',
  PassForm: 'pass-form',
  RequestedAudits: 'requested-audits',
  SamplingPanel: 'sampling-panel',
}))

type El = { type: unknown; props: Record<string, unknown> }

function findById(node: unknown, id: string): El | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findById(child, id)
      if (hit) return hit
    }
    return null
  }
  const el = node as El
  if (typeof el.type === 'function') {
    return findById((el.type as (p: Record<string, unknown>) => unknown)(el.props), id)
  }
  if (el.props?.id === id) return el
  const props = el.props || {}
  for (const k of Object.keys(props)) {
    const hit = findById(props[k], id)
    if (hit) return hit
  }
  return null
}

describe('AuditQueueRoute admin default desk', () => {
  it('defaults admins to their own desk ("You, with admin tools") instead of first auditor (*)', () => {
    harness.data.current = {
      rows: [],
      requests: [],
      passed: [],
      forms: [],
      today: '2025-11-11',
      unmatched: [],
      mine: { week: 0, month: 0 },
      engineLive: true,
      isAdmin: true,
      viewing: null,
      selfEmail: 'admin@x',
      auditors: [{ email: 'hozaifa@x', name: 'Hozaifa' }],
      readOnly: false,
      ticketUrl: 'https://x',
      importedAt: '',
      passReasons: [],
      quotaWeeks: [],
    }

    const routeEl = (AuditQueueRoute as unknown as (p: { route: { title: string } }) => El)({
      route: { title: 'Audit Desk' },
    })
    expect(routeEl.props.who).toBe('')

    const tree = (routeEl.type as (p: Record<string, unknown>) => El)(routeEl.props)
    const select = findById(tree, 'qa-desk')
    expect(select).toBeTruthy()
    expect(select!.props.value).toBe('admin@x')
    const children = select!.props.children as unknown[]
    const firstOpt = (Array.isArray(children[0]) ? children[0][0] : children[0]) as El
    expect(firstOpt.props.value).toBe('admin@x')
    expect(firstOpt.props.children).toBe('You, with admin tools')
  })
})
