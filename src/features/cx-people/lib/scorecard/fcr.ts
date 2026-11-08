/**
 * FCR API fragment — the fcr_daily row shape the scorecard POST accepts:
 * { date, email, passed, failed, excluded } (sc_daily's fcr_* counts, one row
 * per agent per day; `excluded` does not enter the denominator, matching
 * scDerive_'s passed/(passed+failed)).
 */

import 'server-only'
import { InputError } from '@/features/shared/lib/api-error'
import { DATE_KEY_RE } from '@/features/shared/lib/fragments'
import { normEmail_ } from '@/features/shared/lib/adapters'
import { scNum_ } from './index'

export interface FcrDailyInput {
  date: string
  agent_email: string
  passed: number
  failed: number
  excluded: number
}

function fcrCount(v: unknown, name: string): number {
  if (v === '' || v === null || v === undefined) return 0
  const n = scNum_(v)
  if (!isFinite(n) || n < 0) throw new InputError(name + ' is a non-negative number.')
  return n
}

/** Validated scorecard FCR row (POST /api/fcr/daily). */
export function fcrDailyInput(body: Record<string, unknown>): FcrDailyInput {
  const date = String(body.date ?? '').slice(0, 10)
  if (!DATE_KEY_RE.test(date)) throw new InputError('FCR rows need a date (yyyy-MM-dd).')
  const agent_email = normEmail_(body.agent_email ?? body.email)
  if (!agent_email) throw new InputError('FCR rows need an agent email.')
  return {
    date,
    agent_email,
    passed: fcrCount(body.passed, 'passed'),
    failed: fcrCount(body.failed, 'failed'),
    excluded: fcrCount(body.excluded, 'excluded'),
  }
}
