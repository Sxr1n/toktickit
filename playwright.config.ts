import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: './server',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm run dev',
      cwd: './client',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      // Functional flow + all three screenshot sets.
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      // Screenshot set only - the functional flow doesn't need to repeat per viewport.
      name: 'tablet',
      testMatch: 'visual-checklist.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 834, height: 1194 } },
    },
    {
      // Screenshot set only. Uses Chromium (not the WebKit-based iPhone preset) since only
      // the Chromium browser binary is installed in this environment.
      name: 'mobile',
      testMatch: 'visual-checklist.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
})
