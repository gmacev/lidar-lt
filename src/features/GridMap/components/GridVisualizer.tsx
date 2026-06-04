import { useEffect, useState } from 'react';
import Map, { Source, Layer, type LayerProps } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { StyleSpecification } from 'maplibre-gl';
import { useTranslation } from 'react-i18next';
import { useLithuaniaGrid } from '@/features/GridMap/hooks';
import { GridSearchControl } from './GridSearchControl';
import { LanguageSwitcher } from '@/common/components/LanguageSwitcher';

const GRID_SOURCE_ID = 'lidar-grid';
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DARK_WATER_COLOR = '#2b8cff';

const darkenLibertyStyle = (style: StyleSpecification): StyleSpecification => ({
    ...style,
    layers: style.layers.map((layer) => {
        const paint = { ...(layer.paint ?? {}) };
        const id = layer.id.toLowerCase();

        if (layer.type === 'background') {
            return { ...layer, paint: { ...paint, 'background-color': '#090b08' } };
        }

        if (layer.type === 'fill') {
            if (id.includes('building')) {
                Object.assign(paint, {
                    'fill-color': '#131715',
                    'fill-outline-color': '#2b332f',
                    'fill-opacity': 0.72,
                });
            } else if (id.includes('road')) {
                Object.assign(paint, { 'fill-color': '#1b1711', 'fill-opacity': 0.36 });
            } else if (id.includes('water')) {
                Object.assign(paint, { 'fill-color': DARK_WATER_COLOR, 'fill-opacity': 0.58 });
            } else if (
                id.includes('park') ||
                id.includes('wood') ||
                id.includes('grass') ||
                id.includes('landcover')
            ) {
                Object.assign(paint, {
                    'fill-color': '#0b2410',
                    'fill-outline-color': '#1f6a2a',
                    'fill-opacity': 0.62,
                });
            } else if (id.includes('landuse')) {
                Object.assign(paint, {
                    'fill-color': '#0f150d',
                    'fill-outline-color': '#1c2419',
                    'fill-opacity': 0.72,
                });
            } else {
                Object.assign(paint, { 'fill-color': '#0d100c' });
            }
        }

        if (layer.type === 'line') {
            if (id.includes('water')) {
                Object.assign(paint, { 'line-color': DARK_WATER_COLOR, 'line-opacity': 0.98 });
            } else if (id.includes('road') || id.includes('highway') || id.includes('rail')) {
                Object.assign(paint, { 'line-color': '#3e3325', 'line-opacity': 0.28 });
            } else if (id.includes('boundary')) {
                Object.assign(paint, { 'line-color': '#6f756e', 'line-opacity': 0.56 });
            } else {
                Object.assign(paint, { 'line-color': '#2a302a', 'line-opacity': 0.52 });
            }
        }

        if (layer.type === 'symbol') {
            Object.assign(paint, {
                'text-color': id.includes('country') || id.includes('city') ? '#f2f2ef' : '#c7c9c2',
                'text-halo-color': '#10120e',
                'text-halo-width': 1.25,
            });
        }

        if (layer.type === 'fill-extrusion' && id.includes('building')) {
            Object.assign(paint, {
                'fill-extrusion-color': '#18201d',
                'fill-extrusion-opacity': 0.42,
            });
        }

        if (layer.type === 'raster') {
            Object.assign(paint, {
                'raster-opacity': 0,
                'raster-saturation': -0.6,
                'raster-brightness-max': 0.35,
            });
        }

        return { ...layer, paint } as typeof layer;
    }),
});

const getMapLabelExpression = (language: string) =>
    language.startsWith('en')
        ? ['coalesce', ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']]
        : ['coalesce', ['get', 'name:lt'], ['get', 'name_lt'], ['get', 'name']];

export function GridVisualizer() {
    const { t, i18n } = useTranslation();
    const { data, mapRef, tooltip, search, handlers } = useLithuaniaGrid();
    const [mapStyle, setMapStyle] = useState<StyleSpecification | string>(MAP_STYLE_URL);

    useEffect(() => {
        let isMounted = true;

        fetch(MAP_STYLE_URL)
            .then((response) => response.json() as Promise<StyleSpecification>)
            .then((style) => {
                if (isMounted) {
                    setMapStyle(darkenLibertyStyle(style));
                }
            })
            .catch(() => {
                if (isMounted) {
                    setMapStyle(MAP_STYLE_URL);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        const applyLabelLanguage = () => {
            const style = map.getStyle();
            const layers = style.layers ?? [];
            const labelExpression = getMapLabelExpression(i18n.resolvedLanguage ?? i18n.language);

            for (const layer of layers) {
                if (layer.type !== 'symbol') continue;

                const textField = layer.layout?.['text-field'];
                if (!textField) continue;

                const textFieldJson = JSON.stringify(textField);
                const isNameLabel =
                    textFieldJson.includes('"name"') ||
                    textFieldJson.includes('"name_en"') ||
                    textFieldJson.includes('"name:latin"');

                if (isNameLabel) {
                    map.setLayoutProperty(layer.id, 'text-field', labelExpression);
                }
            }
        };

        if (map.isStyleLoaded()) {
            applyLabelLanguage();
        }

        map.on('styledata', applyLabelLanguage);

        return () => {
            map.off('styledata', applyLabelLanguage);
        };
    }, [i18n.language, i18n.resolvedLanguage, mapRef]);

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
            'line-color': '#b8842a',
            'line-width': 1,
            'line-opacity': search.matchedIds.size > 0 ? 0.18 : 0.32,
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
                mapStyle={mapStyle}
                interactiveLayerIds={['grid-fill']}
                onClick={handlers.onClick}
                onMouseMove={handlers.onMouseMove}
                onMouseLeave={handlers.onMouseLeave}
                attributionControl={false}
            >
                <Source id={GRID_SOURCE_ID} type="geojson" data={data} promoteId="id">
                    <Layer {...fillLayer} />
                    <Layer {...lineLayer} />
                    <Layer {...matchedLineLayer} />
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
