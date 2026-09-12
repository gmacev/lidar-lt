import { expect, test } from '@playwright/test';
import { CANONICAL_VIEWER_PATH, gotoMockedViewer } from './support/viewer';

test.describe('viewer responsive layout', () => {
    test('desktop shows sidebar and right rail without collapsed state', async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name === 'mobile-chromium', 'desktop-only assertion');

        await gotoMockedViewer(page);

        await expect(page.getByTestId('viewer-sidebar')).toHaveAttribute('data-collapsed', 'false');
        await expect(page.getByTestId('viewer-right-rail')).toBeVisible();
        await expect(page.getByTestId('viewer-tool-distance')).toBeVisible();
        await expect(page.getByTestId('viewer-tool-flood')).toBeVisible();
        await expect(page.getByTestId('viewer-tool-annotations')).toBeVisible();
        await expect(page.getByTestId('viewer-mobile-notice')).toHaveCount(0);
    });

    test('mobile starts with the sidebar collapsed and hides desktop-only measurements', async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only assertion');

        await gotoMockedViewer(page);

        await expect(page.getByTestId('viewer-sidebar')).toHaveAttribute('data-collapsed', 'true');
        await expect(page.getByTestId('viewer-tool-distance')).toHaveCount(0);
        await expect(page.getByTestId('viewer-tool-area')).toHaveCount(0);
        await expect(page.getByTestId('viewer-tool-flood')).toHaveCount(0);
        await expect(page.getByTestId('viewer-tool-annotations')).toHaveCount(0);
        await expect(page.getByTestId('viewer-mobile-notice')).toBeVisible();
        await page.getByText('Limited experience on mobile').click();
        await expect(page.getByTestId('viewer-mobile-notice')).toBeHidden();
    });

    test('UI hide and show toggles HUD visibility', async ({ page }) => {
        await gotoMockedViewer(page);

        await page.getByTestId('viewer-ui-toggle').click();
        await expect(page.getByTestId('viewer-right-rail')).toBeHidden();
        await expect(page.getByTestId('viewer-sidebar')).toBeHidden();
        await expect(page.getByTestId('viewer-ui-toggle')).toBeVisible();

        await page.getByTestId('viewer-ui-toggle').click();
        await expect(page.getByTestId('viewer-right-rail')).toBeVisible();
        await expect(page.getByTestId('viewer-sidebar')).toBeVisible();
    });

    test('mobile keeps the orthophoto split usable when the HUD is hidden', async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only assertion');

        await gotoMockedViewer(page, `${CANONICAL_VIEWER_PATH}&orthophotoCompare=true`);
        const slider = page.getByTestId('viewer-orthophoto-split');
        await expect(slider).toBeVisible();
        expect((await slider.boundingBox())?.width).toBeGreaterThanOrEqual(44);

        await page.getByTestId('viewer-ui-toggle').click();
        await expect(page.getByTestId('viewer-right-rail')).toBeHidden();
        await expect(page.getByTestId('viewer-orthophoto-compare')).toBeVisible();
        await expect(slider).toBeVisible();
    });

    test('Firefox Android portrait reserves the obscured bottom strip', async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only assertion');

        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'userAgent', {
                configurable: true,
                value: 'Mozilla/5.0 (Android 15; Mobile; rv:145.0) Gecko/145.0 Firefox/145.0',
            });
        });
        await gotoMockedViewer(page);

        const viewerPage = page.getByTestId('viewer-page');
        const bottomNavigation = page.getByTestId('viewer-bottom-navigation');
        await expect(viewerPage).toHaveCSS('width', '390px');
        await expect(viewerPage).toHaveCSS('height', '836px');

        const bounds = await bottomNavigation.boundingBox();
        if (!bounds) throw new Error('Bottom navigation has no rendered bounds');
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(836);
    });

    test('short mobile landscape keeps the single-column right tools visible', async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only assertion');

        await page.setViewportSize({ width: 915, height: 360 });
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'userAgent', {
                configurable: true,
                value: 'Mozilla/5.0 (Android 15; Mobile; rv:145.0) Gecko/145.0 Firefox/145.0',
            });
        });
        await gotoMockedViewer(page);

        const viewerPage = page.getByTestId('viewer-page');
        const rail = page.getByTestId('viewer-right-rail');
        const rightTools = page.getByTestId('viewer-right-tools');
        const compass = page.getByTestId('viewer-compass');
        const bottomNavigation = page.getByTestId('viewer-bottom-navigation');
        const cornerInfo = page.getByTestId('viewer-corner-info');
        const documentOverflow = await page.evaluate(() => ({
            horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        }));
        expect(documentOverflow).toEqual({ horizontal: 0, vertical: 0 });
        await expect(viewerPage).toHaveCSS('touch-action', 'none');
        await expect(viewerPage).toHaveCSS('width', '895px');
        await expect(viewerPage).toHaveCSS('height', '352px');
        await expect(rail).toHaveCSS('width', '40px');
        await expect(rightTools).toHaveCSS('gap', '4px');
        await expect(compass).toBeVisible();

        const compassBox = await compass.boundingBox();
        if (!compassBox) throw new Error('Compass has no rendered bounds');
        expect(compassBox.x + compassBox.width).toBeLessThanOrEqual(895);
        expect(compassBox.y + compassBox.height).toBeLessThanOrEqual(352);

        for (const bottomControl of [bottomNavigation, cornerInfo]) {
            const bounds = await bottomControl.boundingBox();
            if (!bounds) throw new Error('Bottom control has no rendered bounds');
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(895);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(352);
        }
    });
});
