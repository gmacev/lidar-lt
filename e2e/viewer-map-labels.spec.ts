import { expect, test } from '@playwright/test';
import { CANONICAL_VIEWER_PATH, gotoMockedViewer, installMockViewer } from './support/viewer';

test.describe('viewer map labels', () => {
    test('toggles labels, shares state, filters features, and keeps attribution visible', async ({
        page,
    }) => {
        await gotoMockedViewer(page);
        const toggle = page.getByTestId('viewer-map-labels-toggle');

        await expect(toggle).toHaveAttribute('data-active', 'false');
        await expect(page.getByTestId('viewer-map-labels')).toHaveCount(0);

        await toggle.click();
        await expect(page).toHaveURL(/mapLabels=true/);
        await expect(toggle).toHaveAttribute('data-active', 'true');
        await expect(page.getByTestId('viewer-map-labels')).toContainText('Vilnius');
        await expect(page.getByTestId('viewer-map-labels')).not.toContainText('Ignored Peak');
        await expect(page.getByTestId('viewer-map-labels')).not.toContainText('Ignored Stream');
        await expect(page.getByTestId('viewer-map-labels')).not.toContainText('Outside Village');
        await expect(page.getByTestId('viewer-map-attribution')).toContainText(
            '©OpenMapTilesData fromOpenStreetMap'
        );

        await page.reload();
        await expectViewerLabelsReady(page);
        await expect(page.getByTestId('viewer-map-labels-toggle')).toHaveAttribute(
            'data-active',
            'true'
        );

        await page.getByTestId('viewer-ui-toggle').click();
        await expect(page.getByTestId('viewer-map-attribution')).toBeVisible();
        await expect(page.getByTestId('viewer-map-labels')).toContainText('Vilnius');

        await page.getByTestId('viewer-ui-toggle').click();
        await page.getByTestId('viewer-reset-defaults').click();
        await expect(page).not.toHaveURL(/mapLabels=/);
        await expect(page.getByTestId('viewer-map-labels')).toHaveCount(0);
    });

    test('shows a non-blocking error when the label provider is unavailable', async ({ page }) => {
        await installMockViewer(page, { mapLabels: 'unavailable' });
        await page.goto(`${CANONICAL_VIEWER_PATH}&mapLabels=true`);
        await expect(page.getByTestId('viewer-loading-overlay')).toBeHidden();
        await expect(page.getByText('Map labels unavailable')).toBeVisible();
        await expect(page.getByTestId('viewer-container').locator('canvas')).toBeVisible();
    });
});

async function expectViewerLabelsReady(page: import('@playwright/test').Page) {
    await expect(page.getByTestId('viewer-loading-overlay')).toBeHidden();
    await expect(page.getByTestId('viewer-map-labels')).toContainText('Vilnius');
}
