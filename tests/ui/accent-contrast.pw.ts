import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const app = path.resolve(__dirname, '../../src/app')
const css = ['theme.css', 'cx-kit.css', ...readdirSync(path.join(app, 'styles')).map(name => `styles/${name}`)]
  .map(file => readFileSync(path.join(app, file), 'utf8')).join('\n')
const surfaces = ['bg', 'surface', 'surface-2', 'surface-sunken', 'accent-soft']
const modes = [
  { theme: 'light', system: 'light' },
  { theme: 'dark', system: 'light' },
  { theme: 'light', system: 'dark' },
  { theme: 'dark', system: 'dark' },
  { theme: null, system: 'light' },
  { theme: null, system: 'dark' },
] as const
const accents = ['default', 'pine', 'blue', 'plum', 'rust']

function fixture() {
  return `<style>${css}</style>
    <style>.samples { display:grid; grid-template-columns:1fr 1fr; gap:16px }
      .sample { padding:16px; display:grid; gap:8px }</style>
    <h1>Accent contrast</h1><div class="samples">
    ${surfaces.map(surface => `<section class="sample" style="background:var(--cx-${surface})">
      <div data-app="hub"><button class="md-link" data-probe="text">My day link</button></div>
      <div data-app="queue">
        <button class="dq-crumb" data-probe="text">Queue breadcrumb</button>
        <strong class="hm-total-n" data-probe="text">128</strong>
      </div>
      <div class="cx-seg"><label><input type="radio" checked><span data-probe="text">Selected segment</span></label></div>
      <label class="cx-toggle"><input type="checkbox" checked><span data-probe="text">Days off</span></label>
      <button class="cx-tab" aria-selected="true" data-probe="text">Selected tab</button>
      <a class="nav-link" aria-current="page" href="#main">
        <svg class="nav-icon" viewBox="0 0 20 20" aria-hidden="true" data-probe="icon"><path d="M2 10h16"/></svg>
        <span class="nav-text" data-probe="text">Current page</span>
      </a>
      <button class="cx-btn cx-btn--primary" data-probe="text">Primary action</button>
    </section>`).join('')}</div>`
}

test('fields retain visible keyboard focus in forced colors', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' })
  await page.setContent(`<style>${css}</style>
    <input class="input" aria-label="Legacy input">
    <select class="select" aria-label="Legacy select"><option>Any</option></select>
    <input class="cx-input" aria-label="Input">
    <select class="cx-select" aria-label="Select"><option>Any</option></select>
    <textarea class="cx-textarea" aria-label="Notes"></textarea>`)
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press('Tab')
    const focus = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement!)
      return { width: parseFloat(style.outlineWidth), style: style.outlineStyle }
    })
    expect(focus.width).toBeGreaterThanOrEqual(2)
    expect(focus.style).toBe('solid')
  }
})

test('pressed ladder and hub segmented actions have visible states', async ({ page }) => {
  await page.setContent(`<style>${css}</style>
    <button class="cx-ladder__seg" aria-pressed="true">Selected ladder</button>
    <div data-app="hub"><div class="pw-seg" role="group" aria-label="Priority">
      <button aria-pressed="true">Any</button><button aria-pressed="false">Urgent</button>
    </div></div>`)
  await expect(page.locator('.cx-ladder__seg')).toHaveCSS('outline-style', 'solid')
  await expect(page.locator('.cx-ladder__seg')).toHaveCSS('outline-width', '3px')
  await expect(page.locator('.pw-seg')).toHaveCSS('display', 'inline-flex')
  const selected = page.locator('.pw-seg button[aria-pressed="true"]')
  const other = page.locator('.pw-seg button[aria-pressed="false"]')
  expect(await selected.evaluate(el => getComputedStyle(el).backgroundColor))
    .not.toBe(await other.evaluate(el => getComputedStyle(el).backgroundColor))
})

for (const { theme, system } of modes) {
  for (const accent of accents) {
    test(`${theme ?? 'auto'} theme / ${system} system / ${accent} accent`, async ({ page }, testInfo) => {
      await page.route('**/*', route => route.abort())
      await page.emulateMedia({ colorScheme: system, reducedMotion: 'reduce' })
      await page.setContent(fixture())
      await page.evaluate(({ theme, accent }) => {
        const root = document.documentElement
        if (theme) root.dataset.theme = theme
        if (accent !== 'default') root.dataset.accent = accent
        root.setAttribute('data-reduce-motion', '')
      }, { theme, accent })

      const measure = () => page.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        // Canvas converts browser-resolved OKLab/color-mix to sRGB for WCAG.
        const rgba = (color: string) => {
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = color
          ctx.fillRect(0, 0, 1, 1)
          const pixel = ctx.getImageData(0, 0, 1, 1).data
          return [pixel[0], pixel[1], pixel[2], pixel[3] / 255]
        }
        const over = (fg: number[], bg: number[]) => {
          const alpha = fg[3] + bg[3] * (1 - fg[3])
          if (alpha === 0) return [0, 0, 0, 0]
          return [...fg.slice(0, 3).map((v, i) =>
            (v * fg[3] + bg[i] * bg[3] * (1 - fg[3])) / alpha), alpha]
        }
        const luminance = (rgb: number[]) => {
          const [r, g, b] = rgb.slice(0, 3).map(value => {
            const v = value / 255
            return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4
          })
          return .2126 * r + .7152 * g + .0722 * b
        }
        return Array.from(document.querySelectorAll<HTMLElement>('[data-probe]')).map(el => {
          const style = getComputedStyle(el)
          let background = [0, 0, 0, 0]
          for (let node: Element | null = el; node && background[3] < 1; node = node.parentElement) {
            background = over(background, rgba(getComputedStyle(node).backgroundColor))
          }
          if (background[3] < 1) background = over(background, [255, 255, 255, 1])
          const fg = luminance(over(rgba(style.color), background))
          const bg = luminance(background)
          return {
            element: el.getAttribute('class'),
            text: el.textContent,
            foreground: style.color,
            background,
            ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05),
            minimum: el.dataset.probe === 'icon' ? 3 : 4.5,
          }
        })
      })
      const normal = await measure()
      expect(normal).toHaveLength(surfaces.length * 9)
      const buttons = page.locator('.cx-btn--primary')
      await buttons.first().hover()
      const hovered = (await measure()).filter(result => result.text === 'Primary action')
      const readings = [...normal, ...hovered]
      await testInfo.attach('contrast.json', { body: JSON.stringify(readings, null, 2), contentType: 'application/json' })
      expect(readings.filter(result => !Number.isFinite(result.ratio) || result.ratio < result.minimum),
        'WCAG AA foreground contrast').toEqual([])

      if (theme === system && accent !== 'default') {
        await page.screenshot({ path: testInfo.outputPath('accent.png'), fullPage: true })
      }
    })
  }
}
