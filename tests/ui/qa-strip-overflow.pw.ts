import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

/**
 * Regression: ctl-strip-overflow — .qa-list is display:grid with an implicit
 * single `auto` column, so the track sizes to the strip row's max-content
 * (nowrap name + nowrap meta + pills + buttons ≈ 2x card width) and pushes
 * rows off-screen with a document-level horizontal scrollbar.
 * Fixture mirrors ctls-page.tsx (.card > .card-pad > .qa-list > article) and
 * the details.qa-card--strip variant used by disputes/my-audits.
 */
const app = path.resolve(__dirname, '../../src/app')
const css = ['theme.css', 'cx-kit.css', 'refresh.css', ...readdirSync(path.join(app, 'styles')).map(name => `styles/${name}`)]
  .map(file => readFileSync(path.join(app, file), 'utf8')).join('\n')

const strip = (meta: string) => `
  <article class="qa-card qa-card--strip">
    <span class="pill bad">42</span>
    <strong class="qa-name">Abdelsamad Mohamed Abdelsamad Youssef</strong>
    <span class="qa-meta">
      <span>ticket <a class="qa-link">Cash refund-KW9BA88YN000000000000000211SZ7001</a>, ${meta}</span>
      <span class="qa-sep">·</span>
      <span>Owner Very Long Teamlead Name; shown to you because you were on shift when it opened</span>
    </span>
    <span class="pill warn">Overdue since 2026-11-01</span>
    <span class="qa-acts">
      <button class="cx-btn cx-btn--primary cx-btn--small">Open in the form</button>
      <button class="cx-btn cx-btn--small">Resend result email</button>
    </span>
  </article>`

const detailStrip = `
  <details class="qa-card qa-card--strip">
    <summary>
      <svg class="qa-chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
      <span class="pill ok">88</span>
      <strong class="qa-name">Abdelsamad Mohamed Abdelsamad Youssef</strong>
      <span class="qa-meta">
        <span>ticket <a class="qa-link">Cash refund-KW9BA88YN000000000000000211SZ7001</a>, audited by Long Auditor Name</span>
        <span class="qa-sep">·</span>
        <span>raised by Agent With A Very Long Full Name, 2026-10-30</span>
      </span>
      <span class="pill">open</span>
    </summary>
    <div class="qa-detail"><p class="qa-reason">Dispute reason text</p></div>
  </details>`

const submitCard = `
  <section class="card" aria-labelledby="ctlf-h">
    <div class="card-head"><div class="card-title" id="ctlf-h">Submit a CTL</div></div>
    <div class="card-pad">
      <div class="qa-ctl">
        <form class="qa-ctlform"><p>CTL form fields</p></form>
        <aside class="qa-ctlside"><div class="qa-ctlside__body"><p class="qa-ctlside__title">Who can close it</p></div></aside>
      </div>
    </div>
  </section>`

function fixture(withSubmit = false) {
  return `<style>${css}</style>
  <div data-app="quality">
    <section class="cxp dq-page">
      ${withSubmit ? submitCard : ''}
      <section class="card" aria-labelledby="ctl-h">
        <div class="card-head"><div class="card-title" id="ctl-h">29 open</div></div>
        <div class="card-pad"><div class="qa-list">${[strip('Voice'), strip('Chat'), strip('Email')].join('')}${detailStrip}</div></div>
      </section>
    </section>
  </div>`
}

test('strip rows stay inside the card; meta truncates; no document h-scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.setContent(fixture())

  // 1. No document-level horizontal scrollbar.
  const doc = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(doc.scroll, `document scrollWidth ${doc.scroll} exceeds clientWidth ${doc.client}`).toBeLessThanOrEqual(doc.client)

  // 2. Every strip row is no wider than the .qa-list content box.
  const widths = await page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('.qa-list')!
    const listRight = list.getBoundingClientRect().right
    return Array.from(document.querySelectorAll<HTMLElement>('.qa-card--strip'))
      .map(el => ({ right: el.getBoundingClientRect().right, listRight }))
  })
  for (const w of widths) {
    expect(w.right, `strip right ${w.right} exceeds .qa-list right ${w.listRight}`).toBeLessThanOrEqual(w.listRight + 1)
  }

  // 3. Admin actions are on-screen inside the viewport.
  const acts = await page.locator('.qa-acts').first().boundingBox()
  expect(acts, 'qa-acts not laid out').not.toBeNull()
  expect(acts!.x + acts!.width).toBeLessThanOrEqual(1400)

  // 4. .qa-meta actually clips its overflowing text (ellipsis path engaged).
  const meta = await page.locator('.qa-meta').first().evaluate(el => ({
    client: el.clientWidth,
    overflow: getComputedStyle(el).overflow,
  }))
  expect(meta.overflow).toBe('hidden')
  expect(meta.client).toBeGreaterThan(0)
})

test('narrow viewport: .qa-name ellipsizes; no document h-scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.setContent(fixture())

  const doc = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(doc.scroll, `document scrollWidth ${doc.scroll} exceeds clientWidth ${doc.client}`).toBeLessThanOrEqual(doc.client)

  const widths = await page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('.qa-list')!
    const listRight = list.getBoundingClientRect().right
    return Array.from(document.querySelectorAll<HTMLElement>('.qa-card--strip'))
      .map(el => ({ right: el.getBoundingClientRect().right, listRight }))
  })
  for (const w of widths) {
    expect(w.right, `strip right ${w.right} exceeds .qa-list right ${w.listRight}`).toBeLessThanOrEqual(w.listRight + 1)
  }

  // Name ellipsis actually engaged on at least one row.
  const names = await page.locator('.qa-name').evaluateAll(els => els.map(el => ({
    overflow: getComputedStyle(el).overflow,
    scroll: el.scrollWidth,
    client: el.clientWidth,
  })))
  expect(names.length).toBeGreaterThan(0)
  for (const n of names) expect(n.overflow).toBe('hidden')
  expect(names.some(n => n.scroll > n.client)).toBe(true)
})

test('wide viewport: Submit-a-CTL card caps at 72rem; list card stays full width', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.setContent(fixture(true))

  const m = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.card'))
    const submit = cards.find(c => c.querySelector('.qa-ctl'))!
    const list = cards.find(c => c.querySelector('.qa-list'))!
    const form = submit.querySelector<HTMLElement>('.qa-ctlform')!
    const aside = submit.querySelector<HTMLElement>('.qa-ctlside')!
    const doc = document.documentElement
    return {
      submitW: submit.getBoundingClientRect().width,
      listW: list.getBoundingClientRect().width,
      formL: form.getBoundingClientRect().left,
      asideL: aside.getBoundingClientRect().left,
      scroll: doc.scrollWidth,
      client: doc.clientWidth,
    }
  })
  expect(Math.abs(m.submitW - 1152), `submit card width ${m.submitW} != 72rem`).toBeLessThanOrEqual(2)
  expect(m.asideL, 'aside should sit right of the form').toBeGreaterThan(m.formL)
  expect(m.scroll, `document scrollWidth ${m.scroll} exceeds clientWidth ${m.client}`).toBeLessThanOrEqual(m.client)
  expect(m.listW, `list card ${m.listW} should exceed submit card ${m.submitW}`).toBeGreaterThan(m.submitW)
})
