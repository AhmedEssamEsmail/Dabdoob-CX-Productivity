/**
 * vendor-apis.ts — API object -> mirror `cols` mappers, plus the readers'
 * end-to-end acceptance of API-shaped rows (the DD-MM/MM-DD sheet misparse
 * cannot recur: timestamps are emitted as ISO instants).
 */
import { describe, expect, it } from 'vitest'
import { epochMs } from '@/lib/vendor/http'
import { maqsamBase } from '@/lib/vendor/maqsam'
import { freshchatBase } from '@/lib/vendor/freshchat'
import { fetchFreshchatRows, fetchMaqsamRows, freshchatConvToCols, maqsamCallToCols } from '@/lib/jobs/vendor-apis'
import { DescribedError } from '@/lib/errors'
import { tphCallMinutesFromRows_, tphChatCases_ } from '@/lib/tph'

describe('maqsamBase / freshchatBase', () => {
  it('normalizes domain spellings to the API host', () => {
    expect(maqsamBase('dabdoob')).toBe('api.dabdoob.maqsam.com/v2')
    expect(maqsamBase('dabdoob.maqsam.com')).toBe('api.dabdoob.maqsam.com/v2')
    expect(maqsamBase('api.dabdoob.maqsam.com')).toBe('api.dabdoob.maqsam.com/v2')
    expect(maqsamBase('https://api.dabdoob.maqsam.com/v2/')).toBe('api.dabdoob.maqsam.com/v2')
    expect(freshchatBase('dabdoob')).toBe('dabdoob.freshchat.com/v2')
    expect(freshchatBase('dabdoob.freshchat.com')).toBe('dabdoob.freshchat.com/v2')
    expect(freshchatBase('https://dabdoob.freshchat.com/v2')).toBe('dabdoob.freshchat.com/v2')
  })
})

describe('epochMs', () => {
  it('accepts seconds and milliseconds', () => {
    expect(epochMs(1793652000)).toBe(1793652000000)
    expect(epochMs(1793652000000)).toBe(1793652000000)
    expect(epochMs('1793652000')).toBe(1793652000000)
    expect(epochMs(0)).toBe(0)
    expect(epochMs('')).toBe(0)
    expect(epochMs(undefined)).toBe(0)
  })
})

describe('maqsamCallToCols', () => {
  it('maps a call to the sheet D..J cell shape with ISO timestamps', () => {
    // Documented v2 shape: timestamp (unix), agents[{email}], duration,
    // handlingTime — end = timestamp + duration when no explicit end_time.
    const cols = maqsamCallToCols({
      id: '348615800',
      agents: [{ identifier: 'a1', email: 'Maria.Mamdouh@Dabdoob.com' }],
      state: 'serviced',
      direction: 'inbound',
      timestamp: 1793652600, // 2026-10-31T23:30:00Z — epoch seconds
      duration: 200,
      handlingTime: 165, // seconds -> 0.0019097222 days
    })!
    expect(cols).toHaveLength(7)
    expect(cols[0]).toBe('2026-11-02T20:50:00.000Z')
    expect(cols[1]).toBe('2026-11-02T20:53:20.000Z')
    expect(cols[3]).toBe('maria.mamdouh@dabdoob.com')
    expect(cols[4]).toBe('serviced')
    expect(cols[5]).toBe('inbound')
    expect(cols[6]).toBe(String(165 / 86400))
    expect(maqsamCallToCols({ agent_email: 'x@y' })).toBeNull() // no start -> skip
  })

  it('tphCallMinutesFromRows_ attributes an API call to the right date+hour', () => {
    // A Nov-5 14:00 Kuwait call — under the old DD-MM sheet format ('05-11-2026')
    // this mis-attributed to May-11. As ISO it cannot.
    const cols = maqsamCallToCols({
      agent_email: 'maria.mamdouh@dabdoob.com',
      state: 'serviced',
      direction: 'inbound',
      start_time: Date.UTC(2026, 10, 5, 11, 0, 0) / 1000, // 14:00 Asia/Kuwait
      total_handling_time: 600, // 10 min
    })!
    const got = tphCallMinutesFromRows_(
      [cols],
      ['2026-11-05'],
      { 'maria.mamdouh@dabdoob.com': true },
      ['serviced'],
      'Asia/Kuwait',
      'Asia/Kuwait',
      55
    )
    expect(Object.keys(got)).toEqual(['2026-11-05'])
    expect(got['2026-11-05']['maria.mamdouh@dabdoob.com|14']).toEqual([10, 10])
    // non-inbound / non-serviced calls are filtered by the reader
    const outbound = maqsamCallToCols({
      agent_email: 'maria.mamdouh@dabdoob.com', state: 'completed', direction: 'outbound',
      start_time: Date.UTC(2026, 10, 5, 12, 0, 0) / 1000,
    })!
    const none = tphCallMinutesFromRows_([outbound], ['2026-11-05'], { 'maria.mamdouh@dabdoob.com': true }, ['serviced'], 'Asia/Kuwait', 'Asia/Kuwait', 55)
    expect(none).toEqual({})
  })
})

describe('freshchatConvToCols', () => {
  it('maps a resolved conversation to the sheet A..G shape', () => {
    const cols = freshchatConvToCols({
      conversation_id: 'f84fb3b0-756a-4e35-8e2e-cc851499017b',
      created_time: 1793405292,
      updated_time: 1793405667,
      resolved_time: 1793405667,
      status: 'resolved',
      channel_id: 'IG_dabdoobapp',
    })!
    expect(cols).toHaveLength(7)
    expect(cols[0]).toBe('2026-10-31T00:08:12.000Z')
    expect(cols[1]).toBe('AGENT_RESOLVE')
    expect(cols[2]).toBe('f84fb3b0-756a-4e35-8e2e-cc851499017b-1793405292000')
    expect(cols[4]).toBe('2026-10-31T00:14:27.000Z')
    expect(cols[5]).toBe('IG_dabdoobapp')
    expect(cols[6]).toBe('f84fb3b0-756a-4e35-8e2e-cc851499017b')
  })

  it('open conversations carry a blank status marker', () => {
    const cols = freshchatConvToCols({
      conversation_id: 'abc', created_time: 1793405292, updated_time: 1793405400, status: 'assigned',
    })!
    expect(cols[1]).toBe('')
    expect(cols[4]).toBe('')
  })

  it('tphChatCases_ counts API-shaped conversations as stock/new', () => {
    const stock = freshchatConvToCols({
      conversation_id: 'conv-open', created_time: Date.UTC(2026, 9, 8, 6, 0, 0) / 1000, // 09:00 KWT, still open
      updated_time: Date.UTC(2026, 9, 8, 6, 30, 0) / 1000, status: 'assigned',
    })!
    const fresh = freshchatConvToCols({
      conversation_id: 'conv-resolved', created_time: Date.UTC(2026, 9, 8, 7, 0, 0) / 1000, // 10:00 KWT
      updated_time: Date.UTC(2026, 9, 8, 7, 45, 0) / 1000, resolved_time: Date.UTC(2026, 9, 8, 7, 45, 0) / 1000,
      status: 'resolved',
    })!
    const got = tphChatCases_([stock, fresh], '2026-10-08', [9, 10, 11], 'Asia/Kuwait', 'Asia/Kuwait')
    expect(got.cells).not.toBeNull()
    expect(got.cells![9]).toEqual({ stock: 0, new: 1 }) // conv-open initiated at 09:xx -> new inside its own hour
    expect(got.cells![10]).toEqual({ stock: 1, new: 1 }) // still-open stock + the resolved-45-min one
    expect(got.cells![11]).toEqual({ stock: 1, new: 0 }) // conv-open still open past 11:30
  })
})

describe('missing credentials', () => {
  it('fetchMaqsamRows / fetchFreshchatRows fail loudly naming the env vars', async () => {
    delete process.env.MAQSAM_API_KEY
    delete process.env.MAQSAM_API_SECRET
    delete process.env.MAQSAM_DOMAIN
    delete process.env.FRESHCHAT_API_KEY
    delete process.env.FRESHCHAT_DOMAIN
    await expect(fetchMaqsamRows()).rejects.toThrowError(DescribedError)
    await expect(fetchMaqsamRows()).rejects.toThrowError(/MAQSAM_API_KEY/)
    await expect(fetchFreshchatRows()).rejects.toThrowError(/FRESHCHAT_API_KEY/)
  })
})
