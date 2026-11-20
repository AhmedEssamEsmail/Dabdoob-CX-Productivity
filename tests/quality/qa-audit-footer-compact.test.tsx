import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditForm } from '@/features/cx-quality/components/qa-shared'
import { PassForm } from '@/features/cx-quality/components/audit-queue-detail'
import AuditQueueRoute from '@/features/cx-quality/components/audit-queue-page'
import { Button, Textarea } from '@/features/shared/components/ui'

/* Regression test for specs/qa-audit-footer-compact:
   1. The queue-row "Pass" CTA must read "Skip" (auditors misread it as
      "pass the audit score"); the passItem flow/aria wiring is unchanged.
   2. PassForm sample branch: "Confirm pass" -> "Confirm skip",
      "Passing…" -> "Skipping…"; the x (non-ticket/off-queue) branch keeps
      "Remove"/"Removing…".
   3. AuditForm comment textarea (#qa-comment) is compact (rows<=3).
   4. AuditForm footer submit + Cancel render at size="sm" (cx-btn--sm).
   No-DOM element-descriptor stub, same harness as
   tests/quality/audit-form-controls.test.tsx. */
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
    useEffect() {},
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
  data: { current: null as unknown },
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

/* Keep every real qa-shared export (AuditForm, qaTicketLabel, …) and only
   seam the data layer: useSe feeds the fixture, P.* are spies so the queue
   page renders without fetch and PassForm can stay "busy" on demand. */
vi.mock('@/features/cx-quality/components/qa-shared', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return {
    ...real,
    P: {
      queuePage: vi.fn(() => Promise.resolve({})),
      startAudit: vi.fn(() => Promise.resolve({ startedAt: '2025-11-11 09:00' })),
      importNow: vi.fn(),
      passItem: vi.fn(() => new Promise(() => {})),
    },
    Q: vi.fn(),
    useSe: (load: () => unknown) => {
      load()
      return { data: harness.data.current, error: null, reload: () => {} }
    },
    useQaSort: () => ({ s: null, toggle: () => {}, apply: (r: unknown[]) => r }),
  }
})

vi.mock('@/features/cx-quality/components/audit-queue-coverage', () => ({
  AuditEntry: 'audit-entry',
  WeekCoverage: 'week-coverage',
}))

type El = {
  type: unknown
  props: Record<string, unknown> & { children?: unknown }
}

/* Walk every props value (aside/children/row data) — the qa-queue buttons
   sit several table levels below PageShell's children. */
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

/* --- queue page fixture (shape mirrors tests/perf/audit-queue-memo) ----- */
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
    status: 'open',
    passReason: '',
    passedByName: '',
    repeatFails: 0,
    takenByOther: false,
    date: '2025-11-11',
    source: 'sample',
    auditType: null,
  }
}

function fixture() {
  return {
    rows: [queueRow(1), queueRow(2), queueRow(3)],
    requests: [],
    passed: [],
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
    passReasons: ['Already handled'],
    quotaWeeks: [],
  }
}

function renderPage(): El {
  stub.begin()
  const routeEl = (AuditQueueRoute as unknown as (p: { route: { title: string } }) => El)({
    route: { title: 'Audit Desk' },
  })
  return (routeEl.type as (p: Record<string, unknown>) => El)(routeEl.props)
}

const SAMPLE_ROW = {
  queueId: 'q1',
  ticketId: '1001',
  agentName: 'Agent 1',
  source: 'sample',
  auditType: null,
}
const NONTICKET_ROW = { ...SAMPLE_ROW, queueId: 'q9', auditType: 'coaching' }

function renderPass(row: Record<string, unknown>): El {
  stub.begin()
  return PassForm({
    row,
    reasons: ['Already handled'],
    onCancel: () => {},
    onDone: () => {},
  }) as unknown as El
}

const FORM = {
  title: 'Test form',
  formId: 'f1',
  scoring: 'standard',
  sections: [
    {
      id: 's1',
      title: 'Sec',
      optional: false,
      questions: [
        { id: 'q1', text: 'Greeted the customer?', weight: 10 },
        { id: 'q2', text: 'Verified identity?', weight: 5, fatal: true },
      ],
    },
  ],
}

function renderAuditForm(): El {
  stub.begin()
  return AuditForm({
    form: FORM,
    facts: null,
    submitLabel: 'Submit audit',
    onSubmit: async () => ({}),
    onCancel: () => {},
  }) as unknown as El
}

beforeEach(() => {
  stub.reset()
  harness.data.current = fixture()
})

describe('queue-row skip CTA (qa-audit-footer-compact)', () => {
  it('the second row action reads "Skip", not "Pass", and keeps aria-expanded', () => {
    const page = renderPage()
    const toggles = [...walk(page)].filter(
      (e) => e.type === Button && e.props['aria-expanded'] !== undefined
    )
    expect(toggles.length).toBeGreaterThanOrEqual(3)
    for (const b of toggles) {
      expect(b.props['aria-expanded']).toBe(false)
      expect(b.props.children, 'row pass-toggle label must be "Skip"').toBe('Skip')
    }
  })
})

describe('PassForm labels (qa-audit-footer-compact)', () => {
  it('sample branch submit reads "Confirm skip"', () => {
    const root = renderPass(SAMPLE_ROW)
    const submit = [...walk(root)].find(
      (e) => e.type === Button && e.props.type === 'submit'
    )
    expect(submit, 'submit button').toBeTruthy()
    expect(submit!.props.children).toBe('Confirm skip')
  })

  it('sample branch busy label reads "Skipping…"', () => {
    const root = renderPass(SAMPLE_ROW)
    const form = [...walk(root)].find((e) => e.type === 'form')!
    ;(form.props.onSubmit as (e: unknown) => void)({ preventDefault() {} })
    const again = renderPass(SAMPLE_ROW)
    const submit = [...walk(again)].find(
      (e) => e.type === Button && e.props.type === 'submit'
    )!
    expect(submit.props.children).toBe('Skipping…')
  })

  it('non-ticket/off-queue branch still reads "Remove" / "Removing…"', () => {
    const root = renderPass(NONTICKET_ROW)
    const submit = [...walk(root)].find(
      (e) => e.type === Button && e.props.type === 'submit'
    )!
    expect(submit.props.children).toBe('Remove')
    const form = [...walk(root)].find((e) => e.type === 'form')!
    ;(form.props.onSubmit as (e: unknown) => void)({ preventDefault() {} })
    const again = renderPass(NONTICKET_ROW)
    const busy = [...walk(again)].find(
      (e) => e.type === Button && e.props.type === 'submit'
    )!
    expect(busy.props.children).toBe('Removing…')
  })
})

describe('AuditForm compact footer (qa-audit-footer-compact)', () => {
  it('comment textarea declares a compact row count (rows===2)', () => {
    const root = renderAuditForm()
    const ta = [...walk(root)].find(
      (e) => e.type === Textarea && e.props.id === 'qa-comment'
    )
    expect(ta, 'qa-comment textarea').toBeTruthy()
    expect(ta!.props.rows, 'qa-comment must declare rows===2').toBe(2)
  })

  it('footer submit and Cancel render at size="sm"', () => {
    const root = renderAuditForm()
    const foot = [...walk(root)].find(
      (e) => e.props?.className === 'qa-form__foot'
    )
    expect(foot, '.qa-form__foot').toBeTruthy()
    const btns = [...walk(foot)].filter((e) => e.type === Button)
    expect(btns.length).toBe(2)
    for (const b of btns) {
      expect(b.props.size, 'qa-form footer button must be size="sm"').toBe('sm')
    }
  })
})

describe('queue-detail form actions size (ui-label-size-sweep A5)', () => {
  it('PassForm .qa-actions submit + Cancel render at size="sm"', () => {
    const root = renderPass(SAMPLE_ROW)
    const actions = [...walk(root)].find(
      (e) => e.props?.className === 'qa-actions'
    )
    expect(actions, '.qa-actions').toBeTruthy()
    const btns = [...walk(actions)].filter((e) => e.type === Button)
    expect(btns.length).toBe(2)
    for (const b of btns) {
      expect(b.props.size, 'PassForm action button must be size="sm"').toBe('sm')
    }
  })
})
