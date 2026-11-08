/**
 * Login pop-ups — port of original_deprecated/Popups.js.
 *
 * When something needs a person's attention on next load (a 1:1 not logged the
 * same day), a row is written to `popups`; the client shows it on every load
 * until the SERVER resolves it (the underlying thing is fixed) — never the user.
 *
 * popups(recipient, kind, title, body, link, ref, created_at, resolved_at,
 *        submitted_by, submitted_at) + popup_id.
 */

import 'server-only'

import { db, readRows, appendRow, updateRows, newId, cacheGet, cachePut, cacheRemove } from './repo'
import { normEmail } from './identity'
import { assertWritable } from './viewas'
import { remindersOn } from './settings'

const POPUPS_TABLE = 'popups'
const REMINDER_POPUP_KINDS = new Set(['missed_1on1', 'qa_ctl_due'])
const POPUPS_POLL_KEY = 'pop:poll:'
const POPUPS_POLL_S = 300

export interface PendingPopup {
  id: string
  kind: string
  title: string
  body: string
  link: string
  createdAt: string
}

/** Every open row for the caller (pendingPopupsFor_). queue_checkin_missed stays mail-only. */
export async function pendingPopupsFor(email: string): Promise<PendingPopup[]> {
  if (!(await remindersOn())) return []
  let rows: Record<string, unknown>[]
  try {
    rows = await readRows(POPUPS_TABLE)
  } catch {
    return []
  }
  return rows
    .filter(
      (r) => normEmail(r.recipient) === email && !r.resolved_at && r.kind !== 'queue_checkin_missed'
    )
    .map((r) => ({
      id: String(r.popup_id),
      kind: String(r.kind),
      title: String(r.title),
      body: String(r.body),
      link: String(r.link || ''),
      createdAt: String(r.created_at || r.submitted_at || ''),
    }))
}

export interface RaisePopupInput {
  recipient: string
  kind: string
  title: string
  body?: string
  link?: string
  ref?: string
}

/** Opens a pop-up unless an open one already exists for the same recipient + kind + ref (raisePopup_). */
export async function raisePopup(p: RaisePopupInput, actor: string): Promise<Record<string, unknown>> {
  if (REMINDER_POPUP_KINDS.has(p.kind) && !(await remindersOn())) return { skipped: 'off' }
  await assertWritable()
  const dupe = await readRows(POPUPS_TABLE, {
    where: (r) =>
      normEmail(r.recipient) === normEmail(p.recipient) &&
      r.kind === p.kind &&
      String(r.ref) === String(p.ref || '') &&
      !r.resolved_at,
  })
  if (dupe.length) return dupe[0]
  return appendRow(
    POPUPS_TABLE,
    {
      popup_id: newId('pop'),
      recipient: normEmail(p.recipient),
      kind: p.kind,
      title: p.title,
      body: p.body || '',
      link: p.link || '',
      ref: p.ref || '',
      created_at: new Date().toISOString(),
      resolved_at: null,
    },
    actor
  )
}

/** Closes every open pop-up matching kind + ref (resolvePopups_). Returns how many resolved. */
export async function resolvePopups(kind: string, ref: string, actor: string): Promise<number> {
  await assertWritable()
  let open: Record<string, unknown>[]
  try {
    open = await readRows(POPUPS_TABLE, {
      where: (r) => r.kind === kind && String(r.ref) === String(ref) && !r.resolved_at,
    })
  } catch {
    return 0
  }
  for (const r of open) {
    await updateRows(POPUPS_TABLE, 'popup_id', [{ key: r.popup_id, patch: { resolved_at: new Date().toISOString() } }], {
      actor,
      stampUpdates: false,
    })
    cacheRemove(POPUPS_POLL_KEY + normEmail(r.recipient)) // the poll re-reads for them
  }
  return open.length
}

/**
 * The live poll (popupsPoll): the tab is read in full only when it changed. The
 * change stamp was the sheet's last row number — on Postgres the row count plays
 * the same role (a new pop-up is always a new row). Resolved pop-ups disappear
 * within POPUPS_POLL_S, or at once when resolved here.
 */
export async function popupsPoll(email: string): Promise<{ popups: PendingPopup[] }> {
  if (!(await remindersOn())) return { popups: [] }
  const { count, error } = await db()
    .from(POPUPS_TABLE)
    .select('*', { count: 'exact', head: true })
  if (error) return { popups: [] }
  const stamp = count ?? 0
  const key = POPUPS_POLL_KEY + email
  const hit = cacheGet(key)
  if (hit) {
    try {
      const c = JSON.parse(hit) as { stamp?: number; popups?: PendingPopup[] }
      if (c.stamp === stamp) return { popups: c.popups || [] }
    } catch {
      /* stale entry: read */
    }
  }
  const popups = await pendingPopupsFor(email)
  cachePut(key, JSON.stringify({ stamp, popups }), POPUPS_POLL_S)
  return { popups }
}
