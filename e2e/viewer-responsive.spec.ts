import { expect, test } from '@playwright/test';
import { gotoMockedViewer } from './support/viewer';

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
    });

    test('mobile starts with the sidebar collapsed and hides desktop-only measurements', async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only assertion');

        await gotoMockedViewer(page);

        await expect(page.getByTestId('viewer-sidebar')).toHaveAttribute('data-collapsed', 'true');
        await expect(page.getByTestId('viewer-tool-distance')).toHaveCount(0);
        await expect(page.getByTestId('viewer-tool-area')).toHaveCount(0);
        await expect(page.getByTestId('viewer-tool-flood')).toBeVisible();
        await expect(page.getByTestId('viewer-tool-annotations')).toBeVisible();
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
});
