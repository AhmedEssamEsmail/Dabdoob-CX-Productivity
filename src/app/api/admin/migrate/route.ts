import { createClient } from '@supabase/supabase-js'
import { migrateAll, MODULE_MAPPINGS } from '@/features/shared/migration/engine'
import { MAPPINGS as ROUTE_MAPPINGS } from '@/features/shared/migration/mappings/route-core'

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAdminAuth(request: Request): Promise<boolean> {
  const expectedKey = process.env.MIGRATION_SECRET_KEY
  // Fail closed: without an env key this route must not accept anything.
  if (!expectedKey) return false
  return request.headers.get('x-migration-key') === expectedKey
}

export async function POST(request: Request) {
  if (!(await checkAdminAuth(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as { tables?: string[] }
  const wanted = body.tables?.length ? new Set(body.tables) : null

  try {
    const result = await migrateAll(supabase, [...ROUTE_MAPPINGS, ...MODULE_MAPPINGS], wanted)
    return Response.json(result)
  } catch (error) {
    return Response.json({ success: false, tables: {}, errors: ['Fatal: ' + error] }, { status: 500 })
  }
}
