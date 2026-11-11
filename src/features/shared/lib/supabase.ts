import 'server-only'
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

let client: SupabaseClient | null = null

async function pgFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const started = performance.now()
  try {
    return await globalThis.fetch(input, init)
  } finally {
    const ms = Math.round(performance.now() - started)
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const url = new URL(raw)
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
      console.log(`[pg] ${method} ${url.pathname}${url.search} ${ms}`)
    } catch {
      console.log(`[pg] ? ? ${ms}`)
    }
  }
}

function getClient(): SupabaseClient {
  if (!client) {
    client =
      process.env.PG_PROFILE === '1'
        ? createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, { global: { fetch: pgFetch } })
        : createSupabaseClient(supabaseUrl, supabaseServiceRoleKey)
  }
  return client
}

export function createClient(): SupabaseClient {
  return getClient()
}

/** Lazy view of the service-role singleton for legacy `supabase.from(...)` call sites. */
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_target, prop) => Reflect.get(getClient(), prop),
})

export type Database = {
  public: {
    Tables: {
      config: {
        Row: {
          key: string
          value: string
          description: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          description?: string
          updated_by?: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          description?: string
          updated_by?: string
          updated_at?: string
        }
      }
      roster: {
        Row: {
          email: string
          name: string
          role: 'admin' | 'tl' | 'agent' | 'specialist'
          tl_email: string | null
          country: string | null
          active: boolean
          submitted_by: string | null
          submitted_at: string
        }
        Insert: {
          email: string
          name: string
          role: 'admin' | 'tl' | 'agent' | 'specialist'
          tl_email?: string
          country?: string
          active?: boolean
          submitted_by?: string
          submitted_at?: string
        }
        Update: {
          email?: string
          name?: string
          role?: 'admin' | 'tl' | 'agent' | 'specialist'
          tl_email?: string
          country?: string
          active?: boolean
          submitted_by?: string
          submitted_at?: string
        }
      }
      view_as: {
        Row: {
          id: number
          owner_email: string
          action: 'start' | 'stop'
          target_email: string | null
          app: string | null
          submitted_by: string | null
          submitted_at: string
        }
        Insert: {
          owner_email: string
          action: 'start' | 'stop'
          target_email?: string
          app?: string
          submitted_by?: string
          submitted_at?: string
        }
        Update: {
          owner_email?: string
          action?: 'start' | 'stop'
          target_email?: string
          app?: string
          submitted_by?: string
          submitted_at?: string
        }
      }
    }
  }
}
