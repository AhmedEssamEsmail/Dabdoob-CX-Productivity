/**
 * Notes.js — the owner's private brain-dump page (route #/notes).
 *
 * Owner only (Config assistant_owner_email, the same person My day serves);
 * nobody else, not even another admin, can read or write them. One table,
 * `my_notes`, read once per page load. A note is free text plus an optional
 * tag and a status (raw -> exploring -> decided -> dropped). Delete is soft
 * (deleted_at), like 1:1 records, so a slip can be put back.
 */

import { normEmail_ } from '@/features/shared/lib/adapters'
import { newId, appendRow, updateRow } from '@/features/shared/platform/repo'
import { readRows } from '@/features/shared/platform/repo'
import { assertWritable } from '@/features/shared/platform/viewas'
import { realEmail, assistantOwnerEmail } from '@/features/shared/platform/identity'

export const NOTE_STATUSES = ['raw', 'exploring', 'decided', 'dropped']
export const NOTE_COLUMNS = [
  'note_id', 'text', 'tag', 'status', 'deleted_at',
  'submitted_by', 'submitted_at', 'updated_by', 'updated_at',
]
const TABLE = 'my_notes'

/** Throws unless the signed-in caller is the owner. The real caller, not the View as person. */
async function notesOwner_(): Promise<string> {
  const email = await realEmail()
  const owner = await assistantOwnerEmail()
  if (!owner || email !== owner) throw new Error('Notes are private to ' + (owner || 'the owner') + '.')
  return email
}

function noteOut_(r: Record<string, unknown>) {
  return {
    id: String(r.note_id),
    text: String(r.text || ''),
    tag: String(r.tag || ''),
    status: NOTE_STATUSES.indexOf(String(r.status)) === -1 ? 'raw' : String(r.status),
    createdAt: String(r.submitted_at || ''),
    updatedAt: String(r.updated_at || r.submitted_at || ''),
  }
}

/** Every live note of the owner, newest first (notesPage). */
export async function notesPage() {
  const owner = await notesOwner_()
  let rows: Record<string, unknown>[] = []
  try {
    rows = await readRows(TABLE, { where: (r) => !r.deleted_at && normEmail_(r.submitted_by) === owner })
  } catch {
    rows = [] // missing table reads as []
  }
  return { notes: rows.map(noteOut_).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
}

/** Creates a note (no id) or patches one: { id?, text?, tag?, status? } (notesSave). */
export async function notesSave(input: Record<string, unknown>) {
  const owner = await notesOwner_()
  await assertWritable()
  const i = input || {}
  const patch: Record<string, unknown> = {}
  if ('text' in i) {
    patch.text = String(i.text || '').trim().slice(0, 20000)
    if (!patch.text) throw new Error('Write something first.')
  }
  if ('tag' in i) patch.tag = String(i.tag || '').trim().slice(0, 80)
  if ('status' in i) {
    if (NOTE_STATUSES.indexOf(String(i.status)) === -1) throw new Error('Unknown note status "' + i.status + '".')
    patch.status = i.status
  }
  if (!i.id) {
    if (!patch.text) throw new Error('Write something first.')
    const row = await appendRow(
      TABLE,
      { note_id: newId('NOTE'), text: patch.text, tag: patch.tag || '', status: patch.status || 'raw', deleted_at: '' },
      owner,
    )
    return noteOut_(row)
  }
  const row = await updateRow(TABLE, 'note_id', String(i.id), patch, {
    guard: notesGuard_(owner),
    actor: owner,
  })
  if (!row) throw new Error('That note no longer exists.')
  return noteOut_(row)
}

/** Soft-deletes a note (notesDelete). */
export async function notesDelete(id: string) {
  const owner = await notesOwner_()
  await assertWritable()
  const row = await updateRow(TABLE, 'note_id', String(id), { deleted_at: new Date().toISOString() }, {
    guard: notesGuard_(owner),
    actor: owner,
  })
  if (!row) throw new Error('That note no longer exists.')
  return { id: String(id) }
}

function notesGuard_(owner: string) {
  return function (cur: Record<string, unknown>): void {
    if (normEmail_(cur.submitted_by) !== owner || cur.deleted_at) throw new Error('That note no longer exists.')
  }
}
