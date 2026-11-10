import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePageData } from '@/features/shared/lib/use-page-data'

/* Minimal React stub: useState cells + deps-compared useEffect, no DOM needed.
   setState marks the harness dirty; settle() re-renders until quiescent. */
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
      pending = []
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
    useCallback: <T>(fn: T) => fn,
    runEffects() {
      const fns = pending
      pending = []
      for (const f of fns) f()
      effectCursor = 0
    },
  }
  return api
})

vi.mock('react', () => stub)

type Result = ReturnType<typeof usePageData<unknown>>
let latest: Result
let lastArgs: { key: string | null; loader: () => Promise<unknown>; opts?: Parameters<typeof usePageData>[2] }

function Render() {
  stub.begin()
  const result = usePageData(lastArgs.key, lastArgs.loader, lastArgs.opts) as Result
  stub.runEffects()
  return result
}

function mount(key: string | null, loader: () => Promise<unknown>, opts?: Parameters<typeof usePageData>[2]) {
  lastArgs = { key, loader, opts }
  latest = Render()
  return latest
}

async function settle() {
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 0))
    if (!stub.dirty) return
    stub.dirty = false
    latest = Render()
  }
}

beforeEach(() => stub.reset())

describe('usePageData', () => {
  it('second mount returns cached data immediately and revalidates in background', async () => {
    const loader1 = vi.fn(async () => 'first')
    mount('t-cache', loader1)
    await settle()
    expect(latest.data).toBe('first')
    expect(latest.loading).toBe(false)

    stub.reset()
    const loader2 = vi.fn(async () => 'second')
    mount('t-cache', loader2)
    // cached value is present on the very first render, before any fetch resolves
    expect(latest.data).toBe('first')
    expect(loader2).toHaveBeenCalledTimes(1)

    await settle()
    expect(latest.data).toBe('second')
    expect(loader1).toHaveBeenCalledTimes(1)
    expect(loader2).toHaveBeenCalledTimes(1)
  })

  it('cache:false always fetches and never serves the cache', async () => {
    const loader = vi.fn(async () => 'nocache')
    mount('t-nocache', loader, { cache: false })
    await settle()
    expect(latest.data).toBe('nocache')

    stub.reset()
    const loader2 = vi.fn(async () => 'nocache-2')
    mount('t-nocache', loader2, { cache: false })
    expect(latest.data).toBeNull()
    expect(loader2).toHaveBeenCalledTimes(1)

    await settle()
    expect(latest.data).toBe('nocache-2')
  })

  it('initialData seeds the first render and still revalidates', async () => {
    const loader = vi.fn(async () => 'fresh')
    mount('t-seed', loader, { initialData: 'seed' })
    expect(latest.data).toBe('seed')
    expect(latest.loading).toBe(false)
    expect(loader).toHaveBeenCalledTimes(1)

    await settle()
    expect(latest.data).toBe('fresh')
    expect(latest.loading).toBe(false)
  })

  it('reload re-fires the loader', async () => {
    let n = 0
    const loader = vi.fn(async () => `v${++n}`)
    mount('t-reload', loader)
    await settle()
    expect(latest.data).toBe('v1')

    latest.reload()
    await settle()
    expect(loader).toHaveBeenCalledTimes(2)
    expect(latest.data).toBe('v2')
  })
})
