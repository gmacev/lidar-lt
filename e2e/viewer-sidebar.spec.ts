import { expect, test } from '@playwright/test';
import {
    expectNoSearchParam,
    expectSearchParam,
    gotoMockedViewer,
    setRangeValue,
} from './support/viewer';

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
        await expectSearchParam(page, 'projection', 'ORTHOGRAPHIC');
        await expect(page.getByTestId('viewer-fov')).toBeDisabled();

        await page.getByTestId('viewer-projection-perspective').click();
        await expectNoSearchParam(page, 'projection');
        await expect(page.getByTestId('viewer-fov')).toBeEnabled();
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

    test('fits the automatic elevation range to visible classifications', async ({ page }) => {
        await gotoMockedViewer(page);

        const rangeMax = page.getByTestId('viewer-elevation-range-max');
        await expect(rangeMax).toBeVisible();
        await expect
            .poll(async () => parseFloat((await rangeMax.textContent()) ?? ''))
            .toBeGreaterThan(200);

        await page.getByTestId('viewer-classification-6').uncheck();

        await expect
            .poll(async () => parseFloat((await rangeMax.textContent()) ?? ''))
            .toBeLessThan(180);
    });

    test('applies the built-in terrain preset without changing location or camera', async ({
        page,
    }) => {
        const cameraParams = {
            x: '581500',
            y: '6060500',
            z: '500',
            yaw: '0.4',
            pitch: '-1.2',
            radius: '450',
        };
        const search = new URLSearchParams({
            sectorName: 'VILNIUS (centras)',
            ...cameraParams,
            colorMode: 'intensity',
            intensityMax: '25000',
            edlEnabled: 'false',
            reliefEnabled: 'false',
            hiddenClasses: '[2]',
            mapLabels: 'true',
        });

        await gotoMockedViewer(page, `/viewer/76_32?${search.toString()}`);

        const predefinedCard = page.getByTestId('viewer-predefined-preset-terrain-enhancement');
        const managerChildren = page.getByTestId('viewer-preset-manager').locator(':scope > *');

        await expect(predefinedCard).toContainText('Terrain enhancement');
        await expect(predefinedCard.getByRole('button')).toHaveCount(1);
        await expect(
            predefinedCard.getByRole('button', { name: /Terrain enhancement/i })
        ).toHaveText('Load');
        await expect(managerChildren.first()).toHaveAttribute(
            'data-testid',
            'viewer-predefined-presets'
        );

        await predefinedCard.getByRole('button', { name: /Terrain enhancement/i }).click();

        await expectSearchParam(page, 'colorMode', 'elevation');
        await expectSearchParam(page, 'ep', 'terrain');
        await expectSearchParam(page, 'edlEnabled', 'true');
        await expectSearchParam(page, 'edlStrength', '10');
        await expectSearchParam(page, 'edlRadius', '2');
        await expectSearchParam(page, 'reliefEnabled', 'true');
        await expectSearchParam(page, 'reliefStrength', '2.5');
        await expectSearchParam(page, 'reliefRadius', '1');
        await expectSearchParam(page, 'reliefAzimuth', '315');
        await expectSearchParam(page, 'ps', '2.5');
        await expectSearchParam(page, 'psm', 'adaptive');
        await expectSearchParam(page, 'mns', '5');
        await expectSearchParam(page, 'psh', 'circle');
        await expectSearchParam(page, 'zScale', '1');
        await expectSearchParam(page, 'pb', '8000000');
        await expectSearchParam(page, 'fov', '60');
        await expectSearchParam(page, 'hiddenClasses', '[7,5,6,4,3,0]');
        await expectSearchParam(page, 'mapLabels', 'false');
        await expectNoSearchParam(page, 'intensityMax');

        await expect(page).toHaveURL(/\/viewer\/76_32/);
        await expectSearchParam(page, 'sectorName', 'VILNIUS (centras)');
        for (const [key, value] of Object.entries(cameraParams)) {
            await expectSearchParam(page, key, value);
        }

        await expect(page.getByTestId('viewer-classification-2')).toBeChecked();
        await expect(page.getByTestId('viewer-classification-3')).not.toBeChecked();
        await expect(page.getByTestId('viewer-edl-strength')).toHaveValue('10');
        await expect(page.getByTestId('viewer-relief-strength')).toHaveValue('2.5');

        await page.getByPlaceholder('Preset name').fill('My preset');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByTestId('viewer-user-preset')).toContainText('My preset');
        await expect(managerChildren.first()).toHaveAttribute(
            'data-testid',
            'viewer-predefined-presets'
        );

        const storedPresets = await page.evaluate(() =>
            localStorage.getItem('lidar:viewer-presets:v1')
        );
        expect(storedPresets).toContain('"name":"My preset"');
        expect(storedPresets).not.toContain('terrain-enhancement');
    });

    test('localizes the built-in terrain preset in Lithuanian', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('i18nextLng', 'lt'));
        await gotoMockedViewer(page);

        const predefinedCard = page.getByTestId('viewer-predefined-preset-terrain-enhancement');
        await expect(predefinedCard).toContainText('Reljefo išryškinimas');
        await expect(predefinedCard.getByRole('button')).toHaveText('Įkelti');
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

        const beforeHide = Number(await azimuth.inputValue());
        await page.getByTestId('viewer-ui-toggle').click();
        await page.waitForTimeout(150);
        await page.getByTestId('viewer-ui-toggle').click();
        await expect(cycle).toHaveText(/10s/i);
        await expect.poll(async () => Number(await azimuth.inputValue())).not.toBe(beforeHide);

        await setRangeValue(page, 'viewer-relief-azimuth', 180);
        await expect(cycle).toHaveText(/Off/i);
        await expect(azimuth).toHaveValue('180');

        const azimuthBeforeCycle = Number(await azimuth.inputValue());
        await cycle.click();
        await expect(cycle).toHaveText(/10s/i);
        await cycle.click();
        await expect(cycle).toHaveText(/7s/i);
        await cycle.click();
        await expect(cycle).toHaveText(/3s/i);
        await cycle.click();
        await expect(cycle).toHaveText(/Off/i);

        await expect(azimuth).toHaveValue(String(azimuthBeforeCycle));
        await expectSearchParam(page, 'reliefAzimuth', String(azimuthBeforeCycle));

        await cycle.click();
        await expect(cycle).toHaveText(/10s/i);
        await page.getByTestId('viewer-reset-defaults').click();
        await expect(cycle).toHaveText(/Off/i);
        await expect(azimuth).toHaveValue('315');
    });
});
