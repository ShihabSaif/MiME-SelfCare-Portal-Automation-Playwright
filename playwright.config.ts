import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const authFile = 'playwright/.auth/user.json';
const desktopChrome = { ...devices['Desktop Chrome'] };

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Serial flow: login → services → recharge → … → my-profile */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html', { open: 'never' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'off',
    headless: false,
  },

  /*
   * Ordered flow (each project depends on the previous):
   * login → services → recharge-wallet → wallet-transfer → payment-history
   *       → inventory → complains → my-profile
   */
  projects: [
    {
      name: 'login',
      testMatch: /myportal-login\.spec\.ts/,
      use: { ...desktopChrome },
    },
    {
      name: 'services',
      testMatch: /services\.spec\.ts/,
      use: { ...desktopChrome, storageState: authFile },
      dependencies: ['login'],
    },
    {
      name: 'recharge-wallet',
      testMatch: /recharge-wallet\.spec\.ts/,
      use: { ...desktopChrome, storageState: authFile },
      dependencies: ['services'],
    },
    {
      name: 'wallet-transfer',
      testMatch: /wallet-transfer\.spec\.ts/,
      use: { ...desktopChrome, storageState: authFile },
      dependencies: ['recharge-wallet'],
    },
    {
      name: 'payment-history',
      testMatch: /payment-history\.spec\.ts/,
      use: { ...desktopChrome, storageState: authFile },
      dependencies: ['wallet-transfer'],
    },
    {
      name: 'inventory',
      testMatch: /inventory\.spec\.ts/,
      use: { ...desktopChrome, storageState: authFile },
      dependencies: ['payment-history'],
    },
    {
      name: 'complains',
      testMatch: /complains\.spec\.ts/,
      use: { ...desktopChrome, storageState: authFile },
      dependencies: ['inventory'],
    },
    {
      name: 'my-profile',
      testMatch: /my-profile\.spec\.ts/,
      use: { ...desktopChrome, storageState: authFile },
      dependencies: ['complains'],
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
