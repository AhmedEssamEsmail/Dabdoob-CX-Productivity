import { google } from 'googleapis'

export const maxDuration = 60

async function checkAdminAuth(request: Request): Promise<boolean> {
  const migrationKey = request.headers.get('x-migration-key')
  const expectedKey = process.env.MIGRATION_SECRET_KEY || 'migration-secret-2024'
  return migrationKey === expectedKey
}

export async function POST(request: Request) {
  const isAdmin = await checkAdminAuth(request)
  if (!isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
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

    return Response.json({
      spreadsheetTitle: response.data.properties?.title,
      sheets: sheetList,
    })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
