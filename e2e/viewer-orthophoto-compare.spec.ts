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
    test('toggles, picks a vintage, persists, and resets without persisting projection', async ({
        page,
    }) => {
        let orthophotoRequests = 0;
        page.on('request', (request) => {
            if (request.url().includes('/arcgis/rest/services/NZT/ORT')) {
                orthophotoRequests += 1;
            }
        });
        await gotoMockedViewer(page);

        const toggle = page.getByTestId('viewer-orthophoto-compare-toggle');
        await expect(toggle).toHaveAttribute('data-active', 'false');
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveCount(0);
        await expect(page.getByTestId('viewer-orthophoto-picker')).toHaveCount(0);
        expect(orthophotoRequests).toBe(0);

        await toggle.click();
        await expectSearchParam(page, 'orthophotoCompare', 'true');
        const picker = page.getByTestId('viewer-orthophoto-picker');
        await expect(picker).toBeVisible();
        // No "aktualiausia" wording anywhere in the picker.
        await expect(picker.getByText(/aktualiausia/i)).toHaveCount(0);
        const newestOption = page.getByTestId('viewer-orthophoto-year-2024-2026');
        await expect(newestOption).toBeVisible();
        await expect(newestOption).toHaveAttribute('aria-checked', 'true');
        await expect(page.getByTestId('viewer-orthophoto-year-1995-1999')).toBeVisible();
        // The resolved newest vintage is pinned for stable reloads.
        await expectSearchParam(page, 'orthoYear', '2024-2026');

        await expect(page.getByTestId('viewer-orthophoto-compare')).toBeVisible();
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2024-2026'
        );
        const renderer = page.getByTestId('viewer-orthophoto-renderer');
        await expect(renderer.locator('canvas')).toBeVisible();
        await expect
            .poll(async () => Number((await renderer.getAttribute('data-loaded-tiles')) ?? 0))
            .toBeGreaterThan(0);
        expect(Number(await renderer.getAttribute('data-loaded-tiles'))).toBeLessThanOrEqual(64);
        await expect(page.getByText('Camera switched to orthographic projection')).toBeVisible();
        await expect(page.getByTestId('viewer-projection-orthographic')).toBeDisabled();
        await expect(page.getByTestId('viewer-projection-perspective')).toBeDisabled();
        await expect(page.getByTestId('viewer-projection-orthographic')).toHaveClass(/laser-green/);
        await expectNoSearchParam(page, 'projection');

        await page.getByTestId('viewer-orthophoto-year-2021-2023').click();
        await expectSearchParam(page, 'orthoYear', '2021-2023');
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2021-2023'
        );

        await page.reload();
        await expectViewerReady(page);
        await expect(page.getByTestId('viewer-orthophoto-compare-toggle')).toHaveAttribute(
            'data-active',
            'true'
        );
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2021-2023'
        );

        await page.getByTestId('viewer-reset-defaults').click();
        await expectNoSearchParam(page, 'orthophotoCompare');
        await expectNoSearchParam(page, 'orthoYear');
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveCount(0);
    });

    test('keeps comparing when the picker is dismissed by an outside click', async ({ page }) => {
        await gotoMockedViewer(page, `${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);

        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        await expect(page.getByTestId('viewer-orthophoto-picker')).toBeVisible();

        await page.mouse.click(500, 300);
        await expect(page.getByTestId('viewer-orthophoto-picker')).toHaveCount(0);
        await expect(page.getByTestId('viewer-orthophoto-compare')).toBeVisible();
        await expectSearchParam(page, 'orthophotoCompare', 'true');

        // Reopening from the tool shows the picker again instead of disabling.
        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        await expect(page.getByTestId('viewer-orthophoto-picker')).toBeVisible();
        await expect(page.getByTestId('viewer-orthophoto-compare')).toBeVisible();
    });

    test('turns comparison off from the picker', async ({ page }) => {
        await gotoMockedViewer(page, `${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);

        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        await expect(page.getByTestId('viewer-orthophoto-picker')).toBeVisible();

        await page.getByTestId('viewer-orthophoto-disable').click();
        await expectNoSearchParam(page, 'orthophotoCompare');
        await expectNoSearchParam(page, 'orthoYear');
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveCount(0);
        await expect(page.getByTestId('viewer-orthophoto-picker')).toHaveCount(0);
        await expect(page.getByTestId('viewer-projection-perspective')).toHaveClass(/laser-green/);
    });

    test('hides vintages without sector coverage and defaults to the newest available', async ({
        page,
    }) => {
        await installMockViewer(page, {
            orthophotoMissingServices: ['ORT10LT_2024_2026'],
        });
        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);
        await expectViewerReady(page);

        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2021-2023'
        );
        await expectSearchParam(page, 'orthoYear', '2021-2023');

        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        await expect(page.getByTestId('viewer-orthophoto-picker')).toBeVisible();
        await expect(page.getByTestId('viewer-orthophoto-year-2024-2026')).toHaveCount(0);
        await expect(page.getByTestId('viewer-orthophoto-year-2021-2023')).toBeVisible();
    });

    test('auto-discovers a future vintage and preselects it as newest', async ({ page }) => {
        await installMockViewer(page, {
            orthophotoExtraServices: ['NZT/ORT10LT_2026_2028'],
        });
        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);
        await expectViewerReady(page);

        // A vintage unknown at author time is discovered, labeled, and preselected.
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2026-2028'
        );
        await expectSearchParam(page, 'orthoYear', '2026-2028');

        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        const picker = page.getByTestId('viewer-orthophoto-picker');
        await expect(picker).toBeVisible();
        const futureOption = page.getByTestId('viewer-orthophoto-year-2026-2028');
        await expect(futureOption).toBeVisible();
        await expect(futureOption).toHaveAttribute('aria-checked', 'true');
        await expect(picker.getByText(/aktualiausia/i)).toHaveCount(0);
        const options = picker.getByRole('radio');
        await expect(options.first()).toHaveAttribute(
            'data-testid',
            'viewer-orthophoto-year-2026-2028'
        );
        await expect(page.getByTestId('viewer-orthophoto-year-2024-2026')).toBeVisible();
    });

    test('ignores vintages whose footprint does not cover the sector', async ({ page }) => {
        await installMockViewer(page, {
            orthophotoExtraServices: ['NZT/ORT10LT_2026_2028'],
            orthophotoMetadataOverrides: {
                ORT10LT_2026_2028: { xmin: 0, ymin: 0, xmax: 1000, ymax: 1000 },
            },
        });
        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);
        await expectViewerReady(page);

        // A directory-listed vintage outside the sector is neither shown nor pinned.
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2024-2026'
        );
        await expectSearchParam(page, 'orthoYear', '2024-2026');

        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        await expect(page.getByTestId('viewer-orthophoto-picker')).toBeVisible();
        await expect(page.getByTestId('viewer-orthophoto-year-2026-2028')).toHaveCount(0);
        await expect(page.getByTestId('viewer-orthophoto-year-2024-2026')).toBeVisible();
    });

    test('keeps a vintage with a rollout hole at the sector center', async ({ page }) => {
        await installMockViewer(page, {
            orthophotoMissingFirstTileServices: ['ORT10LT_2024_2026'],
        });
        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);
        await expectViewerReady(page);

        // Partial coverage still wins over older full-coverage vintages.
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2024-2026'
        );
        await expectSearchParam(page, 'orthoYear', '2024-2026');
    });

    test('recovers from rapid toggling while the catalog is slow', async ({ page }) => {
        await installMockViewer(page);
        let releaseDirectory!: () => void;
        const directoryGate = new Promise<void>((resolve) => {
            releaseDirectory = resolve;
        });
        // Registered last so it runs before the default handlers.
        await page.route(/\/services\/NZT\?f=pjson/, async (route) => {
            await directoryGate;
            await route.fallback();
        });

        await page.goto(CANONICAL_VIEWER_PATH);
        await expectViewerReady(page);
        const directoryRequest = page.waitForRequest(/\/services\/NZT\?f=pjson/);
        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        await directoryRequest;

        // Aborting one consumer must not wedge the next one in error.
        await page.getByTestId('viewer-orthophoto-disable').click();
        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        releaseDirectory();

        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2024-2026'
        );
        await expectSearchParam(page, 'orthoYear', '2024-2026');
        await expect(page.getByText('Orthophoto unavailable')).toHaveCount(0);
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

    test('restores perspective after the picker turns comparison off', async ({ page }) => {
        await gotoMockedViewer(page);

        const toggle = page.getByTestId('viewer-orthophoto-compare-toggle');
        const perspective = page.getByTestId('viewer-projection-perspective');

        await toggle.click();
        await expect(page.getByText('Camera switched to orthographic projection')).toBeVisible();
        await page.getByTestId('viewer-orthophoto-disable').click();
        await expect(perspective).toHaveClass(/laser-green/);
        await expectNoSearchParam(page, 'projection');
    });

    test('keeps an existing orthographic preference without notifying', async ({ page }) => {
        await gotoMockedViewer(page, `${CANONICAL_VIEWER_PATH}&projection=ORTHOGRAPHIC`);

        const toggle = page.getByTestId('viewer-orthophoto-compare-toggle');
        const orthographic = page.getByTestId('viewer-projection-orthographic');

        await toggle.click();
        await expect(page.getByText('Camera switched to orthographic projection')).toHaveCount(0);
        await page.getByTestId('viewer-orthophoto-disable').click();
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
        // Probes succeed so the overlay mounts; only renderer tiles fail.
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2024-2026'
        );
        const renderer = page.getByTestId('viewer-orthophoto-renderer');
        await expect(renderer.locator('canvas')).toBeVisible();
        await expect
            .poll(async () => Number((await renderer.getAttribute('data-failed-tiles')) ?? 0))
            .toBeGreaterThan(0);
        await expect(page.getByText('Orthophoto unavailable')).toBeVisible();
        await expect(page.getByTestId('viewer-container').locator('canvas')).toBeVisible();
    });
});
