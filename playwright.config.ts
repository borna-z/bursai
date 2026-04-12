import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
    locale: 'en-US',
  },
  webServer: {
    command: 'npm run dev',
    port: 8080,
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    { name: 'mobile-chrome', use: { browserName: 'chromium' } },
  ],
});
