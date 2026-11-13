/**
 * Typed mirror row -> the positional cell arrays the shared TPH readers
 * still consume. The legacy `cols` jsonb column is no longer written or
 * read (S05-03); readers always re-derive cells from the typed columns.
 */
import 'server-only'

type Row = Record<string, unknown>

/** Typed timestamptz cell -> the ISO string the positional readers parse; null/blank -> ''. */
const iso_ = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return ''
  const ms = Date.parse(String(v))
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString()
}

/** Typed text cell -> string; null -> ''. */
const cell_ = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** fd_activities typed row -> the Activities A..J cell array (10 cells, J empty). */
export function fdActivityCells_(r: Row): unknown[] {
  return [
    iso_(r.performed_at),
    cell_(r.ticket_id),
    cell_(r.performer_name),
    cell_(r.performer_type),
    cell_(r.activity_type),
    cell_(r.field_changed),
    cell_(r.new_value),
    cell_(r.old_value),
    cell_(r.group_name),
    '',
  ]
}

/** maqsam_calls typed row -> the 7-cell D..J mirror layout. */
export function maqsamCells_(r: Row): unknown[] {
  return [
    iso_(r.started_at),
    iso_(r.ended_at),
    cell_(r.duration),
    cell_(r.agent_email),
    cell_(r.state),
    cell_(r.direction),
    cell_(r.handling),
  ]
}

/** freshchat typed row -> the 7-cell A..G mirror layout. */
export function freshchatCells_(r: Row): unknown[] {
  return [
    iso_(r.initiated_at),
    cell_(r.status),
    cell_(r.ref_key),
    iso_(r.updated_at),
    iso_(r.resolved_at),
    cell_(r.channel),
    cell_(r.conversation_id),
  ]
}
