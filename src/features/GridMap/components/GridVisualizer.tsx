import Map, { Source, Layer, type LayerProps } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslation } from 'react-i18next';
import { useLithuaniaGrid } from '@/features/GridMap/hooks';
import { GridSearchControl } from './GridSearchControl';
import { LanguageSwitcher } from '@/common/components/LanguageSwitcher';

const GRID_SOURCE_ID = 'lidar-grid';
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export function GridVisualizer() {
    const { t } = useTranslation();
    const { data, mapRef, tooltip, search, handlers } = useLithuaniaGrid();

    // Dynamic layer styles using feature state for hover
    const fillLayer: LayerProps = {
        id: 'grid-fill',
        type: 'fill',
        paint: {
            'fill-color': [
                'case',
                ['boolean', ['feature-state', 'matched'], false],
                '#00ff9d', // Matched: Neon Green
                ['boolean', ['feature-state', 'hover'], false],
                '#0066ff', // Hover: Neon Blue
                '#000000', // Default: Black
            ],
            'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'matched'], false],
                0.42, // Matched opacity
                ['boolean', ['feature-state', 'hover'], false],
                0.24, // Hover opacity
                0, // Default: Invisible
            ],
        },
    };

    const lineLayer: LayerProps = {
        id: 'grid-line',
        type: 'line',
        paint: {
            'line-color': '#008899',
            'line-width': 1,
            'line-opacity': 0.52,
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
            />

            {/* Language switcher - top right */}
            <div className="absolute right-2 top-2 z-10 sm:right-4 sm:top-4">
                <LanguageSwitcher />
            </div>

            <Map
                ref={mapRef}
                initialViewState={{
                    longitude: 23.8813,
                    latitude: 55.1694,
                    zoom: 6.5,
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle={MAP_STYLE_URL}
                interactiveLayerIds={['grid-fill']}
                onClick={handlers.onClick}
                onMouseMove={handlers.onMouseMove}
                onMouseLeave={handlers.onMouseLeave}
                attributionControl={false}
            >
                <Source id={GRID_SOURCE_ID} type="geojson" data={data} promoteId="id">
                    <Layer {...fillLayer} />
                    <Layer {...lineLayer} />
                </Source>
            </Map>

            {tooltip && (
                <div
                    className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full rounded border border-neon-cyan bg-black/80 px-3 py-2 text-neon-cyan"
                    style={{ left: tooltip.x, top: tooltip.y - 10 }}
                >
                    <div className="font-mono text-xs text-gray-400">
                        {t('grid.sectorId')}: {tooltip.id}
                    </div>
                    <div className="text-sm font-bold">{tooltip.name}</div>
                </div>
            )}
        </div>
    );
}
