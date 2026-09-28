import Map, { Source, Layer, type LayerProps } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslation } from 'react-i18next';
import { useLithuaniaGrid } from '@/features/GridMap/hooks';
import { GridSearchControl } from './GridSearchControl';
import { GridAnnotationNavigator } from './GridAnnotationNavigator';
import { GridSectorLinks } from './GridSectorLinks';
import { LanguageSwitcher } from '@/common/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/common/components/ThemeSwitcher';
import { useTheme } from '@/common/theme';
import { Icon } from '@/common/components/Icon';
import {
    GEOPORTAL_MAX_MAP_ZOOM,
    GEOPORTAL_MIN_MAP_ZOOM,
    GEOPORTAL_LOGICAL_TILE_SIZE,
    getGeoportalTileTemplate,
} from '@/features/GridMap/utils/geoportalTiles';

const GRID_SOURCE_ID = 'lidar-grid';
const GEOPORTAL_SOURCE_ID = 'geoportal-basemap';
// Include the Baltic Sea coverage in Geoportal's published western extent.
const GEOPORTAL_RASTER_BOUNDS: [number, number, number, number] = [
    18.9665, 53.866554, 26.914825, 56.470551,
];
// Keep the viewport close to Lithuania while leaving room around the grid edges.
const MAP_PAN_BOUNDS: [number, number, number, number] = [18, 52, 30, 59];
const INITIAL_VIEW = { longitude: 23.8813, latitude: 55.1694, zoom: 6.8, bearing: 0, pitch: 0 };
const EMPTY_MAP_STYLE = { version: 8 as const, sources: {}, layers: [] };

export function GridVisualizer() {
    const { t } = useTranslation();
    const { resolvedTheme } = useTheme();
    const { data, mapRef, tooltip, search, annotationHighlight, hasActiveSectorMatch, handlers } =
        useLithuaniaGrid(resolvedTheme);

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
                    ? hasActiveSectorMatch
                        ? 0.32
                        : 0.55
                    : hasActiveSectorMatch
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
            'line-opacity': resolvedTheme === 'light' ? (hasActiveSectorMatch ? 0.34 : 0.68) : 0,
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
    const validSectorIds = new Set(
        data.features.flatMap((feature) => {
            const id = (feature.properties as { id?: unknown } | null)?.id;
            return typeof id === 'string' ? [id.replace(/\//g, '_')] : [];
        })
    );

    return (
        <div
            className="grid-map relative h-full w-full"
            data-annotation-highlight={annotationHighlight.sectorId ?? undefined}
        >
            {/* Search: full-width bottom sheet above the footer on mobile,
                top-left panel on sm+ screens. */}
            <GridSearchControl
                value={search.query}
                onChange={search.setQuery}
                matchedCount={matchedCount}
                totalCount={totalCount}
                searchStatus={search.status}
            />

            {/* Appearance, language, and saved annotations - top right */}
            <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-2 sm:right-4 sm:top-4">
                <div className="flex items-start gap-2">
                    <ThemeSwitcher />
                    <LanguageSwitcher themed />
                </div>
                <GridAnnotationNavigator
                    validSectorIds={validSectorIds}
                    onHighlightedSectorChange={annotationHighlight.setSectorId}
                />
            </div>

            <button
                type="button"
                onClick={() =>
                    mapRef.current?.getMap().easeTo({
                        center: [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude],
                        zoom: INITIAL_VIEW.zoom,
                        bearing: INITIAL_VIEW.bearing,
                        pitch: INITIAL_VIEW.pitch,
                        duration: 500,
                    })
                }
                aria-label={t('grid.resetView')}
                title={t('grid.resetView')}
                className={`absolute right-2 z-10 flex size-10 items-center justify-center rounded-lg border border-panel-border bg-panel-bg text-panel-text shadow-lg transition-colors hover:border-theme-brand/55 hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-brand/70 motion-reduce:transition-none sm:bottom-4 sm:right-4 ${search.status === 'error' ? 'bottom-[calc(9rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(6rem+env(safe-area-inset-bottom))]'}`}
            >
                <Icon name="crosshair" size={19} aria-hidden="true" />
            </button>

            <Map
                ref={mapRef}
                initialViewState={INITIAL_VIEW}
                maxBounds={MAP_PAN_BOUNDS}
                renderWorldCopies={false}
                minZoom={GEOPORTAL_MIN_MAP_ZOOM}
                maxZoom={GEOPORTAL_MAX_MAP_ZOOM}
                style={{ width: '100%', height: '100%' }}
                mapStyle={EMPTY_MAP_STYLE}
                interactiveLayerIds={['grid-fill']}
                onMouseMove={handlers.onMouseMove}
                onMouseLeave={handlers.onMouseLeave}
                attributionControl={false}
            >
                <Layer
                    id="map-background"
                    type="background"
                    paint={{
                        'background-color': resolvedTheme === 'light' ? '#fdfdfd' : '#131313',
                    }}
                />
                <Source
                    id={GEOPORTAL_SOURCE_ID}
                    type="raster"
                    tiles={[getGeoportalTileTemplate(resolvedTheme)]}
                    tileSize={GEOPORTAL_LOGICAL_TILE_SIZE}
                    minzoom={GEOPORTAL_MIN_MAP_ZOOM}
                    maxzoom={GEOPORTAL_MAX_MAP_ZOOM}
                    bounds={GEOPORTAL_RASTER_BOUNDS}
                    attribution="Žemėlapis: geoportal.lt © Aplinkos ministerija, © SSVA, 2026"
                >
                    <Layer
                        id="geoportal-basemap-layer"
                        type="raster"
                        paint={{ 'raster-fade-duration': 0 }}
                    />
                </Source>
                <Source id={GRID_SOURCE_ID} type="geojson" data={data} promoteId="id">
                    <Layer {...fillLayer} />
                    <Layer {...lineCasingLayer} />
                    <Layer {...lineLayer} />
                    <Layer {...matchedLineLayer} />
                </Source>
                <GridSectorLinks data={data} />
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
