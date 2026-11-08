import { defineConfig } from '@playwright/test'

// Real CSS in isolated documents: no app server, auth, fixtures or remote writes.
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.pw.ts',
  outputDir: '../../test-results/ui-contrast',
  reporter: 'list',
  fullyParallel: true,
  workers: 2,
  use: { viewport: { width: 1000, height: 900 } },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
})
