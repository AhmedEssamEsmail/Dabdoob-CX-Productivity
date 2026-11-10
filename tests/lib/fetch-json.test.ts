import { afterEach, describe, expect, it, vi } from 'vitest'
import { FetchError, fetchJson, postJson } from '@/features/shared/lib/fetch-json'

afterEach(() => vi.unstubAllGlobals())

function stubFetch(res: { ok: boolean; status?: number; json?: unknown }) {
  const spy = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: res.ok,
    status: res.status ?? (res.ok ? 200 : 500),
    json: async () => res.json ?? {},
  }))
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('fetchJson', () => {
  it('throws FetchError carrying the url on !ok', async () => {
    stubFetch({ ok: false, json: { error: 'boom' } })
    const err = await fetchJson('/api/x').catch((e) => e)
    expect(err).toBeInstanceOf(FetchError)
    expect(err.message).toBe('boom')
    expect(err.url).toBe('/api/x')
  })

  it('falls back to "Request failed" when no error body', async () => {
    stubFetch({ ok: false, json: {} })
    const err = await fetchJson('/api/y').catch((e) => e)
    expect(err).toBeInstanceOf(FetchError)
    expect(err.message).toBe('Request failed')
  })

  it('returns parsed json on ok', async () => {
    stubFetch({ ok: true, json: { rows: [1] } })
    await expect(fetchJson('/api/z')).resolves.toEqual({ rows: [1] })
  })
})

describe('postJson', () => {
  it('serializes body, sets POST + content-type, returns fetchJson result', async () => {
    const spy = stubFetch({ ok: true, json: { ok: true } })
    const body = { a: 1, b: 'x' }
    await expect(postJson('/api/p', body)).resolves.toEqual({ ok: true })
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe('/api/p')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify(body))
    expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json')
  })

  it('lets init override method/headers', async () => {
    const spy = stubFetch({ ok: true, json: {} })
    await postJson('/api/q', {}, { method: 'PUT', headers: { 'content-type': 'text/plain' } })
    const init = spy.mock.calls[0][1]
    expect(init?.method).toBe('PUT')
    expect((init?.headers as Record<string, string>)['content-type']).toBe('text/plain')
  })
})
