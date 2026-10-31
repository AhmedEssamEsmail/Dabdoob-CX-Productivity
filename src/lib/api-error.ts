/**
 * Error -> HTTP status for the API fragments. InputError is thrown by the
 * payload validators (400 by default; 404/409 via the `status` option).
 * requireRole's legacy denial ("You do not have access to this..."), the
 * View-as read-only refusal and 'Forbidden' map to 403; 'Unauthorized' to 401;
 * everything else is a 500.
 */

import { NextResponse } from 'next/server'
import { VIEW_AS_READONLY } from '@/lib/platform/viewas'

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
  return NextResponse.json({ error: msg }, { status: 500 })
}
