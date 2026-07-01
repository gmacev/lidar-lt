import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
import type { FeatureCollection, Geometry } from 'geojson';

const gridPath = path.resolve('src/assets/grid.json');
const source = await readFile(gridPath, 'utf8');
const grid: unknown = JSON.parse(source);

if (
    typeof grid !== 'object' ||
    grid === null ||
    !('type' in grid) ||
    grid.type !== 'FeatureCollection' ||
    !('features' in grid) ||
    !Array.isArray(grid.features)
) {
    throw new Error(`${gridPath} is not a GeoJSON FeatureCollection`);
}

const roundCoordinates = (coordinates: unknown): unknown => {
    if (!Array.isArray(coordinates)) return coordinates;
    if (coordinates.every((coordinate) => typeof coordinate === 'number')) {
        return coordinates.map((coordinate) => Math.round(coordinate * 1_000_000) / 1_000_000);
    }
    return coordinates.map(roundCoordinates);
};

for (const feature of (grid as FeatureCollection).features) {
    const geometry: Geometry | null = feature.geometry;
    if (geometry && 'coordinates' in geometry) {
        geometry.coordinates = roundCoordinates(
            geometry.coordinates
        ) as typeof geometry.coordinates;
    }
}

const optimized = await format(JSON.stringify(grid), {
    parser: 'json',
    printWidth: 100,
    tabWidth: 4,
});

await writeFile(gridPath, optimized);
console.info(
    `Optimized ${(grid as FeatureCollection).features.length} grid features in ${gridPath}`
);
