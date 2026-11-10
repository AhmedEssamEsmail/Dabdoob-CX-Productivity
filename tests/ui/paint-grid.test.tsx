import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  nextGridIndex,
  PaintGrid,
} from '@/features/shared/components/ui/PaintGrid'

/* Minimal React stub (same pattern as tests/ui/autosave-input.test.tsx):
   useState cells + deps-compared useEffect, no DOM needed. The component
   returns a plain element descriptor whose props expose the handlers. */
const stub = vi.hoisted(() => {
  type Cleanup = () => void
  type EffectFn = () => Cleanup | void
  const cells: unknown[] = []
  const slots: Array<{ deps?: unknown[]; cleanup?: Cleanup }> = []
  let cursor = 0
  let effectCursor = 0
  let pending: EffectFn[] = []
  const api = {
    dirty: false,
    reset() {
      cells.length = 0
      slots.length = 0
      pending = []
      api.dirty = false
    },
    begin() {
      cursor = 0
      effectCursor = 0
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
    useEffect(fn: EffectFn, deps?: unknown[]) {
      const i = effectCursor++
      const slot = slots[i] ?? (slots[i] = {})
      const same =
        slot.deps === deps ||
        (!!slot.deps && !!deps && slot.deps.length === deps.length && slot.deps.every((v, j) => Object.is(v, deps[j])))
      if (same) return
      slot.cleanup?.()
      slot.deps = deps
      pending.push(() => {
        slot.cleanup = fn() ?? undefined
      })
    },
    forwardRef(fn: unknown) {
      return fn
    },
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

type El = {
  type: unknown
  props: Record<string, unknown> & {
    onPointerDown: (e: { currentTarget: { focus: () => void } }) => void
    onPointerEnter: () => void
    onPointerUp: () => void
    onKeyDown: (e: {
      key: string
      preventDefault: () => void
      ctrlKey: boolean
      metaKey: boolean
      currentTarget: unknown
    }) => void
  }
}
type Props = Record<string, unknown>

const ROWS = [
  {
    id: 'a@x',
    label: 'Agent A',
    cells: [
      { id: 'a0', label: 'A slot 0' },
      { id: 'a1', label: 'A slot 1' },
    ],
  },
  {
    id: 'b@x',
    label: 'Agent B',
    cells: [
      { id: 'b0', label: 'B slot 0' },
      { id: 'b1', label: 'B slot 1' },
    ],
  },
]

function render(props: Props): El {
  stub.begin()
  const el = (PaintGrid as unknown as (p: Props) => El)(props)
  stub.runEffects()
  return el
}

function settle(props: Props): El {
  let el = render(props)
  for (let i = 0; i < 10 && stub.dirty; i++) {
    stub.dirty = false
    el = render(props)
  }
  return el
}

function flatNodes(nodes: unknown): El[] {
  return (Array.isArray(nodes) ? nodes : [nodes]).flatMap((n) =>
    Array.isArray(n)
      ? flatNodes(n)
      : n && typeof n === 'object' && 'props' in (n as El)
        ? [n as El]
        : []
  )
}

function cellsOf(el: El): El[] {
  const rows = flatNodes(el.props.children).filter(
    (c) => c?.props?.role === 'row'
  )
  return rows.flatMap((row) =>
    flatNodes(row.props.children).filter((c) => c?.props?.role === 'gridcell')
  )
}

beforeEach(() => stub.reset())

describe('nextGridIndex (APG grid model)', () => {
  it('arrows move and wrap across rows', () => {
    expect(nextGridIndex(2, 2, 0, 'ArrowRight')).toBe(1)
    expect(nextGridIndex(2, 2, 1, 'ArrowRight')).toBe(2)
    expect(nextGridIndex(2, 2, 3, 'ArrowRight')).toBe(0)
    expect(nextGridIndex(2, 2, 0, 'ArrowLeft')).toBe(3)
    expect(nextGridIndex(2, 2, 3, 'ArrowLeft')).toBe(2)
  })

  it('Up/Down move rows and clamp at edges', () => {
    expect(nextGridIndex(2, 2, 0, 'ArrowDown')).toBe(2)
    expect(nextGridIndex(2, 2, 2, 'ArrowUp')).toBe(0)
    expect(nextGridIndex(2, 2, 0, 'ArrowUp')).toBe(0)
    expect(nextGridIndex(2, 2, 3, 'ArrowDown')).toBe(3)
  })

  it('Home/End are per-row; Ctrl+Home/End hit grid corners', () => {
    expect(nextGridIndex(2, 2, 3, 'Home')).toBe(2)
    expect(nextGridIndex(2, 2, 0, 'End')).toBe(1)
    expect(nextGridIndex(2, 2, 3, 'Home', { ctrl: true })).toBe(0)
    expect(nextGridIndex(2, 2, 0, 'End', { ctrl: true })).toBe(3)
  })

  it('RTL flips Left/Right; other keys ignored', () => {
    expect(nextGridIndex(2, 2, 0, 'ArrowRight', { rtl: true })).toBe(3)
    expect(nextGridIndex(2, 2, 0, 'ArrowLeft', { rtl: true })).toBe(1)
    expect(nextGridIndex(2, 2, 0, 'Tab')).toBe(-1)
    expect(nextGridIndex(0, 2, 0, 'ArrowRight')).toBe(-1)
  })
})

describe('PaintGrid', () => {
  it('renders role=grid with one tab stop and readonly cells focusable', () => {
    const el = render({ rows: ROWS, readOnly: true, 'aria-label': 'grid' })
    expect(el.props.role).toBe('grid')
    expect(el.props['aria-readonly']).toBe(true)
    expect(el.props['aria-label']).toBe('grid')
    const cells = cellsOf(el)
    expect(cells).toHaveLength(4)
    expect(cells.filter((c) => c.props.tabIndex === 0)).toHaveLength(1)
    expect(cells.every((c) => c.props.tabIndex === 0 || c.props.tabIndex === -1)).toBe(true)
    expect(cells.every((c) => !('disabled' in c.props))).toBe(true)
    expect(cells.every((c) => c.props.role === 'gridcell')).toBe(true)
  })

  it('pointer down focuses + paints, pointer enter continues, up stops', () => {
    const onPaint = vi.fn()
    const props: Props = { rows: ROWS, onPaint, onCommit: vi.fn() }
    let el = render(props)
    const cells = cellsOf(el)
    const focus = vi.fn()
    cells[1].props.onPointerDown({ currentTarget: { focus } })
    expect(focus).toHaveBeenCalledTimes(1)
    expect(onPaint).toHaveBeenCalledTimes(1)
    expect(onPaint).toHaveBeenLastCalledWith('a@x', 1)
    cells[2].props.onPointerEnter()
    expect(onPaint).toHaveBeenLastCalledWith('b@x', 0)
    cells[2].props.onPointerUp()
    cells[3].props.onPointerEnter()
    expect(onPaint).toHaveBeenCalledTimes(2)
    el = settle(props)
    expect(cellsOf(el).map((c) => c.props.tabIndex)).toEqual([-1, 0, -1, -1])
  })

  it('keyboard arrows move the roving tabindex; Enter paints and commits', () => {
    const onPaint = vi.fn()
    const onCommit = vi.fn()
    const props: Props = { rows: ROWS, onPaint, onCommit }
    let el = render(props)
    const key = (e: El, k: string, extra: Record<string, unknown> = {}) =>
      e.props.onKeyDown({
        key: k,
        preventDefault: vi.fn(),
        ctrlKey: false,
        metaKey: false,
        currentTarget: {},
        ...extra,
      })
    key(el, 'ArrowRight')
    el = settle(props)
    expect(cellsOf(el).map((c) => c.props.tabIndex)).toEqual([-1, 0, -1, -1])
    key(el, 'ArrowDown')
    el = settle(props)
    expect(cellsOf(el).map((c) => c.props.tabIndex)).toEqual([-1, -1, -1, 0])
    key(el, 'Enter')
    expect(onPaint).toHaveBeenCalledTimes(1)
    expect(onPaint).toHaveBeenCalledWith('b@x', 1)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('readOnly grid does not paint on pointer or Enter', () => {
    const onPaint = vi.fn()
    const props: Props = { rows: ROWS, readOnly: true, onPaint, onCommit: vi.fn() }
    const el = render(props)
    cellsOf(el)[0].props.onPointerDown({ currentTarget: { focus: vi.fn() } })
    el.props.onKeyDown({
      key: 'Enter',
      preventDefault: vi.fn(),
      ctrlKey: false,
      metaKey: false,
      currentTarget: {},
    })
    expect(onPaint).not.toHaveBeenCalled()
  })

  it('renders a column-header row with columnheader roles and span styles', () => {
    const el = render({
      rows: ROWS,
      cornerLabel: 'Agent',
      columnHeaders: [
        { label: 'Slot A', span: 4 },
        { label: 'Slot B' },
      ],
    })
    const head = flatNodes(el.props.children).find((c) =>
      String(c?.props?.className ?? '').includes('cx-paintgrid-row--head')
    )
    expect(head).toBeTruthy()
    const heads = flatNodes(head!.props.children).filter(
      (c) => c?.props?.role === 'columnheader'
    )
    expect(heads).toHaveLength(3)
    const span4 = heads.find((h) => h.props.children === 'Slot A')
    expect(span4?.props.style).toEqual({ gridColumn: 'span 4' })
    const plain = heads.find((h) => h.props.children === 'Slot B')
    expect(plain?.props.style).toBeUndefined()
    expect(cellsOf(el)).toHaveLength(4)
  })

  it('pointerup after a stroke commits once', () => {
    const onPaint = vi.fn()
    const onCommit = vi.fn()
    const props: Props = { rows: ROWS, onPaint, onCommit }
    const el = render(props)
    const cells = cellsOf(el)
    cells[0].props.onPointerDown({ currentTarget: { focus: vi.fn() } })
    cells[1].props.onPointerEnter()
    cells[2].props.onPointerUp()
    el.props.onPointerUp()
    expect(onCommit).toHaveBeenCalledTimes(1)
  })
})
