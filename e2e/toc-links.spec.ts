import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const styles = ['theme.css', 'cx-kit.css']
  .map((file) => readFileSync(resolve('src/app', file), 'utf8'))
  .join('\n')

// Mirrors SettingsToc markup (SettingsSection.tsx): nav.cx-toc > ul > li > a
const tocMarkup = `
  <main style="padding:24px">
    <nav class="cx-toc" aria-label="Settings">
      <ul>
        <li><a href="#profile">Profile</a></li>
        <li><a href="#notifications">Notifications</a></li>
        <li><a href="#connections">Connections</a></li>
      </ul>
    </nav>
    <section id="profile"></section>
    <section id="notifications"></section>
    <section id="connections"></section>
  </main>
`

async function renderToc(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.setContent(`<style>${styles}</style>${tocMarkup}`)
}

// Chromium UA default link colours (unvisited / visited)
const UA_LINK_COLORS = ['rgb(0, 0, 238)', 'rgb(85, 26, 139)']

test('toc links are styled pills, not raw UA links', async ({ page }) => {
  for (const width of [375, 1024]) {
    await renderToc(page, width)
    await expect(page.locator('nav.cx-toc')).toHaveAttribute('aria-label', 'Settings')
    for (const link of await page.locator('.cx-toc a').all()) {
      const computed = await link.evaluate((el) => {
        const cs = getComputedStyle(el)
        return { color: cs.color, textDecorationLine: cs.textDecorationLine }
      })
      expect(UA_LINK_COLORS).not.toContain(computed.color)
      expect(computed.textDecorationLine).toBe('none')
    }
  }
})

test('toc links have a distinct hover state', async ({ page }) => {
  await renderToc(page, 1024)
  const link = page.locator('.cx-toc a').first()
  const readState = () =>
    link.evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderColor,
        textDecorationLine: cs.textDecorationLine,
      }
    })
  const before = await readState()
  await link.hover()
  const after = await readState()
  expect(after).not.toEqual(before)
})

test('toc links show a visible focus indicator', async ({ page }) => {
  await renderToc(page, 375)
  const link = page.locator('.cx-toc a').first()
  await link.evaluate((el: HTMLElement) => el.focus({ focusVisible: true } as FocusOptions))
  const indicator = await link.evaluate((el) => {
    const cs = getComputedStyle(el)
    return {
      focused: document.activeElement === el,
      focusVisible: el.matches(':focus-visible'),
      outlineStyle: cs.outlineStyle,
      outlineWidth: parseFloat(cs.outlineWidth),
      boxShadow: cs.boxShadow,
    }
  })
  expect(indicator.focused).toBe(true)
  expect(indicator.focusVisible).toBe(true)
  expect(
    (indicator.outlineStyle !== 'none' && indicator.outlineWidth > 0) ||
      indicator.boxShadow !== 'none'
  ).toBe(true)
})

test('toc nav causes no horizontal scroll', async ({ page }) => {
  for (const width of [375, 1024]) {
    await renderToc(page, width)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
  }
})
