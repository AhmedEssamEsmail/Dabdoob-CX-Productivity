import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditForm } from '@/features/cx-quality/components/qa-shared'
import { Seg, Select } from '@/features/shared/components/ui'

/* Regression test for specs/qa-audit-form-ui defect 2:
   every question's Answer control (and the "why it failed" control when
   askReasons + fail) must render as a <Select>, never a Seg radio group —
   Seg inside the width:1% answer cell stacks its options vertically.
   Uses the same no-DOM element-descriptor stub as
   tests/ui/autosave-input.test.tsx. */
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

vi.mock('react', () => stub)

vi.mock('react/jsx-runtime', () => {
  const jsx = (type: unknown, props: unknown, key?: unknown) => ({ type, props, key })
  return { jsx, jsxs: jsx, Fragment: 'fragment' }
})
vi.mock('react/jsx-dev-runtime', () => {
  const jsx = (type: unknown, props: unknown, key?: unknown) => ({ type, props, key })
  return { jsxDEV: jsx, Fragment: 'fragment' }
})

type El = {
  type: unknown
  props: Record<string, unknown> & {
    children?: unknown
    onChange: (v: unknown) => void
  }
}

function* walk(node: unknown): Generator<El> {
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n)
    return
  }
  if (!node || typeof node !== 'object') return
  const el = node as El
  if ('type' in el && 'props' in el) yield el
  const kids = (el.props ?? {}).children
  if (kids && kids !== node) yield* walk(kids)
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

function render(props?: Record<string, unknown>): El {
  stub.begin()
  return AuditForm({
    form: FORM,
    facts: null,
    submitLabel: 'Submit audit',
    onSubmit: async () => ({}),
    onCancel: () => {},
    askReasons: true,
    ...props,
  }) as unknown as El
}

function rows(root: El): El[] {
  return [...walk(root)].filter(
    (e) => e.type === 'tr' && e.props.className === 'qa-q'
  )
}

beforeEach(() => stub.reset())

describe('AuditForm question controls (qa-audit-form-ui)', () => {
  it('renders answers as Select dropdowns, never Seg radios', () => {
    const root = render()
    const segs = [...walk(root)].filter((e) => e.type === Seg)
    expect(segs, 'Seg radio groups must not appear in audit questions').toHaveLength(0)
    const selects = [...walk(root)].filter((e) => e.type === Select)
    // one answer dropdown per question, each named by the question text
    expect(selects.length).toBeGreaterThanOrEqual(2)
    for (const q of FORM.sections[0].questions) {
      const sel = selects.find((e) => e.props['aria-label'] === q.text)
      expect(sel, `answer select for "${q.text}"`).toBeTruthy()
      // unanswered stays unanswered: an empty option must exist
      const opts = [...walk(sel)].filter((e) => e.type === 'option')
      expect(opts.some((e) => e.props.value === '')).toBe(true)
    }
    // fatal question offers Pass/Fail only — no N/A option
    const fatalSel = selects.find(
      (e) => e.props['aria-label'] === 'Verified identity?'
    )!
    const fatalVals = [...walk(fatalSel)]
      .filter((e) => e.type === 'option')
      .map((e) => e.props.value)
    expect(fatalVals).not.toContain('na')
  })

  it('renders the "why it failed" control as a Select after a fail', () => {
    let root = render()
    // flip q1 to fail via its own control, whichever event shape it takes
    const controls = [...walk(root)].filter(
      (e) => e.type === Select || e.type === Seg
    )
    const first = controls[0]
    first.props.onChange({ currentTarget: { value: 'fail' } })
    root = render()
    if (rows(root)[0]?.props['data-answer'] !== 'fail') {
      first.props.onChange('fail')
      root = render()
    }
    expect(rows(root)[0].props['data-answer']).toBe('fail')
    const whySelects = [...walk(root)].filter(
      (e) => e.type === Select && e.props['aria-labelledby'] === 'qa-why-q1'
    )
    expect(
      whySelects,
      '"why it failed" must be a Select labelled by qa-why-q1'
    ).toHaveLength(1)
    const opts = [...walk(whySelects[0])]
      .filter((e) => e.type === 'option')
      .map((e) => e.props.value)
    for (const v of ['agent', 'process', 'product', 'kb'])
      expect(opts).toContain(v)
    expect(opts).toContain('')
  })
})
