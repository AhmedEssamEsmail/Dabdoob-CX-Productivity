/**
 * Queue oracle: the shared LEGACY_FILES plus the Queue_deprecated / V2 Command Center
 * modules the cx-queue port came from (Scheduler, QueuePages, TlQueue, Heatmap,
 * AgingHelp, Popups, Mailer, Notify, Aggregates, Queue). Bare names resolve through
 * oracle.mjs LEGACY_DIRS; shared files are byte-identical across the three projects
 * (verified), so the Productivity copies stand in for the queue ones.
 */
import { createOracle } from '../../scripts/oracle.mjs'
import { LEGACY_FILES, json } from './helpers-oracle'

export const QUEUE_ORACLE_FILES = [
  ...LEGACY_FILES,
  'Scheduler.js',
  'QueuePages.js',
  'TlQueue.js',
  'Heatmap.js',
  'AgingHelp.js',
  'Popups.js',
  'Mailer.js',
  'Notify.js',
  'Aggregates.js',
  'Queue.js',
]

let _o: ReturnType<typeof createOracle> | null = null
export function qOracle() {
  if (!_o) _o = createOracle(QUEUE_ORACLE_FILES)
  return _o
}

/** callLegacy equivalent for the queue oracle. */
export function qCallLegacy(fn: string, args: unknown[] = [], fixtures: unknown = {}) {
  try {
    return { ok: json(qOracle().call(fn, args, fixtures as object)) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  }
}
