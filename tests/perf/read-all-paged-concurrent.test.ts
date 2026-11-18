import { describe, it, expect, vi } from 'vitest'

const TOTAL = 2500
const state = vi.hoisted(() => ({ ranges: [] as number[], inflight: 0, maxInflight: 0, withCount: [] as boolean[] }))

vi.mock('@/features/shared/lib/supabase', () => {
  const from = () => {
    let counted = false
    const b: Record<string, unknown> = {
      select: (_c: string, opts?: { count?: string }) => {
        counted = opts?.count === 'exact'
        state.withCount.push(counted)
        return b
      },
      order: () => b,
      range: async (lo: number, hi: number) => {
        state.ranges.push(lo)
        state.inflight++
        state.maxInflight = Math.max(state.maxInflight, state.inflight)
        await new Promise((r) => setTimeout(r, 5))
        state.inflight--
        const n = Math.max(0, Math.min(hi, TOTAL - 1) - lo + 1)
        return { data: Array.from({ length: n }, (_, i) => ({ id: lo + i })), error: null, count: counted ? TOTAL : null }
      },
    }
    return b
  }
  return { supabase: { from }, createClient: () => ({ from }) }
})
import { readAllPaged } from '@/features/shared/platform/repo'

describe('readAllPaged concurrent paging', () => {
  it('reads the first page with an exact count, then the rest concurrently, in order', async () => {
    const out = await readAllPaged('things')
    expect(out).toHaveLength(TOTAL)
    expect(out.map((r) => r.id)).toEqual(Array.from({ length: TOTAL }, (_, i) => i))
    expect(state.ranges.slice().sort((a, b) => a - b)).toEqual([0, 1000, 2000])
    expect(state.withCount).toEqual([true, false, false])
    expect(state.maxInflight).toBe(2)
  })
})
