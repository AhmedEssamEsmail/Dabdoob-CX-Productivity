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

  try {
    const { google } = await import('googleapis')
    const body = await request.json().catch(() => ({}))
    const sheetId = body.sheetId || process.env.GOOGLE_SHEET_ID

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    })

    const sheetList = (response.data.sheets || []).map(s => ({
      title: s.properties?.title,
      rowCount: s.properties?.gridProperties?.rowCount,
      columnCount: s.properties?.gridProperties?.columnCount,
    }))

    // Optionally fetch header rows for requested sheets
    const headersRequested = (body.headers as string[] | undefined) || []
    const headers: Record<string, string[]> = {}
    for (const name of headersRequested) {
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `'${name}'!1:2`,
        })
        const vals = res.data.values || []
        headers[name] = (vals[0] as string[] | undefined) || []
      } catch {
        headers[name] = []
      }
    }

    return Response.json({
      spreadsheetTitle: response.data.properties?.title,
      sheets: sheetList,
      headers,
    })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
