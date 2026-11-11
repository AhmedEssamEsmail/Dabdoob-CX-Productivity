import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuditQueueRoute from '@/features/cx-quality/components/audit-queue-page'

/* Minimal React stub — same harness pattern as tests/perf/tph-grid-memo.test.tsx
   (cells/slots cursors, deps-compared useMemo/useCallback, effect queue). */
const stub = vi.hoisted(() => {
  type Cleanup = () => void
  type EffectFn = () => Cleanup | void
  const cells: unknown[] = []
  const slots: Array<{ deps?: unknown[]; cleanup?: Cleanup }> = []
  const memoSlots: Array<{ deps?: unknown[]; value: unknown }> = []
  const callbackSlots: Array<{ deps?: unknown[]; fn: unknown }> = []
  let cursor = 0
  let effectCursor = 0
  let memoCursor = 0
  let callbackCursor = 0
  let pending: EffectFn[] = []
  const sameDeps = (a?: unknown[], b?: unknown[]) =>
    a === b || (!!a && !!b && a.length === b.length && a.every((v, j) => Object.is(v, b[j])))
  const api = {
    dirty: false,
    reset() {
      cells.length = 0
      slots.length = 0
      memoSlots.length = 0
      callbackSlots.length = 0
      pending = []
      api.dirty = false
    },
    begin() {
      cursor = 0
      effectCursor = 0
      memoCursor = 0
      callbackCursor = 0
      pending = []
      api.dirty = false
    },
    runEffects() {
      const fns = pending
      pending = []
      for (const f of fns) f()
      effectCursor = 0
    },
    useState(init: unknown) {
      const i = cursor++
      if (!(i in cells)) cells[i] = typeof init === 'function' ? (init as () => unknown)() : init
      const set = (v: unknown) => {
        cells[i] = typeof v === 'function' ? (v as (p: unknown) => unknown)(cells[i]) : v
        api.dirty = true
      }
      return [cells[i], set]
    },
    useRef(init: unknown) {
      const i = cursor++
      if (!(i in cells)) cells[i] = { current: init }
      return cells[i] as { current: unknown }
    },
    useReducer(init: unknown, reducer: (s: unknown, a: unknown) => unknown) {
      const i = cursor++
      if (!(i in cells)) cells[i] = typeof init === 'function' ? (init as () => unknown)() : init
      return [
        cells[i],
        (a: unknown) => {
          cells[i] = reducer(cells[i], a)
          api.dirty = true
        },
      ]
    },
    useMemo(fn: () => unknown, deps?: unknown[]) {
      const i = memoCursor++
      const slot = memoSlots[i] ?? (memoSlots[i] = { value: undefined })
      if (sameDeps(slot.deps, deps)) return slot.value
      slot.deps = deps
      return (slot.value = fn())
    },
    useCallback(fn: unknown, deps?: unknown[]) {
      const i = callbackCursor++
      const slot = callbackSlots[i] ?? (callbackSlots[i] = { fn: undefined })
      if (sameDeps(slot.deps, deps)) return slot.fn
      slot.deps = deps
      return (slot.fn = fn)
    },
    useEffect(fn: EffectFn, deps?: unknown[]) {
      const i = effectCursor++
      const slot = slots[i] ?? (slots[i] = {})
      if (sameDeps(slot.deps, deps)) return
      slot.cleanup?.()
      slot.deps = deps
      pending.push(() => {
        slot.cleanup = fn() ?? undefined
      })
    },
    createContext() {
      return { Provider: 'ctx-provider', Consumer: 'ctx-consumer' }
    },
    useContext() {
      return null
    },
    memo(fn: unknown) {
      return fn
    },
    forwardRef(fn: unknown) {
      return fn
    },
    Fragment: 'fragment',
  }
  return api
})

const harness = vi.hoisted(() => ({
  data: { current: null as unknown },
  applies: {
    queue: vi.fn((rows: unknown[]) => rows),
    passed: vi.fn((rows: unknown[]) => rows),
  },
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
  getBoot: () => ({ user: { role: 'agent' } }),
}))

vi.mock('@/features/shared/components/shell/ui', () => ({ Chip: 'chip' }))

vi.mock('@/features/shared/components/ui', () => ({
  Button: 'button',
  Empty: 'empty',
  PageShell: 'page-shell',
  Seg: 'seg',
  Select: 'select',
}))

/* qa-shared fully stubbed: useSe returns the fixture payload; useQaSort's
   apply is a per-column-set spy so memoized sorts are countable. QUEUE_COLS
   has no `passed` key; PASSED_COLS does. Child components are string types —
   the jsx stub never invokes them, so only AuditQueuePage's own body runs. */
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
  useQaSort: (cols: Record<string, unknown> | undefined) => ({
    s: null,
    toggle: () => {},
    apply: cols && cols.passed ? harness.applies.passed : harness.applies.queue,
  }),
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

vi.mock('@/features/cx-quality/components/audit-queue-helpers', () => ({
  wiPill: () => ({ cls: '', label: 'pill' }),
  wiTone: () => '',
}))

type El = { type: unknown; props: Record<string, unknown> }

function queueRow(i: number) {
  return {
    queueId: `q${i}`,
    actionAt: '2025-11-11 08:00',
    agentName: `Agent ${i}`,
    tlName: 'TL',
    channel: 'chat',
    contactType: 'customer',
    ticketId: 1000 + i,
    agentStatus: 'open',
    agentStatusLog: '',
    ticketStatus: 'open',
    status: i % 7 === 0 ? 'done' : 'open',
    passReason: '',
    passedByName: '',
    repeatFails: 0,
    takenByOther: false,
    date: '2025-11-11',
    source: 'sample',
    auditType: null,
  }
}

function passedRow(i: number) {
  return {
    queueId: `p${i}`,
    passedAt: '2025-11-10T10:00',
    date: '2025-11-10',
    agentName: `A${i}`,
    ticketId: 5000 + i,
    channel: 'chat',
    reason: 'r',
    passedByName: 'B',
  }
}

/* Mirrors the measured payload shape: rows[213], requests[0], passed[300]. */
function fixture() {
  return {
    rows: Array.from({ length: 213 }, (_, i) => queueRow(i)),
    requests: [],
    passed: Array.from({ length: 300 }, (_, i) => passedRow(i)),
    forms: [],
    today: '2025-11-11',
    unmatched: [],
    mine: { week: 1, month: 2 },
    engineLive: true,
    isAdmin: false,
    viewing: null,
    selfEmail: 'me@x',
    readOnly: false,
    ticketUrl: 'https://x',
    importedAt: '2025-11-11T08:30',
    passReasons: [],
    quotaWeeks: [],
  }
}

function renderPage(): El {
  stub.begin()
  const routeEl = (AuditQueueRoute as unknown as (p: { route: { title: string } }) => El)({
    route: { title: 'Audit Desk' },
  })
  const out = (routeEl.type as (p: Record<string, unknown>) => El)(routeEl.props)
  stub.runEffects()
  return out
}

function collectTickets(node: unknown, acc: unknown[] = []): unknown[] {
  if (!node || typeof node !== 'object') return acc
  if (Array.isArray(node)) {
    for (const child of node) collectTickets(child, acc)
    return acc
  }
  const el = node as El
  if (el.type === 'ticket-ref') acc.push(el.props?.id)
  return collectTickets(el.props?.children, acc)
}

beforeEach(() => {
  stub.reset()
  harness.data.current = fixture()
  harness.applies.queue.mockClear()
  harness.applies.passed.mockClear()
})

describe('AuditQueuePage memo deps', () => {
  it('does not re-sort queue/passed rows on re-render with unchanged payload fields', () => {
    const first = renderPage()
    expect(harness.applies.queue).toHaveBeenCalledTimes(1)
    expect(harness.applies.passed).toHaveBeenCalledTimes(1)

    /* New route element (unrelated prop identity) — payload fields unchanged. */
    const second = renderPage()
    expect(harness.applies.queue).toHaveBeenCalledTimes(1)
    expect(harness.applies.passed).toHaveBeenCalledTimes(1)
    expect(collectTickets(second)).toEqual(collectTickets(first))
  })

  it('does not recompute when s identity changes but dep fields are unchanged', () => {
    const base = fixture()
    harness.data.current = base
    renderPage()
    expect(harness.applies.queue).toHaveBeenCalledTimes(1)
    expect(harness.applies.passed).toHaveBeenCalledTimes(1)

    harness.data.current = { ...base, mine: { week: 9, month: 9 }, importedAt: 'later' }
    renderPage()
    expect(harness.applies.queue).toHaveBeenCalledTimes(1)
    expect(harness.applies.passed).toHaveBeenCalledTimes(1)
  })

  it('recomputes the queue sort when s.rows reference changes', () => {
    const base = fixture()
    harness.data.current = base
    renderPage()
    harness.data.current = { ...base, rows: base.rows.slice() }
    renderPage()
    expect(harness.applies.queue).toHaveBeenCalledTimes(2)
    expect(harness.applies.passed).toHaveBeenCalledTimes(1)
  })

  it('recomputes the passed sort when s.passed reference changes', () => {
    const base = fixture()
    harness.data.current = base
    renderPage()
    harness.data.current = { ...base, passed: base.passed.slice() }
    renderPage()
    expect(harness.applies.queue).toHaveBeenCalledTimes(1)
    expect(harness.applies.passed).toHaveBeenCalledTimes(2)
  })
})
