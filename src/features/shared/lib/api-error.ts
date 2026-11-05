/**
 * Error -> HTTP status for the API fragments. InputError is thrown by the
 * payload validators (400 by default; 404/409 via the `status` option).
 * requireRole's legacy denial ("You do not have access to this..."), the
 * View-as read-only refusal and 'Forbidden' map to 403; 'Unauthorized' to 401;
 * a DescribedError (missing store/source/config/credentials — see
 * src/lib/errors.ts) maps to 503 with the { error, code, detail, hint }
 * envelope; everything else is a 500.
 */

import { NextResponse } from 'next/server'
import { VIEW_AS_READONLY } from '@/lib/platform/viewas'
import { DescribedError, describeDbError } from './errors'

export class InputError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function apiError(e: unknown): NextResponse {
  const msg = e instanceof Error ? e.message : String(e)
  if (e instanceof InputError) return NextResponse.json({ error: msg }, { status: e.status })
  if (msg === 'Unauthorized') return NextResponse.json({ error: msg }, { status: 401 })
  if (msg === 'Forbidden' || msg === VIEW_AS_READONLY || msg.indexOf('do not have access') !== -1) {
    return NextResponse.json({ error: msg }, { status: 403 })
  }
  if (e instanceof DescribedError) {
    return NextResponse.json(
      {
        error: e.message,
        code: e.code,
        ...(e.detail ? { detail: e.detail } : {}),
        ...(e.hint ? { hint: e.hint } : {}),
      },
      { status: e.code === 'internal' ? 500 : 503 }
    )
  }
  return NextResponse.json({ error: msg }, { status: 500 })
}

/**
 * dbErr — a Supabase error from a route's own query, answered in the
 * { error, code, detail, hint } envelope (503 missing/unreachable, 500 rest).
 */
export function dbErr(table: string, error: unknown): NextResponse {
  const d = describeDbError(error, { table })
  return NextResponse.json(
    { error: d.message, code: d.code, ...(d.detail ? { detail: d.detail } : {}), ...(d.hint ? { hint: d.hint } : {}) },
    { status: d.code === 'internal' || d.code === 'write_conflict' ? 500 : 503 }
  )
}
