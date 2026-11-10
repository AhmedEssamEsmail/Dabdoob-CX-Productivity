// ux-ui-audit-v2 Phase F VERIFY-1 — closes AUDIT-REPORT.md "Not verified" items.
// Requires `npm run dev` on :3000 + e2e seeded users. Run:
//   node specs/ux-ui-audit-v2/capture-verify.mjs
// Writes shots/verify/*.png + shots/verify/measurements.json. Read-only except
// one queue-item click on /audit-queue (form is NOT submitted) and a view-as
// start/stop pair (restored at the end).
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'shots', 'verify')
const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3000'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!'
const ADMIN = 'e2e.admin@dabdoob.com'
const AGENT = 'e2e.agent@dabdoob.com'

const R = { contrast: [], pills: [], banner: [], reflow: [], admin390: {}, loginImg: {}, dark: {}, rtl: {}, palette: {}, auditForm: {}, mdStatus: {} }

async function login(page, email) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto('/auth/login')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(PASSWORD)
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ])
    if (res?.ok()) {
      try { await page.waitForURL('/', { timeout: 10000 }); return true } catch { }
    }
    await page.waitForTimeout(500 * (attempt + 1))
  }
  return false
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
}

const shot = (page, name) => page.screenshot({ path: join(OUT, name), fullPage: true }).then(() => name)

/* Runs inside the page: CSS-color parser (rgb/rgba/oklab/oklch/color(srgb)/hex)
   -> sRGB 0-255 + alpha -> WCAG relative luminance -> ratio. All helpers work
   in 0-255 space; __toRgb returns [r,g,b,a] or null. */
const HELPERS = `
function __clamp(v){return Math.min(1,Math.max(0,v))}
function __gam(c){c=__clamp(c);return c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055}
function __toRgb(c){
  c=(c||'').trim();
  let m=c.match(/^rgba?\\(([^)]*)\\)/);
  if(m){const p=m[1].split(/[\\s,\\/]+/).filter(Boolean).map(parseFloat);return [p[0],p[1],p[2],p.length>3?p[3]:1]}
  m=c.match(/^oklab\\(([^)]*)\\)/);
  if(m){const p=m[1].split(/[\\s,\\/]+/).filter(Boolean).map(parseFloat);const L=p[0],a=p[1]||0,b=p[2]||0;
    const l_=L+0.3963377774*a+0.2158037573*b, m_=L-0.1055613458*a-0.0638541728*b, s_=L-0.0894841775*a-1.2914855480*b;
    const l=l_**3,m2=m_**3,s=s_**3;
    return [__gam( 4.0767416621*l-3.3077115913*m2+0.2309699292*s)*255,
            __gam(-1.2684380046*l+2.6097574011*m2-0.3413193965*s)*255,
            __gam(-0.0041960863*l-0.7034186147*m2+1.7076147010*s)*255, p.length>3?p[3]:1]}
  m=c.match(/^oklch\\(([^)]*)\\)/);
  if(m){const p=m[1].split(/[\\s,\\/]+/).filter(Boolean);const L=+p[0],C=+p[1]||0,h=(+p[2]||0)*Math.PI/180;
    return __toRgb('oklab('+L+' '+(C*Math.cos(h))+' '+(C*Math.sin(h))+')')}
  m=c.match(/^color\\(srgb\\s+([^)]*)\\)/);
  if(m){const p=m[1].split(/[\\s,\\/]+/).filter(Boolean).map(parseFloat);return [__gam(p[0])*255,__gam(p[1])*255,__gam(p[2])*255,p.length>3?p[3]:1]}
  m=c.match(/^#([0-9a-f]{3,8})$/i);
  if(m){let h=m[1];if(h.length===3)h=h.split('').map(x=>x+x).join('');
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16),(h.length>6?parseInt(h.slice(6,8),16)/255:1)]}
  return null}
function __lum(p){const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(p[0])+0.7152*f(p[1])+0.0722*f(p[2])}
function __ratio(a,b){const l1=__lum(a),l2=__lum(b);const hi=Math.max(l1,l2),lo=Math.min(l1,l2);return (hi+0.05)/(lo+0.05)}
function __effBg(el){let n=el;for(let i=0;i<10&&n&&n.nodeType===1;i++){const bg=getComputedStyle(n).backgroundColor;const p=__toRgb(bg);if(p&&p[3]>0.05)return [p[0],p[1],p[2]];n=n.parentElement}return [255,255,255]}
function __tokenColor(name){const d=document.createElement('i');d.style.cssText='position:absolute;visibility:hidden;color:var('+name+')';document.body.appendChild(d);const c=getComputedStyle(d).color;d.remove();return c}
function __describe(el){const cls=(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className||'').toString().slice(0,70);const tag=el.tagName.toLowerCase();const txt=(el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,50);return tag+(cls?'.'+cls.split(' ').join('.'):'' )+(txt?' "'+txt+'"':'')}
`

/* ink-3 census on the current page: every element whose computed color equals
   var(--cx-ink-3), with effective bg + ratio. */
async function censusInk3(page, label) {
  const data = await page.evaluate(`(() => { ${HELPERS}
    const probe = document.createElement('i');
    probe.style.cssText='position:absolute;visibility:hidden;color:var(--cx-ink-3)';
    document.body.appendChild(probe);
    const ink3c = getComputedStyle(probe).color; probe.remove();
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.children.length) {
        let t=false; for(const n of el.childNodes){if(n.nodeType===3&&n.textContent.trim()){t=true;break}}
        if(!t) continue;
      }
      const cs = getComputedStyle(el);
      if (cs.color !== ink3c) continue;
      if (cs.display==='none'||cs.visibility==='hidden') continue;
      const fg=__toRgb(cs.color), bg=__effBg(el);
      if(!fg) continue;
      out.push({ el: __describe(el), color: cs.color, bg: 'rgb('+bg.map(v=>Math.round(v)).join(',')+')',
        ratio: +__ratio(fg.slice(0,3), bg).toFixed(2), fs: cs.fontSize });
      if (out.length >= 500) break;
    }
    const ths = [];
    for (const th of document.querySelectorAll('th')) {
      const cs = getComputedStyle(th); const fg=__toRgb(cs.color); const bg=__effBg(th);
      if(!fg) continue;
      ths.push({ el: 'th "'+(th.textContent||'').trim().slice(0,30)+'"', color: cs.color,
        bg: 'rgb('+bg.map(v=>Math.round(v)).join(',')+')', ratio: +__ratio(fg.slice(0,3), bg).toFixed(2), fs: cs.fontSize });
      if (ths.length >= 10) break;
    }
    return { ink3token: ink3c, samples: out, ths };
  })()`)
  const worst = [...data.samples].sort((a, b) => a.ratio - b.ratio).slice(0, 12)
  R.contrast.push({ page: label, n: data.samples.length, worst, thsWorst: [...data.ths].sort((a,b)=>a.ratio-b.ratio).slice(0,5), token: data.ink3token })
  console.log(`ink3 ${label}: n=${data.samples.length} worst=${worst.slice(0,5).map(w => w.ratio).join(',') || '-'} ths=${[...data.ths].sort((a,b)=>a.ratio-b.ratio).slice(0,3).map(t=>t.ratio).join(',') || '-'}`)
  return data
}

async function measureNamed(page, selector, label) {
  const m = await page.evaluate(`(() => { ${HELPERS}
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const cs = getComputedStyle(el);
    const fg = __toRgb(cs.color), bg = __effBg(el);
    return { found: true, el: __describe(el), color: cs.color, bg: 'rgb('+bg.map(v=>Math.round(v)).join(',')+')',
      ratio: fg ? +__ratio(fg.slice(0,3), bg).toFixed(2) : null, fs: cs.fontSize };
  })()`)
  if (m) { m.label = label; R.pills.push(m); console.log(`${label}: ratio=${m.ratio} color=${m.color} bg=${m.bg}`) }
  else console.log(`${label}: NOT FOUND`)
  return m
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ baseURL: BASE })
  const page = await ctx.newPage()
  const ok = await login(page, ADMIN)
  console.log('login admin:', ok)
  if (!ok) { await browser.close(); process.exit(1) }

  /* ---------- 1. Contrast: ink-3 census + named pills/banners ---------- */
  for (const route of ['/overview', '/audit-queue', '/my-day', '/status-validation']) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle(page)
    await censusInk3(page, route)
  }
  // /my-day status pills (md-status-*, incl. blocked if present)
  await page.goto('/my-day', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  R.mdStatus = await page.evaluate(`(() => { ${HELPERS}
    const pills = [...document.querySelectorAll('[class*="md-status"]')];
    return pills.slice(0, 20).map(el => {
      const cs = getComputedStyle(el); const fg = __toRgb(cs.color); const bg = __toRgb(cs.backgroundColor);
      const eff = bg && bg[3] > 0.05 ? bg.slice(0,3) : __effBg(el);
      return { cls: (el.className||'').toString().slice(0,60), text: (el.textContent||'').trim().slice(0,30),
        color: cs.color, bg: cs.backgroundColor,
        ratio: fg ? +__ratio(fg.slice(0,3), eff).toFixed(2) : null };
    });
  })()`)
  console.log('md-status pills:', JSON.stringify(R.mdStatus.slice(0, 8)))
  await measureNamed(page, '.md-status-blocked', '/my-day .md-status-blocked')

  // login page (public render)
  const pub = await ctx.newPage()
  await pub.goto('/auth/login', { waitUntil: 'domcontentloaded' })
  await pub.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await pub.waitForTimeout(600)
  await censusInk3(pub, '/auth/login')
  R.loginImg = await pub.evaluate(() => {
    const img = document.querySelector('.brand-logo')
    if (!img) return { found: false }
    return { found: true, src: img.getAttribute('src'), complete: img.complete,
      naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
      currentSrc: img.currentSrc || '' }
  })
  await pub.waitForTimeout(1500)
  R.loginImg.afterWait = await pub.evaluate(() => {
    const img = document.querySelector('.brand-logo')
    return img ? { complete: img.complete, naturalWidth: img.naturalWidth } : null
  })
  await shot(pub, 'login-brand.png')
  console.log('loginImg:', JSON.stringify(R.loginImg))
  await pub.close()

  /* ---------- 2. View-as banner ---------- */
  const va = await page.evaluate(async ({ email }) => {
    const r = await fetch('/api/view-as', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    return { status: r.status, body: (await r.text()).slice(0, 200) }
  }, { email: AGENT })
  console.log('view-as POST:', JSON.stringify(va))
  if (va.status < 300) {
    await page.goto('/overview', { waitUntil: 'domcontentloaded' })
    await settle(page)
    await shot(page, 'viewas-banner.png')
    const bm = await page.evaluate(`(() => { ${HELPERS}
      const banner = document.querySelector('.va-banner');
      const txt = document.querySelector('.va-banner-text');
      const out = { banner: null, text: null, tokens: {} };
      const sig = __tokenColor('--signal-ink'), bad = __tokenColor('--cx-status-bad-fg'), warn = __tokenColor('--cx-status-warn-fg');
      out.tokens = { signalInk: sig, badFg: bad, warnFg: warn };
      if (banner) {
        const cs = getComputedStyle(banner);
        const bgRgb = __toRgb(cs.backgroundColor);
        out.banner = { bg: cs.backgroundColor, color: cs.color };
        const bg255 = bgRgb ? bgRgb.slice(0,3) : [255,255,255];
        for (const [k, tok] of [['signalInkOnBanner', sig], ['badFgOnBanner', bad], ['warnFgOnBanner', warn]]) {
          const fg = __toRgb(tok); if (fg) out[k] = +__ratio(fg.slice(0,3), bg255).toFixed(2);
        }
      }
      if (txt) { const cs = getComputedStyle(txt); const fg=__toRgb(cs.color); const bg=__effBg(txt);
        out.text = { color: cs.color, ratio: fg ? +__ratio(fg.slice(0,3), bg).toFixed(2) : null }; }
      return out;
    })()`)
    R.banner = bm
    console.log('banner:', JSON.stringify(bm))
    await page.evaluate(async () => { await fetch('/api/view-as', { method: 'DELETE' }) })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await settle(page)
  } else {
    console.log('view-as unavailable — banner contrast via tokens only')
  }

  /* ---------- 3. Command palette ---------- */
  await page.goto('/overview', { waitUntil: 'domcontentloaded' })
  await settle(page)
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(500)
  R.palette.open = await page.evaluate(() => {
    const d = document.querySelector('.cpk')
    return d ? { found: true, cls: (d.className || '').toString().slice(0, 80), text: (d.textContent || '').slice(0, 120) } : { found: false }
  })
  await shot(page, 'palette-open.png')
  console.log('palette:', JSON.stringify(R.palette))
  await page.keyboard.press('Escape')

  /* ---------- 4. AuditForm on /audit-queue (.qa-q alignment) ---------- */
  await page.goto('/audit-queue', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  await page.waitForTimeout(1500)
  R.auditForm.queueProbe = await page.evaluate(() => ({
    workitems: document.querySelectorAll('.qa-workitem').length,
    enabled: [...document.querySelectorAll('.qa-workitem')].filter((b) => !b.disabled).length,
    emptyText: (document.querySelector('.worklist .empty, .worklist')?.textContent || '').trim().slice(0, 120),
  }))
  console.log('queue probe:', JSON.stringify(R.auditForm.queueProbe))
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.qa-workitem')].find((x) => !x.disabled)
    if (b) { b.click(); return (b.textContent || '').trim().slice(0, 80) }
    return null
  })
  console.log('workitem clicked:', clicked)
  if (clicked) {
    await page.waitForSelector('.qa-q', { timeout: 25000 }).catch(() => {})
    await settle(page)
    await shot(page, 'auditform-qa-q.png')
    R.auditForm.form = await page.evaluate(`(() => { ${HELPERS}
      const rows = [...document.querySelectorAll('.qa-q')];
      const out = { rows: rows.length };
      if (rows.length) {
        out.sample = { text: (rows[0].textContent||'').trim().slice(0,60), rect: rows[0].getBoundingClientRect().toJSON() };
        const table = rows[0].closest('table');
        if (table) {
          const heads = [...table.querySelectorAll('thead th')];
          const firstCells = [...rows[0].querySelectorAll('td')];
          const deltas = heads.map((h,i)=>{const c=firstCells[i];return c?Math.abs(h.getBoundingClientRect().left-c.getBoundingClientRect().left):null}).filter(d=>d!=null);
          out.align = { headCount: heads.length, cellCount: firstCells.length, maxDeltaPx: deltas.length?+Math.max(...deltas).toFixed(1):null, deltas: deltas.map(d=>+d.toFixed(1)) };
        }
        // per-row heights to spot flex-tr issues
        out.rowHeights = rows.slice(0,8).map(r=>Math.round(r.getBoundingClientRect().height));
      }
      return out;
    })()`)
    console.log('auditForm:', JSON.stringify(R.auditForm.form))
    // do NOT submit; leave page (audit stays in-progress — noted in report)
  } else {
    R.auditForm.error = 'no enabled .qa-workitem (queue empty or read-only)'
  }

  /* ---------- 5. 320px reflow ---------- */
  await page.setViewportSize({ width: 320, height: 800 })
  for (const route of ['/overview', '/tph']) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle(page)
    const m = await page.evaluate(`(() => {
      const de = document.documentElement, b = document.body;
      const wide = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 321 || r.right > 321) {
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed') continue;
          // skip elements inside a horizontally-scrollable ancestor (legal overflow)
          let n = el.parentElement, scrollable = false;
          while (n) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') { scrollable = true; break } n = n.parentElement }
          if (scrollable) continue;
          wide.push({ el: el.tagName.toLowerCase() + '.' + (el.className||'').toString().split(' ').slice(0,2).join('.'), w: Math.round(r.width), right: Math.round(r.right) });
          if (wide.length >= 8) break;
        }
      }
      return { innerWidth: window.innerWidth, docScrollW: de.scrollWidth, bodyScrollW: b.scrollWidth,
        hScroll: de.scrollWidth > window.innerWidth + 1, wide };
    })()`)
    R.reflow.push({ route, ...m })
    await shot(page, `reflow-320-${route === '/tph' ? 'tph' : 'overview'}.png`)
    console.log(`reflow ${route}:`, JSON.stringify(m))
  }
  await page.setViewportSize({ width: 1440, height: 900 })

  /* ---------- 6. /admin at 390 — page height + per-row cause ---------- */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  await page.waitForTimeout(1200)
  R.admin390.height = await page.evaluate(() => document.documentElement.scrollHeight)
  await shot(page, 'admin-390-full.png')
  R.admin390.analysis = await page.evaluate(`(() => {
    // leaf-tall elements: no descendant also >120px
    const tall = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.height <= 120) continue;
      let hasTallChild = false;
      for (const c of el.children) { if (c.getBoundingClientRect().height > 120) { hasTallChild = true; break } }
      if (!hasTallChild) tall.push(el);
      if (tall.length > 3000) break;
    }
    const leaves = tall.slice(0, 60).map(el => {
      const cs = getComputedStyle(el);
      return { el: el.tagName.toLowerCase() + '.' + (el.className||'').toString().split(' ').slice(0,3).join('.'),
        h: Math.round(el.getBoundingClientRect().height),
        ow: cs.overflowWrap, ws: cs.whiteSpace, ff: cs.fontFamily.slice(0,30),
        text: (el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,70) };
    }).sort((a,b)=>b.h-a.h).slice(0,15);
    // direct children heights of main containers for section attribution
    const main = document.querySelector('main') || document.body;
    const sections = [...main.children].map(s => ({ el: s.tagName.toLowerCase()+'.'+(s.className||'').toString().split(' ').slice(0,2).join('.'), h: Math.round(s.getBoundingClientRect().height) })).sort((a,b)=>b.h-a.h).slice(0,8);
    // count of very tall leaf elements
    const hist = {};
    for (const el of tall) { const b = Math.floor(el.getBoundingClientRect().height/100)*100; hist[b]=(hist[b]||0)+1 }
    return { leafCount: tall.length, leaves, sections, hist };
  })()`)
  console.log('admin390 height:', R.admin390.height)
  console.log('admin390 leaves:', JSON.stringify(R.admin390.analysis.leaves.slice(0,6)))
  console.log('admin390 sections:', JSON.stringify(R.admin390.analysis.sections))

  /* ---------- 7. Dark mode ---------- */
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => localStorage.setItem('cx.appearance', JSON.stringify({ theme: 'dark', accent: 'pine', solid: false, still: false, lang: 'en' })))
  await page.goto('/overview', { waitUntil: 'domcontentloaded' })
  await settle(page)
  R.dark.themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  await shot(page, 'overview-dark.png')
  const dk = await censusInk3(page, '/overview [dark]')
  R.dark.ink3worst = [...dk.samples].sort((a, b) => a.ratio - b.ratio).slice(0, 8)
  console.log('dark ink3 worst:', JSON.stringify(R.dark.ink3worst.slice(0,5)))
  R.dark.body = await page.evaluate(`(() => { ${HELPERS}
    const b = document.body; const cs = getComputedStyle(b);
    const fg = __toRgb(cs.color), bg = __toRgb(cs.backgroundColor) || [255,255,255,1];
    return { color: cs.color, bg: cs.backgroundColor, ratio: fg ? +__ratio(fg.slice(0,3), bg.slice(0,3)).toFixed(2) : null };
  })()`)
  console.log('dark body:', JSON.stringify(R.dark.body))

  /* ---------- 8. RTL (ar) ---------- */
  await page.evaluate(() => localStorage.setItem('cx.appearance', JSON.stringify({ theme: 'auto', accent: 'pine', solid: false, still: false, lang: 'ar' })))
  await page.goto('/overview', { waitUntil: 'domcontentloaded' })
  await settle(page)
  R.rtl = await page.evaluate(() => ({
    lang: document.documentElement.lang, dir: document.documentElement.dir,
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    docScrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
  }))
  await shot(page, 'overview-rtl-ar.png')
  console.log('rtl:', JSON.stringify(R.rtl))
  await page.evaluate(() => localStorage.setItem('cx.appearance', JSON.stringify({ theme: 'auto', accent: 'pine', solid: false, still: false, lang: 'en' })))

  writeFileSync(join(OUT, 'measurements.json'), JSON.stringify(R, null, 2))
  await browser.close()
  console.log('DONE ->', OUT)
}

main().catch((e) => { console.error(e); process.exit(1) })
