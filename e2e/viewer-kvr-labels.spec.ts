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
        const longLabel = page.locator('[data-viewer-label-id="100"]');
        await expect(longLabel).toHaveText(
            'Gedimino kalno, pilies bokšto ir Aukštutinės pilies pastatų komplekso liekanos'
        );
        await expect(page.locator('[data-viewer-label-id="200"]')).toHaveText('Aušros vartai');
        await expect(page.locator('[data-viewer-label-id="300"]')).toHaveText('KVR-300');
        await expect(page.locator('[data-viewer-label-id="400"]')).toHaveCount(0);
        await expect(page.getByTestId('viewer-map-labels')).toHaveCount(0);

        const collapsedBounds = await longLabel.boundingBox();
        const collapsedBackground = await longLabel.evaluate(
            (element) => getComputedStyle(element).backgroundColor
        );
        expect(collapsedBounds).not.toBeNull();
        await longLabel.hover();
        await expect
            .poll(async () => (await longLabel.boundingBox())?.height ?? 0)
            .toBeGreaterThan((collapsedBounds?.height ?? 0) + 5);
        const expandedBounds = await longLabel.boundingBox();
        expect(Math.abs((expandedBounds?.y ?? 0) - (collapsedBounds?.y ?? 0))).toBeLessThan(1);
        await expect(longLabel).toHaveCSS('background-color', collapsedBackground);
        await expect
            .poll(() =>
                longLabel.evaluate(
                    (element) =>
                        element.scrollHeight <= element.clientHeight + 1 &&
                        element.scrollWidth <= element.clientWidth + 1
                )
            )
            .toBe(true);

        await longLabel.click();
        await expect(page).toHaveURL(/x=581456/);
        const focusedResult = page.locator('[data-kvr-match-key="100:object-territory"]');
        await expect(focusedResult).toBeFocused();
        await expect(focusedResult).toHaveAttribute('data-highlighted', 'true');

        const lowerResult = page.locator('[data-kvr-match-key="300:nearby-object"]');
        await page.locator('[data-viewer-label-id="300"]').click();
        await expect(lowerResult).toBeFocused();
        await expect(lowerResult).toHaveAttribute('data-highlighted', 'true');
        await expect(focusedResult).toHaveAttribute('data-highlighted', 'false');
        await expect
            .poll(() =>
                page
                    .getByTestId('viewer-kvr-results-scroll')
                    .evaluate((element) => element.scrollTop)
            )
            .toBeGreaterThan(0);

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
