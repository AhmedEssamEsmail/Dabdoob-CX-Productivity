import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TphData, TphTableRow } from '@/features/cx-productivity/components/tph-grid-shared'
import { Ua, Va, We } from '@/features/cx-productivity/components/tph-grid-shared'
import { Ga } from '@/features/cx-productivity/components/tph-grid-page'
import { Es, Xa } from '@/features/cx-productivity/components/tph-grid-views'
import { PaintGrid } from '@/features/shared/components/ui'

/* Minimal React stub (same pattern as tests/ui/autosave-input.test.tsx),
   extended with deps-compared useMemo/useReducer for the Ga dep-stability test. */
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

vi.mock('react', () => stub)

vi.mock('react/jsx-runtime', () => {
  const jsx = (type: unknown, props: unknown) => ({ type, props })
  return { jsx, jsxs: jsx, Fragment: 'fragment' }
})
vi.mock('react/jsx-dev-runtime', () => {
  const jsx = (type: unknown, props: unknown) => ({ type, props })
  return { jsxDEV: jsx, Fragment: 'fragment' }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/tph',
}))

vi.mock('@/features/cx-productivity/components/pv-shared', () => ({
  useSe: () => ({ data: null, error: null, reload: () => {} }),
}))

/* Keep every real helper; pin the tab off 'overview' (skips the trend fetch)
   and wrap Va/Ua/We so memo recomputes are countable. */
vi.mock('@/features/cx-productivity/components/tph-grid-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/cx-productivity/components/tph-grid-shared')>()
  return { ...actual, Yt: () => 'grid', Va: vi.fn(actual.Va), Ua: vi.fn(actual.Ua), We: vi.fn(actual.We) }
})

vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
vi.stubGlobal('document', { documentElement: { lang: 'en' } })

type El = { type: unknown; props: Record<string, unknown> }

const table: TphTableRow[] = [
  {
    hour: 9,
    channel: 'chat',
    cases: 5,
    source: 'tl',
    agents: [
      {
        email: 'a@x',
        name: 'A',
        minutes: 30,
        callsMin: 0,
        capMin: 0,
        touches: 10,
        tph: 20,
        cap: 5,
        pctOfCap: 200,
        pctRaw: 200,
        over: true,
        reason: '',
        limit: '',
      },
    ],
  },
]

function fixture(over: Partial<TphData> = {}): TphData {
  return {
    date: '2025-11-10',
    today: '2025-11-11',
    table,
    callVariance: [],
    hasCases: true,
    touchesReady: true,
    canEdit: true,
    tlEditDays: 7,
    isAdmin: false,
    ...over,
  } as unknown as TphData
}

function renderGa(d: TphData): El {
  stub.begin()
  const out = (Ga as unknown as (p: { d: TphData; reload: () => void; go: (s: string) => void }) => El)({
    d,
    reload: () => {},
    go: () => {},
  })
  stub.runEffects()
  return out
}

function xaSum(out: El): unknown {
  const children = out.props.children as El[]
  const xa = children.find((c) => c && typeof c === 'object' && 'sum' in (c.props ?? {}))
  return xa?.props.sum
}

beforeEach(() => {
  stub.reset()
  vi.mocked(Va).mockClear()
})

describe('Ga day-step dep stability', () => {
  it('does not recompute Va when d identity changes but d.table is unchanged', () => {
    const d1 = fixture()
    const first = renderGa(d1)
    expect(vi.mocked(Va)).toHaveBeenCalledTimes(1)
    const sum1 = xaSum(first)

    const d2 = fixture({ date: '2025-11-09', hasCases: false })
    const second = renderGa(d2)
    expect(vi.mocked(Va)).toHaveBeenCalledTimes(1)
    expect(xaSum(second)).toEqual(sum1)
  })

  it('recomputes Va when d.table reference changes', () => {
    renderGa(fixture())
    expect(vi.mocked(Va)).toHaveBeenCalledTimes(1)
    const d2 = fixture({ table: [...table] })
    renderGa(d2)
    expect(vi.mocked(Va)).toHaveBeenCalledTimes(2)
  })
})

/* Es grid tab: the memoized PaintGrid (EsPaintGrid) must receive
   referentially stable props across re-renders with unchanged inputs so
   React.memo can skip the agents x slots row subtree. */
function esFixture(over: Partial<TphData> = {}): TphData {
  return fixture({
    slotMin: 15,
    hours: [9, 10],
    firstSlot: 36,
    nowSlot: null,
    channels: [{ key: 'chat', name: 'Chat', kind: 'queue', groups: [] }],
    activities: [],
    off: 'off',
    agents: [{ email: 'a@x', name: 'A', tlEmail: '', mine: false }],
    cells: { 'a@x': Array.from({ length: 8 }, () => ({ c: 'chat', calls: false, src: '' })) },
    tasks: [],
    cases: [],
    eligible: [],
    eligibleDays: 0,
    minutesPerCase: 10,
    callsFactor: 0.5,
    capWindowMin: 30,
    callsBasis: 'estimate',
    callsAsOf: '',
    callMinutes: null,
    dayTotals: [],
    rebuiltAsOf: '',
    rebuiltReasons: {},
    autoAsOf: '',
    touchesAsOf: '',
    shiftsLinked: false,
    lastAuto: null,
    ...over,
  })
}

function renderEs(d: TphData, onSaved: () => void): El {
  stub.begin()
  const out = (Es as unknown as (p: { d: TphData; onSaved: () => void }) => El)({ d, onSaved })
  stub.runEffects()
  return out
}

function findByType(node: unknown, type: unknown): El | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByType(child, type)
      if (found) return found
    }
    return null
  }
  const el = node as El
  if (el.type === type) return el
  return findByType(el.props?.children, type)
}

describe('Es paint-grid memo props', () => {
  it('hands PaintGrid identical row/style/handler props on re-render with unchanged inputs', () => {
    const d = esFixture()
    const onSaved = () => {}
    const first = findByType(renderEs(d, onSaved), PaintGrid)
    expect(first).not.toBeNull()
    const second = findByType(renderEs(d, onSaved), PaintGrid)
    expect(second).not.toBeNull()
    expect(second!.props.rows).toBe(first!.props.rows)
    expect(second!.props.style).toBe(first!.props.style)
    expect(second!.props.onPaint).toBe(first!.props.onPaint)
    expect(second!.props.onCommit).toBe(first!.props.onCommit)
    expect(second!.props.rows).toEqual(first!.props.rows)
  })

  it('rebuilds rows when cells change (new d.cells reference)', () => {
    const onSaved = () => {}
    const d1 = esFixture()
    const first = findByType(renderEs(d1, onSaved), PaintGrid)
    const d2 = esFixture({ cells: { 'a@x': d1.cells['a@x'].slice() } })
    const second = findByType(renderEs(d2, onSaved), PaintGrid)
    expect(second!.props.rows).not.toBe(first!.props.rows)
    expect(second!.props.rows).toEqual(first!.props.rows)
  })
})

/* Xa overview tab (p19-01): every derived list is useMemo'd with field-level
   deps, so a new `d` identity whose dep fields are unchanged must not recompute
   them. Ua/We spy counts come from the shared-mock wrapper above: one Ua call =
   one missingMap recompute; one We call per missingMap entry = one missingItems
   recompute. */
const xaChannels = [{ key: 'chat', name: 'Chat', kind: 'queue', groups: [] }]
const xaTable: TphTableRow[] = [
  {
    hour: 9,
    channel: 'chat',
    cases: null,
    source: 'tl',
    agents: [
      {
        email: 'a@x',
        name: 'A',
        minutes: 30,
        callsMin: 0,
        capMin: 0,
        touches: 10,
        tph: 20,
        cap: 5,
        pctOfCap: 200,
        pctRaw: 200,
        over: true,
        reason: 'no_cases',
        limit: '',
      },
    ],
  },
]
const xaActivities: { key: string; name: string }[] = []
const xaCallVariance = [{ email: 'a@x', name: 'A', hour: 9, callMin: 15 }]
const xaDayTotals = [
  {
    email: 'a@x',
    name: 'A',
    minutes: 30,
    touches: 10,
    cap: 5,
    capTouches: 5,
    pctOfCap: 50,
    pctRaw: 55,
    scoredHours: 1,
    overHours: 2,
    limits: {},
  },
]
const xaRebuiltReasons = { chat: 'rebuilt from history' }
const xaSumValue: ReturnType<typeof Va> = {
  touches: 10,
  outside: 0,
  minutes: 30,
  tph: 20,
  tphExCalls: 20,
  cap: 5,
  pct: 200,
  pctRaw: 200,
  scored: 1,
  onGrid: 1,
  agents: 1,
  over: 1,
  overAgents: 1,
  overTouches: 5,
  zeroCapTouches: 0,
  missing: 1,
  covered: 0,
  carried: 0,
  hours: [],
}
const xaRunner = {
  running: false,
  progress: '',
  run: () => {},
  btn: { class: '', style: undefined, label: 'Rebuild cases and touches' },
}

function xaFixture(over: Partial<TphData> = {}): TphData {
  return {
    date: '2025-11-10',
    today: '2025-11-11',
    hasCases: true,
    touchesReady: true,
    touchesAsOf: '2025-11-10T09:00',
    canEdit: true,
    tlEditDays: 7,
    isAdmin: false,
    off: 'off',
    channels: xaChannels,
    activities: xaActivities,
    table: xaTable,
    dayTotals: xaDayTotals,
    callVariance: xaCallVariance,
    rebuiltReasons: xaRebuiltReasons,
    rebuiltAsOf: '2025-11-10T09:30',
    callsBasis: 'estimate',
    callsFactor: 0.5,
    callsAsOf: '',
    lastAuto: null,
    ...over,
  } as unknown as TphData
}

function renderXa(d: TphData): El {
  stub.begin()
  const out = (
    Xa as unknown as (p: {
      d: TphData
      sum: ReturnType<typeof Va>
      runner: typeof xaRunner
      trend: null
      select: (t: string, focus?: boolean) => void
      go: (date: string) => void
    }) => El
  )({ d, sum: xaSumValue, runner: xaRunner, trend: null, select: () => {}, go: () => {} })
  stub.runEffects()
  return out
}

function collectItemTexts(node: unknown, acc: string[] = []): string[] {
  if (!node || typeof node !== 'object') return acc
  if (Array.isArray(node)) {
    for (const child of node) collectItemTexts(child, acc)
    return acc
  }
  const el = node as El
  if (typeof el.props?.text === 'string') acc.push(el.props.text)
  return collectItemTexts(el.props?.children, acc)
}

describe('Xa memo deps', () => {
  beforeEach(() => {
    vi.mocked(Ua).mockClear()
    vi.mocked(We).mockClear()
  })

  it('does not recompute derived lists when d identity changes but dep fields are unchanged', () => {
    const first = renderXa(xaFixture())
    expect(vi.mocked(Ua)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(We)).toHaveBeenCalledTimes(1)

    const d2 = { ...xaFixture(), date: '2025-11-09' }
    const second = renderXa(d2)
    expect(vi.mocked(Ua)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(We)).toHaveBeenCalledTimes(1)
    expect(collectItemTexts(second)).toEqual(collectItemTexts(first))
  })

  it('recomputes missingMap and missingItems when dep field d.table changes', () => {
    renderXa(xaFixture())
    renderXa(xaFixture({ table: xaTable.map((r) => ({ ...r })) }))
    expect(vi.mocked(Ua)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(We)).toHaveBeenCalledTimes(2)
  })

  it('recomputes missingItems on a narrowed-dep change (d.channels) while missingMap stays cached', () => {
    const first = renderXa(xaFixture())
    const second = renderXa(xaFixture({ channels: [{ key: 'chat', name: 'Chat', kind: 'queue', groups: [] }] }))
    expect(vi.mocked(Ua)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(We)).toHaveBeenCalledTimes(2)
    expect(collectItemTexts(second)).toEqual(collectItemTexts(first))
  })
})
