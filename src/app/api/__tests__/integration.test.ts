/**
 * /api/qa/[action] POST dispatcher: parses `{ args: [...] }` (or a bare array,
 * or a malformed body -> args=[]), spreads positional args into the mocked
 * server fn, and 404s on an unknown action. The google.script.run seam means
 * clients always POST a JSON body of positional args.
 *
 * S06-04 appends: GET (?args=<json> | ?arg0=..&arg1=..) parsing and the
 * apiError status-map cases.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  fns: {
    getQaAccess: vi.fn(),
    passQaQueueItem: vi.fn(),
    submitQaAudit: vi.fn(),
  },
}))
vi.mock('@/features/cx-quality/lib/server', () => h.fns)

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/qa/[action]/route'

function post(action: string, body?: string) {
  // The route only calls req.json(), so a plain Request suffices.
  return POST(
    new Request('http://localhost/api/qa/' + action, { method: 'POST', body }) as never,
    { params: Promise.resolve({ action }) }
  )
}

describe('POST /api/qa/[action]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the handler result as JSON with 200', async () => {
    h.fns.getQaAccess.mockResolvedValue({ role: 'qa', canAudit: true })
    const res = await post('getQaAccess', JSON.stringify({ args: [] }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ role: 'qa', canAudit: true })
  })

  it('spreads { args: [...] } into the server fn positionally', async () => {
    h.fns.passQaQueueItem.mockResolvedValue({ ok: true })
    const res = await post('passQaQueueItem', JSON.stringify({ args: ['T-1', 'note'] }))
    expect(res.status).toBe(200)
    expect(h.fns.passQaQueueItem).toHaveBeenCalledWith('T-1', 'note')
  })

  it('accepts a bare-array body the same way', async () => {
    h.fns.passQaQueueItem.mockResolvedValue({ ok: true })
    await post('passQaQueueItem', JSON.stringify(['T-2', 'n2']))
    expect(h.fns.passQaQueueItem).toHaveBeenCalledWith('T-2', 'n2')
  })

  it('answers 404 for an unknown action without calling a handler', async () => {
    const res = await post('bogus', JSON.stringify({ args: [] }))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Unknown QA action "bogus".' })
    expect(h.fns.getQaAccess).not.toHaveBeenCalled()
  })

  it('malformed body -> handler still invoked with args=[]', async () => {
    h.fns.submitQaAudit.mockResolvedValue({ saved: true })
    const res = await post('submitQaAudit', 'not json')
    expect(res.status).toBe(200)
    expect(h.fns.submitQaAudit).toHaveBeenCalledWith({})
  })
})

function get(action: string, query = '') {
  // The route reads req.nextUrl.searchParams, so a real NextRequest is needed.
  return GET(new NextRequest('http://localhost/api/qa/' + action + query), {
    params: Promise.resolve({ action }),
  })
}

describe('GET /api/qa/[action]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses ?args=<json-array> into positional args', async () => {
    h.fns.submitQaAudit.mockResolvedValue({ ok: true })
    const res = await get('submitQaAudit', '?args=' + encodeURIComponent('["t"]'))
    expect(res.status).toBe(200)
    expect(h.fns.submitQaAudit).toHaveBeenCalledWith('t')
  })

  it('wraps a scalar ?args= into a single-element array', async () => {
    h.fns.submitQaAudit.mockResolvedValue({ ok: true })
    await get('submitQaAudit', '?args=42')
    expect(h.fns.submitQaAudit).toHaveBeenCalledWith(42)
  })

  it('assembles ?arg0=..&argN= spread by index', async () => {
    h.fns.passQaQueueItem.mockResolvedValue({ ok: true })
    await get('passQaQueueItem', '?arg0=t&arg1=n')
    expect(h.fns.passQaQueueItem).toHaveBeenCalledWith('t', 'n')
  })
})

describe('apiError status map via the route catch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps Error("Unauthorized") to 401', async () => {
    h.fns.getQaAccess.mockRejectedValue(new Error('Unauthorized'))
    const res = await get('getQaAccess')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('maps the legacy "do not have access" denial to 403', async () => {
    h.fns.getQaAccess.mockRejectedValue(new Error('You do not have access to this page.'))
    const res = await get('getQaAccess')
    expect(res.status).toBe(403)
  })

  it('maps any other thrown Error to 500', async () => {
    h.fns.getQaAccess.mockRejectedValue(new Error('boom'))
    const res = await get('getQaAccess')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'boom' })
  })
})
