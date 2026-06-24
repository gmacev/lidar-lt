import { expect, test } from '@playwright/test';
import {
    CANONICAL_CELL_ID,
    expectNoSearchParam,
    expectSearchParam,
    expectViewerReady,
    getSearchParams,
    installMockViewer,
} from './support/viewer';

test.describe('viewer URL state', () => {
    test('hydrates valid URL params and normalizes legacy color mode in UI state', async ({
        page,
    }) => {
        await installMockViewer(page);
        await page.goto(
            `/viewer/${CANONICAL_CELL_ID}?sectorName=VILNIUS+%28centras%29&colorMode=return-number&pb=999999999&hiddenClasses=2,3&hiddenClasses=6&projection=ORTHOGRAPHIC&fov=75`
        );
        await expectViewerReady(page);

        await expect(page.getByTestId('viewer-color-mode-elevation')).toHaveClass(/laser-green/);
        await expect(page.getByTestId('viewer-point-budget')).toHaveValue('100000000');
        await expect(page.getByTestId('viewer-classification-2')).not.toBeChecked();
        await expect(page.getByTestId('viewer-classification-3')).not.toBeChecked();
        await expect(page.getByTestId('viewer-classification-6')).not.toBeChecked();
        await expect(page.getByTestId('viewer-projection-orthographic')).toHaveClass(/laser-green/);
        await expect(page.getByTestId('viewer-fov')).toBeDisabled();
    });

    test('ignores invalid params instead of crashing the route', async ({ page }) => {
        await installMockViewer(page);
        await page.goto(
            `/viewer/${CANONICAL_CELL_ID}?sectorName=VILNIUS+%28centras%29&colorMode=bad&psm=giant&pq=ultra&psh=triangle&ep=rainbow&projection=isometric&bg=blue&sb=3&pb=not-a-number`
        );
        await expectViewerReady(page);

        await expect(page.getByTestId('viewer-color-mode-elevation')).toHaveClass(/laser-green/);
        await expect(page.getByTestId('viewer-point-quality-standard')).toHaveClass(/laser-green/);
        await expect(page.getByTestId('viewer-point-shape-circle')).toHaveClass(/laser-green/);
        await expect(page.getByTestId('viewer-point-size-mode-adaptive')).toHaveClass(
            /laser-green/
        );
    });

    test('reset defaults preserves sectorName and markers while clearing display and camera params', async ({
        page,
    }) => {
        await installMockViewer(page);
        await page.goto(
            `/viewer/${CANONICAL_CELL_ID}?sectorName=VILNIUS+%28centras%29&mk=581500,6060500,100&colorMode=intensity&ps=2&pb=12000000&hiddenClasses=2,3&x=1&y=2&z=3&yaw=0.4&pitch=-1&radius=50`
        );
        await expectViewerReady(page);

        await page.getByTestId('viewer-reset-defaults').click();

        await expectSearchParam(page, 'sectorName', 'VILNIUS (centras)');
        await expectSearchParam(page, 'mk', '581500,6060500,100');
        for (const key of [
            'colorMode',
            'ps',
            'pb',
            'hiddenClasses',
            'x',
            'y',
            'z',
            'yaw',
            'pitch',
            'radius',
        ]) {
            await expectNoSearchParam(page, key);
        }
    });

    test('recenter clears only camera params and preserves display state', async ({ page }) => {
        await installMockViewer(page);
        await page.goto(
            `/viewer/${CANONICAL_CELL_ID}?sectorName=VILNIUS+%28centras%29&colorMode=intensity&ps=2&x=1&y=2&z=3&yaw=0.4&pitch=-1&radius=50`
        );
        await expectViewerReady(page);

        await page.getByTestId('viewer-recenter').click();

        for (const key of ['x', 'y', 'z', 'yaw', 'pitch', 'radius']) {
            await expectNoSearchParam(page, key);
        }
        expect(getSearchParams(page).get('colorMode')).toBe('intensity');
        expect(getSearchParams(page).get('ps')).toBe('2');
    });
});
