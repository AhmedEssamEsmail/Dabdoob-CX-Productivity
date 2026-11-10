import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const styles = ['theme.css', 'cx-kit.css', 'refresh.css', 'styles/queue.css']
  .map((file) => readFileSync(resolve('src/app', file), 'utf8'))
  .join('\n')

for (const { width, touch } of [320, 375, 768, 1440].map((width) => ({ width, touch: false })).concat({ width: 375, touch: true })) {
  test(`heatmap times are compact and contained at ${width}px${touch ? ' with touch' : ''}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: touch })
    const page = await context.newPage()
    await page.setContent(`
      <style>${styles}</style>
      <main data-app="queue" style="padding:16px">
        <div class="hm-panel" style="max-width:320px">
          <div class="hm-pair">
            <div class="hm-num"><label for="open">Open from</label><input id="open" class="input cx-input" type="time" value="09:30"></div>
            <div class="hm-num"><label for="close">Close at</label><input id="close" class="input cx-input" type="time" value="22:00"></div>
          </div>
          <fieldset class="hm-shifts"><legend>Shifts (Kuwait time)</legend>
            ${['AM', 'PM', 'MID'].map((shift) => `
              <div class="hm-shift">
                <label class="hm-toggle"><input type="checkbox"><span class="hm-shift-name">${shift}</span></label>
                <div class="hm-num hm-num-compact"><label class="sr-only" for="${shift}-start">${shift} starts</label><input id="${shift}-start" class="input cx-input" type="time" value="09:30"></div>
                <div class="hm-num hm-num-compact"><label class="sr-only" for="${shift}-end">${shift} ends</label><input id="${shift}-end" class="input cx-input" type="time" value="18:30"></div>
              </div>
            `).join('')}
          </fieldset>
        </div>
      </main>
    `)
    for (const input of await page.locator('input[type="time"]').all()) {
      const box = await input.boundingBox()
      expect(box!.height).toBeLessThanOrEqual(touch ? 40 : 32)
      expect(box!.height).toBeGreaterThanOrEqual(24)
      const parent = await input.locator('..').boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(parent!.x)
      expect(box!.x + box!.width).toBeLessThanOrEqual(parent!.x + parent!.width + 1)
      await input.fill('10:30')
      await expect(input).toHaveValue('10:30')
    }
    for (const row of await page.locator('.hm-shift').all()) {
      const boxes = await Promise.all((await row.locator('input[type="time"]').all()).map((input) => input.boundingBox()))
      expect(boxes[0]!.x + boxes[0]!.width + 4).toBeLessThanOrEqual(boxes[1]!.x)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await context.close()
  })
}
