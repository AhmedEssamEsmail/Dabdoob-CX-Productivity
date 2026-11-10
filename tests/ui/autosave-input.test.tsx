import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AutoSaveInput } from '@/features/shared/components/ui/AutoSaveInput'

/* Minimal React stub (same pattern as tests/lib/use-page-data.test.ts):
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
  props: Record<string, unknown> & {
    onFocus: (e: unknown) => void
    onChange: (e: { target: { value: string } }) => void
    onBlur: (e: unknown) => void
    onKeyDown: (e: { key: string; preventDefault: () => void }) => void
  }
}
type Props = Record<string, unknown>

function render(props: Props): El {
  stub.begin()
  const el = (AutoSaveInput as unknown as (p: Props) => El)(props)
  stub.runEffects()
  return el
}

/* Re-render until effect-triggered setState quiesces; returns latest element. */
function settle(props: Props): El {
  let el = render(props)
  for (let i = 0; i < 10 && stub.dirty; i++) {
    stub.dirty = false
    el = render(props)
  }
  return el
}

beforeEach(() => stub.reset())

describe('AutoSaveInput', () => {
  it('does not commit per keystroke; blur commits once', () => {
    const onCommit = vi.fn()
    const props: Props = { value: '1', onCommit }
    let el = render(props)
    el.props.onFocus({})
    el = render(props)
    el.props.onChange({ target: { value: '12' } })
    el = settle(props)
    expect(el.props.value).toBe('12')
    expect(onCommit).not.toHaveBeenCalled()
    el.props.onBlur({})
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('12')
    // a second blur with the same draft must not re-commit
    settle(props).props.onBlur({})
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('Enter commits and keeps focus (preventDefault)', () => {
    const onCommit = vi.fn()
    const props: Props = { value: '1', onCommit }
    let el = render(props)
    el.props.onFocus({})
    el = render(props)
    el.props.onChange({ target: { value: '7' } })
    el = settle(props)
    const preventDefault = vi.fn()
    el.props.onKeyDown({ key: 'Enter', preventDefault })
    expect(preventDefault).toHaveBeenCalled()
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('7')
  })

  it('Escape reverts the draft without committing', () => {
    const onCommit = vi.fn()
    const props: Props = { value: '1', onCommit }
    let el = render(props)
    el.props.onFocus({})
    el = render(props)
    el.props.onChange({ target: { value: '9' } })
    el = settle(props)
    el.props.onKeyDown({ key: 'Escape', preventDefault: vi.fn() })
    el = settle(props)
    expect(el.props.value).toBe('1')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('external value update resets draft when unfocused', () => {
    const onCommit = vi.fn()
    const props: Props = { value: '1', onCommit }
    let el = render(props)
    el.props.onFocus({})
    el = render(props)
    el.props.onChange({ target: { value: '12' } })
    el = settle(props)
    el.props.onBlur({})
    // server value arrives -> draft clears, external value shows
    let el2 = settle({ value: '12', onCommit })
    expect(el2.props.value).toBe('12')
    // a further external change while unfocused resets to the new value
    el2 = settle({ value: '99', onCommit })
    expect(el2.props.value).toBe('99')
    void el
  })

  it('debounceMs commits after the delay without blur', () => {
    vi.useFakeTimers()
    try {
      const onCommit = vi.fn()
      const props: Props = { value: '1', onCommit, debounceMs: 400 }
      let el = render(props)
      el.props.onChange({ target: { value: '55' } })
      el = settle(props)
      expect(onCommit).not.toHaveBeenCalled()
      vi.advanceTimersByTime(400)
      expect(onCommit).toHaveBeenCalledTimes(1)
      expect(onCommit).toHaveBeenCalledWith('55')
    } finally {
      vi.useRealTimers()
    }
  })

  it('exposes isSaving marker', () => {
    const el = render({ value: '1', onCommit: vi.fn(), isSaving: true })
    expect(el.props['data-saving']).toBe('true')
    expect(el.props['aria-busy']).toBe(true)
  })
})
