import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const styles = ['theme.css', 'cx-kit.css', 'refresh.css']
  .map((file) => readFileSync(resolve('src/app', file), 'utf8'))
  .join('\n')

for (const width of [375, 768, 1024, 1440]) {
  test(`aging toolbar stays anchored through refresh states at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.setContent(`
      <style>${styles}</style>
      <main style="padding:24px">
        <header class="page-head aging-page-head">
          <div>
            <h1 class="page-title">Aging cases</h1>
            <p class="page-purpose">Every open ticket, coloured by how long it has waited. The redder the row, the longer the customer has been left.</p>
          </div>
          <div class="page-actions">
            <div class="cx-seg" role="radiogroup" aria-label="Assignment">
              <label><input type="radio" name="assignment" checked><span>All</span></label>
              <label><input type="radio" name="assignment"><span>Ours</span></label>
              <label><input type="radio" name="assignment"><span>Unassigned</span></label>
            </div>
            <span class="cx-section__hint">Freshdesk, read Wed 11 Nov at 01:19 Kuwait time</span>
            <span class="cx-refresh"><button class="cx-btn" type="button">Refresh now</button></span>
          </div>
        </header>
      </main>
    `)
    const controls = [page.getByRole('radiogroup'), page.locator('.page-actions > .cx-section__hint'), page.getByRole('button')]
    const positions = await Promise.all(controls.map((control) => control.boundingBox()))
    for (const state of [
      { label: 'Refreshing…', message: '' },
      { label: 'Refresh now', message: "Could not find the 'submitted_at' column of 'refresh_log' in the schema cache" },
      { label: 'Refresh again in 60 s', message: 'Freshdesk changes up to 01:20 Kuwait time.' },
    ]) {
      await page.locator('.cx-refresh').evaluate((element, next) => {
        element.querySelector('button')!.textContent = next.label
        element.querySelector('[role="status"]')?.remove()
        if (next.message) {
          const status = document.createElement('span')
          status.className = 'cx-section__hint'
          status.setAttribute('role', 'status')
          status.textContent = next.message
          element.append(status)
        }
      }, state)
      for (const [index, control] of controls.entries()) {
        const box = await control.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.x).toBeCloseTo(positions[index]!.x, 0)
        expect(box!.y).toBeCloseTo(positions[index]!.y, 0)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  })
}
