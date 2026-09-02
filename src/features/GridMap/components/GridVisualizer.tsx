import Map, { Source, Layer, type LayerProps } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslation } from 'react-i18next';
import { useLithuaniaGrid } from '@/features/GridMap/hooks';
import { GridSearchControl } from './GridSearchControl';
import { LanguageSwitcher } from '@/common/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/common/components/ThemeSwitcher';
import { useTheme } from '@/common/theme';
import {
    GEOPORTAL_MAX_MAP_ZOOM,
    GEOPORTAL_MIN_MAP_ZOOM,
    GEOPORTAL_LOGICAL_TILE_SIZE,
    getGeoportalTileTemplate,
} from '@/features/GridMap/utils/geoportalTiles';

const GRID_SOURCE_ID = 'lidar-grid';
const GEOPORTAL_SOURCE_ID = 'geoportal-basemap';
const EMPTY_MAP_STYLE = { version: 8 as const, sources: {}, layers: [] };

export function GridVisualizer() {
    const { t } = useTranslation();
    const { resolvedTheme } = useTheme();
    const { data, mapRef, tooltip, search, handlers } = useLithuaniaGrid(resolvedTheme);

    // Dynamic layer styles using feature state for hover
    const fillLayer: LayerProps = {
        id: 'grid-fill',
        type: 'fill',
        paint: {
            'fill-color': [
                'case',
                ['boolean', ['feature-state', 'matched'], false],
                '#ff5a00', // Matched: Neon Orange
                ['boolean', ['feature-state', 'hover'], false],
                '#d28a24', // Hover: Amber
                '#000000', // Default: Black
            ],
            'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'matched'], false],
                0.46, // Matched opacity
                ['boolean', ['feature-state', 'hover'], false],
                0.38, // Hover opacity
                0, // Default: Invisible
            ],
        },
    };

    const lineLayer: LayerProps = {
        id: 'grid-line',
        type: 'line',
        paint: {
            'line-color': resolvedTheme === 'light' ? '#855b18' : '#b8842a',
            'line-width': resolvedTheme === 'light' ? 1.15 : 1,
            'line-opacity':
                resolvedTheme === 'light'
                    ? search.matchedIds.size > 0
                        ? 0.32
                        : 0.55
                    : search.matchedIds.size > 0
                      ? 0.18
                      : 0.32,
        },
    };

    const lineCasingLayer: LayerProps = {
        id: 'grid-line-casing',
        type: 'line',
        paint: {
            'line-color': resolvedTheme === 'light' ? '#f7f4ec' : 'rgba(0, 0, 0, 0)',
            'line-width': resolvedTheme === 'light' ? 2.45 : 0,
            'line-opacity':
                resolvedTheme === 'light' ? (search.matchedIds.size > 0 ? 0.34 : 0.68) : 0,
        },
    };

    const matchedLineLayer: LayerProps = {
        id: 'grid-matched-line',
        type: 'line',
        paint: {
            'line-color': [
                'case',
                ['boolean', ['feature-state', 'matched'], false],
                '#ffb347',
                'rgba(0, 0, 0, 0)',
            ],
            'line-width': ['case', ['boolean', ['feature-state', 'matched'], false], 2, 0],
            'line-opacity': ['case', ['boolean', ['feature-state', 'matched'], false], 0.82, 0],
        },
    };

    if (!data) return null;

    const matchedCount = search.matchedIds.size;
    const totalCount = data.features.length;

    return (
        <div className="grid-map relative h-full w-full">
            <GridSearchControl
                value={search.query}
                onChange={search.setQuery}
                matchedCount={matchedCount}
                totalCount={totalCount}
                searchStatus={search.status}
            />

            {/* Appearance and language controls - top right */}
            <div className="absolute right-2 top-2 z-10 flex items-start gap-2 sm:right-4 sm:top-4">
                <ThemeSwitcher />
                <LanguageSwitcher themed />
            </div>

            <Map
                ref={mapRef}
                initialViewState={{
                    longitude: 23.8813,
                    latitude: 55.1694,
                    zoom: 6,
                }}
                zoomSnap={1}
                style={{ width: '100%', height: '100%' }}
                mapStyle={EMPTY_MAP_STYLE}
                interactiveLayerIds={['grid-fill']}
                onClick={handlers.onClick}
                onMouseMove={handlers.onMouseMove}
                onMouseLeave={handlers.onMouseLeave}
                attributionControl={false}
            >
                <Layer
                    id="map-background"
                    type="background"
                    paint={{
                        'background-color': resolvedTheme === 'light' ? '#e8e7df' : '#151b1e',
                    }}
                />
                <Source
                    id={GEOPORTAL_SOURCE_ID}
                    type="raster"
                    tiles={[getGeoportalTileTemplate(resolvedTheme)]}
                    tileSize={GEOPORTAL_LOGICAL_TILE_SIZE}
                    minzoom={GEOPORTAL_MIN_MAP_ZOOM}
                    maxzoom={GEOPORTAL_MAX_MAP_ZOOM}
                    attribution="Žemėlapis: geoportal.lt © Aplinkos ministerija, © SSVA, 2026"
                >
                    <Layer id="geoportal-basemap-layer" type="raster" />
                </Source>
                <Source id={GRID_SOURCE_ID} type="geojson" data={data} promoteId="id">
                    <Layer {...fillLayer} />
                    <Layer {...lineCasingLayer} />
                    <Layer {...lineLayer} />
                    <Layer {...matchedLineLayer} />
                </Source>
            </Map>

            {tooltip && (
                <div
                    className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full rounded border border-theme-brand bg-panel-bg px-3 py-2 text-theme-brand"
                    style={{ left: tooltip.x, top: tooltip.y - 10 }}
                >
                    <div className="font-mono text-xs text-panel-muted">
                        {t('grid.sectorId')}: {tooltip.id}
                    </div>
                    <div className="text-sm font-bold">{tooltip.name}</div>
                </div>
            )}
        </div>
    );
}
