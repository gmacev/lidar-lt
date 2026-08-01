import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StyleSpecification } from 'maplibre-gl';

const SOURCE_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';
const outputPath = path.resolve('public/styles/liberty-light.json');
const WATER_COLOR = '#aad3df';

const response = await fetch(SOURCE_STYLE_URL, {
    signal: AbortSignal.timeout(15_000),
});
if (!response.ok) {
    throw new Error(`Unable to fetch ${SOURCE_STYLE_URL}: HTTP ${response.status}`);
}

const sourceStyle: unknown = await response.json();
if (
    typeof sourceStyle !== 'object' ||
    sourceStyle === null ||
    !('version' in sourceStyle) ||
    sourceStyle.version !== 8 ||
    !('layers' in sourceStyle) ||
    !Array.isArray(sourceStyle.layers)
) {
    throw new Error(`The style returned by ${SOURCE_STYLE_URL} is not a MapLibre v8 style`);
}

const style = sourceStyle as StyleSpecification;
const lightStyle: StyleSpecification = {
    ...style,
    layers: style.layers.map((layer) => {
        const paint = { ...(layer.paint ?? {}) };
        const id = layer.id.toLowerCase();

        if (layer.type === 'background') {
            return { ...layer, paint: { ...paint, 'background-color': '#ebe9e2' } };
        }

        if (layer.type === 'fill') {
            if (id.includes('building')) {
                Object.assign(paint, {
                    'fill-color': '#d6cbc3',
                    'fill-outline-color': '#c4b8af',
                });
            } else if (id.includes('water')) {
                Object.assign(paint, { 'fill-color': WATER_COLOR });
            } else if (id.includes('sand')) {
                Object.assign(paint, { 'fill-color': '#f2e4bd', 'fill-opacity': 0.82 });
            } else if (id.includes('wood')) {
                Object.assign(paint, {
                    'fill-color': '#add19e',
                    'fill-opacity': 0.58,
                    'fill-outline-color': '#9bc48f',
                });
            } else if (id.includes('park') || id.includes('grass')) {
                Object.assign(paint, {
                    'fill-color': '#c9e5bd',
                    'fill-opacity': 0.72,
                    'fill-outline-color': '#b9d9ad',
                });
            } else if (id.includes('cemetery')) {
                Object.assign(paint, { 'fill-color': '#cfe2ce', 'fill-opacity': 0.76 });
            } else if (id.includes('commercial')) {
                Object.assign(paint, { 'fill-color': '#ead8d5', 'fill-opacity': 0.5 });
            } else if (id.includes('industrial') || id.includes('railway')) {
                Object.assign(paint, { 'fill-color': '#e9e3cd', 'fill-opacity': 0.62 });
            } else if (id.includes('hospital') || id.includes('school')) {
                Object.assign(paint, { 'fill-color': '#e7ded8', 'fill-opacity': 0.66 });
            } else if (id.includes('residential') || id.includes('suburb')) {
                Object.assign(paint, { 'fill-color': '#dddeda', 'fill-opacity': 0.62 });
            } else if (id.includes('aeroway')) {
                Object.assign(paint, { 'fill-color': '#deddd7' });
            }
        }

        if (layer.type === 'line') {
            if (id.includes('water')) {
                Object.assign(paint, { 'line-color': '#79b8c8' });
            } else if (id.includes('boundary')) {
                Object.assign(paint, { 'line-color': '#8f7298' });
            }
        }

        if (layer.type === 'symbol') {
            const isWaterLabel = id.includes('water');
            const isMajorPlaceLabel =
                id.includes('country') ||
                id.includes('state') ||
                id.includes('city') ||
                id.includes('capital');

            Object.assign(paint, {
                'text-color': isWaterLabel ? '#397889' : isMajorPlaceLabel ? '#31332f' : '#50514c',
                'text-halo-color': '#f3f1eb',
                'text-halo-width': isMajorPlaceLabel ? 1.25 : 1.1,
            });
        }

        if (layer.type === 'fill-extrusion' && id.includes('building')) {
            Object.assign(paint, {
                'fill-extrusion-color': '#d2c7bf',
                'fill-extrusion-opacity': 0.66,
            });
        }

        return { ...layer, paint } as typeof layer;
    }),
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(lightStyle));
console.info(`Generated ${outputPath}`);
