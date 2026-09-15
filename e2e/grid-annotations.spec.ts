import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { expectViewerReady, installMockViewer } from './support/viewer';

const STORED_ANNOTATIONS = [
    {
        id: 'annotation-newer',
        position: [581500, 6060500, 100],
        title: 'Oak embankment',
        description: 'Newer annotation',
        cameraPosition: [581450, 6060450, 160],
        cameraTarget: [581500, 6060500, 100],
        visible: true,
        createdAt: '2026-09-15T12:00:00.000Z',
    },
    {
        id: 'annotation-older',
        position: [581600, 6060600, 110],
        title: 'Old roadbed',
        description: '',
        cameraPosition: [581600, 6060600, 150],
        cameraTarget: [581550, 6060550, 105],
        visible: true,
        createdAt: '2026-09-14T12:00:00.000Z',
    },
];

function createAnnotationImportFile() {
    return {
        name: 'annotations.geojson',
        mimeType: 'application/geo+json',
        buffer: Buffer.from(
            JSON.stringify({
                type: 'FeatureCollection',
                name: 'LiDAR LT annotations',
                features: [
                    {
                        type: 'Feature',
                        id: 'grid-import-current',
                        geometry: { type: 'Point', coordinates: [24.1, 55.2] },
                        properties: {
                            id: 'grid-import-current',
                            sectorId: '76_32',
                            title: 'Imported from grid',
                            description: '',
                            createdAt: '2026-09-15T12:00:00.000Z',
                            visible: true,
                            positionLks94: [581500, 6060500, 100],
                            cameraPositionLks94: [581500, 6060500, 300],
                            cameraTargetLks94: [581500, 6060500, 100],
                        },
                    },
                ],
            })
        ),
    };
}

test('shows the full annotation navigator when nothing is stored', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByTestId('grid-annotation-trigger');
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('0');

    await trigger.click();
    await expect(page.getByTestId('grid-annotation-import')).toBeVisible();
    await expect(page.getByTestId('grid-annotation-export')).toBeDisabled();
    await expect(page.getByText('No annotations yet')).toBeVisible();
});

test('imports a validated annotation backup from the empty grid state', async ({ page }) => {
    await page.goto('/');
    await page
        .getByTestId('grid-annotation-import-input')
        .setInputFiles(createAnnotationImportFile());

    const trigger = page.getByTestId('grid-annotation-trigger');
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('1');
    const stored = await page.evaluate(() => localStorage.getItem('lidar:annotations:76_32'));
    expect(z.array(z.object({ id: z.string() })).parse(JSON.parse(stored ?? 'null'))).toEqual([
        { id: 'grid-import-current' },
    ]);
});

test.describe('grid annotation navigation', () => {
    test.beforeEach(async ({ page }) => {
        await installMockViewer(page);
        await page.addInitScript((annotations) => {
            localStorage.setItem('i18nextLng', 'en');
            localStorage.setItem('lidar:annotations:76_32', JSON.stringify(annotations));
        }, STORED_ANNOTATIONS);
    });

    test('lists stored annotations below the language controls and closes with Escape', async ({
        page,
    }) => {
        await page.goto('/');

        const trigger = page.getByTestId('grid-annotation-trigger');
        await expect(trigger).toBeVisible();
        await expect(trigger).toContainText('My annotations');
        await expect(trigger).toContainText('2');
        await expect(page.getByTestId('grid-annotation-pin')).toHaveClass(/text-theme-brand/);

        await trigger.click();
        const panel = page.getByTestId('grid-annotation-panel');
        const annotationButtons = panel.locator('ul').getByRole('button');
        await expect(panel).toBeVisible();
        await expect(annotationButtons).toHaveCount(2);
        await expect(annotationButtons.first()).toContainText('Oak embankment');
        await expect(annotationButtons.first()).toContainText('76_32');
        await expect(annotationButtons.last()).toContainText('Old roadbed');

        await annotationButtons.first().hover();
        await expect(page.locator('.grid-map')).toHaveAttribute(
            'data-annotation-highlight',
            '76_32'
        );
        await page.getByTestId('grid-annotation-export').hover();
        await expect(page.locator('.grid-map')).not.toHaveAttribute('data-annotation-highlight');

        const exportBox = await page.getByTestId('grid-annotation-export').boundingBox();
        const chevronBox = await page
            .getByTestId('grid-annotation-chevron-annotation-newer')
            .boundingBox();
        if (!exportBox || !chevronBox) throw new Error('Grid annotation actions are not visible');
        expect(exportBox.x + exportBox.width / 2).toBeCloseTo(
            chevronBox.x + chevronBox.width / 2,
            0
        );

        await page.keyboard.press('Escape');
        await expect(panel).toBeHidden();
        await expect(trigger).toBeFocused();
    });

    test('opens the annotation sector with its saved camera centered on the target', async ({
        page,
    }) => {
        await page.goto('/');
        await page.getByTestId('grid-annotation-trigger').click();
        await page.getByTestId('grid-annotation-annotation-newer').click();

        await expect(page).toHaveURL(/\/viewer\/76_32/);
        await expectViewerReady(page);

        const url = new URL(page.url());
        expect(url.searchParams.get('x')).toBe('581450');
        expect(url.searchParams.get('y')).toBe('6060450');
        expect(url.searchParams.get('z')).toBe('160');
        expect(Number(url.searchParams.get('yaw'))).toBeCloseTo(-Math.PI / 4);
        expect(Number(url.searchParams.get('pitch'))).toBeCloseTo(-0.703638951);
        expect(Number(url.searchParams.get('radius'))).toBeCloseTo(92.736184955);
    });

    test('exports every annotation as GeoJSON with WGS84 and original LKS94 data', async ({
        page,
    }) => {
        await page.goto('/');
        await page.getByTestId('grid-annotation-trigger').click();

        const downloadPromise = page.waitForEvent('download');
        await page.getByTestId('grid-annotation-export').click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(
            /^lidar-lt-annotations-\d{4}-\d{2}-\d{2}\.geojson$/
        );

        const downloadPath = await download.path();
        if (!downloadPath) throw new Error('Annotation export did not produce a file');
        const raw = await readFile(downloadPath, 'utf8');
        const parsed: unknown = JSON.parse(raw);
        const geoJson = z
            .object({
                type: z.literal('FeatureCollection'),
                name: z.literal('LiDAR LT annotations'),
                features: z.array(
                    z.object({
                        type: z.literal('Feature'),
                        geometry: z.object({
                            type: z.literal('Point'),
                            coordinates: z.tuple([z.number(), z.number()]),
                        }),
                        properties: z.object({
                            sectorId: z.string(),
                            positionLks94: z.tuple([z.number(), z.number(), z.number()]),
                            cameraPositionLks94: z
                                .tuple([z.number(), z.number(), z.number()])
                                .optional(),
                            cameraTargetLks94: z
                                .tuple([z.number(), z.number(), z.number()])
                                .optional(),
                        }),
                    })
                ),
            })
            .parse(parsed);

        expect(geoJson.features).toHaveLength(2);
        expect(geoJson.features[0].geometry.coordinates[0]).toBeGreaterThan(20.5);
        expect(geoJson.features[0].geometry.coordinates[0]).toBeLessThan(27);
        expect(geoJson.features[0].geometry.coordinates[1]).toBeGreaterThan(53.5);
        expect(geoJson.features[0].geometry.coordinates[1]).toBeLessThan(56.5);
        expect(geoJson.features[0].properties).toMatchObject({
            sectorId: '76_32',
            positionLks94: [581500, 6060500, 100],
            cameraPositionLks94: [581450, 6060450, 160],
            cameraTargetLks94: [581500, 6060500, 100],
        });
    });
});
