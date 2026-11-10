// ux-r2 DELTA evidence: render fixture with REAL app CSS (theme+cx-kit+refresh, app order)
// Assert computed styles for the ux1-01 `.cx-panel > .cx-section__head` contract + chip/empty context.
// Usage (from repo root): node specs/ux-ui-audit-v2/fixtures/capture-ux-r2.mjs
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixture = 'file:///' + path.join(here, 'ux-r2-fixture.html').replace(/\\/g, '/')
const shotsDir = path.join(here, '..', 'shots')
fs.mkdirSync(shotsDir, { recursive: true })

const out = []
const check = (name, got, want, pass) => out.push({ name, got, want, pass })

const browser = await chromium.launch()
for (const theme of ['light', 'dark']) {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.goto(fixture, { waitUntil: 'networkidle' })
    if (theme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    const m = await page.evaluate(() => {
      const cs = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop]
      const bb = sel => document.querySelector(sel).getBoundingClientRect()
      const r = {}
      const aH = '#a .cx-section__head'
      r.a_padT = cs(aH, 'paddingTop'); r.a_padL = cs(aH, 'paddingLeft')
      r.a_brdW = cs(aH, 'borderBottomWidth'); r.a_brdS = cs(aH, 'borderBottomStyle')
      r.a_brdC = cs(aH, 'borderBottomColor')
      const bH = '#b .cx-section__head'
      r.b_padT = cs(bH, 'paddingTop'); r.b_brdW = cs(bH, 'borderBottomWidth')
      r.c_padT = cs('#c .card-head', 'paddingTop'); r.c_padL = cs('#c .card-head', 'paddingLeft')
      r.c_brdW = cs('#c .card-head', 'borderBottomWidth')
      r.a_titleX = +bb('#a .cx-section__title').x.toFixed(1)
      r.a_bodyX = +bb('#a .cx-panel--pad p').x.toFixed(1)
      const dot = getComputedStyle(document.querySelector('#d [data-status="ok"]'), '::before')
      r.chipDotBg = dot.backgroundColor; r.chipDotW = dot.width
      r.chipPlainDot = getComputedStyle(document.querySelector('#d .cx-chip--plain'), '::before').display
      r.scrollW = document.documentElement.scrollWidth; r.clientW = document.documentElement.clientWidth
      r.f_brdW = cs('#f .cx-section__head', 'borderBottomWidth')
      return r
    })
    const t = `${theme}@${width}`
    check(`${t} A head padding-top`, m.a_padT, '12px (var(--cx-space-3))', m.a_padT === '12px')
    check(`${t} A head padding-left`, m.a_padL, '16px (var(--cx-space-4))', m.a_padL === '16px')
    check(`${t} A head divider`, `${m.a_brdW} ${m.a_brdS}`, '1px solid', m.a_brdW === '1px' && m.a_brdS === 'solid')
    check(`${t} B canonical head padding-top`, m.b_padT, '0px (untouched)', m.b_padT === '0px')
    check(`${t} B canonical head divider`, m.b_brdW, '0px (untouched)', m.b_brdW === '0px')
    check(`${t} F form-panel head divider`, m.f_brdW, '1px', m.f_brdW === '1px')
    check(`${t} C legacy card-head`, `${m.c_padT}/${m.c_padL}/${m.c_brdW}`, 'parity ref', m.c_brdW === '1px')
    check(`${t} A head-text vs body left edge`, `${m.a_titleX} vs ${m.a_bodyX}`, 'equal (±1px)', Math.abs(m.a_titleX - m.a_bodyX) <= 1)
    check(`${t} chip ok dot`, `${m.chipDotW} ${m.chipDotBg}`, 'rendered dot', m.chipDotW !== '0px')
    check(`${t} chip plain no dot`, m.chipPlainDot, 'none', m.chipPlainDot === 'none')
    check(`${t} no horizontal scroll`, `${m.scrollW}<=${m.clientW}`, 'no h-scroll', m.scrollW <= m.clientW)
    await page.screenshot({ path: path.join(shotsDir, `ux-r2-${theme}-${width}.png`), fullPage: true })
    await page.close()
  }
}
await browser.close()
const fails = out.filter(c => !c.pass)
console.log(JSON.stringify({ fails: fails.length, checks: out }, null, 1))
process.exit(fails.length ? 1 : 0)
