/**
 * In-memory datastore behind the vi.mock'd supabase client + auth client, so the
 * ported Hub page reads can run against the same fixtures the oracle is fed.
 *
 * Each golden test file opts in with:
 *   vi.mock('@/features/shared/lib/supabase', async () =>
 *     (await import('./hub-fakes')).supabaseModule())
 *   vi.mock('@/features/shared/lib/auth', async () =>
 *     (await import('./hub-fakes')).authModule())
 *
 * `tables` holds rows keyed by the SUPABASE table name; `userEmail` is the
 * signed-in caller (Supabase Auth stands in for Session.getActiveUser()).
 * `inserted`/`updated` record writes for spot checks.
 */
export interface HubDb {
  tables: Record<string, Record<string, unknown>[]>
  userEmail: string
  /** Table names that do not exist (supabase would error on .from). */
  missing: Set<string>
  inserted: { table: string; rows: Record<string, unknown>[] }[]
  updated: { table: string; key: unknown; patch: Record<string, unknown> }[]
}

export const hubDb: HubDb = {
  tables: {},
  userEmail: 'admin@dabdoob.com',
  missing: new Set(),
  inserted: [],
  updated: [],
}

export function hubDbReset() {
  hubDb.tables = {}
  hubDb.missing = new Set(['dq_hct'])
  hubDb.inserted = []
  hubDb.updated = []
}

export function hubSetTables(t: Record<string, Record<string, unknown>[]>) {
  hubDb.tables = t || {}
  Object.keys(hubDb.tables).forEach((k) => hubDb.missing.delete(k))
}

export function hubSetUser(email: string) {
  hubDb.userEmail = email
}

/** Every read row gets the implicit serial id a sheet append order would give it. */
function rowsOf(table: string): Record<string, unknown>[] {
  const rows = (hubDb.tables[table] = hubDb.tables[table] || [])
  rows.forEach((r, i) => {
    if (r.id === undefined || r.id === null) r.id = i + 1
  })
  return rows
}

function selectCols(rows: Record<string, unknown>[], cols: string): Record<string, unknown>[] {
  if (!cols || cols.trim() === '*') return rows
  const names = cols
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
  return rows.map((r) => {
    const o: Record<string, unknown> = {}
    names.forEach((n) => {
      o[n] = r[n]
    })
    return o
  })
}

/** A minimal thenable supabase query: select/eq/order/limit/insert/update/upsert/delete/maybeSingle. */
function mkQuery(table: string) {
  if (hubDb.missing.has(table)) {
    const err = { message: 'relation "public.' + table + '" does not exist', code: '42P01' }
    const dead: Record<string, unknown> = {
      select() { return dead },
      eq() { return dead },
      order() { return dead },
      limit() { return dead },
      insert() { return dead },
      update() { return dead },
      delete() { return dead },
      upsert() { return dead },
      maybeSingle() { return Promise.resolve({ data: null, error: err }) },
      single() { return Promise.resolve({ data: null, error: err }) },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve({ data: null, error: err }).then(resolve as never, reject as never)
      },
    }
    return dead
  }
  let out = rowsOf(table).slice()
  let isWrite: 'insert' | 'update' | 'delete' | null = null
  let countOnly = false
  const filters: ((r: Record<string, unknown>) => boolean)[] = []
  const q: Record<string, unknown> = {}

  const run = () => {
    let rows = out
    if (isWrite === 'insert') {
      hubDb.tables[table] = rowsOf(table).concat(out)
      rows = out
    } else if (isWrite === 'update') {
      const all = rowsOf(table)
      // UPDATE ... WHERE pred RETURNING: the returned rows are the ones that
      // matched pred BEFORE the patch — re-running the filters after Object.assign
      // would drop claims on the patched column (`.is('removed_at', null)` style).
      const matched = all.filter((r) => filters.every((f) => f(r)))
      matched.forEach((r) => Object.assign(r, patchObj))
      rows = matched
      hubDb.updated.push({ table, key: undefined, patch: patchObj })
    } else if (isWrite === 'delete') {
      hubDb.tables[table] = rowsOf(table).filter((r) => !filters.every((f) => f(r)))
      rows = []
    } else {
      rows = out.filter((r) => filters.every((f) => f(r)))
    }
    if (orderCol) {
      const dir = orderAsc ? 1 : -1
      rows = rows.slice().sort((a, b) => {
        const av = a[orderCol as string]
        const bv = b[orderCol as string]
        return av === bv ? 0 : (av as never) < (bv as never) ? -dir : dir
      })
    }
    if (limitN !== null) rows = rows.slice(0, limitN)
    return rows
  }

  let orderCol: string | null = null
  let orderAsc = true
  let limitN: number | null = null
  let patchObj: Record<string, unknown> = {}

  const builder: Record<string, unknown> = {
    select(cols?: string, opts?: { count?: string; head?: boolean }) {
      if (opts && opts.count === 'exact' && opts.head) countOnly = true
      selected = cols || '*'
      return builder
    },
    eq(col: string, v: unknown) {
      filters.push((r) => r[col] === v || String(r[col]) === String(v))
      return builder
    },
    neq(col: string, v: unknown) {
      filters.push((r) => !(r[col] === v || String(r[col]) === String(v)))
      return builder
    },
    is(col: string, v: unknown) {
      // IS NULL: '' counts as null (the documented ''<->null storage seam).
      filters.push((r) => (v === null ? r[col] === null || r[col] === undefined || r[col] === '' : r[col] === v))
      return builder
    },
    in(col: string, vs: unknown[]) {
      const set = (vs || []).map(String)
      filters.push((r) => set.indexOf(String(r[col])) !== -1)
      return builder
    },
    or() {
      // supabase .or(expr) — not needed by the ported paths under test; kept as a no-op so
      // chained calls do not blow up when a code path adds one.
      return builder
    },
    order(col: string, opts?: { ascending?: boolean }) {
      orderCol = col
      orderAsc = !opts || opts.ascending !== false
      return builder
    },
    limit(n: number) {
      limitN = n
      return builder
    },
    insert(rows: unknown) {
      isWrite = 'insert'
      out = (Array.isArray(rows) ? rows : [rows]) as Record<string, unknown>[]
      const all = rowsOf(table)
      out.forEach((r, i) => {
        if (r.id === undefined || r.id === null) r.id = all.length + i + 1
      })
      hubDb.inserted.push({ table, rows: out.slice() })
      return builder
    },
    update(patch: Record<string, unknown>) {
      isWrite = 'update'
      patchObj = patch
      out = rowsOf(table).slice()
      return builder
    },
    delete() {
      isWrite = 'delete'
      return builder
    },
    upsert(rows: unknown, opts?: { onConflict?: string }) {
      const list = (Array.isArray(rows) ? rows : [rows]) as Record<string, unknown>[]
      const keys = String((opts && opts.onConflict) || 'id').split(',').map((s) => s.trim())
      const all = rowsOf(table)
      list.forEach((r) => {
        const hit = all.find((x) => keys.every((k) => String(x[k]) === String(r[k])))
        if (hit) Object.assign(hit, r)
        else {
          if (r.id === undefined || r.id === null) r.id = all.length + 1
          all.push(r)
        }
      })
      hubDb.inserted.push({ table, rows: list })
      return builder
    },
    maybeSingle() {
      const rows = run()
      return Promise.resolve({ data: rows[0] || null, error: null })
    },
    single() {
      const rows = run()
      return Promise.resolve({ data: rows[0] || null, error: null })
    },
    then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
      try {
        const rows = run()
        const data = selected === '*' ? rows : selectCols(rows, selected)
        const res = countOnly ? { count: rows.length, data: null, error: null } : { data, error: null }
        return Promise.resolve(res).then(resolve as never, reject as never)
      } catch (e) {
        return Promise.resolve({ data: null, error: e }).then(resolve as never, reject as never)
      }
    },
  }
  let selected = '*'
  void q
  return builder
}

export function supabaseModule() {
  // The real module exports `supabase` and `createClient` (auth.ts:getViewAsUser
  // uses the latter); the mock must cover both or consumers see undefined.
  return {
    supabase: { from: (t: string) => mkQuery(t) },
    createClient: () => ({ from: (t: string) => mkQuery(t) }),
  }
}

const fakeAuthClient = async () => ({
  auth: {
    getUser: async () => ({
      data: { user: hubDb.userEmail ? { email: hubDb.userEmail } : null },
      error: null,
    }),
  },
})

/**
 * The whole public surface of src/features/shared/lib/auth.ts — a vi.mock
 * factory replaces the module wholesale, so any export missing here becomes
 * `undefined` for consumers that still import from 'lib/auth' (the earlier
 * "requireRole is not a function" regression). getUser/requireAuth/
 * getViewAsUser mirror their real bodies; requireRole delegates to the single
 * real implementation in platform/identity.ts (the lazy import keeps it out of
 * the mock-factory cycle, and identity resolves createAuthClient + supabase
 * through these same fakes at call time).
 */
export function authModule() {
  return {
    createAuthClient: fakeAuthClient,
    getUser: async () => {
      const supabase = await fakeAuthClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return user
    },
    requireAuth: async () => {
      const supabase = await fakeAuthClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthorized')
      return user
    },
    requireRole: async (roles: string[]) =>
      (await import('@/features/shared/platform/identity')).requireRole(roles),
    getViewAsUser: async (userEmail: string) => {
      // Same query the real getViewAsUser runs (lib/auth.ts) — mkQuery is
      // Record<string, unknown>, so the chain needs a shape cast.
      interface Q {
        select(c: string): Q
        eq(c: string, v: unknown): Q
        order(c: string, o: { ascending: boolean }): Q
        limit(n: number): Q
        single(): Promise<{ data: Record<string, unknown> | null; error: unknown }>
      }
      const { data: viewAsRecord } = await (mkQuery('view_as') as unknown as Q)
        .select('*')
        .eq('owner_email', userEmail)
        .eq('action', 'start')
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single()
      if (viewAsRecord && viewAsRecord.target_email) {
        return viewAsRecord.target_email as string
      }
      return null
    },
  }
}
