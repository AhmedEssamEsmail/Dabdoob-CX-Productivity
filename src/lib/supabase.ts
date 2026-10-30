import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}

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
