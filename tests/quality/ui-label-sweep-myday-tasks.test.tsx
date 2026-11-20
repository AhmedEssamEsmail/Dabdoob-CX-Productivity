import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyDayPage from '@/features/cx-hub/components/my-day-page'
import { TlTasksPage } from '@/features/cx-people/components/tl-tasks-page'
import { Button, Textarea } from '@/features/shared/components/ui'

/* Regression spec for specs/ui-label-size-sweep S04/S06 pinned fixes
   (fix-qa-2 leaf qa2-02):
   1. my-day FollowUpsCard renders a quiet per-item "Mark done" Button (S04).
   2. tl-tasks TaskDetail update form keeps the note Textarea at
      className "pw-textarea pw-textarea--short" with rows={2} (S06/ux-1).
   No-DOM element-descriptor harness copied from
   tests/quality/qa-audit-footer-compact.test.tsx: internal components are
   found as {type, props} descriptors and invoked directly; data reaches the
   pages only through the Fs.myDayPart / useSe module seams, never fetch.
   Difference from the precedent: useEffect RUNS its callback once per
   render so MyDayPage's mount effect fires the mocked part fetches. */
const stub = vi.hoisted(() => {
  const cells: unknown[] = []
  let cursor = 0
  let id = 0
  const api = {
    dirty: false,
    reset() {
      cells.length = 0
      api.dirty = false
    },
    begin() {
      cursor = 0
      api.dirty = false
    },
    useState(init: unknown) {
      const i = cursor++
      if (!(i in cells))
        cells[i] = typeof init === 'function' ? (init as () => unknown)() : init
      const set = (v: unknown) => {
        cells[i] = typeof v === 'function' ? (v as (p: unknown) => unknown)(cells[i]) : v
        api.dirty = true
      }
      return [cells[i], set]
    },
    useMemo(fn: () => unknown) {
      return fn()
    },
    useCallback(fn: unknown) {
      return fn
    },
    useRef(init: unknown) {
      return { current: init }
    },
    useEffect(fn?: () => unknown) {
      fn?.()
    },
    useLayoutEffect() {},
    useId() {
      return `t${++id}`
    },
    useContext() {
      return undefined
    },
    useSyncExternalStore(_s: unknown, g: () => unknown) {
      return g()
    },
    forwardRef(fn: unknown) {
      return fn
    },
    memo(fn: unknown) {
      return fn
    },
    createContext(v: unknown) {
      return { Provider: 'ctx-provider', Consumer: 'ctx-consumer', _v: v }
    },
    Fragment: 'fragment',
  }
  return api
})

const harness = vi.hoisted(() => ({
  myDay: { current: {} as Record<string, unknown> },
  followups: { current: null as { ok: boolean; data: unknown[] } | null },
  tasks: { current: null as unknown },
}))

vi.mock('react', () => stub)

vi.mock('react/jsx-runtime', () => {
  const jsx = (type: unknown, props: unknown, key?: unknown) => ({ type, props, key })
  return { jsx, jsxs: jsx, Fragment: 'fragment' }
})
vi.mock('react/jsx-dev-runtime', () => {
  const jsx = (type: unknown, props: unknown, key?: unknown) => ({ type, props, key })
  return { jsxDEV: jsx, Fragment: 'fragment' }
})

/* my-day seams: boot context (role only), i18n D(), and hub-shared where
   Fs is the only data path — myDayPart feeds per-part fixtures. */
vi.mock('@/features/shared/shell/context', () => ({
  getBoot: () => ({ user: { role: 'tl', email: 'me@x' } }),
  useBootSelector: (sel: () => unknown) => sel(),
}))

vi.mock('@/features/shared/shell/i18n', () => ({
  D: (t: string) => t,
  useLang: () => 'en',
  prefersReducedMotion: () => false,
}))

vi.mock('@/features/cx-hub/components/hub-shared', () => ({
  Df: () => 'Morning',
  Ft: 'ft',
  Fs: {
    myDayPart: (part: string) => Promise.resolve(harness.myDay.current[part]),
    createFocusBlock: vi.fn(() => Promise.resolve()),
    markFollowUpDone: vi.fn(() => Promise.resolve()),
    searchMail: vi.fn(() => Promise.resolve([])),
    setSettings: vi.fn(() => Promise.resolve()),
    installDigest: vi.fn(() => Promise.resolve('ok')),
  },
  If: 'if-up-next',
  Nf: 'nf',
  useTh: () => {},
}))

/* tl-tasks seams: useSe feeds the page fixture; ./pw is reduced to
   string descriptors + pure helpers so nothing touches DOM/fetch. */
vi.mock('@/features/cx-people/components/shared', () => ({
  fetchJson: vi.fn(() => Promise.resolve({})),
  useSe: () => ({
    data: harness.tasks.current,
    setData: (fn: unknown) => {
      harness.tasks.current =
        typeof fn === 'function' ? (fn as (d: unknown) => unknown)(harness.tasks.current) : fn
    },
    error: null,
    reload: () => {},
  }),
}))

vi.mock('@/features/cx-people/components/pw', () => ({
  PwShell: 'pw-shell',
  PwLate: 'pw-late',
  PwSkel: 'pw-skel',
  PwErr: 'pw-err',
  PwCombo: 'pw-combo',
  useBusy: () => ({
    busy: false,
    error: '',
    setError: () => {},
    run: async (fn: () => Promise<unknown>) => {
      try {
        return await fn()
      } catch {
        return undefined
      }
    },
  }),
  useEnterAnim: () => {},
  dayLabel: (t: unknown) => String(t ?? ''),
  dayTime: (t: unknown) => String(t ?? ''),
  kwDate: (t: unknown) => String(t ?? ''),
  today: () => '2025-11-11',
  addDays: (t: string) => t,
  hLabel: (h: number) => `${h} h`,
  taskDraft: {},
  routeOf: (_id: string, route: unknown) => route,
}))

vi.mock('@/features/shared/components/shell/ui', () => ({
  stagger: () => ({}),
}))

type El = {
  type: unknown
  props: Record<string, unknown> & { children?: unknown }
}

/* Walk every props value — the target controls sit several levels below
   the page shell's children. */
function* walk(node: unknown): Generator<El> {
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n)
    return
  }
  if (!node || typeof node !== 'object') return
  const el = node as El
  if ('type' in el && 'props' in el) yield el
  const props = el.props ?? {}
  for (const k of Object.keys(props)) {
    const v = props[k]
    if (v === node) continue
    yield* walk(v)
  }
}

/* Mount an internal component descriptor on a clean state cursor. */
function mount(el: El): El {
  stub.reset()
  stub.begin()
  return (el.type as (p: Record<string, unknown>) => El)(el.props)
}

/* --- fixtures --------------------------------------------------------- */
const sec = (data: unknown[]) => ({ ok: true, data })

function myDayParts() {
  const fu = sec([
    {
      id: 'f1',
      lastAtMs: 1000,
      subject: 'TL mail to boss',
      from: 'tl@x',
      url: 'https://mail',
      hoursWaiting: 30,
    },
  ])
  return {
    core: {
      events: { today: sec([]), tomorrow: sec([]) },
      deadlines: sec([]),
      focus: sec([]),
      settings: {},
      today: '2025-11-11',
      tomorrow: '2025-11-12',
      generatedAt: '2025-11-11T08:00',
      cached: null,
    },
    mail: { mail: sec([]), generatedAt: '2025-11-11T08:00', cached: null },
    files: { files: sec([]), generatedAt: '2025-11-11T08:00', cached: null },
    followups: { followups: fu, generatedAt: '2025-11-11T08:00', cached: null },
    __fu: fu,
  }
}

function task() {
  return {
    actionId: 'a1',
    title: 'Fix sweep',
    ownerEmail: 'me@x',
    ownerName: 'Me',
    priority: 'P2',
    sourceLabel: '',
    progressState: 'in_progress',
    hours: { available: 8, free: 4, elapsed: 2 },
    estHours: 2,
    fitStatus: 'fits',
    riskReasons: [],
    milestones: [],
    planned: [],
    status: 'open',
    percent: 10,
    ragSelf: 'on_track',
    assignedBy: 'me@x',
    startAt: '2025-11-11T08:00',
    deadlineAt: '2025-11-18T17:00',
    lastUpdateAt: null,
    outcomeNote: '',
    deliveredAt: '',
    atRisk: false,
    overdue: false,
  }
}

function tasksFixture() {
  return {
    me: { email: 'me@x', name: 'Me', role: 'tl' },
    owners: [{ email: 'me@x', name: 'Me' }],
    tasks: [task()],
    load: [{ email: 'me@x', name: 'Me', committed: 1, capacity: 8, pct: 12 }],
    calendar: {},
    now: '2025-11-11T08:00',
  }
}

/* --- renders ---------------------------------------------------------- */
async function renderMyDay(): Promise<El> {
  stub.begin()
  void (MyDayPage as unknown as (p: { route: { title: string } }) => El)({
    route: { title: 'My day' },
  })
  /* mount effect fired Fs.myDayPart for all four parts; let the .then
     chains land in the stub cells, then re-render with the data. */
  await new Promise((r) => setTimeout(r, 0))
  stub.begin()
  return (MyDayPage as unknown as (p: { route: { title: string } }) => El)({
    route: { title: 'My day' },
  })
}

function renderTasks(): El {
  stub.begin()
  return (TlTasksPage as unknown as (p: { route: { title: string } }) => El)({
    route: { title: 'Tasks' },
  })
}

beforeEach(() => {
  stub.reset()
  const parts = myDayParts()
  harness.followups.current = parts.__fu
  harness.myDay.current = parts
  harness.tasks.current = tasksFixture()
})

describe('my-day follow-ups "Mark done" (S04)', () => {
  it('each waiting follow-up item gets a quiet button labelled exactly "Mark done"', async () => {
    const page = await renderMyDay()
    const cardEl = [...walk(page)].find(
      (e) => typeof e.type === 'function' && e.props.section === harness.followups.current
    )
    expect(cardEl, 'FollowUpsCard descriptor').toBeTruthy()
    const card = mount(cardEl!)
    const btn = [...walk(card)].find(
      (e) => e.type === Button && e.props.children === 'Mark done'
    )
    expect(btn, 'follow-up "Mark done" button').toBeTruthy()
    expect(String(btn!.props.className), 'must stay a quiet button').toContain('btn-quiet')
  })
})

describe('tl-tasks note textarea (S06/ux-1)', () => {
  it('the update form note stays "pw-textarea pw-textarea--short" with rows={2}', () => {
    const page = renderTasks()
    const gantt = [...walk(page)].find(
      (e) => typeof e.type === 'function' && Array.isArray(e.props.tasks)
    )
    expect(gantt, 'Gantt descriptor').toBeTruthy()
    ;(gantt!.props.onSelect as (id: string) => void)('a1')
    const again = renderTasks()
    const detailEl = [...walk(again)].find(
      (e) =>
        typeof e.type === 'function' &&
        (e.props.task as { actionId?: string } | undefined)?.actionId === 'a1'
    )
    expect(detailEl, 'TaskDetail descriptor').toBeTruthy()
    const detail = mount(detailEl!)
    const ta = [...walk(detail)].find(
      (e) =>
        e.type === Textarea && String(e.props.className).includes('pw-textarea--short')
    )
    expect(ta, 'note textarea must keep pw-textarea--short').toBeTruthy()
    expect(ta!.props.rows, 'note textarea must stay rows={2}').toBe(2)
  })
})
