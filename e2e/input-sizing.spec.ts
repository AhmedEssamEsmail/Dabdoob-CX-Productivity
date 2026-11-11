import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const styles = ['theme.css', 'cx-kit.css']
  .map((file) => readFileSync(resolve('src/app', file), 'utf8'))
  .join('\n')

/* Mirrors Field/Input/Select/Textarea rendered markup (Field.tsx:61-76,
   Input.tsx:12, Select.tsx:12, Textarea.tsx:10) inside SettingsSection's
   `cx-panel cx-settings-section` + `.form-grid` (SettingsSection.tsx:17-25). */
const fixture = `
  <main style="padding:16px">
    <section id="inputs" aria-labelledby="inputs-heading" class="cx-panel cx-settings-section">
      <h2 id="inputs-heading">Inputs</h2>
      <div class="form-grid">
        <div class="cx-field"><label class="field-label" for="f-text">Agent name</label><input id="f-text" class="input cx-input" type="text" value="Fatima"></div>
        <div class="cx-field"><label class="field-label" for="f-time">Shift starts</label><input id="f-time" class="input cx-input" type="time" value="09:30"></div>
        <div class="cx-field"><label class="field-label" for="f-channel">Channel</label><select id="f-channel" class="cx-select"><option>Email</option><option>SMS</option></select></div>
        <div class="cx-field"><label class="field-label" for="f-note">Note</label><textarea id="f-note" class="cx-textarea" rows="2">Prefilled note</textarea></div>
      </div>
    </section>
  </main>
`

const CONTROLS = 'input.cx-input, select.cx-select, textarea.cx-textarea'

test('controls stay inside their field at 375px and 1024px', async ({ browser }) => {
  for (const width of [375, 1024]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    await page.setContent(`<style>${styles}</style>${fixture}`)
    for (const control of await page.locator(CONTROLS).all()) {
      const box = await control.boundingBox()
      const parent = await control.locator('..').boundingBox()
      expect(box!.x, `${control} at ${width}px`).toBeGreaterThanOrEqual(parent!.x)
      expect(box!.x + box!.width, `${control} at ${width}px`).toBeLessThanOrEqual(parent!.x + parent!.width + 1)
    }
    await context.close()
  }
})

test('single-line controls keep usable height at 375px and 1024px', async ({ browser }) => {
  for (const width of [375, 1024]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    await page.setContent(`<style>${styles}</style>${fixture}`)
    for (const control of await page.locator('input.cx-input, select.cx-select').all()) {
      const box = await control.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(24)
      expect(box!.height).toBeLessThanOrEqual(44)
    }
    // multi-line control: usable floor only (--cx-target = 36px)
    const note = await page.locator('textarea.cx-textarea').boundingBox()
    expect(note!.height).toBeGreaterThanOrEqual(36)
    await context.close()
  }
})

test('text and time inputs accept fill() and keep the value', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } })
  const page = await context.newPage()
  await page.setContent(`<style>${styles}</style>${fixture}`)
  const text = page.locator('#f-text')
  await text.fill('Salem')
  await expect(text).toHaveValue('Salem')
  const time = page.locator('#f-time')
  await time.fill('10:30')
  await expect(time).toHaveValue('10:30')
  await context.close()
})

test('no horizontal scroll at 320px and 375px', async ({ browser }) => {
  for (const width of [320, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } })
    const page = await context.newPage()
    await page.setContent(`<style>${styles}</style>${fixture}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await context.close()
  }
})
