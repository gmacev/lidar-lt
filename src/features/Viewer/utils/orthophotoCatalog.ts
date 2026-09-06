import { z } from 'zod';
import {
    fetchOrthophotoMetadata,
    ORTHOPHOTO_ARCGIS_ROOT,
    ORTHOPHOTO_CATALOG_URL,
    type OrthophotoMetadata,
} from './orthophotoProvider';
import type { Lks94Bounds } from './orthophotoTiles';

export interface OrthophotoServiceInfo {
    /** Stable key used in the URL, e.g. "2024-2026". */
    id: string;
    /** ArcGIS service name, e.g. "NZT/ORT10LT_2024_2026". */
    serviceName: string;
    /** MapServer root URL used for metadata and tile requests. */
    baseUrl: string;
    /** Year range used in labels, e.g. "2024-2026". */
    rangeLabel: string;
    startYear: number;
    endYear: number;
    metadata: OrthophotoMetadata;
}

/**
 * Nationwide 10 cm orthophoto series. Other NZT/ORT* services (ORT2LT city
 * imagery, ORT_recent mixed-vintage mosaic, ORT_skrydziai flight boundaries,
 * Web Mercator duplicates) are intentionally excluded from the year picker.
 */
const ORTHOPHOTO_SERIES_PATTERN = /^NZT\/ORT10LT_\d{4}(?:_\d{4})?$/;

/** Used when the ArcGIS service directory itself cannot be listed. */
const KNOWN_ORTHOPHOTO_SERVICE_NAMES = [
    'NZT/ORT10LT_2024_2026',
    'NZT/ORT10LT_2021_2023',
    'NZT/ORT10LT_2018_2020',
    'NZT/ORT10LT_2015',
    'NZT/ORT10LT_2012_2013',
    'NZT/ORT10LT_2009_2010',
    'NZT/ORT10LT_2005_2006',
    'NZT/ORT10LT_1995_2001',
];

/** Coarse zoom used for coverage probes (~6.7 km tiles). */
const PROBE_LEVEL = 5;

/**
 * Upper bound on tiles probed per service. A 1 km sector intersects at most
 * four L5 tiles; the cap only guards against degenerate bounds.
 */
const MAX_PROBE_TILES = 16;

/** Service directory entries are validated one by one; malformed entries are skipped. */
const ServiceDirectorySchema = z.object({
    error: z.object({ message: z.string().optional() }).optional(),
    services: z.array(z.unknown()).optional(),
});

function isSeriesService(service: unknown): service is { name: string; type: string } {
    if (typeof service !== 'object' || service === null) return false;
    if (!('name' in service) || !('type' in service)) return false;
    return (
        service.type === 'MapServer' &&
        typeof service.name === 'string' &&
        ORTHOPHOTO_SERIES_PATTERN.test(service.name)
    );
}

let catalogCache: OrthophotoServiceInfo[] | null = null;
let catalogPromise: Promise<OrthophotoServiceInfo[]> | null = null;

function parseYearRange(mapName: string, serviceName: string) {
    // Prefer the human range from mapName: "ORT10LT 2015-2017" even though the
    // service itself is named ORT10LT_2015.
    const mapMatch = mapName.match(/(\d{4})\s*[–—-]\s*(\d{4})/);
    if (mapMatch) {
        return {
            rangeLabel: `${mapMatch[1]}-${mapMatch[2]}`,
            startYear: Number(mapMatch[1]),
            endYear: Number(mapMatch[2]),
        };
    }

    const serviceMatch = serviceName.match(/_(\d{4})(?:_(\d{4}))?$/);
    if (serviceMatch) {
        const startYear = Number(serviceMatch[1]);
        const endYear = serviceMatch[2] ? Number(serviceMatch[2]) : startYear;
        return {
            rangeLabel: startYear === endYear ? `${startYear}` : `${startYear}-${endYear}`,
            startYear,
            endYear,
        };
    }

    return null;
}

async function listSeriesServiceNames(): Promise<string[]> {
    try {
        const response = await fetch(ORTHOPHOTO_CATALOG_URL, {
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
            throw new Error(`Orthophoto catalog request failed with HTTP ${response.status}`);
        }
        const directory = ServiceDirectorySchema.parse(await response.json());
        if (directory.error) {
            throw new Error(directory.error.message ?? 'Geoportal returned an ArcGIS error');
        }
        const names = (directory.services ?? [])
            .filter(isSeriesService)
            .map((service) => service.name);
        return names.length > 0 ? names : [...KNOWN_ORTHOPHOTO_SERVICE_NAMES];
    } catch {
        return [...KNOWN_ORTHOPHOTO_SERVICE_NAMES];
    }
}

async function describeService(serviceName: string): Promise<OrthophotoServiceInfo | null> {
    try {
        const baseUrl = `${ORTHOPHOTO_ARCGIS_ROOT}/${serviceName}/MapServer`;
        const metadata = await fetchOrthophotoMetadata(baseUrl);
        const range = parseYearRange(metadata.mapName, serviceName);
        if (!range) return null;
        return {
            id: range.rangeLabel,
            serviceName,
            baseUrl,
            rangeLabel: range.rangeLabel,
            startYear: range.startYear,
            endYear: range.endYear,
            metadata,
        };
    } catch {
        // A single broken vintage must not take down the whole picker.
        return null;
    }
}

/**
 * Discovers every ORT10LT year service, newest first. Session-cached and
 * independent of caller cancellation; only per-sector probes are
 * caller-cancellable.
 */
async function fetchOrthophotoCatalog(): Promise<OrthophotoServiceInfo[]> {
    if (catalogCache) return catalogCache;
    if (!catalogPromise) {
        catalogPromise = (async () => {
            const serviceNames = await listSeriesServiceNames();
            const described = await Promise.all(
                serviceNames.map((serviceName) => describeService(serviceName))
            );
            const services = described
                .filter((service): service is OrthophotoServiceInfo => service !== null)
                .sort((first, second) => {
                    if (second.endYear !== first.endYear) return second.endYear - first.endYear;
                    return second.startYear - first.startYear;
                });
            if (services.length === 0) {
                throw new Error('No orthophoto year services are available');
            }
            catalogCache = services;
            return services;
        })();
        catalogPromise.catch(() => {
            catalogPromise = null;
        });
    }
    return catalogPromise;
}

function getUnionBounds(bounds: readonly Lks94Bounds[]): Lks94Bounds | null {
    if (bounds.length === 0) return null;
    return {
        minX: Math.min(...bounds.map((item) => item.minX)),
        minY: Math.min(...bounds.map((item) => item.minY)),
        maxX: Math.max(...bounds.map((item) => item.maxX)),
        maxY: Math.max(...bounds.map((item) => item.maxY)),
    };
}

function boundsIntersect(first: Lks94Bounds, second: Lks94Bounds) {
    return (
        first.minX < second.maxX &&
        first.maxX > second.minX &&
        first.minY < second.maxY &&
        first.maxY > second.minY
    );
}

interface ProbeTile {
    level: number;
    row: number;
    column: number;
}

/** Coarse tiles intersecting the sector bounds, center-out, capped. */
function getProbeTiles(metadata: OrthophotoMetadata, bounds: Lks94Bounds): ProbeTile[] {
    const lods = metadata.tileInfo.lods;
    const lod =
        lods.find((item) => item.level === PROBE_LEVEL) ??
        lods[Math.floor(lods.length / 2)] ??
        null;
    if (!lod) return [];
    const { columns, originX, originY } = metadata.tileInfo;
    const tileSize = columns * lod.resolution;
    const minColumn = Math.floor((bounds.minX - originX) / tileSize);
    const maxColumn = Math.floor((bounds.maxX - originX) / tileSize);
    // Rows grow downward from the top-left origin.
    const minRow = Math.floor((originY - bounds.maxY) / tileSize);
    const maxRow = Math.floor((originY - bounds.minY) / tileSize);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const tiles: Array<ProbeTile & { distance: number }> = [];
    for (let row = minRow; row <= maxRow; row += 1) {
        for (let column = minColumn; column <= maxColumn; column += 1) {
            const tileCenterX = originX + (column + 0.5) * tileSize;
            const tileCenterY = originY - (row + 0.5) * tileSize;
            tiles.push({
                level: lod.level,
                row,
                column,
                distance: Math.hypot(tileCenterX - centerX, tileCenterY - centerY),
            });
        }
    }
    return tiles
        .sort((first, second) => first.distance - second.distance)
        .slice(0, MAX_PROBE_TILES)
        .map(({ level, row, column }) => ({ level, row, column }));
}

const probeCache = new Map<string, boolean>();
const MAX_PROBE_CACHE_ENTRIES = 1000;

function setProbeCache(key: string, available: boolean) {
    if (probeCache.has(key)) return;
    if (probeCache.size >= MAX_PROBE_CACHE_ENTRIES) {
        const oldest = probeCache.keys().next();
        if (!oldest.done) probeCache.delete(oldest.value);
    }
    probeCache.set(key, available);
}

/**
 * Clears cached tile-probe results. Called on explicit retry so a re-check
 * always re-reads provider state; the catalog itself stays session-cached.
 */
export function clearOrthophotoProbeCache() {
    probeCache.clear();
}

/**
 * Requests one coarse tile with the same URL pattern the renderer uses.
 * Missing coverage answers 404, which rejects (no CORS headers on ArcGIS
 * errors). Only definitive answers are cached: hits and 404 responses;
 * transient failures stay uncached and are retried on the next check.
 */
async function probeTile(
    service: OrthophotoServiceInfo,
    tile: ProbeTile,
    signal: AbortSignal
): Promise<boolean> {
    const url = `${service.baseUrl}/tile/${tile.level}/${tile.row}/${tile.column}`;
    const cached = probeCache.get(url);
    if (cached !== undefined) return cached;
    try {
        const response = await fetch(url, { signal });
        try {
            await response.body?.cancel();
        } catch {
            // Ignored: the status is all the probe needs.
        }
        const available = response.ok;
        if (available || response.status === 404) {
            setProbeCache(url, available);
        }
        return available;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        return false;
    }
}

/**
 * Available means imagery exists for at least part of the sector: the
 * renderer clips to the real footprints, so partial vintages stay selectable
 * while vintages with no tiles here are hidden. Probes run center-out with
 * early exit, so full coverage usually costs a single probe.
 */
async function isOrthophotoServiceAvailable(
    service: OrthophotoServiceInfo,
    bounds: Lks94Bounds,
    signal: AbortSignal
): Promise<boolean> {
    const tiles = getProbeTiles(service.metadata, bounds);
    for (const tile of tiles) {
        if (await probeTile(service, tile, signal)) return true;
    }
    return false;
}

/**
 * Catalog filtered to vintages covering the sector, newest first. Empty
 * bounds yield no services; the caller substitutes point-cloud bounds first.
 */
export async function fetchAvailableOrthophotoServices(
    coverageBounds: readonly Lks94Bounds[],
    signal: AbortSignal
): Promise<OrthophotoServiceInfo[]> {
    const catalog = await fetchOrthophotoCatalog();
    const sectorBounds = getUnionBounds(coverageBounds);
    if (!sectorBounds) return [];
    const candidates = catalog.filter((service) =>
        boundsIntersect(sectorBounds, service.metadata.fullExtent)
    );

    const results = await Promise.all(
        candidates.map(async (service) => {
            signal.throwIfAborted();
            const available = await isOrthophotoServiceAvailable(service, sectorBounds, signal);
            return available ? service : null;
        })
    );
    return results.filter((service): service is OrthophotoServiceInfo => service !== null);
}

export function findOrthophotoService(
    services: readonly OrthophotoServiceInfo[],
    id: string | undefined
): OrthophotoServiceInfo | null {
    if (services.length === 0) return null;
    return services.find((service) => service.id === id) ?? services[0];
}
