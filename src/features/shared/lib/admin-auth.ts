/**
 * requireAdminCaller — the admin-only gate for operator endpoints
 * (source-health, mirrors, backfill). Accepts either a signed-in admin
 * session (requireRole) or the migration key the admin/migrate route uses
 * (x-migration-key header == MIGRATION_SECRET_KEY), so the same endpoints
 * work from the browser and from scripts. Throws 'Unauthorized' /
 * 'Forbidden'-style errors for apiError() to map.
 */

import { requireRole } from '@/features/shared/lib/auth'

export async function requireAdminCaller(req: Request): Promise<{ email: string; role: string }> {
  const key = req.headers.get('x-migration-key')
  const expected = process.env.MIGRATION_SECRET_KEY
  if (expected && key && key === expected) {
    return { email: 'system:migration-key', role: 'admin' }
  }
  const user = await requireRole(['admin'])
  return { email: String(user.email || '').toLowerCase(), role: 'admin' }
}
