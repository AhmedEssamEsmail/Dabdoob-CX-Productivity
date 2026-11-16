import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuditQueueRoute from '@/features/cx-quality/components/audit-queue-page'
import { P } from '@/features/cx-quality/components/qa-shared'

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
  ConfirmInline: 'confirm-inline',
  Empty: 'empty',
  PageShell: 'page-shell',
  Seg: 'seg',
  Select: 'select',
  TableScroll: 'table-scroll',
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
  /* qa2-01: useSe must invoke its loader so the Seg onChange -> P.queuePage(who,
     actMode) wiring is observable. The loader returns the P.queuePage vi.fn()'s
     value — harmless to the memo assertions below. */
  useSe: (loader: () => unknown) => {
    loader()
    return { data: harness.data.current, error: null, reload: () => {} }
  },
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
    forms: [{ channel: 'chat' }],
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

/* Walks every props value (aside/children/...) — the qa-queue-active Seg lives
   inside PageShell's aside, not under children. */
function findSeg(node: unknown, name: string): El | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findSeg(child, name)
      if (hit) return hit
    }
    return null
  }
  const el = node as El
  if (el.type === 'seg' && el.props?.name === name) return el
  const props = el.props || {}
  for (const k of Object.keys(props)) {
    const hit = findSeg(props[k], name)
    if (hit) return hit
  }
  return null
}

beforeEach(() => {
  stub.reset()
  harness.data.current = fixture()
  harness.applies.queue.mockClear()
  harness.applies.passed.mockClear()
  vi.mocked(P.queuePage).mockClear()
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

describe('qa-queue-active Seg wiring (qa2-01)', () => {
  it("onChange('all') makes the loader call P.queuePage(who, 'all'); first render used 'active'", () => {
    renderPage()
    const queuePage = vi.mocked(P.queuePage)
    expect(queuePage.mock.calls.at(-1)?.[1]).toBe('active')

    const seg = findSeg(renderPage(), 'qa-queue-active')
    expect(seg).toBeTruthy()
    ;(seg!.props.onChange as (v: string) => void)('all')

    renderPage()
    expect(queuePage.mock.calls[0]?.[1]).toBe('active')
    expect(queuePage.mock.calls.at(-1)?.[1]).toBe('all')
  })
})

function findType(node: unknown, type: string): El | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findType(child, type)
      if (hit) return hit
    }
    return null
  }
  const el = node as El
  if (el.type === type) return el
  const props = el.props || {}
  for (const k of Object.keys(props)) {
    const hit = findType(props[k], type)
    if (hit) return hit
  }
  return null
}

describe('qa-queue-active toggle with open audit (ux2-01)', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { activeElement: null, getElementById: () => null })
    vi.stubGlobal('HTMLElement', class {})
    vi.stubGlobal('requestAnimationFrame', (f: () => void) => f())
    vi.mocked(P.startAudit).mockResolvedValue({ startedAt: '2025-11-11 09:00' })
  })

  async function openEntry(): Promise<El> {
    const req = findType(renderPage(), 'requested-audits')
    expect(req).toBeTruthy()
    ;(req!.props.onStart as (id: string) => void)('q1')
    await Promise.resolve()
    const tree = renderPage()
    expect(findType(tree, 'audit-entry')).toBeTruthy()
    return tree
  }

  it('clean open entry survives onChange("all") and the reload uses "all"', async () => {
    const tree = await openEntry()
    const seg = findSeg(tree, 'qa-queue-active')
    expect(seg).toBeTruthy()
    ;(seg!.props.onChange as (v: string) => void)('all')

    const after = renderPage()
    expect(findType(after, 'audit-entry')).toBeTruthy()
    expect(vi.mocked(P.queuePage).mock.calls.at(-1)?.[1]).toBe('all')
  })

  it('dirty open entry gates the toggle behind ConfirmInline; confirm applies "all"', async () => {
    const tree0 = await openEntry()
    const entry = findType(tree0, 'audit-entry')!
    ;(entry.props.onDirtyChange as (d: boolean) => void)(true)
    renderPage()

    const seg = findSeg(renderPage(), 'qa-queue-active')
    ;(seg!.props.onChange as (v: string) => void)('all')
    let tree = renderPage()
    const confirm = findType(tree, 'confirm-inline')
    expect(confirm).toBeTruthy()
    expect(vi.mocked(P.queuePage).mock.calls.at(-1)?.[1]).toBe('active')

    ;(confirm!.props.onConfirm as () => void)()
    tree = renderPage()
    expect(findType(tree, 'audit-entry')).toBeNull()
    expect(vi.mocked(P.queuePage).mock.calls.at(-1)?.[1]).toBe('all')
  })

  it('dirty toggle onCancel keeps the entry and "active" mode', async () => {
    const tree0 = await openEntry()
    const entry = findType(tree0, 'audit-entry')!
    ;(entry.props.onDirtyChange as (d: boolean) => void)(true)
    renderPage()

    const seg = findSeg(renderPage(), 'qa-queue-active')
    ;(seg!.props.onChange as (v: string) => void)('all')
    const tree = renderPage()
    const confirm = findType(tree, 'confirm-inline')
    expect(confirm).toBeTruthy()
    ;(confirm!.props.onCancel as () => void)()

    const after = renderPage()
    expect(findType(after, 'confirm-inline')).toBeNull()
    expect(findType(after, 'audit-entry')).toBeTruthy()
    expect(vi.mocked(P.queuePage).mock.calls.at(-1)?.[1]).toBe('active')
  })
})

describe('start-audit dirty gate (ux3-01)', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { activeElement: null, getElementById: () => null })
    vi.stubGlobal('HTMLElement', class {})
    vi.stubGlobal('requestAnimationFrame', (f: () => void) => f())
    vi.mocked(P.startAudit).mockResolvedValue({ startedAt: '2025-11-11 09:00' })
    vi.mocked(P.startAudit).mockClear()
  })

  async function openEntry(): Promise<El> {
    const req = findType(renderPage(), 'requested-audits')
    expect(req).toBeTruthy()
    ;(req!.props.onStart as (id: string) => void)('q1')
    await Promise.resolve()
    const tree = renderPage()
    expect(findType(tree, 'audit-entry')).toBeTruthy()
    return tree
  }

  function onStart(id: string) {
    const req = findType(renderPage(), 'requested-audits')
    expect(req).toBeTruthy()
    ;(req!.props.onStart as (s: string) => void)(id)
  }

  it('dirty open entry gates onStart behind ConfirmInline; confirm starts the new audit', async () => {
    const tree0 = await openEntry()
    const entry = findType(tree0, 'audit-entry')!
    ;(entry.props.onDirtyChange as (d: boolean) => void)(true)
    renderPage()
    vi.mocked(P.startAudit).mockClear()

    onStart('q2')
    let tree = renderPage()
    const confirm = findType(tree, 'confirm-inline')
    expect(confirm).toBeTruthy()
    expect(vi.mocked(P.startAudit)).not.toHaveBeenCalled()

    ;(confirm!.props.onConfirm as () => void)()
    await Promise.resolve()
    tree = renderPage()
    expect(vi.mocked(P.startAudit)).toHaveBeenCalledWith('q2')
    expect(findType(tree, 'audit-entry')).toBeTruthy()
  })

  it('dirty onStart onCancel keeps the open audit and never calls startAudit', async () => {
    const tree0 = await openEntry()
    const entry = findType(tree0, 'audit-entry')!
    ;(entry.props.onDirtyChange as (d: boolean) => void)(true)
    renderPage()
    vi.mocked(P.startAudit).mockClear()

    onStart('q2')
    const tree = renderPage()
    const confirm = findType(tree, 'confirm-inline')
    expect(confirm).toBeTruthy()
    ;(confirm!.props.onCancel as () => void)()

    const after = renderPage()
    expect(findType(after, 'confirm-inline')).toBeNull()
    expect(findType(after, 'audit-entry')).toBeTruthy()
    expect(vi.mocked(P.startAudit)).not.toHaveBeenCalled()
  })

  it('clean open entry starts the new audit immediately with no confirm', async () => {
    await openEntry()
    vi.mocked(P.startAudit).mockClear()

    onStart('q2')
    await Promise.resolve()
    const tree = renderPage()
    expect(findType(tree, 'confirm-inline')).toBeNull()
    expect(vi.mocked(P.startAudit)).toHaveBeenCalledWith('q2')
    expect(findType(tree, 'audit-entry')).toBeTruthy()
  })
})
