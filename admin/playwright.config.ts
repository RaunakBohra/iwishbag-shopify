import { defineConfig, devices } from '@playwright/test'

const DEFAULT_PORT = process.env.ADMIN_PORT ?? '3000'
const baseURL = process.env.ADMIN_BASE_URL ?? `http://127.0.0.1:${DEFAULT_PORT}`
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'https://playwright.test'

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { outputFolder: 'playwright-report' }], ['line']] : 'list',
  use: {
    baseURL,
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command:
      process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ??
      `npm run dev -- --hostname 127.0.0.1 --port ${DEFAULT_PORT}`,
    cwd: process.cwd(),
    port: Number(DEFAULT_PORT),
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_URL: apiBase,
      ALLOW_DEV_ACCESS: 'true'
    }
  }
})
