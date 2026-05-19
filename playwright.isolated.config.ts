import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const authFile = 'playwright/.auth/user.json';
const desktopChrome = { ...devices['Desktop Chrome'] };

/**
 * Run a single section spec without login or other suite projects.
 * Requires a saved session at playwright/.auth/user.json (run login once first).
 *
 * Example:
 *   npx playwright test tests/my-profile.spec.ts -c playwright.isolated.config.ts --workers=1 --headed
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'off',
    headless: false,
  },
  projects: [
    {
      name: 'my-profile-only',
      testMatch: /my-profile\.spec\.ts/,
      use: { ...desktopChrome, storageState: authFile },
    },
  ],
});
