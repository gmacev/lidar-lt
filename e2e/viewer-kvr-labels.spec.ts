import { expect, test } from '@playwright/test';
import { gotoMockedViewer } from './support/viewer';

test.describe('viewer KVR labels', () => {
    test('shows deduplicated interactive result labels independently of map labels', async ({
        page,
    }) => {
        await gotoMockedViewer(page);
        await runKvrInspection(page);

        const labels = page.locator('[data-viewer-label-source="kvr"]');
        await expect(labels).toHaveCount(3);
        await expect(page.locator('[data-viewer-label-id="100"]')).toHaveText(
            'Gedimino pilies bokštas'
        );
        await expect(page.locator('[data-viewer-label-id="200"]')).toHaveText('Aušros vartai');
        await expect(page.locator('[data-viewer-label-id="300"]')).toHaveText('KVR-300');
        await expect(page.locator('[data-viewer-label-id="400"]')).toHaveCount(0);
        await expect(page.getByTestId('viewer-map-labels')).toHaveCount(0);

        await page.locator('[data-viewer-label-id="100"]').click();
        await expect(page).toHaveURL(/x=581456/);
        await expect(page.locator('[data-kvr-match-key="100:object-territory"]')).toBeFocused();

        const lowerResult = page.locator('[data-kvr-match-key="300:nearby-object"]');
        await page.locator('[data-viewer-label-id="300"]').click();
        await expect(lowerResult).toBeFocused();
        await expect
            .poll(async () =>
                lowerResult.evaluate((element) => {
                    const resultBounds = element.getBoundingClientRect();
                    const scrollBounds = element
                        .closest('[data-testid="viewer-kvr-results-scroll"]')
                        ?.getBoundingClientRect();
                    return Boolean(
                        scrollBounds &&
                        resultBounds.top >= scrollBounds.top &&
                        resultBounds.bottom <= scrollBounds.bottom
                    );
                })
            )
            .toBe(true);

        await page.getByTestId('viewer-map-labels-toggle').click();
        await expect(page.getByTestId('viewer-map-labels')).toBeVisible();
        await expect(page.locator('[data-viewer-label-id="100"]')).toBeVisible();
        await expect(page.getByTestId('viewer-map-labels')).not.toContainText('Vilnius');
    });

    test('hides transient labels with the popover, UI, and exclusive tool state', async ({
        page,
    }) => {
        await gotoMockedViewer(page);
        await runKvrInspection(page);
        await expect(page.getByTestId('viewer-kvr-labels')).toBeVisible();

        await page.getByTestId('viewer-ui-toggle').click();
        await expect(page.getByTestId('viewer-kvr-labels')).toHaveCount(0);

        await page.getByTestId('viewer-ui-toggle').click();
        await expect(page.getByTestId('viewer-kvr-labels')).toBeVisible();

        await page.getByTestId('viewer-tool-annotations').click();
        await expect(page.getByTestId('viewer-kvr-labels')).toHaveCount(0);
    });
});

async function runKvrInspection(page: import('@playwright/test').Page) {
    await page.getByTestId('viewer-tool-kvr').click();
    await page
        .getByTestId('viewer-container')
        .locator('canvas')
        .click({ position: { x: 400, y: 300 } });
    await expect(page.getByTestId('viewer-kvr-popover')).toBeVisible();
    await expect(page.getByTestId('viewer-kvr-labels')).toBeVisible();
}
