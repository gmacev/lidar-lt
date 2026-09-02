import { expect, test } from '@playwright/test';
import {
    GEOPORTAL_IMAGE_SIZE,
    GEOPORTAL_LOGICAL_TILE_SIZE,
    GEOPORTAL_MAX_MAP_ZOOM,
    GEOPORTAL_MIN_MAP_ZOOM,
    buildGeoportalTileUrl,
    transformGeoportalDarkPixels,
} from '../src/features/GridMap/utils/geoportalTiles';

test.describe('Geoportal basemap tile mapping', () => {
    test('builds a native 512 px export in Web Mercator for a MapLibre tile', () => {
        const tileUrl = buildGeoportalTileUrl({ zoom: 7, x: 72, y: 40 });
        expect(tileUrl).not.toBeNull();

        const url = new URL(tileUrl ?? '');
        expect(url.pathname).toBe(
            '/arcgis/rest/services/geoportal_public/background_Lietuva-102100/MapServer/export'
        );
        const bounds = url.searchParams.get('bbox')?.split(',').map(Number);
        expect(bounds).toHaveLength(4);
        expect(bounds?.[0]).toBeCloseTo(2_504_688.5428, 3);
        expect(bounds?.[1]).toBeCloseTo(7_200_979.5607, 3);
        expect(bounds?.[2]).toBeCloseTo(2_817_774.6107, 3);
        expect(bounds?.[3]).toBeCloseTo(7_514_065.6285, 3);
        expect(url.searchParams.get('bboxSR')).toBe('3857');
        expect(url.searchParams.get('imageSR')).toBe('3857');
        expect(url.searchParams.get('size')).toBe(
            `${GEOPORTAL_IMAGE_SIZE},${GEOPORTAL_IMAGE_SIZE}`
        );
        expect(GEOPORTAL_IMAGE_SIZE / GEOPORTAL_LOGICAL_TILE_SIZE).toBe(2);
        expect(url.searchParams.get('f')).toBe('image');
    });

    test('rejects tile coordinates outside the supported map range', () => {
        expect(buildGeoportalTileUrl({ zoom: GEOPORTAL_MIN_MAP_ZOOM - 1, x: 0, y: 0 })).toBeNull();
        expect(buildGeoportalTileUrl({ zoom: GEOPORTAL_MAX_MAP_ZOOM + 1, x: 0, y: 0 })).toBeNull();
        expect(buildGeoportalTileUrl({ zoom: 6.5, x: 0, y: 0 })).toBeNull();
        expect(buildGeoportalTileUrl({ zoom: 7, x: 128, y: 0 })).toBeNull();
        expect(buildGeoportalTileUrl({ zoom: 7, x: 0, y: -1 })).toBeNull();
    });

    test('creates a subdued dark palette while retaining semantic chroma and alpha', () => {
        const pixels = new Uint8ClampedArray([
            245, 240, 220, 255, 15, 15, 15, 190, 60, 120, 180, 128,
        ]);

        transformGeoportalDarkPixels(pixels);

        const darkLand = Array.from(pixels.slice(0, 3));
        expect(Math.max(...darkLand)).toBeGreaterThan(20);
        expect(darkLand.every((channel) => channel < 100)).toBe(true);
        expect(Array.from(pixels.slice(4, 7)).every((channel) => channel > 180)).toBe(true);
        expect(pixels[10]).toBeGreaterThan(pixels[9] ?? 0);
        expect(pixels[9]).toBeGreaterThan(pixels[8] ?? 0);
        expect([pixels[3], pixels[7], pixels[11]]).toEqual([255, 190, 128]);
    });
});
