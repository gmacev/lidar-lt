import { expect, test } from '@playwright/test';
import { CANONICAL_VIEWER_PATH, installMockViewer } from './support/viewer';

test.describe('viewer error states', () => {
    test('shows a metadata not-found error and navigates back to the map', async ({ page }) => {
        await installMockViewer(page, { metadata: 'not-found' });
        await page.goto(CANONICAL_VIEWER_PATH);

        await expect(page.getByTestId('viewer-error-overlay')).toBeVisible();
        await expect(page.getByTestId('viewer-error-overlay')).toContainText('404');

        await page.getByTestId('viewer-error-back').click();
        await expect(page).toHaveURL(/\/$/);
    });

    test('shows a metadata unavailable error', async ({ page }) => {
        await installMockViewer(page, { metadata: 'unavailable' });
        await page.goto(CANONICAL_VIEWER_PATH);

        await expect(page.getByTestId('viewer-error-overlay')).toBeVisible();
        await expect(page.getByTestId('viewer-error-overlay')).toContainText('503');
    });

    test('shows an error when the Potree global is missing', async ({ page }) => {
        await installMockViewer(page, { potree: 'missing' });
        await page.goto(CANONICAL_VIEWER_PATH);

        await expect(page.getByTestId('viewer-error-overlay')).toBeVisible();
        await expect(page.getByTestId('viewer-error-overlay')).toContainText('Potree');
    });
});
