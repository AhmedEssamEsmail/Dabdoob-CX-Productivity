import { test, expect } from '@playwright/test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const styles = ['theme.css', 'cx-kit.css']
  .map((file) => readFileSync(resolve('src/app', file), 'utf8'))
  .join('\n')

/* Mirrors PageShell `.page` chrome (admin-page.tsx:209-218) and SettingsSection
   `cx-panel cx-settings-section` markup (SettingsSection.tsx:14-27). */
const fixture = `
  <main style="padding:16px">
    <section class="page" aria-labelledby="page-title">
      <header class="page-head">
        <div>
          <h1 id="page-title" class="page-title">Settings</h1>
          <p class="page-purpose">Workspace defaults.</p>
        </div>
      </header>
      <section id="reminders" aria-labelledby="reminders-heading" class="cx-panel cx-settings-section">
        <h2 id="reminders-heading">Reminders</h2>
        <div class="form-grid">
          <div class="field"><label class="field-label" for="remind-before">Remind before</label><input id="remind-before" class="input cx-input" type="text" value="30m"></div>
          <div class="field"><label class="field-label" for="remind-channel">Channel</label><input id="remind-channel" class="input cx-input" type="text" value="email"></div>
        </div>
      </section>
      <section id="appearance" aria-labelledby="appearance-heading" class="cx-panel cx-settings-section">
        <h2 id="appearance-heading">Appearance</h2>
        <div class="form-grid">
          <div class="field"><label class="field-label" for="density">Density</label><input id="density" class="input cx-input" type="text" value="cozy"></div>
          <div class="field"><label class="field-label" for="theme">Theme</label><input id="theme" class="input cx-input" type="text" value="auto"></div>
        </div>
      </section>
    </section>
  </main>
`

test('settings sections keep token padding at 1024px', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 } })
  const page = await context.newPage()
  await page.setContent(`<style>${styles}</style>${fixture}`)
  for (const section of await page.locator('.cx-settings-section').all()) {
    const padding = await section.evaluate((el) => {
      const s = getComputedStyle(el)
      return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((v) => parseFloat(v))
    })
    for (const side of padding) expect(side).toBeGreaterThanOrEqual(12)
  }
  await context.close()
})

test('form grid collapses to one column at 375px with no h-scroll', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } })
  const page = await context.newPage()
  await page.setContent(`<style>${styles}</style>${fixture}`)
  for (const grid of await page.locator('.cx-settings-section .form-grid').all()) {
    const fields = await grid.locator(':scope > .field').all()
    const [first, second] = await Promise.all(fields.slice(0, 2).map((f) => f.boundingBox()))
    expect(second!.y, 'second field must stack below the first at 375px').toBeGreaterThan(first!.y + first!.height - 1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await context.close()
})

test('.page fills the viewport at 375px, not a fixed narrow column', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } })
  const page = await context.newPage()
  await page.setContent(`<style>${styles}</style>${fixture}`)
  const box = await page.locator('.page').boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(320)
  expect(box!.x + box!.width).toBeLessThanOrEqual(375)
  await context.close()
})

/* Source scan: the removed PageShell `narrow=` prop (S01-03) must not return.
   file -> reason; cap 3 entries (spec contract). */
const EXEMPT: Record<string, string> = {}
const SCAN_ROOTS = ['src/features', 'src/app']
const PAGESHELL_NARROW = /PageShell[^>]*\bnarrow\b/g

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') collectFiles(path, acc)
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(path)
    }
  }
  return acc
}

const stripComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '')

test('no PageShell consumer passes narrow= outside EXEMPT', () => {
  for (const file of Object.keys(EXEMPT)) {
    expect(existsSync(file), `stale EXEMPT entry: ${file}`).toBe(true)
  }
  const offenders: string[] = []
  for (const root of SCAN_ROOTS) {
    for (const file of collectFiles(root)) {
      if (file in EXEMPT) continue
      const src = stripComments(readFileSync(file, 'utf8'))
      for (const match of src.matchAll(PAGESHELL_NARROW)) {
        offenders.push(`${file}:${src.slice(0, match.index).split('\n').length}`)
      }
    }
  }
  expect(offenders, `PageShell narrow= offenders:\n${offenders.join('\n')}`).toEqual([])
})
