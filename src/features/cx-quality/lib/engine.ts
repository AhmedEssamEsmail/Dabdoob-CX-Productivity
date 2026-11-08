/**
 * Queue engine pure functions — port of Quality_deprecated/QaEngine.js
 * (constants, wall clock, settings layer, dates, and the selection engine).
 * Sheet/Freshdesk reads become arguments. Names keep the legacy trailing
 * underscore so the golden oracle maps 1:1.
 */

import 'server-only'

export const QE_SOURCE_SS_ID = '1VtBT8kIIhK7PxKYJJQlnhxNtmz17ewhkWtpUt8jiB4s'
export const QE_OLD_DATA_SS_ID = '1ArWBreAPYAmFX4qnWd1jw3OQ2s8MLvJpqp5024gWjYY'
export const QE_TZ = 'Asia/Riyadh'
export const QE_TZ_OFFSET_MS = 3 * 3600000

export const QE_MAX_TOUCH_ROWS = 60000
export const QE_CHUNK_ROWS = 20000
export const QE_DETAIL_BLOCK_ROWS = 2000

export const QE_FD_PAGE_SIZE = 100
export const QE_FD_MAX_PAGES = 200
export const QE_FD_TIME_BUDGET_MS = 240000
export const QE_FD_MAX_LOOKBACK_DAYS = 30
export const QE_FD_CACHE_KEEP_DAYS = 30

export const QE_PROP_FD_DOMAIN = 'QQ_FD_DOMAIN'
export const QE_PROP_FD_KEY = 'QQ_FD_KEY'
export const QE_PROP_BUILD_RETRIES = 'QE_BUILD_RETRIES'

export const QE_BUILD_RETRY_HOURS = 3
export const QE_BUILD_MAX_RETRIES = 3

export const QE_SH_LOG = 'Queue Log'
export const QE_SH_CATALOGUE = 'Catalogue'
export const QE_SH_BUILDS = 'Build Log'
export const QE_SH_FD_CACHE = 'Ticket Detail Cache'

export const QE_LOG_HEADERS = [
  'Key', 'Queued Date', 'ISO Week', 'Slot', 'Agent', 'Channel',
  'Group', 'Contact Type', 'Tier', 'Ticket ID', 'Subject',
  'Country', 'Status', 'Last Touch', 'Touches', 'State',
  'Audited At', 'Audited By',
  'Interaction', 'Agent Status', 'Passed To',
  'Agent Email', 'Agent FD ID',
  'Action Time', 'Agent Status Log', 'Pass Reason',
]
export const QE_LOG_TEXT_COLS = ['Queued Date', 'Last Touch', 'Audited At', 'Interaction', 'Action Time']
export const QE_STATUS_LOG_MAX = 8

export const QE_FD_STATUS_NAMES: Record<string, string> = {
  '2': 'Open', '3': 'Pending', '4': 'Resolved', '5': 'Closed', '6': 'Waiting on Customer', '7': 'Pending on CX',
  '8': 'Pending on Ops', '9': 'No Response From customer', '10': 'Pending on 3PL',
}

export const QE_SH_CANDIDATES = 'Candidates'
export const QE_CANDIDATE_HEADERS = ['Queued Date', 'Agent', 'Candidates']
export const QE_CANDIDATES_PER_AGENT = 60

export const QE_SH_OUTCOMES = 'Build Outcomes'
export const QE_OUTCOME_HEADERS = ['Queued Date', 'Ran At', 'Mode', 'Outcomes']
export const QE_OUTCOME_MAX_CHARS = 45000

export const QE_LOG_COL: Record<string, number> = (() => {
  const m: Record<string, number> = {}
  for (let i = 0; i < QE_LOG_HEADERS.length; i++) m[QE_LOG_HEADERS[i]] = i
  return m
})()

export const QE_CATALOGUE_HEADERS = ['Kind', 'Value', 'Times Seen', 'Last Seen']
export const QE_BUILD_HEADERS = ['Ran At', 'By', 'Mode', 'Agents', 'Queued', 'Pool', 'Eligible', 'Notes']
export const QE_FD_CACHE_HEADERS = [
  'ID', 'Group Name', 'Contact Type 1', 'Contact Type 2',
  'Contact Type 3', 'Subject', 'Status', 'Country',
  'Order ID', 'Channel', 'Source', 'Created At', 'Cached At',
]

// ---------------------------------------------------------------- wall clock in Asia/Riyadh

export function qeLocal_(y: number, mo: number, d: number, h?: number, mi?: number, s?: number): Date {
  return new Date(Date.UTC(y, mo, d, h || 0, mi || 0, s || 0) - QE_TZ_OFFSET_MS)
}

/** Wall-clock parts of an instant in QE_TZ. */
export function qeWall_(date: Date): { y: number; m: number; d: number; dow: number; h: number } {
  const t = new Date(date.getTime() + QE_TZ_OFFSET_MS)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), dow: t.getUTCDay(), h: t.getUTCHours() }
}

// ---------------------------------------------------------------- default settings (verbatim)

export function qeDefaultSettings_(): Record<string, unknown> {
  return {
    auditsPerWeek: 20,
    auditsPerDay: 4,
    offerMultiplier: 1.5,
    lookbackDays: 3,
    maxWindowShiftDays: 4,
    weekStartsOn: 0,
    minTouches: 3,
    scoresStartDate: '2026-06-01',
    scoresLookbackDays: 180,
    autoMarkFromBackend: true,
    reofferExpired: true,
    scoresMinAudits: 10,
    requireCustomerFacing: true,
    actionPlan: { agents: [], perDay: 6, perWeek: 30 },
    channelGroups: {
      'Inbound Calls': ['Inbound Calls Documentation'],
      'Waiting Address': ['Waiting Address', 'Unreachable Customers'],
      'Chats': ['FreshChat'],
      'Internal Tickets': [
        'Customer Support - Internal',
        'Kuwait - Customer Support - Internal',
        'Refunds - CX Group',
        'Kuwait Ops', 'Riyadh Ops', 'Qatar Ops', 'Jeddah Ops',
        'Dammam Ops', 'UAE Ops', 'Bahrain Ops',
        'Aramex Pending Requests',
        'Ops Qatar -Gift cards', 'Ops Bahrain -Gift cards',
        'Ops Kuwait - Gift cards',
      ],
    },
    channelWeights: { 'Inbound Calls': 0.4, 'Waiting Address': 0.25, 'Chats': 0.2, 'Internal Tickets': 0.15 },
    customerFacing: ['Inbound Calls', 'Waiting Address', 'Chats'],
    tierWeights: { '1': 6, '2': 3, '3': 1 },
    defaultTier: 3,
    tier1Floor: 0.5,
    coverWorkedDays: true,
    statusBalance: 0.6,
    statusBalanceByChannel: { 'Internal Tickets': 1 },
    openerOnlyChannels: ['Inbound Calls', 'Waiting Address', 'Chats'],
    excludeStatuses: ['Closed'],
    excludeAgentStatuses: [],
    statusWeights: {},
    tierByL2: {
      'Courier Issue': 1, 'Order Issue': 1, 'Delivery Issue': 1,
      'Refund Request': 1, 'Payment & Promotion Issue': 1,
      'Negative feedback': 1, "Customer Didn't Answer": 1,
      'Address Confirmed': 2, 'Different City': 2, 'Waiting address': 2,
      'Card': 2, 'Wrapping': 2, 'Helium Balloons': 2, 'Dabdoob Bags': 2,
      'Payment link request': 2, 'App Issues': 2, 'Orders Issues': 2,
      'System Issues': 2, 'Phone Number Verification issue': 2,
      'Digital Gift Card': 2, 'More info needed': 2, 'Bank Details': 2,
      'NPS': 2, 'Abandoned Call': 2,
      'Account': 3, 'Orders': 3, 'Dabdoob World': 3, 'Partnership & Careers': 3,
      'Payments & Promotions': 3, 'Events & Competitions': 3,
      'Suggestions & Feedback': 3, 'Products': 3, 'Spam Emails': 3, 'Spam': 3,
      'Email Delivery Failure': 3, 'Marketing Campaign': 3,
      'Positive feedback': 3, 'Story Mention': 3,
    },
    contactTypeWeights: {},
    tierByL3: {
      'Harassment': 1, 'Rude Behavior': 1, 'Extra Collection': 1,
      'Fake Promise': 1, 'Courier Refused Rejection': 1, 'Damaged Item': 1,
      'Wrong item': 1, 'Received Wrong order': 1, 'Missing an item': 1,
      'Missing a Part': 1, 'Out of Delivery SLA': 1,
      'Waiting Address out of delivery SLA': 1, 'Refund for out of delivery': 1,
      "Cancellation based on customer's request": 1,
      "Return based on customer's request": 1, 'Cancelled Order from Ops': 1,
      'Cancelled order from 3pl': 1,
      'Cancelled order for unreachable customer': 1,
      'Poor Material': 1, 'Description Mismatch': 1, 'Photo Mismatch': 1,
      'Wrong Address': 1, 'Wrong Phone Number': 1,
      'recall unreachable customer': 1, 'Negative Feedback': 1,
      'Address Confirmed3': 3, 'Within Delivery SLA': 3,
    },
    excludeEmailDomains: ['freshworks.com', 'silverkeytech.com', 'haass.io'],
    excludeAgents: [],
    adminEmails: ['mohamed.nabil@dabdoob.com'],
    auditorEmails: [],
    expirePendingAfterDays: 3,
  }
}

// ---------------------------------------------------------------- settings layer (verbatim)

export function qeClampInt_(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = Math.round(Number(v))
  if (!isFinite(n)) return fallback
  if (n < lo) return lo
  if (n > hi) return hi
  return n
}

export function qeClampNum_(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = Number(v)
  if (!isFinite(n)) return fallback
  return Math.min(hi, Math.max(lo, n))
}

export function qeRound2_(n: unknown): number {
  return Math.round(Number(n) * 100) / 100
}

/** The queue never shows work older than the window it was sampled from. */
export function qeClampRetention_(S: Record<string, unknown>): Record<string, unknown> {
  const lb = (S.lookbackDays as number) || 3
  if (!(Number(S.expirePendingAfterDays) > 0) || Number(S.expirePendingAfterDays) > lb) S.expirePendingAfterDays = lb
  return S
}

export function qeCleanTierMap_(m: Record<string, unknown> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  if (!m) return out
  Object.keys(m).forEach((k) => {
    const t = Number(m[k])
    if (t === 1 || t === 2 || t === 3) out[k] = t
  })
  return out
}

/**
 * Defaults merged with `stored` (one level deep) and normalised with the old saveSettings_
 * rules. Throws a readable error on settings the old app would have refused to save.
 */
export function qeMergeSettings_(stored: unknown): Record<string, unknown> {
  const next = qeDefaultSettings_()
  const src = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>
  Object.keys(src).forEach((k) => {
    if (src[k] !== null && src[k] !== undefined) next[k] = src[k]
  })

  next.auditsPerWeek = qeClampInt_(next.auditsPerWeek, 1, 200, 20)
  next.auditsPerDay = qeClampInt_(next.auditsPerDay, 1, next.auditsPerWeek as number, 4)
  next.offerMultiplier = qeClampNum_(next.offerMultiplier, 1, 3, 1.5)
  next.lookbackDays = qeClampInt_(next.lookbackDays, 1, 3, 3)
  next.maxWindowShiftDays = qeClampInt_(next.maxWindowShiftDays, 0, 14, 4)
  next.minTouches = qeClampInt_(next.minTouches, 1, 100, 3)
  next.defaultTier = qeClampInt_(next.defaultTier, 1, 3, 3)
  next.expirePendingAfterDays = qeClampInt_(next.expirePendingAfterDays, 1, 30, 3)
  next.weekStartsOn = Number(next.weekStartsOn) === 1 ? 1 : 0
  qeClampRetention_(next)
  next.tier1Floor = qeClampNum_(next.tier1Floor, 0, 1, 0.5)
  next.coverWorkedDays = next.coverWorkedDays !== false
  next.scoresLookbackDays = qeClampInt_(next.scoresLookbackDays, 7, 730, 180)
  next.scoresStartDate = /^\d{4}-\d{2}-\d{2}$/.test(String(next.scoresStartDate || '').trim()) ? String(next.scoresStartDate).trim() : ''
  next.scoresMinAudits = qeClampInt_(next.scoresMinAudits, 1, 500, 10)
  next.autoMarkFromBackend = next.autoMarkFromBackend !== false
  next.reofferExpired = next.reofferExpired !== false

  const ap = (next.actionPlan || {}) as { agents?: unknown[]; perWeek?: unknown; perDay?: unknown }
  const apAgents = (ap.agents || []).map((a) => String(a).trim()).filter((a) => a)
  const apWeek = qeClampInt_(ap.perWeek, 1, 200, 30)
  const apDay = qeClampInt_(ap.perDay, 1, apWeek, 6)
  if (apAgents.length && apDay < (next.auditsPerDay as number)) {
    throw new Error(
      'The action-plan daily quota (' + apDay + ') is below the standard one (' + next.auditsPerDay +
      '). An action plan means more audits, not fewer: raise it or clear the agent list.'
    )
  }
  next.actionPlan = { agents: apAgents, perDay: apDay, perWeek: apWeek }

  const w = (next.channelWeights || {}) as Record<string, unknown>
  let sum = 0
  const keys = Object.keys(w)
  if (!keys.length) throw new Error('At least one channel must have a weight.')
  keys.forEach((c) => {
    const v = Number(w[c])
    if (!isFinite(v) || v < 0) throw new Error('Channel weight for "' + c + '" must be a positive number.')
    sum += v
  })
  if (sum <= 0) throw new Error('Channel weights cannot all be zero.')
  const scale = sum > 1.5 ? 100 : 1
  if (Math.abs(sum - scale) > 0.011 * scale) {
    throw new Error(
      'Channel weights must add up to ' + (scale === 100 ? '100%' : '1.00') + '; they currently add up to ' +
      qeRound2_(sum) + (scale === 100 ? '%' : '')
    )
  }
  const norm: Record<string, number> = {}
  keys.forEach((c) => {
    norm[c] = Number(w[c]) / sum
  })
  next.channelWeights = norm

  const tw = (next.tierWeights || {}) as Record<string, unknown>
  ;['1', '2', '3'].forEach((t) => {
    const v = Number(tw[t])
    tw[t] = isFinite(v) && v > 0 ? v : 1
  })
  next.tierWeights = tw

  const cg = (next.channelGroups || {}) as Record<string, unknown[]>
  Object.keys(next.channelWeights as Record<string, number>).forEach((c) => {
    if ((next.channelWeights as Record<string, number>)[c] > 0 && (!cg[c] || !cg[c].length)) {
      throw new Error('Channel "' + c + '" has a weight but no Freshdesk groups mapped to it, so it can never be filled. Map a group or set its weight to 0.')
    }
  })

  next.tierByL2 = qeCleanTierMap_(next.tierByL2 as Record<string, unknown>)
  next.tierByL3 = qeCleanTierMap_(next.tierByL3 as Record<string, unknown>)

  next.statusBalance = qeClampNum_(next.statusBalance, 0, 1, 0.6)
  const sbc: Record<string, number> = {}
  const rawSbc = (next.statusBalanceByChannel || {}) as Record<string, unknown>
  Object.keys(rawSbc).forEach((c) => {
    const v = Number(rawSbc[c])
    if (isFinite(v)) sbc[c] = qeClampNum_(v, 0, 1, 0.6)
  })
  next.statusBalanceByChannel = sbc
  next.excludeStatuses = ((next.excludeStatuses || []) as unknown[]).map((s) => String(s).trim()).filter((s) => s)
  next.excludeAgentStatuses = ((next.excludeAgentStatuses || []) as unknown[]).map((s) => String(s).trim()).filter((s) => s)
  next.openerOnlyChannels = ((next.openerOnlyChannels || []) as unknown[]).map((s) => String(s).trim()).filter((s) => s)
  const ctw: Record<string, number> = {}
  const rawCtw = (next.contactTypeWeights || {}) as Record<string, unknown>
  Object.keys(rawCtw).forEach((k) => {
    const v = Number(rawCtw[k])
    if (isFinite(v) && v > 0 && v !== 1) ctw[String(k).trim()] = Math.min(20, v)
  })
  next.contactTypeWeights = ctw
  const sw: Record<string, number> = {}
  const rawSw = (next.statusWeights || {}) as Record<string, unknown>
  Object.keys(rawSw).forEach((s) => {
    const v = Number(rawSw[s])
    if (isFinite(v) && v > 0 && v !== 1) sw[s] = v
  })
  next.statusWeights = sw
  return next
}

/** qeSettings_ against a raw config value (the parsed qa_engine_settings value or its JSON string). */
export function qeSettingsFrom_(raw: unknown): Record<string, unknown> {
  let stored = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) stored = {}
    else {
      try {
        stored = JSON.parse(raw)
      } catch (e) {
        throw new Error('Config qa_engine_settings is not valid JSON: ' + (e as Error).message)
      }
    }
  }
  try {
    return qeMergeSettings_(stored)
  } catch (e2) {
    throw new Error('Config qa_engine_settings: ' + (e2 as Error).message)
  }
}

/**
 * The sampling-weights editor's save (saveQaSampling), checked at the trust boundary. Pure.
 */
export function qeCleanSamplingInput_(input: unknown): {
  contactTypeWeights: Record<string, number>
  statusWeights: Record<string, number>
  excludeStatuses: string[]
  excludeAgentStatuses: string[]
} {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  function name(k: unknown, what: string): string {
    const s = String(k === null || k === undefined ? '' : k).replace(/\s+/g, ' ').trim()
    if (!s || s.length > 150) throw new Error('A ' + what + ' name is empty or longer than 150 characters.')
    return s
  }
  function weights(m: unknown, what: string): Record<string, number> {
    if (m === null || m === undefined) m = {}
    if (typeof m !== 'object' || Array.isArray(m)) throw new Error(what + ' weights must be a list of names and numbers.')
    const keys = Object.keys(m as Record<string, unknown>)
    if (keys.length > 300) throw new Error('Too many ' + what + ' weights (' + keys.length + '; at most 300).')
    const out: Record<string, number> = {}
    keys.forEach((k) => {
      const n = name(k, what)
      const v = Number((m as Record<string, unknown>)[k])
      if ((m as Record<string, unknown>)[k] === '' || (m as Record<string, unknown>)[k] === null || !isFinite(v) || v <= 0 || v > 20) {
        throw new Error(
          'The weight for "' + n + '" must be a number above 0 and at most 20 (1 = normal).' +
          (what === 'status' ? ' To leave a status out of the sample, mark it Excluded instead.' : '')
        )
      }
      if (v !== 1) out[n] = Math.round(v * 100) / 100
    })
    return out
  }
  function statusList(ex: unknown): { list: string[]; keys: Record<string, boolean> } {
    if (ex === undefined || ex === null) ex = []
    if (!Array.isArray(ex)) throw new Error('Excluded statuses must be a list.')
    if (ex.length > 50) throw new Error('Too many excluded statuses (at most 50).')
    const list: string[] = []
    const keys: Record<string, boolean> = {}
    ;(ex as unknown[]).forEach((s) => {
      const n = name(s, 'status')
      const k = qeStatusKey_(n)
      if (!keys[k]) {
        keys[k] = true
        list.push(n)
      }
    })
    return { list, keys }
  }
  const exNow = statusList(src.excludeStatuses)
  const exAgent = statusList(src.excludeAgentStatuses)
  const exclude = exNow.list
  const exKeys = exNow.keys
  const sw = weights(src.statusWeights, 'status')
  const swOut: Record<string, number> = {}
  const swKeys: Record<string, boolean> = {}
  Object.keys(sw).forEach((s) => {
    const k = qeStatusKey_(s)
    if (exKeys[k] || swKeys[k]) return
    swKeys[k] = true
    swOut[s] = sw[s]
  })
  return {
    contactTypeWeights: weights(src.contactTypeWeights, 'contact type'),
    statusWeights: swOut,
    excludeStatuses: exclude,
    excludeAgentStatuses: exAgent.list,
  }
}

/** Stored qa_engine_settings with the editor's three keys replaced; validated as a whole before it is returned. */
export function qeWithSampling_(
  storedRaw: unknown,
  clean: ReturnType<typeof qeCleanSamplingInput_>
): Record<string, unknown> {
  let stored = storedRaw
  if (typeof stored === 'string') stored = stored.trim() ? JSON.parse(stored) : {}
  stored = stored && typeof stored === 'object' ? JSON.parse(JSON.stringify(stored)) : {}
  ;(stored as Record<string, unknown>).contactTypeWeights = clean.contactTypeWeights
  ;(stored as Record<string, unknown>).statusWeights = clean.statusWeights
  ;(stored as Record<string, unknown>).excludeStatuses = clean.excludeStatuses
  ;(stored as Record<string, unknown>).excludeAgentStatuses = clean.excludeAgentStatuses
  qeMergeSettings_(JSON.parse(JSON.stringify(stored))) // throws on anything else already wrong in the stored settings
  return stored as Record<string, unknown>
}

// ---------------------------------------------------------------- dates

export function qeAsDateText_(v: unknown, withTime?: boolean): string {
  if (!(v instanceof Date)) return String(v === null || v === undefined ? '' : v)
  return qeFmt_(v, withTime === false ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm:ss')
}

/** Oldest Queued Date still on the queue: items queued before it expire. */
export function qeRetentionWindow_(S: Record<string, unknown>, now: Date): string {
  return qeFmt_(new Date(now.getTime() - ((S.expirePendingAfterDays as number) - 1) * 86400000), 'yyyy-MM-dd')
}

/**
 * Mixed timestamp formats: ISO "2026-07-02T16:45:40Z", local "07-02-2026 19:44:55" (MM-dd-yyyy),
 * "yyyy-MM-dd HH:mm[:ss]", "DD/MM/YYYY HH:MM[:SS]" (day first), or a Date cell.
 * Local forms are Asia/Riyadh wall time, as in the old project.
 */
export function qeParseTouchDate_(v: unknown): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (!s) return null
  if (s.indexOf('T') > 0 && s.indexOf('-') > 0) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d
  }
  let m = s.match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (m) return qeLocal_(+m[3], +m[1] - 1, +m[2], +m[4], +m[5], +(m[6] || 0))
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m) return qeLocal_(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (m) return qeLocal_(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0))
  const d2 = new Date(s)
  return isNaN(d2.getTime()) ? null : d2
}

// ---------------------------------------------------------------- selection engine

export function qeGroupToChannel_(S: Record<string, unknown>): Record<string, string> {
  const m: Record<string, string> = {}
  const cg = (S.channelGroups || {}) as Record<string, unknown[]>
  for (const ch in cg) (cg[ch] || []).forEach((g) => {
    m[String(g).trim().toLowerCase()] = ch
  })
  return m
}

export function qeTierOf_(l2: string, l3: string, S: Record<string, unknown>): number {
  const tl3 = S.tierByL3 as Record<string, number>
  const tl2 = S.tierByL2 as Record<string, number>
  if (l3 && Object.prototype.hasOwnProperty.call(tl3, l3)) return tl3[l3]
  if (l2 && Object.prototype.hasOwnProperty.call(tl2, l2)) return tl2[l2]
  return S.defaultTier as number
}

/** Deterministic PRNG: rebuilding the same day reproduces the same queue. */
export function qeMakeRng_(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function qeShuffle_(arr: unknown[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
  }
}

/** Splits `total` slots across weights, summing to exactly total. */
export function qeLargestRemainder_(weights: Record<string, number>, total: number): Record<string, number> {
  const keys = Object.keys(weights)
  const raw: Record<string, number> = {}
  const base: Record<string, number> = {}
  let used = 0
  keys.forEach((k) => {
    raw[k] = weights[k] * total
    base[k] = Math.floor(raw[k])
    used += base[k]
  })
  const rem = total - used
  const order = keys.slice().sort((x, y) => {
    const dx = raw[x] - base[x]
    const dy = raw[y] - base[y]
    if (Math.abs(dy - dx) > 1e-12) return dy - dx
    return weights[y] - weights[x]
  })
  for (let i = 0; i < rem; i++) base[order[i]]++
  return base
}

/** Status match key: case, edge and inner spacing ignored. */
export function qeStatusKey_(s: unknown): string {
  const k = String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return k || '(not set)'
}

/** A touch-log status value as a name: numeric codes become Freshdesk's names. */
export function qeStatusName_(v: unknown): string {
  const s = String(v === null || v === undefined ? '' : v).trim()
  if (/^\d+$/.test(s)) return QE_FD_STATUS_NAMES[s] || 'Status ' + s
  return s
}

/** Per-status multipliers keyed "tier|status": inverse share ^ balance, normalised to mean 1 within each tier. */
export function qeStatusMultipliers_(
  cands: { tier: unknown; status: unknown }[],
  balance: number,
  manualWeights?: Record<string, number>
): Record<string, number> {
  const manual: Record<string, number> = {}
  Object.keys(manualWeights || {}).forEach((s) => {
    manual[qeStatusKey_(s)] = Number((manualWeights as Record<string, unknown>)[s])
  })
  const counts: Record<string, Record<string, number>> = {}
  const totals: Record<string, number> = {}
  for (let i = 0; i < cands.length; i++) {
    const t = String(cands[i].tier)
    const k = qeStatusKey_(cands[i].status)
    if (!counts[t]) {
      counts[t] = {}
      totals[t] = 0
    }
    counts[t][k] = (counts[t][k] || 0) + 1
    totals[t]++
  }
  const out: Record<string, number> = {}
  Object.keys(counts).forEach((t) => {
    const keys = Object.keys(counts[t])
    const raw: Record<string, number> = {}
    let mean = 0
    keys.forEach((k) => {
      const share = counts[t][k] / totals[t]
      raw[k] = balance > 0 ? Math.pow(share, -balance) : 1
      mean += share * raw[k]
    })
    if (!(mean > 0)) mean = 1
    keys.forEach((k) => {
      let w = raw[k] / mean
      if (manual[k] !== undefined && isFinite(manual[k]) && manual[k] > 0) w *= manual[k]
      out[t + '|' + k] = w
    })
  })
  return out
}

export interface QeCand {
  channel: string
  tier: unknown
  status: unknown
  contactType: string
  day?: string
  [k: string]: unknown
}

/** One agent's draw (old selectForAgent_): channel by weekly deficit, tier/status/type weights, Tier 1 floor, day coverage. */
export function qeSelectForAgent_(
  pool: QeCand[],
  perAgent: number,
  weekTaken: Record<string, number>,
  rng: () => number,
  S: Record<string, unknown>,
  perWeek?: number
): { picked: QeCand[]; weeklyTarget: Record<string, number>; tier1: number; tier1Min: number; daysWorked: number; daysCovered: number } {
  const weights = S.channelWeights as Record<string, number>
  const weekly = perWeek === undefined || perWeek === null ? (S.auditsPerWeek as number) : perWeek
  const weeklyTarget = qeLargestRemainder_(weights, weekly)

  const avail: Record<string, QeCand[]> = {}
  pool.forEach((rec) => {
    if (!avail[rec.channel]) avail[rec.channel] = []
    avail[rec.channel].push(rec)
  })
  for (const ch in avail) qeShuffle_(avail[ch], rng)

  function isT1(r: QeCand) {
    return Number(r.tier) === 1
  }
  function countT1(list: QeCand[]) {
    let n = 0
    for (let i = 0; i < list.length; i++) if (isT1(list[i])) n++
    return n
  }
  let t1Pool = 0
  for (const chk in avail) t1Pool += countT1(avail[chk])
  let floor = S.tier1Floor === undefined ? 0 : Number(S.tier1Floor)
  if (!isFinite(floor) || floor < 0) floor = 0
  let minT1 = Math.min(t1Pool, Math.ceil(perAgent * floor))

  const daysCovered: Record<string, boolean> = {}
  const dayList: string[] = []
  pool.forEach((r) => {
    if (r.day && daysCovered[r.day] === undefined) {
      daysCovered[r.day] = false
      dayList.push(r.day)
    }
  })
  let coverDays = S.coverWorkedDays !== false && dayList.length > 1
  function uncoveredDays() {
    let n = 0
    for (let i = 0; i < dayList.length; i++) if (!daysCovered[dayList[i]]) n++
    return n
  }
  function hasCandidate(list: QeCand[], needT1: boolean, needDay: boolean) {
    for (let i = 0; i < list.length; i++) {
      if (needT1 && !isT1(list[i])) continue
      if (needDay && list[i].day && daysCovered[list[i].day as string]) continue
      return true
    }
    return false
  }

  const picked: QeCand[] = []
  const seenType: Record<string, number> = {}
  const takenSoFar: Record<string, number> = {}
  let t1Taken = 0
  for (let slot = 0; slot < perAgent; slot++) {
    const slotsLeft = perAgent - slot
    const forceT1 = minT1 - t1Taken >= slotsLeft
    const uncov = uncoveredDays()
    const forceDay = coverDays && uncov > 0 && uncov >= slotsLeft

    let bestCh: string | null = null
    let bestDef = -Infinity
    for (const c in weights) {
      if (!avail[c] || !avail[c].length) continue
      if (!hasCandidate(avail[c], forceT1, forceDay)) continue
      const target = weeklyTarget[c] || 0
      if (target <= 0) continue
      const already = (weekTaken[c] || 0) + (takenSoFar[c] || 0)
      const def = (target - already) / target
      if (def > bestDef + 1e-9) {
        bestDef = def
        bestCh = c
      } else if (Math.abs(def - bestDef) <= 1e-9 && bestCh && weights[c] > weights[bestCh]) {
        bestCh = c
      }
    }
    if (!bestCh && forceT1) {
      minT1 = t1Taken
      slot--
      continue
    }
    if (!bestCh && forceDay) {
      coverDays = false
      slot--
      continue
    }
    if (!bestCh) break

    const cands = avail[bestCh]
    const sbc = S.statusBalanceByChannel as Record<string, number> | undefined
    const balance = sbc && sbc[bestCh] !== undefined ? sbc[bestCh] : (S.statusBalance as number) || 0
    const statusMul = qeStatusMultipliers_(cands, balance, S.statusWeights as Record<string, number>)

    let totalW = 0
    const ws: number[] = []
    for (let i = 0; i < cands.length; i++) {
      const ctw = (S.contactTypeWeights as Record<string, number> | undefined)?.[cands[i].contactType]
      let w =
        (((S.tierWeights as Record<string, number>)[String(cands[i].tier)] || 1) /
          (1 + 1.5 * (seenType[cands[i].contactType] || 0))) *
        (statusMul[String(cands[i].tier) + '|' + qeStatusKey_(cands[i].status)] || 1) *
        (isFinite(ctw as number) && (ctw as number) > 0 ? (ctw as number) : 1)
      if (forceT1 && !isT1(cands[i])) w = 0
      if (forceDay && cands[i].day && daysCovered[cands[i].day as string]) w = 0
      ws.push(w)
      totalW += w
    }
    let roll = rng() * totalW
    let pick = -1
    for (let j = 0; j < ws.length; j++) {
      roll -= ws[j]
      if (ws[j] > 0 && roll <= 0) {
        pick = j
        break
      }
    }
    if (pick < 0) {
      for (let k = ws.length - 1; k >= 0; k--) if (ws[k] > 0) {
        pick = k
        break
      }
    }
    if (pick < 0) break

    const rec = cands.splice(pick, 1)[0]
    seenType[rec.contactType] = (seenType[rec.contactType] || 0) + 1
    takenSoFar[bestCh] = (takenSoFar[bestCh] || 0) + 1
    if (isT1(rec)) t1Taken++
    if (rec.day) daysCovered[rec.day] = true
    picked.push(rec)
  }
  let daysHit = 0
  for (let dk = 0; dk < dayList.length; dk++) if (daysCovered[dayList[dk]]) daysHit++
  return { picked, weeklyTarget, tier1: t1Taken, tier1Min: minT1, daysWorked: dayList.length, daysCovered: daysHit }
}

/** First + second name, title-cased (old Scores.js normAgent_); null for junk (emails, numbers). */
export function qeNormAgent_(raw: unknown): string | null {
  let s = String(raw === null || raw === undefined ? '' : raw).trim()
  if (!s) return null
  if (s.indexOf('@') >= 0) return null
  if (/^[\d\s]+$/.test(s)) return null
  s = s.replace(/\s+/g, ' ')
  const parts = s
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  const out = parts.join(' ')
  return out.length > 1 ? out : null
}

/** The one spelling used to join the queue (full Users List name) to the scoring forms (free text). */
export function qeCanonAgent_(name: unknown): string {
  const n = qeNormAgent_(name)
  return n || String(name === null || name === undefined ? '' : name).trim()
}

/** One agent's quota (action-plan agents carry a bigger one) and the offer numbers (x offerMultiplier). */
export function qeQuotaFor_(agent: unknown, S: Record<string, unknown>): { perDay: number; perWeek: number; actionPlan: boolean; offerPerDay: number; offerPerWeek: number } {
  const ap = (S.actionPlan || {}) as { agents?: unknown[]; perDay?: number; perWeek?: number }
  const names = ap.agents || []
  let q = { perDay: S.auditsPerDay as number, perWeek: S.auditsPerWeek as number, actionPlan: false }
  const want = qeCanonAgent_(agent)
  for (let i = 0; i < names.length; i++) {
    if (qeCanonAgent_(names[i]) === want) {
      q = { perDay: ap.perDay || (S.auditsPerDay as number), perWeek: ap.perWeek || (S.auditsPerWeek as number), actionPlan: true }
      break
    }
  }
  let m = Number(S.offerMultiplier)
  if (!isFinite(m) || m < 1) m = 1
  const out = q as { perDay: number; perWeek: number; actionPlan: boolean; offerPerDay: number; offerPerWeek: number }
  out.offerPerDay = Math.ceil(q.perDay * m)
  out.offerPerWeek = Math.ceil(q.perWeek * m)
  return out
}

/** Weekly ledger key: "W" + the date (Asia/Riyadh) the quota week started (weekStartsOn 0 = Sunday). */
export function qeWeekKeyFor_(d: Date, S: Record<string, unknown>): string {
  const startsOn = S && Number(S.weekStartsOn) === 1 ? 1 : 0
  const w = qeWall_(d)
  const back = (w.dow - startsOn + 7) % 7
  const t = new Date(Date.UTC(w.y, w.m, w.d - back))
  const m = t.getUTCMonth() + 1
  const day = t.getUTCDate()
  return 'W' + t.getUTCFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day)
}

/** qeFmt_: Utilities.formatDate(date, QE_TZ, pattern) — the Riyadh wall clock via the shared formatter. */
export function qeFmt_(date: Date, pattern: string): string {
  const ms = date.getTime() + QE_TZ_OFFSET_MS
  const t = new Date(ms)
  const p = {
    yyyy: String(t.getUTCFullYear()),
    MM: ('0' + (t.getUTCMonth() + 1)).slice(-2),
    dd: ('0' + t.getUTCDate()).slice(-2),
    HH: ('0' + t.getUTCHours()).slice(-2),
    mm: ('0' + t.getUTCMinutes()).slice(-2),
    ss: ('0' + t.getUTCSeconds()).slice(-2),
  }
  return String(pattern)
    .replace(/yyyy/g, p.yyyy)
    .replace(/MM/g, p.MM)
    .replace(/dd/g, p.dd)
    .replace(/HH/g, p.HH)
    .replace(/mm/g, p.mm)
    .replace(/ss/g, p.ss)
}
