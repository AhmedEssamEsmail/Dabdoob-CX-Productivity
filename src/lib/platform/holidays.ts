/**
 * Holidays API fragment — the `holidays` table writes (WorkCalendar.js
 * DQ_HOLIDAYS_HEADERS on the migration-002 schema: id/country/date/name/
 * deleted_at/submitted_*). Reads go through the same dqHolidayIndex_ rules
 * (deleted_at rows are out); every write wcReset()s the calendar cache like a
 * legacy admin edit did.
 */

import { db } from './repo'
import { wcReset } from './calendar'
import { assertWritable } from './viewas'
import { InputError } from '@/lib/api-error'
import { DATE_KEY_RE } from '@/lib/fragments'

export const HOLIDAYS_TABLE = 'holidays'

/** Validated holiday payload (country + date + name). */
export function holidayInput(body: Record<string, unknown>): { country: string; date: string; name: string } {
  const country = String(body.country ?? '').trim()
  if (!country) throw new InputError('A holiday needs a country.')
  const date = String(body.date ?? '').slice(0, 10)
  if (!DATE_KEY_RE.test(date)) throw new InputError('A holiday needs a date (yyyy-MM-dd).')
  return { country, date, name: String(body.name ?? '') }
}

/** Active holidays, optionally inside [from, to] (dqHolidayIndex_'s deleted_at rule). */
export async function holidayList(from?: string | null, to?: string | null): Promise<Record<string, unknown>[]> {
  const { data, error } = await db().from(HOLIDAYS_TABLE).select('*').is('deleted_at', null)
  if (error) throw new Error(error.message)
  return ((data || []) as Record<string, unknown>[])
    .filter((h) => {
      const d = String(h.date).slice(0, 10)
      return (!from || d >= from) && (!to || d <= to)
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.country).localeCompare(String(b.country)))
}

/**
 * Upsert one holiday on (country, date): an active row gets its name updated,
 * a new (or previously deleted) one is inserted stamped.
 */
export async function holidayUpsert(body: Record<string, unknown>, actor: string): Promise<Record<string, unknown>> {
  await assertWritable()
  const input = holidayInput(body)
  const now = new Date().toISOString()
  const { data: existing, error: findError } = await db()
    .from(HOLIDAYS_TABLE)
    .select('*')
    .ilike('country', input.country)
    .eq('date', input.date)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  if (findError) throw new Error(findError.message)
  let row: Record<string, unknown> | null
  if (existing) {
    const { data, error } = await db()
      .from(HOLIDAYS_TABLE)
      .update({ country: input.country, name: input.name })
      .eq('id', existing.id)
      .select()
      .maybeSingle()
    if (error) throw new Error(error.message)
    row = data as Record<string, unknown> | null
  } else {
    const { data, error } = await db()
      .from(HOLIDAYS_TABLE)
      .insert({ ...input, submitted_by: actor, submitted_at: now })
      .select()
      .maybeSingle()
    if (error) throw new Error(error.message)
    row = data as Record<string, unknown> | null
  }
  wcReset()
  return row || input
}

/** Soft delete: deleted_at stamped on the row (the calendar index drops it). */
export async function holidayDelete(id: string, actor: string): Promise<Record<string, unknown>> {
  await assertWritable()
  const idNum = Number(id)
  if (!isFinite(idNum)) throw new InputError('Give the holiday id to remove.')
  const { data: current, error: findError } = await db().from(HOLIDAYS_TABLE).select('*').eq('id', idNum).maybeSingle()
  if (findError) throw new Error(findError.message)
  if (!current) throw new InputError('That holiday does not exist.', 404)
  if (current.deleted_at) throw new InputError('That holiday is already deleted.', 409)
  const { data, error } = await db()
    .from(HOLIDAYS_TABLE)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', idNum)
    .select()
    .maybeSingle()
  if (error) throw new Error(error.message)
  void actor
  wcReset()
  return (data as Record<string, unknown>) || current
}
