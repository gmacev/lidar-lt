import { expect, test } from '@playwright/test';
import { expectSearchParam, gotoMockedViewer, setRangeValue } from './support/viewer';

const DESKTOP_TOOL_IDS = [
    'viewer-tool-distance',
    'viewer-tool-area',
    'viewer-tool-volume',
    'viewer-tool-circle',
    'viewer-tool-angle',
    'viewer-tool-azimuth',
    'viewer-tool-profile',
    'viewer-tool-flood',
    'viewer-tool-annotations',
    'viewer-recenter',
    'viewer-tool-google-maps',
    'viewer-tool-kvr',
    'viewer-compass',
] as const;

test.describe('viewer right-side tools', () => {
    test('shows the complete desktop tool rail', async ({ page }) => {
        await gotoMockedViewer(page);

        for (const testId of DESKTOP_TOOL_IDS) {
            await expect(page.getByTestId(testId)).toBeVisible();
        }
    });

    test('toggles measurement tools and enforces exclusive active state', async ({ page }) => {
        await gotoMockedViewer(page);

        await page.getByTestId('viewer-tool-distance').click();
        await expect(page.getByTestId('viewer-tool-distance')).toHaveAttribute(
            'data-active',
            'true'
        );

        await page.getByTestId('viewer-tool-area').click();
        await expect(page.getByTestId('viewer-tool-distance')).toHaveAttribute(
            'data-active',
            'false'
        );
        await expect(page.getByTestId('viewer-tool-area')).toHaveAttribute('data-active', 'true');

        await page.getByTestId('viewer-tool-area').click();
        await expect(page.getByTestId('viewer-tool-area')).toHaveAttribute('data-active', 'false');

        for (const testId of [
            'viewer-tool-volume',
            'viewer-tool-circle',
            'viewer-tool-angle',
            'viewer-tool-azimuth',
            'viewer-tool-profile',
        ]) {
            await page.getByTestId(testId).click();
            await expect(page.getByTestId(testId)).toHaveAttribute('data-active', 'true');
        }
    });

    test('opens flood controls, updates water level, and resets', async ({ page }) => {
        await gotoMockedViewer(page);

        await page.getByTestId('viewer-tool-flood').click();
        await expect(page.getByTestId('viewer-tool-flood')).toHaveAttribute('data-active', 'true');
        await expect(page.getByTestId('viewer-flood-popover')).toBeVisible();

        await setRangeValue(page, 'viewer-flood-water-level', 120);
        await expect(page.getByTestId('viewer-flood-water-level')).toHaveValue('120');

        await page.getByTestId('viewer-tool-flood').click();
        await expect(page.getByTestId('viewer-tool-flood')).toHaveAttribute('data-active', 'false');
        await expect(page.getByTestId('viewer-flood-popover')).toBeHidden();
    });

    test('opens annotation and KVR tools with exclusive state', async ({ page }) => {
        await gotoMockedViewer(page);

        await page.getByTestId('viewer-tool-annotations').click();
        await expect(page.getByTestId('viewer-tool-annotations')).toHaveAttribute(
            'data-active',
            'true'
        );
        await expect(page.getByTestId('viewer-annotation-popover')).toBeVisible();

        await page.getByTestId('viewer-tool-kvr').click();
        await expect(page.getByTestId('viewer-tool-annotations')).toHaveAttribute(
            'data-active',
            'false'
        );
        await expect(page.getByTestId('viewer-tool-kvr')).toHaveAttribute('data-active', 'true');

        await page.getByTestId('viewer-tool-kvr').click();
        await expect(page.getByTestId('viewer-tool-kvr')).toHaveAttribute('data-active', 'false');
    });

    test('copies a Google Maps URL and compass writes camera URL state', async ({
        context,
        page,
    }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await gotoMockedViewer(page);

        await page.getByTestId('viewer-tool-google-maps').click();
        await expect
            .poll(() => page.evaluate(() => navigator.clipboard.readText()))
            .toContain('https://www.google.com/maps/@');

        await page.getByTestId('viewer-compass').click();
        await expectSearchParam(page, 'yaw', '0');
    });
});
