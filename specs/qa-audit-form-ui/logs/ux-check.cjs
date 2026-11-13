/* ux-check.cjs — fragment harness: mounts AuditForm-like markup with the real
   stylesheets (theme -> cx-kit -> refresh -> quality.css) in Chromium at
   375px and 1024px, measures #qa-when + .qa-q selects, checks h-scroll.
   Usage: node ux-check.cjs  (run from repo root or spec logs dir) */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const ROOT = path.resolve(__dirname, '../../..')
const css = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const styles = [
  'src/app/theme.css',
  'src/app/cx-kit.css',
  'src/app/refresh.css',
  'src/app/styles/quality.css',
].map(css).join('\n')

const row = (id, answer, why) => `
  <tr class="qa-q" data-answer="${answer}" data-fatal="${id === 'q2'}">
    <td><div class="qa-q__text">
      <span class="lead">${id === 'q2' ? 'Did the agent verify the customer identity before disclosing account information?' : 'Did the agent greet the customer and introduce themselves?'}</span>
      <span class="cx-muted qa-q__hint">Hint text for ${id}</span>
    </div></td>
    <td class="num">${id === 'q2' ? 'Critical: −100%' : '−10% if failed'}</td>
    <td class="num">
      <select class="cx-select" aria-label="Answer ${id}" aria-required="true">
        <option value=""></option>
        <option value="pass" ${answer === 'pass' ? 'selected' : ''}>Pass</option>
        <option value="fail" ${answer === 'fail' ? 'selected' : ''}>Fail</option>
        <option value="na" ${answer === 'na' ? 'selected' : ''}>N-A</option>
      </select>
      ${why ? `<div class="qa-q__why">
        <span class="cx-faint" id="qa-why-${id}">Why it failed</span>
        <select class="cx-select" aria-labelledby="qa-why-${id}" aria-required="true">
          <option value=""></option>
          <option value="agent" selected>Agent</option>
          <option value="process">Process</option>
          <option value="product">Product</option>
          <option value="kb">KB</option>
        </select>
      </div>` : ''}
    </td>
  </tr>`

const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${styles}</style></head>
<body><div data-app="quality">
<form class="cx-panel qa-form" aria-label="Audit: form">
  <div class="cx-panel--pad">
    <div class="cx-field">
      <label class="cx-label" for="qa-when">Interaction date and time (Riyadh)</label>
      <input class="cx-input" type="datetime-local" id="qa-when" required>
    </div>
    <fieldset class="qa-sec">
      <legend class="qa-sec__title">Opening</legend>
      <div class="tblscroll" role="region" tabindex="0" aria-label="Opening questions">
        <table class="cx-table">
          <thead><tr><th scope="col">Question</th><th class="num" scope="col">Weight</th><th class="num" scope="col">Answer</th></tr></thead>
          <tbody>${row('q1', 'fail', true)}${row('q2', '', false)}</tbody>
        </table>
      </div>
    </fieldset>
    <div class="between"><div class="flex">
      <div class="qa-score" data-status="bad" aria-live="polite">
        <span class="qa-score__num cx-num">0%</span>
        <span class="qa-score__sub">0 of 2 answered</span>
      </div>
    </div>
    <div class="qa-form__foot">
      <button class="cx-btn cx-btn--primary" type="submit" disabled>Submit (2 left)</button>
    </div></div>
  </div>
</form>
</div></body></html>`

const measure = `(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return Math.round(b.width) }
  const when = document.getElementById('qa-when')
  const sels = [...document.querySelectorAll('.qa-q .cx-select')].map(r)
  const clips = [...document.querySelectorAll('.qa-q .cx-select')].map(s => {
    const o = s.options[s.selectedIndex]
    return { sel: r(s), txt: o ? o.text : '' }
  })
  return {
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
    whenWidth: r(when),
    whenFieldWidth: r(when.closest('.cx-field')),
    selectWidths: sels,
    clips,
    tableWidth: r(document.querySelector('.cx-table')),
    scoreNum: getComputedStyle(document.querySelector('.qa-score__num')).fontSize,
    tblscrollHasOverflow: (() => { const t = document.querySelector('.tblscroll'); return t.scrollWidth > t.clientWidth })(),
  }
})()`

;(async () => {
  const browser = await chromium.launch()
  for (const w of [375, 1024]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.setContent(html, { waitUntil: 'load' })
    const m = await page.evaluate(measure)
    console.log(`--- ${w}px ---`)
    console.log(JSON.stringify(m, null, 1))
    await page.screenshot({ path: path.join(__dirname, `ux2-${w}.png`), fullPage: true })
    await page.close()
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
