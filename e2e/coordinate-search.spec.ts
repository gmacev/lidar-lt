import { expect, test } from '@playwright/test';
import { gotoMockedViewer } from './support/viewer';

test.describe('coordinate search', () => {
    test('finds the same grid sector from WGS84 and EPSG:3346 coordinates', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
        await page.goto('/');

        const search = page.getByLabel('Search for a sector or geographic object');
        const status = page.getByRole('status');

        await search.fill('54.687157, 25.279652');
        await expect(status).toHaveText('Found: 1 / 2741');

        await search.fill('582507.36, 6061943.84');
        await expect(status).toHaveText('Found: 1 / 2741');

        await search.fill('6061943.84, 582507.36');
        await expect(status).toHaveText('Found: 1 / 2741');
    });

    test('accepts both EPSG:3346 coordinate orders in the sector viewer', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
        await gotoMockedViewer(page);

        const search = page.getByPlaceholder('Coordinates');
        const go = page.getByRole('button', { name: 'Go', exact: true });

        await search.fill('581500, 6060500');
        await expect(go).toBeEnabled();

        await search.fill('6060500, 581500');
        await expect(go).toBeEnabled();
    });

    test('uses the Lithuanian sector coordinate placeholder', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('i18nextLng', 'lt'));
        await gotoMockedViewer(page);

        await expect(page.getByPlaceholder('Koordinatės')).toBeVisible();
    });
});
