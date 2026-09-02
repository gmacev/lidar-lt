import { expect, test } from '@playwright/test';
import {
    GEOPORTAL_IMAGE_SIZE,
    GEOPORTAL_LOGICAL_TILE_SIZE,
    GEOPORTAL_MAX_MAP_ZOOM,
    GEOPORTAL_MIN_MAP_ZOOM,
    buildGeoportalTileUrls,
    transformGeoportalDarkPixels,
} from '../src/features/GridMap/utils/geoportalTiles';

test.describe('Geoportal basemap tile mapping', () => {
    test('builds four native child-tile URLs for a 512 px MapLibre tile', () => {
        const tileUrls = buildGeoportalTileUrls({ zoom: 7, x: 72, y: 40 });

        expect(tileUrls).toEqual([
            'https://www.geoportal.lt/arcgis/rest/services/geoportal_public/background_Lietuva-102100/MapServer/tile/2/80/144',
            'https://www.geoportal.lt/arcgis/rest/services/geoportal_public/background_Lietuva-102100/MapServer/tile/2/80/145',
            'https://www.geoportal.lt/arcgis/rest/services/geoportal_public/background_Lietuva-102100/MapServer/tile/2/81/144',
            'https://www.geoportal.lt/arcgis/rest/services/geoportal_public/background_Lietuva-102100/MapServer/tile/2/81/145',
        ]);
        expect(GEOPORTAL_IMAGE_SIZE / GEOPORTAL_LOGICAL_TILE_SIZE).toBe(2);

        const highestDetailTiles = buildGeoportalTileUrls({
            zoom: GEOPORTAL_MAX_MAP_ZOOM,
            x: 74_274,
            y: 41_457,
        });
        expect(highestDetailTiles?.[0]).toContain('/tile/12/82914/148548');
    });

    test('rejects tile coordinates outside the supported map range', () => {
        expect(buildGeoportalTileUrls({ zoom: GEOPORTAL_MIN_MAP_ZOOM - 1, x: 0, y: 0 })).toBeNull();
        expect(buildGeoportalTileUrls({ zoom: GEOPORTAL_MAX_MAP_ZOOM + 1, x: 0, y: 0 })).toBeNull();
        expect(buildGeoportalTileUrls({ zoom: 6.5, x: 0, y: 0 })).toBeNull();
        expect(buildGeoportalTileUrls({ zoom: 7, x: 128, y: 0 })).toBeNull();
        expect(buildGeoportalTileUrls({ zoom: 7, x: 0, y: -1 })).toBeNull();
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
