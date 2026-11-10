import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadOptions } from '@/features/shared/lib/use-options'

afterEach(() => vi.unstubAllGlobals())

function stubOptionsFetch(options: string[]) {
  const spy = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ options }),
  }))
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('loadOptions', () => {
  it('dedups concurrent callers into one fetch', async () => {
    const spy = stubOptionsFetch(['a', 'b'])
    const [x, y] = await Promise.all([loadOptions('dedup-key'), loadOptions('dedup-key')])
    expect(spy).toHaveBeenCalledTimes(1)
    expect(x).toEqual(['a', 'b'])
    expect(y).toEqual(['a', 'b'])
  })

  it('serves a second call from the session cache', async () => {
    const spy = stubOptionsFetch(['c'])
    await loadOptions('cache-key')
    await expect(loadOptions('cache-key')).resolves.toEqual(['c'])
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not cache failures — a later call retries', async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'nope' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ options: ['d'] }) })
    vi.stubGlobal('fetch', spy)
    await expect(loadOptions('fail-key')).rejects.toThrow('nope')
    await expect(loadOptions('fail-key')).resolves.toEqual(['d'])
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
