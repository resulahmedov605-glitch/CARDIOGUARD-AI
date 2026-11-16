import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const frontend = fileURLToPath(new URL('.', import.meta.url))
const backend = fileURLToPath(new URL('../backend', import.meta.url))
const python =
  process.env.CARDIOGUARD_PYTHON ||
  (process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python')

export default defineConfig({
  testDir: './e2e',
  outputDir: '../.cache/browser-tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../.cache/browser-report' }]],
  use: {
    baseURL: 'http://127.0.0.1:15173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  // Dedicated ports: never reuse or stop the user's development servers.
  webServer: [
    {
      command: `"${python}" -m uvicorn app.main:app --host 127.0.0.1 --port 18000`,
      cwd: backend,
      url: 'http://127.0.0.1:18000/api/v1/health',
      reuseExistingServer: false,
      env: { PYTHONDONTWRITEBYTECODE: '1' },
    },
    {
      command: 'npm run dev -- --port 15173 --configLoader native',
      cwd: frontend,
      url: 'http://127.0.0.1:15173',
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: 'http://127.0.0.1:18000' },
    },
  ],
})
