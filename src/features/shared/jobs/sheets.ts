/**
 * The spreadsheet seam the ported engines still read through (SheetBookLike).
 * Legacy called SpreadsheetApp.openById + Sheet.getRange synchronously; on this
 * stack a job prefetches the tabs it needs (Google Sheets API, service account —
 * the same creds src/app/api/admin/migrate uses) and the engine reads the held
 * values through the identical getRange/getLastRow surface.
 *
 * Workbooks that feed jobs: the FD activity workbook (fd_activity_ss_id, tab
 * 'Activities'), the daily-report workbook (daily_report_ss_id, tab 'Freshchat')
 * and one month workbook per date's month (prodFileFor_) holding 'Assumptions',
 * 'Maqsam Calls', 'FD_AUX', 'AUXes Exceptions', 'Quality' and 'Headcount'.
 */

import type { SheetBookLike, SheetRangeLike, SheetTabLike } from '@/features/shared/lib/adapters'
import { describeDbError, described } from '@/features/shared/lib/errors'

/** Tabs read from each productivity month workbook (prodFileFor_). */
export const PROD_MONTH_TABS = ['Assumptions', 'Maqsam Calls', 'FD_AUX', 'AUXes Exceptions', 'Quality', 'Headcount']
/** Tabs read from the FD activity workbook (fd_activity_ss_id). */
export const FD_ACTIVITY_TABS = ['Activities']
/** Tabs read from the daily-report workbook (daily_report_ss_id). */
export const DAILY_REPORT_TABS = ['Freshchat']

/** A tab of prefetched values as a SheetTabLike — 1-based like the real sheet. */
function sheetTab(values: unknown[][]): SheetTabLike {
  const rows = values || []
  return {
    getLastRow: () => rows.length,
    getLastColumn: () => rows.reduce((m, r) => Math.max(m, (r || []).length), 0),
    getRange(row: number, col: number, nRows: number, nCols: number): SheetRangeLike {
      return {
        getValues: () => {
          const out: unknown[][] = []
          for (let r = 0; r < nRows; r++) {
            const src = rows[row - 1 + r] || []
            const line: unknown[] = []
            for (let c = 0; c < nCols; c++) line.push(src[col - 1 + c] === undefined ? '' : src[col - 1 + c])
            out.push(line)
          }
          return out
        },
        getValue: () => {
          const src = rows[row - 1] || []
          return src[col - 1] === undefined ? '' : src[col - 1]
        },
      }
    },
  }
}

/**
 * sheetBook_: a workbook over prefetched { tabName: values } grids (header row
 * included, 1-based). getSheetByName of an unfetched tab returns null — the
 * readers treat it like an empty tab (prodReadCols_/tphReadTail_ missingOk).
 */
export function sheetBook(cells: Record<string, unknown[][]>, id = ''): SheetBookLike {
  return {
    getId: () => id,
    getSheetByName: (name: string) => (cells[name] ? sheetTab(cells[name]) : null),
  }
}

/** The service-account creds the migrate route already uses; null when unset. */
export function sheetCreds(): { client_email: string; private_key: string } | null {
  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY
  if (!client_email || !key) return null
  return { client_email, private_key: key.replace(/\\n/g, '\n') }
}

/**
 * Fetches the given tabs of one spreadsheet through the Sheets API
 * (spreadsheets.readonly). One values.get per tab so a missing tab reads as an
 * empty grid instead of failing the batch. Throws when creds are absent or the
 * spreadsheet is unreachable — the caller treats that like the legacy
 * openSpreadsheet_ failure (the step that opens it fails).
 */
export async function fetchWorkbookTabs(id: string, tabs: string[]): Promise<Record<string, unknown[][]>> {
  const creds = sheetCreds()
  if (!creds) throw new Error('Google Sheets credentials are not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).')
  const { google } = await import('googleapis')
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const out: Record<string, unknown[][]> = {}
  await Promise.all(
    tabs.map(async (tab) => {
      try {
        /* values.get caps at the range end — big tabs (Activities ~193k rows) are
         * paged 100k rows at a time until a short page. */
        const PAGE = 100000
        const MAX_PAGES = 10
        let rows: unknown[][] = []
        for (let p = 0; p < MAX_PAGES; p++) {
          const from = p * PAGE + 1
          const res = await sheets.spreadsheets.values.get({
            spreadsheetId: id,
            range: `'${tab.replace(/'/g, "\\'")}'!A${from}:ZZ${from + PAGE - 1}`,
          })
          const page = (res.data.values || []) as unknown[][]
          rows = rows.concat(page)
          if (page.length < PAGE) break
        }
        out[tab] = rows
      } catch (e) {
        // Only a missing tab reads as empty (missingOk). Anything else — the
        // sheet not being shared (403), a wrong spreadsheet id (404), a rate
        // limit (429) — throws a described error, not a silent empty grid.
        const d = describeDbError(e, { workbook: id, tab })
        if (d.code === 'missing_source') {
          out[tab] = []
          return
        }
        throw described(e, { workbook: id, tab })
      }
    })
  )
  return out
}
