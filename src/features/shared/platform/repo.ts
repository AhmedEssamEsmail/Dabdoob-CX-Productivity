/**
 * Repository layer, ported from original_deprecated/Repo.js.
 *
 * The datastore is the one thing that changed: Google Sheets -> Supabase Postgres.
 * The rules the legacy layer enforced are kept:
 *  - submitted_by / submitted_at are stamped from the server on append and are
 *    stripped from any client-supplied object (never trusted).
 *  - updated_by / updated_at are stamped on update when the table has those columns.
 *  - No write while the owner is in View as (callers run assertWritable() first —
 *    repo.ts does not import viewas.ts so this module stays a leaf).
 *  - Dates leave the server as ISO strings.
 *  - Strings that would be read as a formula (=, +, @, or - followed by a
 *    non-digit) get a leading apostrophe — kept for the CSV export helper.
 *
 * CacheService.getScriptCache() becomes a process-local Map with TTLs — the same
 * best-effort, may-be-cold semantics the script cache had.
 */

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/features/shared/lib/supabase'

/** The shared service-role client every API route in this project already uses. */
export function db(): SupabaseClient {
  return createClient()
}

// ---------------------------------------------------------------- small cache (CacheService)

interface CacheEntry {
  value: string
  expiresAt: number
}

const CACHE = new Map<string, CacheEntry>()

/** CacheService.getScriptCache().get equivalent: JSON string in, null when missing/expired. */
export function cacheGet(key: string): string | null {
  const hit = CACHE.get(key)
  if (!hit) return null
  if (hit.expiresAt <= Date.now()) {
    CACHE.delete(key)
    return null
  }
  return hit.value
}

/** CacheService .put(key, value, ttlSeconds). Oversized/missing values are simply not stored. */
export function cachePut(key: string, value: string, ttlSeconds: number): void {
  try {
    CACHE.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  } catch {
    /* the script cache was best-effort; so is this one */
  }
}

export function cacheRemove(key: string): void {
  CACHE.delete(key)
}

/** Test/maintenance hook: drop every cached entry. */
export function cacheClear(): void {
  CACHE.clear()
}

// ---------------------------------------------------------------- stamping rules

export const STAMP_FIELDS = ['submitted_by', 'submitted_at']
export const UPDATE_STAMP_FIELDS = ['updated_by', 'updated_at']

/** Copies a client object, dropping the stamp fields and internal keys (sanitizeInput_). */
export function sanitizeInput<T extends Record<string, unknown>>(obj: T | null | undefined): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  Object.keys(obj || {}).forEach((k) => {
    if (k.charAt(0) === '_') return
    if (STAMP_FIELDS.indexOf(k) !== -1 || UPDATE_STAMP_FIELDS.indexOf(k) !== -1) return
    clean[k] = (obj as Record<string, unknown>)[k]
  })
  return clean
}

/** A short random id for new rows (sortable by time). */
export function newId(prefix?: string): string {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/** Header comparison: case-insensitive, whitespace collapsed. "Promo  code " matches "Promo Code". */
export function normHeader(h: unknown): string {
  return String(h == null ? '' : h).replace(/\s+/g, ' ').trim().toLowerCase()
}

export function isTrue(v: unknown): boolean {
  return v === true || String(v).toLowerCase() === 'true'
}

/** Dates leave the server as ISO strings (toClientValue_). */
export function toClientValue(v: unknown): unknown {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString()
  return v
}

/**
 * Neutralises values a spreadsheet would otherwise evaluate as formulas (toCellValue_).
 * Kept for the CSV export helper: anything exported back to Sheets/Excel goes through it.
 */
export function toCellValue(v: unknown): unknown {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v
  if (typeof v === 'object') return JSON.stringify(v)
  if (typeof v === 'string' && /^(=|\+|@|-(?![\d.]))/.test(v)) return "'" + v
  return v
}

// ---------------------------------------------------------------- generic table helpers (Postgres)

export interface ReadOptions {
  where?: (row: Record<string, unknown>) => boolean
  orderBy?: string
  ascending?: boolean
  limit?: number
}

/**
 * readTable_ equivalent: rows of a table as plain objects, optionally filtered.
 * Tables ported through this helper are small (options, popups, mail_log, health,
 * holidays, view_as, roster, config), so filtering in memory keeps semantics exact.
 */
export async function readRows(table: string, opts: ReadOptions = {}): Promise<Record<string, unknown>[]> {
  let query = db().from(table).select('*')
  if (opts.orderBy) query = query.order(opts.orderBy, { ascending: opts.ascending !== false })
  if (opts.limit) query = query.limit(opts.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const rows = (data || []) as Record<string, unknown>[]
  return opts.where ? rows.filter(opts.where) : rows
}

/** The first row whose keyField equals keyValue, or null (findRow_). */
export async function findRow(table: string, keyField: string, keyValue: unknown): Promise<Record<string, unknown> | null> {
  const { data, error } = await db()
    .from(table)
    .select('*')
    .eq(keyField, keyValue as string)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Record<string, unknown> | null) ?? null
}

/**
 * appendRows_ equivalent: stamps submitted_by / submitted_at from the actor,
 * strips client-supplied stamps, inserts. Returns the stored objects.
 */
export async function appendRows(
  table: string,
  objs: Record<string, unknown>[],
  actor: string
): Promise<Record<string, unknown>[]> {
  if (!objs || !objs.length) return []
  const now = new Date().toISOString()
  const datas = objs.map((o) => {
    const d = sanitizeInput(o)
    d.submitted_by = actor
    d.submitted_at = now
    return d
  })
  const { data, error } = await db().from(table).insert(datas).select()
  if (error) throw new Error(error.message)
  return (data || []) as Record<string, unknown>[]
}

export async function appendRow(
  table: string,
  obj: Record<string, unknown>,
  actor: string
): Promise<Record<string, unknown>> {
  return (await appendRows(table, [obj], actor))[0]
}

export interface UpdateSpec {
  key: unknown
  patch: Record<string, unknown>
}

export interface UpdateOptions {
  /** Runs against the row as it is now; should throw to refuse the change (updateRows_ guard). */
  guard?: (currentRow: Record<string, unknown>, patch: Record<string, unknown>) => void
  /** Set false when the table has no updated_by / updated_at columns. Default true. */
  stampUpdates?: boolean
  actor: string
}

/**
 * updateRows_ equivalent: one entry per update — the updated row, or null when no
 * row matched. Patches may not change the key or the submitted_* stamps;
 * updated_by / updated_at are stamped when stampUpdates is on.
 */
export async function updateRows(
  table: string,
  keyField: string,
  updates: UpdateSpec[],
  opts: UpdateOptions
): Promise<(Record<string, unknown> | null)[]> {
  if (updates.length <= 1) return updateRowsOneByOne(table, keyField, updates, opts)
  const actor = opts.actor
  const now = new Date().toISOString()
  const stampUpdates = opts.stampUpdates !== false
  const keys = [...new Set(updates.map((u) => u.key))]
  const { data: currentRows, error: selErr } = await db()
    .from(table)
    .select('*')
    .in(keyField, keys as never[])
  if (selErr) throw new Error(selErr.message)
  const byKey = new Map<unknown, Record<string, unknown>>()
  ;(currentRows || []).forEach((r) => {
    const row = r as Record<string, unknown>
    byKey.set(row[keyField], row)
  })
  const out: (Record<string, unknown> | null)[] = []
  const mergedByKey = new Map<unknown, Record<string, unknown>>()
  const patchByKey = new Map<unknown, Record<string, unknown>>()
  for (const u of updates) {
    const data = sanitizeInput(u.patch)
    delete data[keyField]
    const current = mergedByKey.get(u.key) ?? byKey.get(u.key)
    if (!current) {
      out.push(null)
      continue
    }
    if (opts.guard) opts.guard(current, data)
    if (stampUpdates) {
      data.updated_by = actor
      data.updated_at = now
    }
    const merged = { ...current, ...data }
    mergedByKey.set(u.key, merged)
    patchByKey.set(u.key, { ...patchByKey.get(u.key), [keyField]: u.key, ...data })
    out.push(merged)
  }
  if (!patchByKey.size) return out
  const groups = new Map<string, Record<string, unknown>[]>()
  for (const patch of patchByKey.values()) {
    const signature = JSON.stringify(Object.keys(patch).sort())
    const group = groups.get(signature)
    if (group) group.push(patch)
    else groups.set(signature, [patch])
  }
  try {
    for (const rows of groups.values()) {
      const { error } = await db()
        .from(table)
        .upsert(rows, { onConflict: keyField })
      if (error) throw new Error(error.message)
    }
  } catch (err) {
    if (err instanceof Error && /constraint|conflict|42P10/i.test(err.message)) {
      return updateRowsOneByOne(table, keyField, updates, opts)
    }
    throw err
  }
  return out
}

/** Original per-row findRow + update path; also the fallback when the table has no usable conflict key. */
async function updateRowsOneByOne(
  table: string,
  keyField: string,
  updates: UpdateSpec[],
  opts: UpdateOptions
): Promise<(Record<string, unknown> | null)[]> {
  const actor = opts.actor
  const now = new Date().toISOString()
  const stampUpdates = opts.stampUpdates !== false
  const out: (Record<string, unknown> | null)[] = []
  for (const u of updates) {
    const data = sanitizeInput(u.patch)
    delete data[keyField]
    const current = await findRow(table, keyField, u.key)
    if (!current) {
      out.push(null)
      continue
    }
    if (opts.guard) opts.guard(current, data)
    if (stampUpdates) {
      data.updated_by = actor
      data.updated_at = now
    }
    const { data: updated, error } = await db()
      .from(table)
      .update(data)
      .eq(keyField, u.key as string)
      .select()
      .maybeSingle()
    if (error) throw new Error(error.message)
    out.push((updated as Record<string, unknown> | null) ?? current)
  }
  return out
}

export async function updateRow(
  table: string,
  keyField: string,
  keyValue: unknown,
  patch: Record<string, unknown>,
  opts: UpdateOptions
): Promise<Record<string, unknown> | null> {
  return (await updateRows(table, keyField, [{ key: keyValue, patch }], opts))[0]
}
