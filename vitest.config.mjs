import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    // Mirror tsconfig paths so '@/...' imports resolve in unit tests.
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'node',
    // Dummy values so modules that build a Supabase client at import time
    // (src/lib/supabase.ts) can be imported without real credentials.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_ANON_KEY: 'test-anon-key',
    },
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
})
