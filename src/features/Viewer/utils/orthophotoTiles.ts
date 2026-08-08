import type { OrthophotoLod, OrthophotoMetadata } from './orthophotoProvider';

export interface Lks94Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export interface OrthophotoTileFragment {
    key: string;
    tileKey: string;
    level: number;
    row: number;
    column: number;
    tileBounds: Lks94Bounds;
    clipBounds: Lks94Bounds;
}

export interface OrthophotoTilePlan {
    fragments: OrthophotoTileFragment[];
    level: number;
    tileKeys: string[];
}

function intersectBounds(first: Lks94Bounds, second: Lks94Bounds): Lks94Bounds | null {
    const intersection = {
        minX: Math.max(first.minX, second.minX),
        minY: Math.max(first.minY, second.minY),
        maxX: Math.min(first.maxX, second.maxX),
        maxY: Math.min(first.maxY, second.maxY),
    };

    return intersection.minX < intersection.maxX && intersection.minY < intersection.maxY
        ? intersection
        : null;
}

function chooseInitialLod(lods: OrthophotoLod[], targetResolution: number) {
    const suitableIndex = lods.findIndex((lod) => lod.resolution <= targetResolution);
    return suitableIndex === -1 ? lods.length - 1 : suitableIndex;
}

function getTileRange(metadata: OrthophotoMetadata, lod: OrthophotoLod, bounds: Lks94Bounds) {
    const tileWidth = metadata.tileInfo.columns * lod.resolution;
    const tileHeight = metadata.tileInfo.rows * lod.resolution;
    const epsilon = Math.min(tileWidth, tileHeight) * 1e-9;

    return {
        minColumn: Math.floor((bounds.minX - metadata.tileInfo.originX) / tileWidth),
        maxColumn: Math.floor((bounds.maxX - metadata.tileInfo.originX - epsilon) / tileWidth),
        minRow: Math.floor((metadata.tileInfo.originY - bounds.maxY) / tileHeight),
        maxRow: Math.floor((metadata.tileInfo.originY - bounds.minY - epsilon) / tileHeight),
        tileWidth,
        tileHeight,
    };
}

function getTileCoordinates(
    metadata: OrthophotoMetadata,
    lod: OrthophotoLod,
    clippedCoverage: Lks94Bounds[]
) {
    const coordinates = new Map<string, { row: number; column: number }>();

    for (const bounds of clippedCoverage) {
        const range = getTileRange(metadata, lod, bounds);
        for (let row = range.minRow; row <= range.maxRow; row++) {
            for (let column = range.minColumn; column <= range.maxColumn; column++) {
                coordinates.set(`${row}:${column}`, { row, column });
            }
        }
    }

    return [...coordinates.values()];
}

export function createOrthophotoTilePlan(options: {
    coverageBounds: readonly Lks94Bounds[];
    devicePixelRatio: number;
    maxTiles: number;
    metadata: OrthophotoMetadata;
    metersPerPixel: number;
    visibleBounds: Lks94Bounds;
}): OrthophotoTilePlan | null {
    const { coverageBounds, devicePixelRatio, maxTiles, metadata, metersPerPixel, visibleBounds } =
        options;
    const providerCoverage = coverageBounds
        .map((bounds) => intersectBounds(bounds, metadata.fullExtent))
        .filter((bounds): bounds is Lks94Bounds => bounds !== null);
    const visibleCoverage = providerCoverage
        .map((bounds) => intersectBounds(bounds, visibleBounds))
        .filter((bounds): bounds is Lks94Bounds => bounds !== null);
    if (visibleCoverage.length === 0) return null;

    const lods = metadata.tileInfo.lods;
    let lodIndex = chooseInitialLod(
        lods,
        metersPerPixel / Math.max(1, Math.min(devicePixelRatio, 2))
    );
    let coordinates = getTileCoordinates(metadata, lods[lodIndex]!, visibleCoverage);

    while (coordinates.length > maxTiles && lodIndex > 0) {
        lodIndex -= 1;
        coordinates = getTileCoordinates(metadata, lods[lodIndex]!, visibleCoverage);
    }

    const lod = lods[lodIndex]!;
    const tileWidth = metadata.tileInfo.columns * lod.resolution;
    const tileHeight = metadata.tileInfo.rows * lod.resolution;
    const fragments: OrthophotoTileFragment[] = [];

    for (const { row, column } of coordinates) {
        const tileKey = `${lod.level}:${row}:${column}`;
        const tileBounds = {
            minX: metadata.tileInfo.originX + column * tileWidth,
            maxX: metadata.tileInfo.originX + (column + 1) * tileWidth,
            maxY: metadata.tileInfo.originY - row * tileHeight,
            minY: metadata.tileInfo.originY - (row + 1) * tileHeight,
        };

        providerCoverage.forEach((coverage, coverageIndex) => {
            const clipBounds = intersectBounds(tileBounds, coverage);
            if (!clipBounds) return;
            fragments.push({
                key: `${tileKey}:${coverageIndex}:${clipBounds.minX}:${clipBounds.minY}:${clipBounds.maxX}:${clipBounds.maxY}`,
                tileKey,
                level: lod.level,
                row,
                column,
                tileBounds,
                clipBounds,
            });
        });
    }

    return {
        fragments,
        level: lod.level,
        tileKeys: coordinates.map(({ row, column }) => `${lod.level}:${row}:${column}`),
    };
}
