import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { fetchWorkbookTabs } from '@/features/shared/jobs/sheets'
import { qaPeriodOf_, qaWhen_ } from '@/features/cx-quality/lib/core'

const SS_QUALITY = '1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w'

function weekOf(d: string) { return qaPeriodOf_(d, 'week', 0) }
function sheetDate(v: unknown): string {
  const s = String(v === undefined || v === null ? '' : v).replace(/^'/, '')
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(qaWhen_(s)) || /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return m ? m[1] : ''
}
const WEEKS = [] as string[]
for (let i = 0; i < 12; i++) {
  const d = new Date(Date.UTC(2026, 7, 30) + i * 7 * 864e5)
  WEEKS.push(d.toISOString().slice(0, 10))
}

async function main() {
  const tabs = await fetchWorkbookTabs(SS_QUALITY, ['qa_audits', 'qa_queue'])
  const qrows = tabs['qa_queue'] || []
  const qhead = (qrows[0] || []).map((h) => String(h || '').trim())
  const qE = qhead.indexOf('agent_email')
  const qAt = qhead.indexOf('interaction_at')
  const qD = qhead.indexOf('queue_date')
  console.log('sheet qa_queue rows (incl header):', qrows.length, 'cols:', { qE, qAt, qD })
  const qper: Record<string, Record<string, number>> = {}
  const qperByQd: Record<string, Record<string, number>> = {}
  qrows.slice(1).forEach((r) => {
    const e = String(r[qE] || '').trim()
    if (!e) return
    const d = sheetDate(r[qAt])
    if (d) {
      const w = weekOf(d)
      if (w >= '2026-08-30' && w <= '2026-11-15') (qper[e] = qper[e] || {})[w] = ((qper[e] || {})[w] || 0) + 1
    }
    const qd = sheetDate(r[qD])
    if (qd) {
      const w = weekOf(qd)
      if (w >= '2026-08-30' && w <= '2026-11-15') (qperByQd[e] = qperByQd[e] || {})[w] = ((qperByQd[e] || {})[w] || 0) + 1
    }
  })
  console.log('\n=== SHEET qa_queue by interaction_at ===')
  console.log('WEEK       ' + WEEKS.map((w) => w.slice(5)).join('  '))
  Object.keys(qper).sort().forEach((e) => {
    console.log(e.padEnd(38), WEEKS.map((w) => String((qper[e] || {})[w] || 0).padStart(8)).join(''))
  })
  console.log('\n=== SHEET qa_queue by queue_date ===')
  Object.keys(qperByQd).sort().forEach((e) => {
    console.log(e.padEnd(38), WEEKS.map((w) => String((qperByQd[e] || {})[w] || 0).padStart(8)).join(''))
  })

  const rows = tabs['qa_audits'] || []
  console.log('\nsheet qa_audits rows (incl header):', rows.length)
  const head = (rows[0] || []).map((h) => String(h || '').trim())
  const iEmail = head.indexOf('agent_email')
  const iAt = head.indexOf('interaction_at')
  const iAd = head.indexOf('audit_date')
  const iId = head.indexOf('audit_id')
  console.log('cols:', { iEmail, iAt, iAd, iId })

  const per: Record<string, Record<string, number>> = {}
  const nodate: Record<string, number> = {}
  const ids = new Set<string>()
  let dupes = 0
  rows.slice(1).forEach((r) => {
    const e = String(r[iEmail] || '').trim()
    if (!e) return
    const id = String(r[iId] || '')
    if (ids.has(id)) dupes++
    ids.add(id)
    const d = sheetDate(r[iAt])
    if (!d) {
      nodate[e] = (nodate[e] || 0) + 1
      return
    }
    const w = weekOf(d)
    if (w < '2026-08-30' || w > '2026-11-15') return
    ;(per[e] = per[e] || {})[w] = ((per[e] || {})[w] || 0) + 1
  })
  console.log('distinct audit_ids:', ids.size, '| duplicate rows:', dupes)

  console.log('\n=== SHEET COUNTA by interaction date ===')
  console.log('WEEK       ' + WEEKS.map((w) => w.slice(5)).join('  '))
  Object.keys(per).sort().forEach((e) => {
    console.log(e.padEnd(38), WEEKS.map((w) => String((per[e] || {})[w] || 0).padStart(8)).join(''), '  nodate:' + (nodate[e] || 0))
  })
}
main().catch((e) => console.error(e))
