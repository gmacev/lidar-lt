import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StyleSpecification } from 'maplibre-gl';

const SOURCE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const outputPath = path.resolve('public/styles/liberty-dark.json');
const DARK_WATER_COLOR = '#2b8cff';

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
const darkStyle: StyleSpecification = {
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
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(darkStyle));
console.info(`Generated ${outputPath}`);
