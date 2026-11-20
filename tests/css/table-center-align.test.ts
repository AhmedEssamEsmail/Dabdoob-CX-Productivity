import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { WeekCoverage } from '@/features/cx-quality/components/audit-queue-coverage'

/* Regression net for table-center-align (PLAN #6):
   - cx-kit.css wins with centered thead + numeric-cell rules
   - per-app sheets no longer force thead cells back to start/end
   - row-label escapes (.cx-groupbreak, .sch-sticky) survive
   - markup keeps the cx-num class contract S02 relies on */

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

const PER_APP = [
  'src/app/styles/desk.css',
  'src/app/styles/people.css',
  'src/app/styles/queue.css',
  'src/app/styles/quality.css',
  'src/app/refresh.css',
]

describe('cx-kit.css centered table cascade', () => {
  it('centers thead cells for .cx-table and bare tables', () => {
    const css = read('src/app/cx-kit.css')
    expect(css).toMatch(
      /:is\(\.cx-table,\s*table\)\s*thead\s+tr\s+th\s*\{[^}]*text-align:\s*center/,
    )
  })

  it('centers numeric cells via :is(td, tbody th):is(.cx-num, .num, .cx-num-col, .trk-num)', () => {
    const css = read('src/app/cx-kit.css')
    expect(css).toMatch(
      /:is\(td,\s*tbody\s+th\):is\(\.cx-num,\s*\.num,\s*\.cx-num-col,\s*\.trk-num\)\s*\{[^}]*text-align:\s*center/,
    )
  })

  it('keeps .cx-num-col centered (no end regression)', () => {
    const css = read('src/app/cx-kit.css')
    const rule = css.match(/\.cx-num-col\s*\{([^}]*)\}/)
    expect(rule, '.cx-num-col rule missing').not.toBeNull()
    expect(rule![1]).toMatch(/text-align:\s*center/)
    expect(rule![1]).not.toMatch(/text-align:\s*(start|end)\b/)
  })
})

describe('per-app sheets stop overriding thead alignment', () => {
  it.each(PER_APP)('%s has no thead th rule forcing start/end', (file) => {
    const css = read(file)
    const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
    for (const m of rules) {
      const targetsTheadTh = m[1]
        .split(',')
        .some((s) => /thead/.test(s) && /\bth\b/.test(s))
      if (targetsTheadTh) {
        expect(m[2], `${file} selector "${m[1].trim()}"`).not.toMatch(
          /text-align:\s*(start|end)\b/,
        )
      }
    }
  })

  it('quality.css .num rule declares center', () => {
    const css = read('src/app/styles/quality.css')
    expect(css).toMatch(
      /\.cx-table\s*:is\(th,\s*td\)\.num\s*\{[^}]*text-align:\s*center/,
    )
  })
})

describe('row-label guards survive the centering sweep', () => {
  it('refresh.css keeps .cx-groupbreak th left-aligned', () => {
    expect(read('src/app/refresh.css')).toMatch(
      /\.cx-groupbreak\s+th\s*\{[^}]*text-align:\s*start\b/,
    )
  })

  it('queue.css keeps tbody .sch-sticky start !important; base .sch-sticky drops text-align', () => {
    const css = read('src/app/styles/queue.css')
    expect(css).toMatch(
      /\[data-app="queue"\]\s+tbody\s+\.sch-sticky\s*\{[^}]*text-align:\s*start\s*!important/,
    )
    const base = css.match(/\[data-app="queue"\]\s+\.sch-sticky\s*\{([^}]*)\}/)
    expect(base, '.sch-sticky base rule missing').not.toBeNull()
    expect(base![1]).not.toMatch(/text-align/)
  })

  it('queue.css keeps .sch-table tbody row-label th start-aligned', () => {
    expect(read('src/app/styles/queue.css')).toMatch(
      /\.sch-table\s+tbody\s+:is\(th,\s*td\)\s*\{[^}]*text-align:\s*start/,
    )
  })

  it('queue.css restores .sch-table thead th padding', () => {
    expect(read('src/app/styles/queue.css')).toMatch(
      /\.sch-table\s+thead\s+th\s*\{[^}]*padding:\s*var\(--cx-space-2\)\s+var\(--cx-space-3\)/,
    )
  })
})

// Reuse the qa-cov-center markup fixture to prove the cx-num class contract.
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

describe('markup class contract', () => {
  it('WeekCoverage still renders cx-num on centered numeric cells', () => {
    const html = renderToString(createElement(WeekCoverage, { d: DATA }))
    expect(html).toContain('class="cx-num qa-cov__ctr"')
  })
})

describe('R2 chip-cell + narrowing rules', () => {
  it('centers any td carrying a .cx-chip at any depth', () => {
    expect(read('src/app/cx-kit.css')).toMatch(
      /:is\(\.cx-table,\s*table\)\s+td:has\(\.cx-chip\)\s*\{[^}]*text-align:\s*center/,
    )
  })

  it('never sweeps th / tbody th row labels into the chip rule', () => {
    const css = read('src/app/cx-kit.css')
    expect(css).not.toMatch(/th:has\(\.cx-chip\)/)
    expect(css).not.toMatch(/tbody\s+th:has\(/)
  })

  it('cx-txt opts a text-primary td out of the chip center rule', () => {
    const css = read('src/app/cx-kit.css')
    expect(css).toMatch(/:root :is\(\.cx-table, table\) td\.cx-txt\s*\{[^}]*text-align:\s*start/)
    const chipIdx = css.indexOf('td:has(.cx-chip)')
    const txtIdx = css.indexOf('td.cx-txt')
    expect(chipIdx).toBeGreaterThanOrEqual(0)
    expect(txtIdx).toBeGreaterThan(chipIdx)
  })

  it('shrinks .cx-select.qa-narrow to content width', () => {
    expect(read('src/app/styles/quality.css')).toMatch(
      /\.cx-select\.qa-narrow\s*\{[^}]*inline-size:\s*auto/,
    )
  })

  it('left-aligns .qa-whylist li content (Status/Why split into columns)', () => {
    const css = read('src/app/styles/quality.css')
    expect(css).toMatch(
      /\.qa-whylist\s+li\s*\{[^}]*justify-content:\s*flex-start/,
    )
  })

  it('keeps the bare .qa-narrow 12rem cap free of width overrides', () => {
    const css = read('src/app/styles/quality.css')
    const bare = css.match(/\[data-app="quality"\]\s+\.qa-narrow\s*\{([^}]*)\}/)
    expect(bare, 'bare .qa-narrow rule missing').not.toBeNull()
    expect(bare![1]).toMatch(/max-inline-size:\s*12rem/)
    expect(bare![1].replace(/max-inline-size:[^;}]+/g, '')).not.toMatch(
      /\b(inline-size|width)\s*:/,
    )
  })
})

describe('R2 cx-num markup contract', () => {
  it('quality-analytics Channels td carries cx-num', () => {
    expect(
      read('src/features/cx-quality/components/quality-analytics-page.tsx'),
    ).toMatch(/<td className="cx-num">\s*\{s\.channels\.length/)
  })

  it('quality-scores dual-mode td applies cx-num only in count mode', () => {
    const src = read(
      'src/features/cx-quality/components/quality-scores-page.tsx',
    )
    expect(src).toMatch(
      /<td[^>]*className=\{m\s*\?[^}]*cx-num[^}]*\}[^>]*>\s*\{m\s*\?[^\n]*r\.agents/,
    )
  })
})
