import { expect, test } from '@playwright/test';
import { CANONICAL_VIEWER_PATH } from './support/viewer';

test.describe('viewer live smoke', () => {
    test('loads the canonical sector against live point-cloud data', async ({ page }) => {
        test.setTimeout(120_000);

        await page.goto(CANONICAL_VIEWER_PATH);

        await expect(page.getByTestId('viewer-error-overlay')).toBeHidden({ timeout: 120_000 });
        await expect(page.getByTestId('viewer-loading-overlay')).toBeHidden({ timeout: 120_000 });
        await expect(page.getByTestId('viewer-container').locator('canvas')).toBeVisible({
            timeout: 120_000,
        });
        await expect(page.getByTestId('viewer-sidebar')).toBeVisible();
        await expect(page.getByTestId('viewer-right-rail')).toBeVisible();
    });
});
