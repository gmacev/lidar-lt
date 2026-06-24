import { expect, test } from '@playwright/test';
import { CANONICAL_VIEWER_PATH, gotoMockedViewer } from './support/viewer';

test.describe('viewer boot', () => {
    test('loads the canonical viewer route with a rendered canvas and HUD', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (message) => {
            if (message.type() === 'error') {
                consoleErrors.push(message.text());
            }
        });

        await gotoMockedViewer(page);

        await expect(page).toHaveURL(new RegExp(`/viewer/76_32`));
        await expect(page).toHaveTitle(/LiDAR/);
        await expect(page.getByTestId('viewer-page')).toBeVisible();
        await expect(page.getByTestId('viewer-top-controls')).toBeVisible();
        await expect(page.getByTestId('viewer-container').locator('canvas')).toHaveCount(1);
        expect(consoleErrors).toEqual([]);
    });

    test('opens the canonical path helper URL', async ({ page }) => {
        await gotoMockedViewer(page, CANONICAL_VIEWER_PATH);

        expect(new URL(page.url()).pathname).toBe('/viewer/76_32');
        expect(new URL(page.url()).searchParams.get('sectorName')).toBe('VILNIUS (centras)');
    });
});
