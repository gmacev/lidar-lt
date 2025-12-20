import Map, { Source, Layer, type LayerProps } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useLithuaniaGrid } from '@/features/GridMap/hooks';
import { GridSearchControl } from './GridSearchControl';

const GRID_SOURCE_ID = 'lidar-grid';

export function GridVisualizer() {
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
                0.5, // Matched opacity
                ['boolean', ['feature-state', 'hover'], false],
                0.3, // Hover opacity
                0, // Default: Invisible
            ],
        },
    };

    const lineLayer: LayerProps = {
        id: 'grid-line',
        type: 'line',
        paint: {
            'line-color': '#00f3ff',
            'line-width': 1,
            'line-opacity': 0.2,
        },
    };

    if (!data) return null;

    const matchedCount = search.matchedIds.size;
    const totalCount = data.features.length;

    return (
        <div className="relative h-full w-full">
            <GridSearchControl
                value={search.query}
                onChange={search.setQuery}
                matchedCount={matchedCount}
                totalCount={totalCount}
            />

            <Map
                ref={mapRef}
                initialViewState={{
                    longitude: 23.8813,
                    latitude: 55.1694,
                    zoom: 6.5,
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
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
                    <div className="font-mono text-xs text-gray-400">SECTOR ID: {tooltip.id}</div>
                    <div className="text-sm font-bold">{tooltip.name}</div>
                </div>
            )}
        </div>
    );
}
