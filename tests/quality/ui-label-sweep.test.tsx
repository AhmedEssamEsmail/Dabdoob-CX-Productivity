import { beforeEach, describe, expect, it, vi } from 'vitest'
import DisputesPage from '@/features/cx-quality/components/disputes-page'
import MyAuditsPage from '@/features/cx-quality/components/my-audits-page'
import MailDeskPage from '@/features/cx-desk/components/mail-desk-page'
import { If } from '@/features/cx-hub/components/hub-shared'
import { Button, Seg } from '@/features/shared/components/ui'

/* Regression spec for specs/ui-label-size-sweep S04-S06 pinned fixes
   (fix-qa-2 leaf qa2-01):
   1. disputes DecisionForm Seg options keep the pinned labels
      ("Uphold dispute: void the audit" / "re-score" / "Reject dispute";
      "Not aligned: escalate to <owner>" only when canEscalate).
   2. my-audits submitted-CTL deny toggle reads "Deny: it did not happen"
      at size="sm".
   3. mail-desk ApprovalCard actions "Approve" / "Reject" /
      "Send reply only" each render at size="sm".
   4. hub-shared If jump button keeps the pinned aria-label template
      `Jump to up next (Now|Next: <at>)`.
   No-DOM element-descriptor harness copied from
   tests/quality/qa-audit-footer-compact.test.tsx: internal components are
   found as {type, props} descriptors and invoked directly; data reaches
   pages only through the qa-shared/use-page-data module seams. */
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
  qa: { current: null as unknown },
  mail: { current: null as unknown },
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

/* Keep every real qa-shared export (QaPage, chips, AuditFails, qaPct…) and
   only seam the data layer: useSe feeds the fixture, P.* are spies so the
   pages render without fetch. */
vi.mock('@/features/cx-quality/components/qa-shared', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return {
    ...real,
    P: {
      disputesPage: vi.fn(() => Promise.resolve({})),
      decideDispute: vi.fn(() => Promise.resolve({})),
      myAuditsPage: vi.fn(() => Promise.resolve({})),
      confirmCtl: vi.fn(() => Promise.resolve({})),
    },
    Q: vi.fn(),
    useSe: (load: () => unknown) => {
      load()
      return { data: harness.qa.current, error: null, reload: () => {} }
    },
  }
})

/* mail-desk (and hub-shared, which we only partially render) load through
   usePageData — feed the mail fixture from here, never a real fetch. */
vi.mock('@/features/shared/lib/use-page-data', () => ({
  usePageData: () => ({
    data: harness.mail.current,
    setData: vi.fn(),
    error: '',
    loading: false,
    reload: vi.fn(),
  }),
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

/* One-level render: invoke a component descriptor and return its subtree. */
function mount(el: El): El {
  stub.begin()
  return (el.type as (p: Record<string, unknown>) => El)(el.props)
}

/* --- fixtures --------------------------------------------------------- */
function disputeRow() {
  return {
    disputeId: 'd1',
    status: 'open',
    oldScore: 80,
    agentName: 'Agent One',
    auditorName: 'Auditor',
    raisedByName: 'Team Lead',
    raisedAt: '2025-11-11T08:00',
    reason: 'the marks were wrong',
    audit: null,
    escalatedByName: '',
    escalatedAt: '2025-11-11T08:00',
    escalationNote: '',
  }
}

function disputesFixture(isOwner: boolean) {
  return {
    rows: [disputeRow()],
    auditors: [],
    month: 'Nov 2025',
    target: 5,
    ownerName: 'Owner Name',
    isOwner,
    ticketUrl: 'https://x',
  }
}

function auditWithSubmittedCtl() {
  return {
    auditId: 'a1',
    status: 'done',
    score: 80,
    finalScore: 80,
    fatal: false,
    ticketId: 1234,
    channel: 'chat',
    auditDate: '2025-11-10',
    auditorName: 'Auditor',
    ctl: {
      ctlId: 'c1',
      status: 'submitted',
      tlName: 'Team Lead',
      action: 'Coached',
      notes: 'went through it',
      outcome: '',
    },
  }
}

function waitingApproval() {
  return {
    threadId: 't1',
    gmailUrl: 'https://mail',
    type: 'refund',
    orderId: 'O-1',
    mobile: '999',
    requester: 'r@x',
    requesterName: 'Requester',
    replyTo: '',
    cc: '',
    excerpt: '',
    receivedAt: '2025-11-11T08:00',
    status: 'pending',
    stuck: false,
    decision: '',
    decisionText: '',
    decidedBy: '',
    decidedAt: '',
    sentStatus: '',
  }
}

function mailFixture() {
  return {
    isApprover: true,
    dryRun: false,
    asOf: '2025-11-11T08:00',
    sla: [],
    approvals: [waitingApproval()],
  }
}

/* --- renders ---------------------------------------------------------- */
function renderDisputes(): El {
  stub.begin()
  const routeEl = (DisputesPage as unknown as (p: { route: { title: string } }) => El)({
    route: { title: 'Disputes' },
  })
  return mount(routeEl) // QaPage -> PageShell descriptor
}

function renderMyAudits(): El {
  stub.begin()
  const routeEl = (MyAuditsPage as unknown as (p: { route: { title: string } }) => El)({
    route: { title: 'My audits' },
  })
  return mount(routeEl)
}

function renderMailDesk(): El {
  stub.begin()
  const shellEl = (MailDeskPage as unknown as () => El)()
  return mount(shellEl) // internal Shell -> PageShell descriptor
}

/* Internal components surface as {type: fn, props} descriptors inside the
   page tree — find by a distinctive prop, then mount. */
function mountDecisionForm(page: El): El {
  const el = [...walk(page)].find(
    (e) => typeof e.type === 'function' && e.props.disputeId !== undefined
  )
  expect(el, 'DecisionForm descriptor').toBeTruthy()
  return mount(el!)
}

function mountAuditCard(page: El): El {
  const el = [...walk(page)].find(
    (e) =>
      typeof e.type === 'function' &&
      (e.props.a as Record<string, unknown> | undefined)?.auditId !== undefined
  )
  expect(el, 'AuditCard descriptor').toBeTruthy()
  return mount(el!)
}

function mountApprovalCard(page: El): El {
  const el = [...walk(page)].find(
    (e) =>
      typeof e.type === 'function' &&
      (e.props.a as Record<string, unknown> | undefined)?.threadId !== undefined &&
      'dryRun' in e.props
  )
  expect(el, 'ApprovalCard descriptor').toBeTruthy()
  return mount(el!)
}

beforeEach(() => {
  stub.reset()
  harness.qa.current = null
  harness.mail.current = mailFixture()
})

describe('disputes DecisionForm pinned Seg labels (S04)', () => {
  it('meeting-outcome options are exactly the three pinned labels when escalation is not offered', () => {
    harness.qa.current = disputesFixture(true)
    const form = mountDecisionForm(renderDisputes())
    const seg = [...walk(form)].find((e) => e.type === Seg)
    expect(seg, 'Meeting outcome Seg').toBeTruthy()
    const labels = (seg!.props.options as { value: string; label: string }[]).map(
      (o) => o.label
    )
    expect(labels).toEqual([
      'Uphold dispute: void the audit',
      'Uphold dispute: re-score',
      'Reject dispute',
    ])
  })

  it('a fourth "Not aligned: escalate to <owner>" option is pushed only when canEscalate', () => {
    harness.qa.current = disputesFixture(false)
    const form = mountDecisionForm(renderDisputes())
    const seg = [...walk(form)].find((e) => e.type === Seg)!
    const labels = (seg.props.options as { value: string; label: string }[]).map(
      (o) => o.label
    )
    expect(labels).toEqual([
      'Uphold dispute: void the audit',
      'Uphold dispute: re-score',
      'Reject dispute',
      'Not aligned: escalate to Owner Name',
    ])
  })
})

describe('my-audits submitted-CTL deny toggle (S04/S05)', () => {
  it('reads "Deny: it did not happen" and renders at size="sm"', () => {
    harness.qa.current = { audits: [auditWithSubmittedCtl()], average: 90 }
    const card = mountAuditCard(renderMyAudits())
    const deny = [...walk(card)].find(
      (e) => e.type === Button && e.props.children === 'Deny: it did not happen'
    )
    expect(deny, 'deny toggle button').toBeTruthy()
    expect(deny!.props.size, 'deny toggle must be size="sm"').toBe('sm')
  })
})

describe('mail-desk ApprovalCard action sizes (S05)', () => {
  it('Approve / Reject / Send reply only each render at size="sm"', () => {
    const card = mountApprovalCard(renderMailDesk())
    const actions = [...walk(card)].find(
      (e) => e.props?.className === 'md-actions'
    )
    expect(actions, '.md-actions').toBeTruthy()
    const btns = [...walk(actions)].filter((e) => e.type === Button)
    expect(btns.map((b) => b.props.children)).toEqual([
      'Approve',
      'Reject',
      'Send reply only',
    ])
    for (const b of btns) {
      expect(b.props.size, `${String(b.props.children)} must be size="sm"`).toBe('sm')
    }
  })
})

describe('hub-shared If up-next jump aria-label (S04)', () => {
  it('live item: aria-label reads "Jump to up next (Now: <at>)"', () => {
    stub.begin()
    const el = (If as unknown as (p: { item: { at: string; title: string; live: boolean } }) => El)({
      item: { at: '09:30', title: 'Shift handover', live: true },
    })
    expect(el.type).toBe(Button)
    expect(el.props['aria-label']).toBe('Jump to up next (Now: 09:30)')
    const kids = el.props.children
    expect(Array.isArray(kids) ? kids[0] : kids).toBe('Now')
  })

  it('non-live item: aria-label reads "Jump to up next (Next: <at>)"', () => {
    stub.begin()
    const el = (If as unknown as (p: { item: { at: string; title: string; live: boolean } }) => El)({
      item: { at: '14:00', title: 'Calibration', live: false },
    })
    expect(el.type).toBe(Button)
    expect(el.props['aria-label']).toBe('Jump to up next (Next: 14:00)')
    const kids = el.props.children
    expect(Array.isArray(kids) ? kids[0] : kids).toBe('Next')
  })
})
