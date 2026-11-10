/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* page-local helpers extracted from audit-queue-page.tsx (S13-05 split). */

/** wi-ico tone + pill for a queue row / request. */
export function wiTone(w: any): string {
  if (w.status === 'done') return 'ok'
  if (w.status === 'in_progress') return 'info'
  return w.requested ? 'warn' : ''
}
export function wiPill(w: any): { cls: string; label: string } {
  if (w.status === 'done') return { cls: 'ok', label: 'done' }
  if (w.status === 'in_progress') return { cls: 'warn', label: 'in progress' }
  return w.requested ? { cls: 'warn', label: 'requested' } : { cls: '', label: 'queued' }
}
