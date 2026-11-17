import dotenv from 'dotenv'

dotenv.config({ path: '.env.pulled' })
dotenv.config({ path: '.env.production' })

import { dqSetting_ } from '@/features/shared/lib/adapters'
import { fetchWorkbookTabs } from '@/features/shared/jobs/sheets'
import { configAll, setConfig } from '@/features/shared/platform/settings'

const MONTH_RE = /^\d{4}-\d{2}$/

async function main() {
  const cfg = await configAll()
  const files = dqSetting_(cfg, 'productivity_files')
  const months =
    files && typeof files === 'object' && !Array.isArray(files)
      ? Object.keys(files as Record<string, unknown>)
          .filter((month) => MONTH_RE.test(month))
          .sort()
      : []
  const latest = months.length ? months[months.length - 1] : ''
  const fromMonth = latest ? String((files as Record<string, unknown>)[latest] || '') : ''
  const id = fromMonth || String(dqSetting_(cfg, 'productivity_fallback_id') || '')
  if (!id) throw new Error('No productivity workbook id: productivity_files is empty and productivity_fallback_id is unset.')

  // Amendment-3 exemption is consumed: strict freeze — a re-run throws
  // SheetsFreezeError unless prod_assumptions is reseeded via another route.
  const tabs = await fetchWorkbookTabs(id, ['Assumptions'])
  const grid = tabs.Assumptions || []
  const value = {
    mq: Number(grid[3] && grid[3][1]),
    text: Number(grid[4] && grid[4][1]),
    wa: Number(grid[5] && grid[5][1]),
  }
  if (!Object.values(value).every(Number.isFinite)) {
    throw new Error(`Assumptions B4:B6 were not numeric: ${JSON.stringify(value)}`)
  }

  await setConfig(
    'prod_assumptions',
    value,
    'Productivity minute targets — Assumptions B4:B6; editable at /admin/config.',
    'script:seed-prod-assumptions',
  )
  console.log('seeded prod_assumptions', JSON.stringify(value))
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
