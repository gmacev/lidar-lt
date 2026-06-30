import { expect, test } from '@playwright/test';
import { expectSearchParam, gotoMockedViewer, setRangeValue } from './support/viewer';

test.describe('viewer sidebar settings', () => {
    test('updates visualization params from color, intensity, projection, and FOV controls', async ({
        page,
    }) => {
        await gotoMockedViewer(page);

        await page.getByTestId('viewer-color-mode-intensity').click();
        await expectSearchParam(page, 'colorMode', 'intensity');

        await setRangeValue(page, 'viewer-intensity-max', 25000);
        await expectSearchParam(page, 'intensityMax', '25000');

        await setRangeValue(page, 'viewer-intensity-gamma', 1.5);
        await expectSearchParam(page, 'ig', '1.5');

        await setRangeValue(page, 'viewer-intensity-brightness', 0.35);
        await expectSearchParam(page, 'ib', '0.35');

        await page.getByTestId('viewer-color-mode-elevation').click();
        await expectSearchParam(page, 'colorMode', 'elevation');

        await page.getByTestId('viewer-elevation-palette-terrain').click();
        await expectSearchParam(page, 'ep', 'terrain');

        await setRangeValue(page, 'viewer-fov', 80);
        await expectSearchParam(page, 'fov', '80');

        await page.getByTestId('viewer-projection-orthographic').click();
        await expect(page.getByTestId('viewer-fov')).toBeDisabled();
    });

    test('updates classification, EDL, relief, and point-cloud params', async ({ page }) => {
        await gotoMockedViewer(page);

        await page.getByTestId('viewer-classification-2').uncheck();
        await expectSearchParam(page, 'hiddenClasses', '[2]');

        await page.getByTestId('viewer-edl-enabled').click();
        await expectSearchParam(page, 'edlEnabled', 'false');

        await page.getByTestId('viewer-edl-enabled').click();
        await expectSearchParam(page, 'edlEnabled', 'true');

        await setRangeValue(page, 'viewer-edl-strength', 2.5);
        await expectSearchParam(page, 'edlStrength', '2.5');

        await setRangeValue(page, 'viewer-edl-radius', 1.5);
        await expectSearchParam(page, 'edlRadius', '1.5');

        await page.getByTestId('viewer-relief-enabled').click();
        await expectSearchParam(page, 'reliefEnabled', 'true');

        await setRangeValue(page, 'viewer-relief-strength', 3);
        await expectSearchParam(page, 'reliefStrength', '3');

        await setRangeValue(page, 'viewer-relief-azimuth', 180);
        await expectSearchParam(page, 'reliefAzimuth', '180');

        await page.getByTestId('viewer-point-quality-high').click();
        await expectSearchParam(page, 'pq', 'high');

        await page.getByTestId('viewer-point-shape-square').click();
        await expectSearchParam(page, 'psh', 'square');

        await page.getByTestId('viewer-point-size-mode-fixed').click();
        await expectSearchParam(page, 'psm', 'fixed');

        await setRangeValue(page, 'viewer-point-size', 2.2);
        await expectSearchParam(page, 'ps', '2.2');

        await setRangeValue(page, 'viewer-point-budget', 12_000_000);
        await expectSearchParam(page, 'pb', '12000000');

        await setRangeValue(page, 'viewer-z-scale', 2.5);
        await expectSearchParam(page, 'zScale', '2.5');

        await setRangeValue(page, 'viewer-min-node-size', 30);
        await expectSearchParam(page, 'mns', '30');
    });

    test('cycles automatic hillshade azimuth rotation on one button', async ({ page }) => {
        await gotoMockedViewer(page);

        const enabled = page.getByTestId('viewer-relief-enabled');
        const cycle = page.getByTestId('viewer-relief-azimuth-cycle');
        const azimuth = page.getByTestId('viewer-relief-azimuth');

        await expect(cycle).toBeDisabled();
        await expect(cycle).toHaveText(/Off/i);
        await enabled.click();

        const initialAzimuth = Number(await azimuth.inputValue());
        await cycle.click();
        await expect(cycle).toHaveText(/10s/i);
        await expect.poll(async () => Number(await azimuth.inputValue())).not.toBe(initialAzimuth);

        await setRangeValue(page, 'viewer-relief-azimuth', 180);
        await expect(cycle).toHaveText(/Off/i);
        await expect(azimuth).toHaveValue('180');

        await cycle.click();
        await expect(cycle).toHaveText(/10s/i);
        await cycle.click();
        await expect(cycle).toHaveText(/7s/i);
        await cycle.click();
        await expect(cycle).toHaveText(/3s/i);
        await cycle.click();
        await expect(cycle).toHaveText(/Off/i);

        const stoppedAzimuth = Number(await azimuth.inputValue());
        await page.waitForTimeout(100);
        await expect(azimuth).toHaveValue(String(stoppedAzimuth));
    });
});
