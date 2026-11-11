/**
 * CX-Hub extraction pipeline — turns each legacy app's index.html bundle into
 * workable source. One command extracts every app:
 *
 *   node .devin/work/extract-all.mjs
 *
 * Output per app under .devin/work/extract/<app>/:
 *   app.js         — raw <script type="module"> payload
 *   app.pretty.js  — babel-formatted bundle
 *   app.css        — main <style rel="stylesheet" crossorigin> payload
 *   boot.css/js    — head inline boot-splash bits
 *   registry.json  — route metadata objects (path/title/icon/gate/roles)
 *   icons.json     — route -> svg inner markup
 *   pages.json     — route -> { symbol, startLine, endLine, deps[] }
 *   pages/<route>.js — verbatim component source slices
 *   report.json    — css-vs-shared delta + unmapped routes + notes
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@babel/parser'
import _generate from '@babel/generator'
import _traverse from '@babel/traverse'

const generate = _generate.default || _generate
const traverse = _traverse.default || _traverse

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..') // CX-Hub/  (this script lives in scripts/legacy/)
const LEGACY_WORKSPACE = path.resolve(ROOT, '..', '_archive', 'legacy-apps') // KPIs/_archive/legacy-apps
const OUT = path.join(ROOT, '.devin/work/extract')

const APPS = {
  hub: 'Command_Center_V2_deprecated',
  quality: 'Quality_deprecated',
  productivity: 'Productivity_Depricated',
  queue: 'Queue_deprecated',
  people: 'People_deprecated',
  operations: 'Operations_deprecated',
  desk: 'Desk_deprecated',
  fcr: 'FCR_deprecated',
}

const registry = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'specs/legacy-parity/data/legacy-route-registry.json'), 'utf8'),
)
const KNOWN_ROUTES = new Set(registry.pages.map((r) => r.path))
KNOWN_ROUTES.add('ecosystem') // hidden hub route, absent from the public registry

function extractBlocks(html) {
  const styles = [...html.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)]
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
  const appCss = styles.find((m) => /rel="stylesheet"|crossorigin/.test(m[1]))?.[2] ?? ''
  const bootCss = styles.filter((m) => !/rel="stylesheet"|crossorigin/.test(m[1])).map((m) => m[2]).join('\n')
  const appJs = scripts.find((m) => /type="module"/.test(m[1]))?.[2] ?? ''
  const bootJs = scripts.filter((m) => !/type="module"/.test(m[1])).map((m) => m[2]).join('\n')
  return { appCss, bootCss, appJs, bootJs }
}

function pretty(js) {
  const ast = parse(js, { sourceType: 'module' })
  return generate(ast, { comments: true, concise: false }).code
}

/** Object-literal tables whose keys are all known route paths. */
function findRouteTables(ast) {
  const hits = []
  traverse(ast, {
    VariableDeclarator(p) {
      if (!p.node.init || p.node.init.type !== 'ObjectExpression') return
      const props = p.node.init.properties
      const keys = props
        .map((pr) => (pr.key && (pr.key.value ?? pr.key.name)))
        .filter((k) => typeof k === 'string')
      const matched = keys.filter((k) => KNOWN_ROUTES.has(k))
      // A dispatch table: >=1 known-route key, every value an Identifier (component
      // symbol), and known-route keys making up at least half of all keys (keeps
      // icon/label string maps out — those have StringLiteral values anyway).
      const allIdentValues = props.every((pr) => pr.value?.type === 'Identifier')
      if (matched.length >= 1 && allIdentValues && matched.length >= Math.ceil(keys.length / 2)) {
        hits.push({
          name: p.node.id.name,
          map: Object.fromEntries(
            props.map((pr) => [
              pr.key.value ?? pr.key.name,
              pr.value.type === 'Identifier' ? pr.value.name : pr.value.type,
            ]),
          ),
          start: p.node.init.start,
          end: p.node.init.end,
        })
      }
    },
  })
  return hits
}

/** The route-metadata array: [{path:"x",title:"y",...},...] */
function findRouteMeta(ast) {
  const metas = []
  traverse(ast, {
    ArrayExpression(p) {
      const els = p.node.elements
      if (!els.length || els.some((e) => !e || e.type !== 'ObjectExpression')) return
      const first = els[0].properties.find((pr) => (pr.key?.name ?? pr.key?.value) === 'path')
      if (!first) return
      const paths = els.map(
        (e) => e.properties.find((pr) => (pr.key?.name ?? pr.key?.value) === 'path')?.value?.value,
      )
      if (paths.filter((x) => KNOWN_ROUTES.has(x)).length >= 2) {
        metas.push({ start: p.node.start, end: p.node.end, count: els.length })
      }
    },
  })
  return metas
}

/** Top-level symbol table: name -> {start,end,kind} */
function topLevel(ast) {
  const out = new Map()
  for (const node of ast.program.body) {
    if (node.type === 'FunctionDeclaration' && node.id) {
      out.set(node.id.name, { start: node.start, end: node.end, kind: 'function' })
    } else if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) {
        if (d.id.type === 'Identifier') out.set(d.id.name, { start: node.start, end: node.end, kind: 'var' })
      }
    }
  }
  return out
}

/** Free identifiers of a node that resolve to top-level symbols. */
function depsOf(node, topNames) {
  const refs = new Set()
  const collect = (n) => {
    if (!n || typeof n !== 'object') return
    if (n.type === 'Identifier' && topNames.has(n.name)) refs.add(n.name)
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue
      const v = n[k]
      if (Array.isArray(v)) v.forEach(collect)
      else if (v && typeof v === 'object' && v.type) collect(v)
    }
  }
  collect(node)
  refs.delete(node?.id?.name)
  return [...refs].sort()
}

const cssDiff = (a, b) => (a === b ? 'identical' : `${Math.abs(a.length - b.length)}B delta`)

const summary = []
for (const [app, dir] of Object.entries(APPS)) {
  const src = path.join(LEGACY_WORKSPACE, dir, 'index.html')
  if (!fs.existsSync(src)) {
    summary.push(`${app}: MISSING ${dir}/index.html`)
    continue
  }
  const html = fs.readFileSync(src, 'utf8')
  const { appCss, bootCss, appJs, bootJs } = extractBlocks(html)
  const outDir = path.join(OUT, app)
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true })
  fs.writeFileSync(path.join(outDir, 'app.js'), appJs)
  fs.writeFileSync(path.join(outDir, 'app.css'), appCss)
  if (bootCss.trim()) fs.writeFileSync(path.join(outDir, 'boot.css'), bootCss)
  if (bootJs.trim()) fs.writeFileSync(path.join(outDir, 'boot.js'), bootJs)

  const prettyCode = pretty(appJs)
  fs.writeFileSync(path.join(outDir, 'app.pretty.js'), prettyCode)

  const ast = parse(prettyCode, { sourceType: 'module' })
  const top = topLevel(ast)
  const tables = findRouteTables(ast)
  const metas = findRouteMeta(ast)

  // registry.json — route metadata objects
  let registryJson = []
  if (metas.length) {
    const m = metas.sort((a, b) => b.count - a.count)[0]
    registryJson = JSON.parse(generate(ast.program.body.find?.(() => false) ?? { type: 'Program' }, {}).code || '[]') // placeholder
    // simpler: slice raw source of the array and eval through babel AST props
    const arrNode = (function () {
      let found = null
      traverse(ast, {
        ArrayExpression(p) {
          if (found) return
          if (p.node.start === m.start) found = p.node
        },
      })
      return found
    })()
    if (arrNode) {
      registryJson = arrNode.elements.map((e) => {
        const o = {}
        for (const pr of e.properties) {
          const k = pr.key?.name ?? pr.key?.value
          if (!k) continue
          o[k] = pr.value.type === 'StringLiteral' || pr.value.type === 'NumericLiteral' || pr.value.type === 'BooleanLiteral'
            ? pr.value.value
            : pr.value.type === 'ArrayExpression'
              ? pr.value.elements.map((x) => x?.value ?? x?.name)
              : `@@${pr.value.type}:${prettyCode.slice(pr.value.start, pr.value.end).slice(0, 60)}`
        }
        return o
      })
    }
  }
  fs.writeFileSync(path.join(outDir, 'registry.json'), JSON.stringify(registryJson, null, 1))

  // icons.json — string tables of svg markup
  const icons = {}
  for (const t of tables) {
    if (Object.values(t.map).every((v) => v === 'StringLiteral')) icons[t.name] = t.map
  }
  // also raw string-object tables (icons are StringLiteral values keyed by route)
  traverse(ast, {
    VariableDeclarator(p) {
      if (!p.node.init || p.node.init.type !== 'ObjectExpression') return
      const props = p.node.init.properties
      const entries = props
        .filter((pr) => pr.value?.type === 'StringLiteral' && KNOWN_ROUTES.has(pr.key?.value ?? pr.key?.name))
        .map((pr) => [pr.key.value ?? pr.key.name, pr.value.value])
      if (entries.length >= 2) Object.assign(icons, Object.fromEntries(entries))
    },
  })
  fs.writeFileSync(path.join(outDir, 'icons.json'), JSON.stringify(icons, null, 1))

  // pages.json — route -> component symbol/range/deps
  const componentTable = tables
    .filter((t) => Object.values(t.map).some((v) => top.has(v) && top.get(v).kind === 'function'))
    .sort((a, b) => Object.keys(b.map).length - Object.keys(a.map).length)[0]
  const pages = {}
  const unmapped = []
  if (componentTable) {
    for (const [route, sym] of Object.entries(componentTable.map)) {
      const node = top.get(sym)
      if (!node || node.kind !== 'function') {
        unmapped.push({ route, reason: `symbol ${sym} not a function` })
        continue
      }
      const fnNode = ast.program.body.find((n) => n.start === node.start)
      const deps = fnNode ? depsOf(fnNode, new Set(top.keys())) : []
      const src2 = prettyCode.slice(node.start, node.end)
      const safe = route.replace(/[^a-z0-9-]/g, '_')
      fs.writeFileSync(path.join(outDir, 'pages', `${safe}.js`), src2 + '\n')
      pages[route] = {
        symbol: sym,
        startLine: prettyCode.slice(0, node.start).split('\n').length,
        endLine: prettyCode.slice(0, node.end).split('\n').length,
        bytes: node.end - node.start,
        deps: deps.filter((d) => d !== sym),
      }
      // closure slice: the component + every top-level symbol it transitively
      // touches, dependency-ordered — one self-contained file per page.
      const seen = new Set()
      const order = []
      const visit = (name) => {
        if (seen.has(name) || !top.has(name)) return
        seen.add(name)
        const n = ast.program.body.find((x) => x.start === top.get(name).start)
        if (n) for (const d of depsOf(n, new Set(top.keys()))) visit(d)
        order.push(name)
      }
      visit(sym)
      const emitted = new Set()
      const closureSrc = order
        .map((n) => top.get(n))
        .filter((n) => !emitted.has(n.start) && emitted.add(n.start))
        .map((n) => prettyCode.slice(n.start, n.end))
        .join('\n\n')
      fs.writeFileSync(path.join(outDir, 'pages', `${safe}.closure.js`), closureSrc + '\n')
      pages[route].closureSymbols = order.length
      pages[route].closureBytes = closureSrc.length
    }
  } else {
    unmapped.push({ route: '*', reason: 'no component dispatch table found' })
  }
  // routes in this app's registry group missing from the table
  const appRoutes = registry.pages.filter((r) => r.group === app).map((r) => r.path)
  const covered = new Set(Object.keys(pages))
  for (const r of appRoutes) if (!covered.has(r)) unmapped.push({ route: r, reason: 'no component in bundle (legacy placeholder)' })

  const report = {
    app,
    bundleBytes: appJs.length,
    cssBytes: appCss.length,
    dispatchTable: componentTable ? componentTable.name : null,
    dispatchEntries: componentTable ? Object.keys(componentTable.map).length : 0,
    routesBuilt: covered.size,
    routesPlaceholder: unmapped.filter((u) => u.reason?.includes('placeholder')).map((u) => u.route),
    unmapped,
    metaArrays: metas.length,
    topLevelSymbols: top.size,
  }
  fs.writeFileSync(path.join(outDir, 'pages.json'), JSON.stringify(pages, null, 1))
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1))
  summary.push(
    `${app}: ${covered.size}/${appRoutes.length} pages, dispatch=${report.dispatchTable}, css=${appCss.length}B, js=${appJs.length}B`,
  )
}

// css cross-app diff
const cssByApp = {}
for (const app of Object.keys(APPS)) {
  const f = path.join(OUT, app, 'app.css')
  if (fs.existsSync(f)) cssByApp[app] = fs.readFileSync(f, 'utf8')
}
const base = cssByApp['productivity'] || Object.values(cssByApp)[0]
const cssReport = Object.fromEntries(
  Object.entries(cssByApp).map(([a, c]) => [a, cssDiff(c, base)]),
)
fs.writeFileSync(path.join(OUT, 'css-diff.json'), JSON.stringify(cssReport, null, 1))

console.log(summary.join('\n'))
console.log('css vs productivity:', JSON.stringify(cssReport))
