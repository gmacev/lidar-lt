import { expect, test } from '@playwright/test';
import { CANONICAL_VIEWER_PATH, expectViewerReady, installMockViewer } from './support/viewer';

test.describe('viewer runtime loading', () => {
    test('does not load Potree assets on the grid route', async ({ page }) => {
        const runtimeRequests: string[] = [];
        page.on('request', (request) => {
            if (/\/(potree|libs\/three\.js)\//.test(request.url())) {
                runtimeRequests.push(request.url());
            }
        });

        await page.goto('/');
        await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();

        expect(runtimeRequests).toEqual([]);
    });

    test('can retry a failed runtime dependency load', async ({ page }) => {
        let shouldFail = true;
        await page.route('**/libs/three.js/build/three.min.js', async (route) => {
            if (shouldFail) {
                shouldFail = false;
                await route.abort('failed');
                return;
            }
            await route.fallback();
        });
        await installMockViewer(page);

        await page.goto(CANONICAL_VIEWER_PATH);
        await expect(page.getByTestId('viewer-runtime-gate')).toBeVisible();
        await expect(page.getByTestId('viewer-runtime-retry')).toBeVisible();

        await page.getByTestId('viewer-runtime-retry').click();
        await expectViewerReady(page);
    });
});
