/**
 * Vendor API -> mirror-row mappers. Each mapper emits the same 7-cell `cols`
 * shape the sheet mirrors stored, so every reader (tphCallMinutesFromRows_,
 * tphChatCases_) works unchanged. Timestamps go out as ISO strings — the sheet
 * formats were ambiguous (Maqsam col D is DD-MM-YYYY while col E is MM-DD-YYYY
 * in the same row), ISO instants cannot misparse.
 */

import { DescribedError } from '@/lib/errors'
import { epochMs, isoMs } from '@/lib/vendor/http'
import { listMaqsamCalls, maqsamCredsFromEnv } from '@/lib/vendor/maqsam'
import { listFreshchatConversations, freshchatCredsFromEnv } from '@/lib/vendor/freshchat'

const str = (v: unknown) => String(v === null || v === undefined ? '' : v).trim()
const num = (v: unknown) => {
  const n = Number(v)
  return isFinite(n) ? n : 0
}
const pick = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]
  return undefined
}

/** seconds -> 'H:MM:SS' (the sheet's Call duration display). */
function hms(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Maqsam call -> mirror cells matching sheet cols D..J:
 *   [0] start ISO | [1] end ISO | [2] duration 'H:MM:SS' | [3] agent email |
 *   [4] call state | [5] direction | [6] total handling time, fractional days
 * [6] blank falls back to end−start inside tphCallMinutesFromRows_.
 */
export function maqsamCallToCols(call: Record<string, unknown>): unknown[] | null {
  const start = epochMs(pick(call, 'timestamp', 'start_time', 'start', 'started_at', 'created_at', 'created_time'))
  if (!start) return null
  const durationSec = num(pick(call, 'duration', 'call_duration'))
  const explicitEnd = epochMs(pick(call, 'end_time', 'end', 'ended_at', 'finished_at'))
  const end = explicitEnd || (durationSec > 0 ? start + durationSec * 1000 : 0)
  const agent = call.agent as Record<string, unknown> | undefined
  const agents = Array.isArray(call.agents) ? (call.agents[0] as Record<string, unknown> | undefined) : undefined
  const email = str(
    pick(call, 'agent_email', 'email', 'agentEmail') || (agent && pick(agent, 'email')) || (agents && pick(agents, 'email'))
  ).toLowerCase()
  const state = str(pick(call, 'state', 'call_state', 'status'))
  const direction = str(pick(call, 'direction', 'call_direction', 'type'))
  // handling time: seconds in the API, fractional days in the sheet
  const handlingSec = num(pick(call, 'handlingTime', 'handling_time', 'total_handling_time', 'handling', 'handling_time_seconds'))
  return [isoMs(start), end ? isoMs(end) : '', hms(durationSec), email, state, direction, handlingSec > 0 ? String(handlingSec / 86400) : '']
}

/** Freshchat conversation -> mirror cells matching sheet cols A..G:
 *   [0] initiated ISO | [1] status ('' open / 'AGENT_RESOLVE' resolved) |
 *   [2] '<convId>-<createdMs>' (epoch-suffix fallback) | [3] updated ISO |
 *   [4] resolved ISO | [5] channel | [6] conversation id
 */
export function freshchatConvToCols(conv: Record<string, unknown>): unknown[] | null {
  const id = str(pick(conv, 'conversation_id', 'id'))
  const created = epochMs(pick(conv, 'created_time', 'created_at'))
  if (!id || !created) return null
  const updated = epochMs(pick(conv, 'updated_time', 'updated_at'))
  const resolved = epochMs(pick(conv, 'resolved_time', 'status_resolved_time', 'resolved_at'))
  const status = str(conv.status).toLowerCase()
  const isResolved = resolved > 0 || status === 'resolved' || status === 'closed'
  const channel = str(pick(conv, 'channel_id', 'channel', 'source'))
  return [isoMs(created), isResolved ? 'AGENT_RESOLVE' : '', `${id}-${created}`, updated ? isoMs(updated) : '', isResolved && resolved ? isoMs(resolved) : '', channel, id]
}

/** maqsam_calls SPECS.fetch: calls created since `sinceMs` (or the months bound). */
export async function fetchMaqsamRows(sinceMs?: number): Promise<unknown[][]> {
  const creds = maqsamCredsFromEnv()
  if (!creds) {
    throw new DescribedError({
      code: 'missing_credentials',
      message: 'MAQSAM_API_KEY / MAQSAM_API_SECRET / MAQSAM_DOMAIN are not configured',
      hint: 'Set the Maqsam API credentials in Vercel env (Maqsam Account Settings > API Credentials).',
    })
  }
  const calls = await listMaqsamCalls(creds, { startMs: sinceMs })
  const rows: unknown[][] = []
  for (const c of calls) {
    const cols = maqsamCallToCols(c)
    if (cols) rows.push(cols)
  }
  return rows
}

/** freshchat SPECS.fetch: conversations updated since `sinceMs` (all when absent). */
export async function fetchFreshchatRows(sinceMs?: number): Promise<unknown[][]> {
  const creds = freshchatCredsFromEnv()
  if (!creds) {
    throw new DescribedError({
      code: 'missing_credentials',
      message: 'FRESHCHAT_API_KEY / FRESHCHAT_DOMAIN are not configured',
      hint: 'Set the Freshchat API credentials in Vercel env (Freshchat Admin Settings > API Settings).',
    })
  }
  const convs = await listFreshchatConversations(creds, { sinceMs })
  const rows: unknown[][] = []
  for (const c of convs) {
    const cols = freshchatConvToCols(c)
    if (cols) rows.push(cols)
  }
  return rows
}
