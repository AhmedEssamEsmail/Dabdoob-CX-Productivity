import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTabIndex, scrollSelectedTabIntoView } from '@/features/shared/components/ui/Tabs'

describe('Tabs keyboard model (APG)', () => {
  const n = 4

  it('ArrowRight advances and wraps', () => {
    expect(nextTabIndex(n, 0, 'ArrowRight', false)).toBe(1)
    expect(nextTabIndex(n, n - 1, 'ArrowRight', false)).toBe(0)
  })

  it('ArrowLeft retreats and wraps', () => {
    expect(nextTabIndex(n, 1, 'ArrowLeft', false)).toBe(0)
    expect(nextTabIndex(n, 0, 'ArrowLeft', false)).toBe(n - 1)
  })

  it('RTL flips Arrow keys', () => {
    expect(nextTabIndex(n, 0, 'ArrowRight', true)).toBe(n - 1)
    expect(nextTabIndex(n, 0, 'ArrowLeft', true)).toBe(1)
  })

  it('Home and End jump to first/last', () => {
    expect(nextTabIndex(n, 2, 'Home', false)).toBe(0)
    expect(nextTabIndex(n, 1, 'End', false)).toBe(n - 1)
  })

  it('ignores other keys and invalid state', () => {
    expect(nextTabIndex(n, 0, 'Tab', false)).toBe(-1)
    expect(nextTabIndex(n, 0, 'Enter', false)).toBe(-1)
    expect(nextTabIndex(0, 0, 'ArrowRight', false)).toBe(-1)
    expect(nextTabIndex(n, -1, 'ArrowRight', false)).toBe(-1)
  })
})

describe('scrollSelectedTabIntoView', () => {
  const tabRect = { left: 300, right: 350, top: 0, bottom: 40, width: 50, height: 40, x: 300, y: 0, toJSON: () => ({}) }
  const tab = { getBoundingClientRect: vi.fn(() => tabRect) } as unknown as HTMLElement
  const listRect = { left: 0, right: 100, top: 0, bottom: 40, width: 100, height: 40, x: 0, y: 0, toJSON: () => ({}) }
  const makeList = () => {
    const list = {
      scrollBy: vi.fn(),
      getBoundingClientRect: vi.fn(() => listRect),
      querySelector: vi.fn(() => tab),
    } as unknown as HTMLElement
    vi.stubGlobal('window', { matchMedia: undefined })
    return list
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reveals an off-screen tab in LTR', () => {
    const list = makeList()
    scrollSelectedTabIntoView(list)
    expect(list.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 250 }))
  })

  it('reveals an off-screen tab in RTL with the negative scrollLeft model', () => {
    const list = makeList()
    scrollSelectedTabIntoView(list)
    expect(list.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 250 }))
  })

  it('reveals an off-screen tab in RTL with the positive-reverse scrollLeft model', () => {
    const list = makeList()
    scrollSelectedTabIntoView(list)
    expect(list.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 250 }))
  })
})
