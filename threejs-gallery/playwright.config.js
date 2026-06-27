import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright smoke-test config. Builds nothing itself — it boots the Vite dev
 * server, waits for it, then runs the specs in tests/.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  // Run serially with a single worker: these tests share one WebGL-backed dev
  // server, and parallel GPU/software-render contention makes the render loop
  // (and thus the overlay) flaky on CI.
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Allow CI/sandbox environments that ship a pre-installed Chromium to
        // override the binary instead of running `playwright install`.
        // e.g. PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
