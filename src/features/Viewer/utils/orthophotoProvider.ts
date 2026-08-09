// Viewer code only knows this app-local path. Dev uses Vite's proxy; production can map the
// same path in Caddy after provider permission is finalized.
const ORTHOPHOTO_PROVIDER_BASE_URL = '/geoportal/ort-recent';

export interface OrthophotoLod {
    level: number;
    resolution: number;
    scale: number;
}

export interface OrthophotoMetadata {
    fullExtent: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
    tileInfo: {
        columns: number;
        rows: number;
        originX: number;
        originY: number;
        lods: OrthophotoLod[];
    };
}

interface ArcGisMetadata {
    error?: { message?: string };
    fullExtent?: {
        xmin?: number;
        ymin?: number;
        xmax?: number;
        ymax?: number;
        spatialReference?: { wkid?: number; latestWkid?: number };
    };
    tileInfo?: {
        cols?: number;
        rows?: number;
        origin?: { x?: number; y?: number };
        lods?: Array<{ level?: number; resolution?: number; scale?: number }>;
    };
}

let metadataCache: OrthophotoMetadata | null = null;

function requireFiniteNumber(value: unknown, field: string) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Invalid orthophoto metadata field: ${field}`);
    }
    return value;
}

function normalizeMetadata(value: ArcGisMetadata): OrthophotoMetadata {
    if (value.error) {
        throw new Error(value.error.message ?? 'Geoportal returned an ArcGIS error');
    }

    const extent = value.fullExtent;
    const tileInfo = value.tileInfo;
    if (!extent || !tileInfo || !tileInfo.origin || !tileInfo.lods?.length) {
        throw new Error('Geoportal orthophoto metadata is incomplete');
    }
    const spatialReference = extent.spatialReference;
    const spatialReferenceId = spatialReference?.latestWkid ?? spatialReference?.wkid;
    if (spatialReferenceId !== 3346) {
        throw new Error('Geoportal orthophoto metadata is not in EPSG:3346');
    }

    const lods = tileInfo.lods
        .map((lod) => ({
            level: requireFiniteNumber(lod.level, 'tileInfo.lods.level'),
            resolution: requireFiniteNumber(lod.resolution, 'tileInfo.lods.resolution'),
            scale: requireFiniteNumber(lod.scale, 'tileInfo.lods.scale'),
        }))
        .sort((first, second) => first.level - second.level);

    return {
        fullExtent: {
            minX: requireFiniteNumber(extent.xmin, 'fullExtent.xmin'),
            minY: requireFiniteNumber(extent.ymin, 'fullExtent.ymin'),
            maxX: requireFiniteNumber(extent.xmax, 'fullExtent.xmax'),
            maxY: requireFiniteNumber(extent.ymax, 'fullExtent.ymax'),
        },
        tileInfo: {
            columns: requireFiniteNumber(tileInfo.cols, 'tileInfo.cols'),
            rows: requireFiniteNumber(tileInfo.rows, 'tileInfo.rows'),
            originX: requireFiniteNumber(tileInfo.origin.x, 'tileInfo.origin.x'),
            originY: requireFiniteNumber(tileInfo.origin.y, 'tileInfo.origin.y'),
            lods,
        },
    };
}

export async function fetchOrthophotoMetadata(signal: AbortSignal) {
    if (metadataCache) return metadataCache;

    const response = await fetch(`${ORTHOPHOTO_PROVIDER_BASE_URL}?f=pjson`, {
        headers: { Accept: 'application/json' },
        signal,
    });
    if (!response.ok) {
        throw new Error(`Orthophoto metadata request failed with HTTP ${response.status}`);
    }

    const metadata = normalizeMetadata((await response.json()) as ArcGisMetadata);
    metadataCache = metadata;
    return metadata;
}

export function getOrthophotoTileUrl(level: number, row: number, column: number) {
    return `${ORTHOPHOTO_PROVIDER_BASE_URL}/tile/${level}/${row}/${column}`;
}
