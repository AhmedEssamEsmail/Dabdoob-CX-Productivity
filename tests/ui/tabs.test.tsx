import { describe, expect, it } from 'vitest'
import { nextTabIndex } from '@/features/shared/components/ui/Tabs'

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
