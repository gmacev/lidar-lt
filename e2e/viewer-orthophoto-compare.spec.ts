import { expect, test } from '@playwright/test';
import {
    CANONICAL_VIEWER_PATH,
    expectNoSearchParam,
    expectSearchParam,
    expectViewerReady,
    gotoMockedViewer,
    installMockViewer,
} from './support/viewer';

test.describe('viewer orthophoto comparison', () => {
    test('toggles, persists, preserves projection, and resets without persisting projection', async ({
        page,
    }) => {
        let orthophotoRequests = 0;
        page.on('request', (request) => {
            if (request.url().includes('/geoportal/ort-recent')) orthophotoRequests += 1;
        });
        await gotoMockedViewer(page);

        const toggle = page.getByTestId('viewer-orthophoto-compare-toggle');
        await expect(toggle).toHaveAttribute('data-active', 'false');
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveCount(0);
        expect(orthophotoRequests).toBe(0);

        await toggle.click();
        await expectSearchParam(page, 'orthophotoCompare', 'true');
        await expect(page.getByTestId('viewer-orthophoto-compare')).toBeVisible();
        const renderer = page.getByTestId('viewer-orthophoto-renderer');
        await expect(renderer.locator('canvas')).toBeVisible();
        await expect
            .poll(async () => Number((await renderer.getAttribute('data-loaded-tiles')) ?? 0))
            .toBeGreaterThan(0);
        expect(Number(await renderer.getAttribute('data-loaded-tiles'))).toBeLessThanOrEqual(64);
        await expect(page.getByText('Camera switched to orthographic projection')).toBeVisible();
        await expect(page.getByTestId('viewer-projection-orthographic')).toBeDisabled();
        await expect(page.getByTestId('viewer-projection-perspective')).toBeDisabled();
        await expect(page.getByTestId('viewer-projection-orthographic')).toHaveClass(
            /laser-green/
        );
        await expectNoSearchParam(page, 'projection');

        await page.reload();
        await expectViewerReady(page);
        await expect(page.getByTestId('viewer-orthophoto-compare-toggle')).toHaveAttribute(
            'data-active',
            'true'
        );
        await expect(page.getByTestId('viewer-orthophoto-compare')).toBeVisible();

        await page.getByTestId('viewer-reset-defaults').click();
        await expectNoSearchParam(page, 'orthophotoCompare');
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveCount(0);
    });

    test('supports keyboard comparison and remains visible with controls hidden', async ({
        page,
    }) => {
        await gotoMockedViewer(page, `${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);
        const slider = page.getByTestId('viewer-orthophoto-split');

        await expect(slider).toHaveAttribute('aria-valuenow', '50');
        await slider.focus();
        await slider.press('ArrowRight');
        await expect(slider).toHaveAttribute('aria-valuenow', '55');
        await slider.press('End');
        await expect(slider).toHaveAttribute('aria-valuenow', '100');

        await page.getByTestId('viewer-ui-toggle').click();
        await expect(page.getByTestId('viewer-orthophoto-compare')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Geoportal.lt' })).toBeVisible();
    });

    test('restores perspective after a forced orthographic comparison', async ({ page }) => {
        await gotoMockedViewer(page);

        const toggle = page.getByTestId('viewer-orthophoto-compare-toggle');
        const perspective = page.getByTestId('viewer-projection-perspective');

        await toggle.click();
        await expect(page.getByText('Camera switched to orthographic projection')).toBeVisible();
        await toggle.click();
        await expect(perspective).toHaveClass(/laser-green/);
        await expectNoSearchParam(page, 'projection');
    });

    test('keeps an existing orthographic preference without notifying', async ({ page }) => {
        await gotoMockedViewer(page, `${CANONICAL_VIEWER_PATH}&projection=ORTHOGRAPHIC`);

        const toggle = page.getByTestId('viewer-orthophoto-compare-toggle');
        const orthographic = page.getByTestId('viewer-projection-orthographic');

        await toggle.click();
        await expect(page.getByText('Camera switched to orthographic projection')).toHaveCount(0);
        await toggle.click();
        await expect(orthographic).toHaveClass(/laser-green/);
        await expectSearchParam(page, 'projection', 'ORTHOGRAPHIC');
    });

    test('keeps Potree operational when the provider is unavailable', async ({ page }) => {
        await installMockViewer(page, { orthophoto: 'unavailable' });
        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);

        await expectViewerReady(page);
        await expect(page.getByText('Orthophoto unavailable')).toBeVisible();
        await expect(page.getByTestId('viewer-container').locator('canvas')).toBeVisible();
    });

    test('renders successful tiles when part of the imagery request fails', async ({ page }) => {
        await installMockViewer(page, { orthophoto: 'partial' });
        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);

        await expectViewerReady(page);
        const renderer = page.getByTestId('viewer-orthophoto-renderer');
        await expect
            .poll(async () => Number((await renderer.getAttribute('data-loaded-tiles')) ?? 0))
            .toBeGreaterThan(0);
        await expect
            .poll(async () => Number((await renderer.getAttribute('data-failed-tiles')) ?? 0))
            .toBeGreaterThan(0);
        await expect(page.getByTestId('viewer-container').locator('canvas')).toBeVisible();
    });

    test('clips imagery to a partial source-manifest footprint', async ({ page }) => {
        await installMockViewer(page, {
            sourceManifest: {
                sourceFileDateRange: { from: '2025', to: '2025' },
                sourceFiles: [
                    {
                        bounds: {
                            minx: 581430,
                            miny: 6060430,
                            maxx: 581570,
                            maxy: 6060570,
                        },
                    },
                ],
            },
        });
        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);
        await expectViewerReady(page);

        const renderer = page.getByTestId('viewer-orthophoto-renderer');
        await expect(renderer.locator('canvas')).toBeVisible();
        await expect
            .poll(async () => Number((await renderer.getAttribute('data-clipped-fragments')) ?? 0))
            .toBeGreaterThan(0);
    });

    test('shows one non-blocking error when every visible tile fails', async ({ page }) => {
        await installMockViewer(page, { orthophoto: 'tiles-unavailable' });
        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);

        await expectViewerReady(page);
        await expect(page.getByText('Orthophoto unavailable')).toBeVisible();
        await expect(page.getByTestId('viewer-container').locator('canvas')).toBeVisible();
    });
});
