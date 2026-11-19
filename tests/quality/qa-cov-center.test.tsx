import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { WeekCoverage } from '@/features/cx-quality/components/audit-queue-coverage'
import { SortTh } from '@/features/cx-quality/components/qa-shared'

/* Regression: the weekly coverage table's date and Done columns must carry
   center-aligned markup. .cx-table's base rule (`text-align:start`, spec
   0,2,1) used to beat the unscoped .qa-cov__day/.qa-cov__cell rules, so the
   CSS now scopes them under .qa-cov and the Done column carries qa-cov__ctr
   on both its SortTh header and its body cells. */

const ROW = {
  email: 'a@x.com',
  name: 'Ann',
  quota: 20,
  perDay: 4,
  done: 5,
  requested: 1,
  waiting: 2,
  remaining: 15,
  days: [0, 5, 0, 0, 0, 0, 0],
}

const DATA = {
  quotaWeeks: [{ weekStart: '2026-11-15', rows: [ROW] }],
  today: '2026-11-19',
}

const sort = { s: null, toggle: () => {}, apply: (rows: unknown[]) => rows }

describe('WeekCoverage center-aligned columns', () => {
  it('marks the Done column header with qa-cov__ctr', () => {
    const el = SortTh({ col: 'done', sort, className: 'qa-cov__ctr', children: 'Done' })
    expect(el.props.scope).toBe('col')
    expect(el.props.className).toBe('qa-cov__ctr')
  })

  it('renders qa-cov__ctr on the Done header and Done cells', () => {
    const html = renderToString(createElement(WeekCoverage, { d: DATA }))
    // Done <th> and the Done <td> both carry the marker class
    expect(html).toContain('class="qa-cov__ctr"')
    expect(html).toContain('class="cx-num qa-cov__ctr"')
    // date headers keep qa-cov__day (centered by the scoped CSS rule)
    expect(html).toContain('qa-cov__day')
    expect(html).toContain('qa-cov__cell')
    // other summary columns stay unmarked (left-aligned)
    expect(html).not.toContain('Requests waiting</button></th><th class="qa-cov__ctr"')
  })
})
