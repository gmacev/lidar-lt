import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 5173);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 10_000,
        navigationTimeout: 30_000,
        testIdAttribute: 'data-testid',
    },
    webServer: {
        command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            testIgnore: /.*\.live\.spec\.ts/,
        },
        {
            name: 'mobile-chromium',
            use: {
                ...devices['Pixel 7'],
                viewport: { width: 390, height: 844 },
                hasTouch: true,
            },
            testMatch: /.*responsive\.spec\.ts/,
        },
        {
            name: 'live-chromium',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /.*\.live\.spec\.ts/,
            retries: 0,
        },
    ],
});
