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
    test('defaults to the continuous mosaic, switches periods, and persists', async ({ page }) => {
        let orthophotoRequests = 0;
        const recentTileRequests: string[] = [];
        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('/arcgis/rest/services/NZT/ORT')) {
                orthophotoRequests += 1;
            }
            if (url.includes('/NZT/ORT_recent/MapServer/tile/')) {
                recentTileRequests.push(url);
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
        const recentOption = page.getByTestId('viewer-orthophoto-year-recent');
        await expect(recentOption).toBeVisible();
        await expect(recentOption).toHaveAttribute('aria-checked', 'true');
        await expect(recentOption).toHaveText('Latest continuous orthophoto');
        const options = picker.getByRole('radio');
        await expect(options.first()).toHaveAttribute(
            'data-testid',
            'viewer-orthophoto-year-recent'
        );
        await expect(page.getByTestId('viewer-orthophoto-year-2024-2026')).toBeVisible();
        await expect(page.getByTestId('viewer-orthophoto-year-1995-1999')).toBeVisible();
        // The continuous mosaic is the default and is pinned for stable reloads.
        await expectSearchParam(page, 'orthoYear', 'recent');

        await expect(page.getByTestId('viewer-orthophoto-compare')).toBeVisible();
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            'recent'
        );
        await expect.poll(() => recentTileRequests.length).toBeGreaterThan(0);
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

        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        await expect(page.getByTestId('viewer-orthophoto-picker')).toBeVisible();
        await page.getByTestId('viewer-orthophoto-year-recent').click();
        await expectSearchParam(page, 'orthoYear', 'recent');
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            'recent'
        );

        await page.reload();
        await expectViewerReady(page);
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            'recent'
        );
        await expectSearchParam(page, 'orthoYear', 'recent');

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
            orthophotoRecentUnavailable: true,
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
        await expect(page.getByTestId('viewer-orthophoto-year-recent')).toHaveCount(0);
        await expect(page.getByTestId('viewer-orthophoto-year-2024-2026')).toHaveCount(0);
        await expect(page.getByTestId('viewer-orthophoto-year-2021-2023')).toBeVisible();
    });

    test('falls back to the newest dated service when the continuous mosaic is down', async ({
        page,
    }) => {
        await installMockViewer(page, {
            orthophotoExtraServices: ['NZT/ORT10LT_2026_2028'],
            orthophotoRecentUnavailable: true,
        });
        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);
        await expectViewerReady(page);

        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2026-2028'
        );
        await expectSearchParam(page, 'orthoYear', '2026-2028');

        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        const picker = page.getByTestId('viewer-orthophoto-picker');
        await expect(picker).toBeVisible();
        await expect(picker.getByTestId('viewer-orthophoto-year-recent')).toHaveCount(0);
        const options = picker.getByRole('radio');
        await expect(options.first()).toHaveAttribute(
            'data-testid',
            'viewer-orthophoto-year-2026-2028'
        );
    });

    test('auto-discovers a future vintage below the continuous option', async ({ page }) => {
        await installMockViewer(page, {
            orthophotoExtraServices: ['NZT/ORT10LT_2026_2028'],
        });
        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);
        await expectViewerReady(page);

        // The continuous mosaic stays the default; a vintage unknown at author
        // time slots in as the newest dated option.
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            'recent'
        );
        await expectSearchParam(page, 'orthoYear', 'recent');

        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        const picker = page.getByTestId('viewer-orthophoto-picker');
        await expect(picker).toBeVisible();
        const recentOption = page.getByTestId('viewer-orthophoto-year-recent');
        await expect(recentOption).toBeVisible();
        await expect(recentOption).toHaveAttribute('aria-checked', 'true');
        await expect(picker.getByText(/aktualiausia/i)).toHaveCount(0);
        const options = picker.getByRole('radio');
        await expect(options.first()).toHaveAttribute(
            'data-testid',
            'viewer-orthophoto-year-recent'
        );
        const futureOption = page.getByTestId('viewer-orthophoto-year-2026-2028');
        await expect(futureOption).toBeVisible();
        await expect(options.nth(1)).toHaveAttribute(
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
            'recent'
        );
        await expectSearchParam(page, 'orthoYear', 'recent');

        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        await expect(page.getByTestId('viewer-orthophoto-picker')).toBeVisible();
        await expect(page.getByTestId('viewer-orthophoto-year-2026-2028')).toHaveCount(0);
        await expect(page.getByTestId('viewer-orthophoto-year-2024-2026')).toBeVisible();
    });

    test('keeps a vintage with a rollout hole at the sector center', async ({ page }) => {
        await installMockViewer(page, {
            orthophotoMissingFirstTileServices: ['ORT10LT_2024_2026'],
            orthophotoRecentUnavailable: true,
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
            'recent'
        );
        await expectSearchParam(page, 'orthoYear', 'recent');
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
        // Probes succeed so the overlay mounts on the continuous mosaic;
        // only renderer tiles fail.
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            'recent'
        );
        const renderer = page.getByTestId('viewer-orthophoto-renderer');
        await expect(renderer.locator('canvas')).toBeVisible();
        await expect
            .poll(async () => Number((await renderer.getAttribute('data-failed-tiles')) ?? 0))
            .toBeGreaterThan(0);
        await expect(page.getByText('Orthophoto unavailable')).toBeVisible();
        // Recent yielded once to dated imagery, which then failed too: the
        // toast appears exactly once instead of looping between services.
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2024-2026'
        );
        await expect(page.getByTestId('viewer-container').locator('canvas')).toBeVisible();
    });

    test('falls back to the newest dated service when recent tiles fail', async ({ page }) => {
        await installMockViewer(page, { orthophotoRecentTilesUnavailable: true });
        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);
        await expectViewerReady(page);

        // Recent mounts, its failing tiles yield once to the newest dated
        // service, and no error toast appears for the recovered layer.
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2024-2026'
        );
        await expectSearchParam(page, 'orthoYear', '2024-2026');
        await expect(page.getByText('Orthophoto unavailable')).toHaveCount(0);
    });

    test('falls back to the continuous mosaic for an unknown saved selection', async ({ page }) => {
        await gotoMockedViewer(
            page,
            `${CANONICAL_VIEWER_PATH}&orthophotoCompare=true&orthoYear=bogus`
        );
        await expectViewerReady(page);

        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            'recent'
        );
        await expectSearchParam(page, 'orthoYear', 'recent');
    });

    test('labels the continuous option in Lithuanian without year wording', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('i18nextLng', 'lt'));
        await gotoMockedViewer(page, `${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);

        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        const picker = page.getByTestId('viewer-orthophoto-picker');
        await expect(picker).toBeVisible();
        const recentOption = page.getByTestId('viewer-orthophoto-year-recent');
        await expect(recentOption).toHaveText('Naujausias vientisas ortofoto');
        await expect(picker.getByText(/aktualiausia/i)).toHaveCount(0);
    });

    test('carries the continuous selection through sector navigation', async ({ page }) => {
        await gotoMockedViewer(
            page,
            `${CANONICAL_VIEWER_PATH}&orthophotoCompare=true&orthoYear=recent`
        );

        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            'recent'
        );

        const arrows = page
            .getByRole('group', { name: 'Adjacent sector navigation' })
            .getByRole('button', { name: /Navigate to/ });
        await expect(arrows.first()).toBeVisible();
        await arrows.first().click();

        await expectViewerReady(page);
        expect(page.url()).not.toContain('/viewer/76_32');
        await expectSearchParam(page, 'orthophotoCompare', 'true');
        await expectSearchParam(page, 'orthoYear', 'recent');
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            'recent'
        );
    });

    test('discovers dated options while recent metadata stalls', async ({ page }) => {
        await installMockViewer(page);
        // Registered last so it runs before the default handlers: the
        // continuous mosaic metadata never settles, so dated discovery must
        // proceed on its own instead of leaving the picker loading forever.
        await page.route(
            /\/NZT\/ORT_recent\/MapServer\?f=pjson/,
            () => new Promise<never>(() => {})
        );
        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);
        await expectViewerReady(page);

        // The picker offers dated options with no full-loading spinner: the
        // pending recent request no longer blocks the dated list.
        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        await expect(page.getByTestId('viewer-orthophoto-picker')).toBeVisible();
        await expect(page.getByTestId('viewer-orthophoto-year-2024-2026')).toBeVisible();
        await expect(page.getByTestId('viewer-orthophoto-picker-loading')).toHaveCount(0);

        // The default stays unresolved instead of flashing a dated vintage
        // while the continuous mosaic is still pending.
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveCount(0);

        // An explicit dated choice renders while recent is still pending.
        await page.getByTestId('viewer-orthophoto-year-2024-2026').click();
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            '2024-2026'
        );
        await expect(page.getByText('Orthophoto unavailable')).toHaveCount(0);
    });

    test('shows dated options loading beneath the continuous option', async ({ page }) => {
        await installMockViewer(page);
        let releaseDirectory!: () => void;
        const directoryGate = new Promise<void>((resolve) => {
            releaseDirectory = resolve;
        });
        // Registered last so it runs before the default handlers: dated
        // discovery waits while recent metadata resolves right away.
        await page.route(/\/services\/NZT\?f=pjson/, async (route) => {
            await directoryGate;
            await route.fallback();
        });

        await page.goto(`${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);
        await expectViewerReady(page);
        await expect(page.getByTestId('viewer-orthophoto-compare')).toHaveAttribute(
            'data-service',
            'recent'
        );

        // The picker is usable with the continuous option while dated
        // options disclose their loading state instead of appearing silently.
        await page.getByTestId('viewer-orthophoto-compare-toggle').click();
        await expect(page.getByTestId('viewer-orthophoto-year-recent')).toBeVisible();
        await expect(page.getByTestId('viewer-orthophoto-picker-loading-more')).toBeVisible();
        await expect(page.getByTestId('viewer-orthophoto-picker-loading')).toHaveCount(0);

        releaseDirectory();
        await expect(page.getByTestId('viewer-orthophoto-year-2024-2026')).toBeVisible();
        await expect(page.getByTestId('viewer-orthophoto-picker-loading-more')).toHaveCount(0);
    });
});
