import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
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
    'viewer-map-labels-toggle',
    'viewer-tool-google-maps',
    'viewer-tool-kvr',
    'viewer-compass',
] as const;

function createAnnotationGeoJsonFeature(id: string, sectorId: string, title: string) {
    return {
        type: 'Feature',
        id,
        geometry: { type: 'Point', coordinates: [24.1, 55.2] },
        properties: {
            id,
            sectorId,
            title,
            description: '',
            createdAt: '2026-09-15T12:00:00.000Z',
            visible: true,
            positionLks94: [581500, 6060500, 100],
            cameraPositionLks94: [581500, 6060500, 300],
            cameraTargetLks94: [581500, 6060500, 100],
        },
    };
}

function createAnnotationImportFile(features: object[]) {
    return {
        name: 'annotations.geojson',
        mimeType: 'application/geo+json',
        buffer: Buffer.from(
            JSON.stringify({
                type: 'FeatureCollection',
                name: 'LiDAR LT annotations',
                features,
            })
        ),
    };
}

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
        await expect(page.getByTestId('viewer-annotation-export')).toBeDisabled();

        await page.getByTestId('viewer-tool-kvr').click();
        await expect(page.getByTestId('viewer-tool-annotations')).toHaveAttribute(
            'data-active',
            'false'
        );
        await expect(page.getByTestId('viewer-tool-kvr')).toHaveAttribute('data-active', 'true');

        await page.getByTestId('viewer-tool-kvr').click();
        await expect(page.getByTestId('viewer-tool-kvr')).toHaveAttribute('data-active', 'false');
    });

    test('uses the exact camera pose stored for an annotation', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'lidar:annotations:76_32',
                JSON.stringify([
                    {
                        id: 'stored-annotation',
                        position: [581500, 6060500, 100],
                        title: 'Stored annotation',
                        description: '',
                        cameraPosition: [581400, 6060400, 150],
                        cameraTarget: [581450, 6060450, 90],
                        visible: true,
                        createdAt: '2026-09-15T12:00:00.000Z',
                    },
                ])
            );
        });
        await gotoMockedViewer(page);

        await page.getByTestId('viewer-tool-annotations').click();
        await page.getByTitle('Stored annotation').click();

        await expect(page.locator('body')).toHaveAttribute(
            'data-annotation-camera-position',
            '581400,6060400,150'
        );
        await expect(page.locator('body')).toHaveAttribute(
            'data-annotation-camera-target',
            '581450,6060450,90'
        );
    });

    test('exports only annotations from the current sector', async ({ page }) => {
        await page.addInitScript(() => {
            const annotation = {
                id: 'current-sector-annotation',
                position: [581500, 6060500, 100],
                title: 'Current sector',
                description: '',
                cameraPosition: [581500, 6060500, 300],
                cameraTarget: [581500, 6060500, 100],
                visible: true,
                createdAt: '2026-09-15T12:00:00.000Z',
            };
            localStorage.setItem('lidar:annotations:76_32', JSON.stringify([annotation]));
            localStorage.setItem(
                'lidar:annotations:57_41',
                JSON.stringify([{ ...annotation, id: 'other-sector-annotation' }])
            );
        });
        await gotoMockedViewer(page);
        await page.getByTestId('viewer-tool-annotations').click();

        const exportButton = page.getByTestId('viewer-annotation-export');
        await expect(exportButton).toBeEnabled();

        const actionCenters = await Promise.all(
            [
                page.getByTestId('viewer-annotation-close'),
                exportButton,
                page.getByTestId('viewer-annotation-delete-current-sector-annotation'),
            ].map(async (button) => {
                const box = await button.boundingBox();
                if (!box) throw new Error('Annotation action button is not visible');
                return box.x + box.width / 2;
            })
        );
        expect(Math.max(...actionCenters) - Math.min(...actionCenters)).toBeLessThanOrEqual(0.5);

        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(
            /^lidar-lt-annotations-76_32-\d{4}-\d{2}-\d{2}\.geojson$/
        );
        const downloadPath = await download.path();
        if (!downloadPath) throw new Error('Sector annotation export did not produce a file');

        const raw = await readFile(downloadPath, 'utf8');
        const parsed: unknown = JSON.parse(raw);
        const exported = z
            .object({
                features: z.array(
                    z.object({
                        id: z.string(),
                        properties: z.object({ sectorId: z.string() }),
                    })
                ),
            })
            .parse(parsed);
        expect(exported.features).toEqual([
            {
                id: 'current-sector-annotation',
                properties: { sectorId: '76_32' },
            },
        ]);
    });

    test('validates and merges a global annotation backup from the sector viewer', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'lidar:annotations:76_32',
                JSON.stringify([
                    {
                        id: 'existing-annotation',
                        position: [581400, 6060400, 90],
                        title: 'Existing annotation',
                        description: '',
                        cameraPosition: [581400, 6060400, 290],
                        cameraTarget: [581400, 6060400, 90],
                        visible: true,
                        createdAt: '2026-09-14T12:00:00.000Z',
                    },
                ])
            );
        });
        await gotoMockedViewer(page);
        await page.getByTestId('viewer-tool-annotations').click();

        await page
            .getByTestId('viewer-annotation-import-input')
            .setInputFiles(
                createAnnotationImportFile([
                    createAnnotationGeoJsonFeature(
                        'existing-annotation',
                        '76_32',
                        'Imported duplicate'
                    ),
                    createAnnotationGeoJsonFeature('new-current', '76_32', 'New current sector'),
                    createAnnotationGeoJsonFeature('new-other', '57_41', 'New other sector'),
                ])
            );

        await expect(page.getByTitle('New current sector')).toBeVisible();
        await expect(page.getByTitle('New other sector')).toHaveCount(0);
        const stored = await page.evaluate(() => ({
            current: localStorage.getItem('lidar:annotations:76_32'),
            other: localStorage.getItem('lidar:annotations:57_41'),
        }));
        const storedSchema = z.array(z.object({ id: z.string(), title: z.string() }));
        expect(storedSchema.parse(JSON.parse(stored.current ?? 'null'))).toEqual([
            { id: 'existing-annotation', title: 'Existing annotation' },
            { id: 'new-current', title: 'New current sector' },
        ]);
        expect(storedSchema.parse(JSON.parse(stored.other ?? 'null'))).toEqual([
            { id: 'new-other', title: 'New other sector' },
        ]);
    });

    test('rejects an invalid annotation backup without changing storage', async ({ page }) => {
        await gotoMockedViewer(page);
        await page.getByTestId('viewer-tool-annotations').click();

        const duplicateFeature = createAnnotationGeoJsonFeature(
            'duplicate-id',
            '76_32',
            'Duplicate'
        );
        await page
            .getByTestId('viewer-annotation-import-input')
            .setInputFiles(createAnnotationImportFile([duplicateFeature, duplicateFeature]));

        await expect(page.getByText('Could not import annotations')).toBeVisible();
        expect(
            await page.evaluate(() => localStorage.getItem('lidar:annotations:76_32'))
        ).toBeNull();
    });

    test('stores new annotations with a camera pose centered on their position', async ({
        page,
    }) => {
        await gotoMockedViewer(page);

        await page.getByTestId('viewer-tool-annotations').click();
        await page.getByTestId('viewer-annotation-start-placement').click();
        await page.locator('canvas').click({ position: { x: 500, y: 200 } });
        const dialog = page.getByRole('dialog', { name: 'New Annotation' });
        await dialog.locator('#annotation-title').fill('Centered annotation');
        await dialog.getByRole('button', { name: 'Save' }).click();

        const storedJson = await page.evaluate(() =>
            localStorage.getItem('lidar:annotations:76_32')
        );
        const parsedStored: unknown = JSON.parse(storedJson ?? 'null');
        const stored = z
            .array(
                z.object({
                    position: z.tuple([z.number(), z.number(), z.number()]),
                    cameraPosition: z.tuple([z.number(), z.number(), z.number()]),
                    cameraTarget: z.tuple([z.number(), z.number(), z.number()]),
                })
            )
            .parse(parsedStored);

        expect(stored).toHaveLength(1);
        expect(stored[0].position).toEqual([581500.1234, 6060500.5678, 100]);
        expect(stored[0].cameraTarget).toEqual(stored[0].position);
        expect(stored[0].cameraPosition[0]).toBeCloseTo(581500.1234);
        expect(stored[0].cameraPosition[1]).toBeCloseTo(6060500.5678);
        expect(stored[0].cameraPosition[2]).toBe(300);
    });

    test('keeps annotation form controls visible after the modal locks body scrolling', async ({
        page,
    }) => {
        await gotoMockedViewer(page);

        await page.getByTestId('viewer-tool-annotations').click();
        await page.getByTestId('viewer-annotation-start-placement').click();
        await page.locator('canvas').click({ position: { x: 500, y: 200 } });

        const dialog = page.getByRole('dialog');
        await expect(dialog.locator('#annotation-title')).toBeVisible();
        await expect(dialog.locator('#annotation-description')).toBeVisible();
        await expect(dialog.locator('button[type="submit"]')).toBeVisible();
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
