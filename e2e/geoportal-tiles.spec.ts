import { expect, test } from '@playwright/test';
import {
    GEOPORTAL_IMAGE_SIZE,
    GEOPORTAL_DARK_TILE_FILTER,
    GEOPORTAL_LOGICAL_TILE_SIZE,
    GEOPORTAL_MAX_MAP_ZOOM,
    GEOPORTAL_MIN_MAP_ZOOM,
    buildGeoportalTileUrls,
    getGeoportalCanvasFilter,
} from '../src/features/GridMap/utils/geoportalTiles';

test.describe('Geoportal basemap tile mapping', () => {
    test('builds four native child-tile URLs for a 512 px MapLibre tile', () => {
        const tileUrls = buildGeoportalTileUrls({ zoom: 7, x: 72, y: 40 });

        expect(tileUrls).toEqual([
            'https://www.geoportal.lt/mapproxy/rest/services/gisc_pagrindinis_wm/MapServer/tile/2/80/144',
            'https://www.geoportal.lt/mapproxy/rest/services/gisc_pagrindinis_wm/MapServer/tile/2/80/145',
            'https://www.geoportal.lt/mapproxy/rest/services/gisc_pagrindinis_wm/MapServer/tile/2/81/144',
            'https://www.geoportal.lt/mapproxy/rest/services/gisc_pagrindinis_wm/MapServer/tile/2/81/145',
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

    test('uses the Geoportal-adjusted CSS filter only for dark tiles', () => {
        expect(GEOPORTAL_DARK_TILE_FILTER).toBe(
            'invert(92%) hue-rotate(180deg) saturate(240%) contrast(106%) brightness(121%)'
        );
        expect(getGeoportalCanvasFilter('dark')).toBe(GEOPORTAL_DARK_TILE_FILTER);
        expect(getGeoportalCanvasFilter('light')).toBe('none');
    });
});
