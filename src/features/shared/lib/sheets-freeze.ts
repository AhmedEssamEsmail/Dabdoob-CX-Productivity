import 'server-only'

/* Mirror of migration/engine.ts SPREADSHEETS literals — engine cannot be
 * imported here (engine -> this module -> engine would cycle). */
export const SHEETS_FREEZE_QUALITY_ID = '1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w' // ss_quality_id
export const SHEETS_FREEZE_HCT_ID = '1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw' // roster_hct_ss_id

export class SheetsFreezeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SheetsFreezeError'
  }
}

export interface SheetReadGateOpts {
  extraIds?: readonly string[] // caller-resolved extra allowed workbook ids; tab 'Activities' only
  manualHct?: boolean // caller is the manual "Sync roster from HCT now" path
  deferred?: boolean // wave-1 grandfather: log [SHEETS_FREEZE_VIOLATION], allow
}

export function assertSheetReadAllowed_(
  spreadsheetId: string,
  tab: string,
  opts?: SheetReadGateOpts
): void {
  if (spreadsheetId === SHEETS_FREEZE_QUALITY_ID && tab === 'qa_audits') return
  if (spreadsheetId === SHEETS_FREEZE_HCT_ID && tab === 'Sheet1' && opts?.manualHct) return
  if (tab === 'Activities' && opts?.extraIds?.includes(spreadsheetId)) return
  if (opts?.deferred) {
    console.error('[SHEETS_FREEZE_VIOLATION] ' + JSON.stringify({ spreadsheetId, tab }))
    return
  }
  throw new SheetsFreezeError('Sheets read frozen: ' + spreadsheetId + ' / ' + tab)
}
