/**
 * Org level from position title; falls back to roster role when position is
 * blank (backfill may not have run yet). Access stays on `role` — this is the
 * title axis only.
 */
export function dqTitleLevel_(position: unknown, role: string): 'agent' | 'tl' | 'manager' {
  const p = String(position || '').trim()
  if (/team\s*lead(er)?/i.test(p)) return 'tl'
  if (/manager|head of/i.test(p)) return 'manager'
  if (p) return 'agent'
  if (role === 'tl') return 'tl'
  if (role === 'admin') return 'manager'
  return 'agent'
}
