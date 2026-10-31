/** Small shared pieces for the ported API fragments (dates and cell picking). */

import { InputError } from './api-error'

export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
export const MONTH_RE = /^\d{4}-\d{2}$/

/** { from, to } bounds of a yyyy-MM month (both inclusive). Throws InputError on bad input. */
export function monthRange(month: string): { from: string; to: string } {
  const m = Number(String(month).slice(5, 7))
  if (!MONTH_RE.test(month) || m < 1 || m > 12) throw new InputError('Give the month as yyyy-MM.')
  const y = Number(month.slice(0, 4))
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { from: month + '-01', to }
}

/** `date` (yyyy-MM-dd-ish) inside [from, to]? */
export function inDateRange(date: unknown, from: string, to: string): boolean {
  const d = String(date || '').slice(0, 10)
  return DATE_KEY_RE.test(d) && d >= from && d <= to
}

/** First present property of `r` under any of `names` (snake/camel tolerant). */
export function pick(r: Record<string, unknown>, ...names: string[]): unknown {
  for (const n of names) {
    if (r[n] !== undefined && r[n] !== null && r[n] !== '') return r[n]
  }
  return undefined
}
