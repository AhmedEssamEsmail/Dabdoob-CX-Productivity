/**
 * fdActivityExport_ — the Freshdesk ticket_activities export port
 * (Reference_Code.gs fetchDailyActivities): request the export -> pick the
 * download URL (`url` or `export[0].url`) -> poll it unauthed until ready ->
 * return raw `activities_data`. fetch is stubbed; poll sleeps run on fake
 * timers so the ~60s deadline logic stays instant in tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  queue: [] as { status: number; body?: unknown; headers?: Record<string, string> }[],
  calls: [] as { url: string; headers?: Record<string, string> }[],
}))

vi.mock('@/features/shared/platform/settings', () => ({
  getConfig: async () => undefined, // -> the dabdoobapp.freshdesk.com default
  setConfig: async () => undefined,
}))

vi.mock('@/features/shared/platform/repo', () => ({
  db: () => ({ from: () => ({ select: async () => ({ data: [], error: null }) }) }),
  appendRow: async () => undefined,
  cacheGet: () => null,
  cachePut: () => undefined,
}))

import { fdActivityExport_ } from '@/features/shared/jobs/freshdesk'
import { DescribedError } from '@/features/shared/lib/errors'

function fakeRes(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return {
    status,
    json: async () => body,
    headers: { get: (k: string) => headers[k] ?? headers[k.toLowerCase()] ?? null },
  } as unknown as Response
}

const ACT = { performed_at: '02/01/2026 10:00:00', ticket_id: 42, performer_id: 7, performer_type: 'user', activity: {} }

describe('fdActivityExport_', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    h.queue = []
    h.calls = []
    process.env.FRESHDESK_API_KEY = 'test-fd-key'
    vi.stubGlobal('fetch', async (url: unknown, opts?: { headers?: Record<string, string> }) => {
      h.calls.push({ url: String(url), headers: opts?.headers })
      const next = h.queue.shift()
      if (!next) throw new Error('unexpected fetch: ' + String(url))
      return fakeRes(next.status, next.body, next.headers)
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete process.env.FRESHDESK_API_KEY
  })

  it('requests the export then downloads the file URL (unauthed) and returns activities_data', async () => {
    h.queue = [
      { status: 200, body: { url: 'https://dl.example.com/activities.json' } },
      { status: 200, body: { activities_data: [ACT] } },
    ]
    const p = fdActivityExport_('2026-01-02')
    await vi.advanceTimersByTimeAsync(3000)
    await expect(p).resolves.toEqual([ACT])
    expect(h.calls[0].url).toBe('https://dabdoobapp.freshdesk.com/api/v2/export/ticket_activities?created_at=2026-01-02')
    expect(h.calls[0].headers?.Authorization).toMatch(/^Basic /)
    expect(h.calls[1].url).toBe('https://dl.example.com/activities.json')
    expect(h.calls[1].headers?.Authorization).toBeUndefined()
  })

  it("accepts the export[0].url response shape", async () => {
    h.queue = [
      { status: 200, body: { export: [{ url: 'https://dl.example.com/from-export.json' }] } },
      { status: 200, body: { activities_data: [ACT] } },
    ]
    const p = fdActivityExport_('2026-01-02')
    await vi.advanceTimersByTimeAsync(3000)
    await expect(p).resolves.toEqual([ACT])
    expect(h.calls[1].url).toBe('https://dl.example.com/from-export.json')
  })

  it('polls the download URL until the export is ready', async () => {
    h.queue = [
      { status: 200, body: { url: 'https://dl.example.com/slow.json' } },
      { status: 404 }, // still generating
      { status: 200, body: { activities_data: [ACT] } },
    ]
    const p = fdActivityExport_('2026-01-02')
    await vi.advanceTimersByTimeAsync(20000)
    await expect(p).resolves.toEqual([ACT])
    expect(h.calls).toHaveLength(3)
  })

  it('returns [] when the download has no activities_data (legacy tolerance)', async () => {
    h.queue = [
      { status: 200, body: { url: 'https://dl.example.com/empty.json' } },
      { status: 200, body: { some_other_key: true } },
    ]
    const p = fdActivityExport_('2026-01-02')
    await vi.advanceTimersByTimeAsync(3000)
    await expect(p).resolves.toEqual([])
  })

  it('throws DescribedError missing_credentials when FRESHDESK_API_KEY is unset', async () => {
    delete process.env.FRESHDESK_API_KEY
    await expect(fdActivityExport_('2026-01-02')).rejects.toThrowError(DescribedError)
    await expect(fdActivityExport_('2026-01-02')).rejects.toMatchObject({ code: 'missing_credentials' })
    expect(h.calls).toHaveLength(0)
  })
})
