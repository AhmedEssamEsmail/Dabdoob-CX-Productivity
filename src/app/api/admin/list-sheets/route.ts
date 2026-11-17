export const maxDuration = 60

async function checkAdminAuth(request: Request): Promise<boolean> {
  const migrationKey = request.headers.get('x-migration-key')
  const expectedKey = process.env.MIGRATION_SECRET_KEY
  // Fail closed: without an env key this route must not accept anything.
  if (!expectedKey) return false
  return migrationKey === expectedKey
}

export async function POST(request: Request) {
  const isAdmin = await checkAdminAuth(request)
  if (!isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return Response.json({ error: 'Sheet reads are frozen (qa-live-sheets-freeze); this diagnostic is retired.' }, { status: 410 })
}
