import { z } from 'zod';
import {
    GEOPORTAL_ORTHOPHOTO_DISCOVERY_URL,
    GEOPORTAL_ORTHOPHOTO_FALLBACK_ENDPOINTS,
    type GeoportalOrthophotoEndpoint,
} from '@/common/config/geoportal';
import { fetchOrthophotoMetadata, type OrthophotoMetadata } from './orthophotoProvider';
import type { Lks94Bounds } from './orthophotoTiles';

/** Continuously covering mixed-vintage mosaic: newest imagery per location. */
const ORTHOPHOTO_RECENT_SERVICE_NAME = 'nzt_ort10lt_recent';
const ORTHOPHOTO_RECENT_ID = 'recent';

interface OrthophotoDatedService {
    kind: 'dated';
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

interface OrthophotoRecentService {
    kind: 'recent';
    /** Stable key used in the URL: "recent". */
    id: typeof ORTHOPHOTO_RECENT_ID;
    /** Geoportal discovery key: "nzt_ort10lt_recent". */
    serviceName: typeof ORTHOPHOTO_RECENT_SERVICE_NAME;
    /** MapServer root URL used for metadata and tile requests. */
    baseUrl: string;
    metadata: OrthophotoMetadata;
}

export type OrthophotoServiceInfo = OrthophotoDatedService | OrthophotoRecentService;

/**
 * Nationwide 10 cm orthophoto series. Other NZT/ORT* services (ORT2LT city
 * imagery, ORT_skrydziai flight boundaries, Web Mercator duplicates) are
 * intentionally excluded from the year picker. ORT_recent is handled
 * separately as the continuous mixed-vintage option.
 */
const ORTHOPHOTO_SERIES_PATTERN = /^nzt_ort10lt_\d{4}(?:_\d{4})?$/;

/** Sector-scale zoom used for coverage probes (~677 m tiles). */
const PROBE_LEVEL = 8;

/**
 * Upper bound on tiles probed per service. A 1 km sector intersects at most
 * nine L8 tiles; the cap only guards against degenerate bounds.
 */
const MAX_PROBE_TILES = 16;

/** Discovery entries are validated one by one; unrelated or malformed results are skipped. */
const DiscoverySchema = z.object({
    status: z.string(),
    searchServices: z.array(z.unknown()).optional(),
});

const DiscoveryServiceSchema = z.object({
    key: z.string(),
    url: z.string().url(),
    serviceType: z.string(),
});

const ALLOWED_ORTHOPHOTO_KEY_PATTERN = /^nzt_ort10lt_(?:recent|\d{4}(?:_\d{4})?)$/;

let datedCache: OrthophotoDatedService[] | null = null;
let datedPromise: Promise<OrthophotoDatedService[]> | null = null;
let recentPromise: Promise<OrthophotoRecentService | null> | null = null;
let discoveryPromise: Promise<GeoportalOrthophotoEndpoint[]> | null = null;

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

function parseDiscoveredEndpoint(value: unknown): GeoportalOrthophotoEndpoint | null {
    const parsed = DiscoveryServiceSchema.safeParse(value);
    if (!parsed.success) return null;
    const { key, serviceType } = parsed.data;
    if (!ALLOWED_ORTHOPHOTO_KEY_PATTERN.test(key) || !/arcgis rest/i.test(serviceType)) return null;

    const url = new URL(parsed.data.url);
    const expectedPath = new RegExp(`^/mapproxy/(?:rest/services/)?${key}/MapServer/?$`, 'i');
    if (
        url.protocol !== 'https:' ||
        url.hostname !== 'www.geoportal.lt' ||
        url.search !== '' ||
        !expectedPath.test(url.pathname)
    ) {
        return null;
    }
    return { key, url: url.href.replace(/\/$/, '') };
}

async function discoverOrthophotoEndpoints(): Promise<GeoportalOrthophotoEndpoint[]> {
    if (!discoveryPromise) {
        discoveryPromise = (async () => {
            try {
                const response = await fetch(GEOPORTAL_ORTHOPHOTO_DISCOVERY_URL, {
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) {
                    throw new Error(`Orthophoto discovery failed with HTTP ${response.status}`);
                }
                const discovery = DiscoverySchema.parse(await response.json());
                if (discovery.status !== 'success') throw new Error('Geoportal discovery failed');

                const endpoints = (discovery.searchServices ?? [])
                    .map(parseDiscoveredEndpoint)
                    .filter((item): item is GeoportalOrthophotoEndpoint => item !== null);
                const unique = [...new Map(endpoints.map((item) => [item.key, item])).values()];
                return unique.length > 0 ? unique : [...GEOPORTAL_ORTHOPHOTO_FALLBACK_ENDPOINTS];
            } catch {
                return [...GEOPORTAL_ORTHOPHOTO_FALLBACK_ENDPOINTS];
            }
        })();
    }
    return discoveryPromise;
}

async function describeService(
    endpoint: GeoportalOrthophotoEndpoint
): Promise<OrthophotoDatedService | null> {
    try {
        const metadata = await fetchOrthophotoMetadata(endpoint.url);
        const range = parseYearRange(metadata.mapName, endpoint.key);
        if (!range) return null;
        return {
            kind: 'dated',
            id: range.rangeLabel,
            serviceName: endpoint.key,
            baseUrl: endpoint.url,
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

async function describeRecentService(): Promise<OrthophotoRecentService | null> {
    try {
        const endpoints = await discoverOrthophotoEndpoints();
        const endpoint = endpoints.find((item) => item.key === ORTHOPHOTO_RECENT_SERVICE_NAME);
        if (!endpoint) return null;
        const metadata = await fetchOrthophotoMetadata(endpoint.url);
        return {
            kind: 'recent',
            id: ORTHOPHOTO_RECENT_ID,
            serviceName: ORTHOPHOTO_RECENT_SERVICE_NAME,
            baseUrl: endpoint.url,
            metadata,
        };
    } catch {
        return null;
    }
}

/**
 * ORT_recent metadata only: never probed, never year-parsed, and shared
 * session-wide independent of caller cancellation. A failed fetch resolves
 * to null so dated services still work.
 */
export function fetchRecentOrthophotoService(): Promise<OrthophotoRecentService | null> {
    if (!recentPromise) {
        recentPromise = describeRecentService();
    }
    return recentPromise;
}

/**
 * Every ORT10LT year service, newest first. Session-cached and independent
 * of caller cancellation; only per-sector probes are caller-cancellable.
 */
async function fetchDatedCatalog(): Promise<OrthophotoDatedService[]> {
    if (datedCache) return datedCache;
    if (!datedPromise) {
        datedPromise = (async () => {
            const endpoints = (await discoverOrthophotoEndpoints()).filter((item) =>
                ORTHOPHOTO_SERIES_PATTERN.test(item.key)
            );
            const described = await Promise.all(
                endpoints.map((endpoint) => describeService(endpoint))
            );
            const dated = described
                .filter((service): service is OrthophotoDatedService => service !== null)
                .sort((first, second) => {
                    if (second.endYear !== first.endYear) return second.endYear - first.endYear;
                    return second.startYear - first.startYear;
                });
            if (dated.length === 0) {
                throw new Error('No orthophoto year services are available');
            }
            datedCache = dated;
            return dated;
        })();
        datedPromise.catch(() => {
            datedPromise = null;
        });
    }
    return datedPromise;
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

/** Sector-scale tiles intersecting the sector bounds, center-out, capped. */
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
 * Missing coverage answers 404. Only definitive answers are cached: hits and 404 responses;
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
 * Dated vintages covering the sector, newest first. ORT_recent is resolved
 * separately via fetchRecentOrthophotoService so it can render without
 * waiting for dated discovery and probes. Empty bounds yield no services;
 * the caller substitutes point-cloud bounds first.
 */
export async function fetchAvailableDatedOrthophotoServices(
    coverageBounds: readonly Lks94Bounds[],
    signal: AbortSignal
): Promise<OrthophotoDatedService[]> {
    const dated = await fetchDatedCatalog();
    const sectorBounds = getUnionBounds(coverageBounds);
    if (!sectorBounds) return [];
    const candidates = dated.filter((service) =>
        boundsIntersect(sectorBounds, service.metadata.fullExtent)
    );

    const results = await Promise.all(
        candidates.map(async (service) => {
            signal.throwIfAborted();
            const available = await isOrthophotoServiceAvailable(service, sectorBounds, signal);
            return available ? service : null;
        })
    );
    return results.filter((service): service is OrthophotoDatedService => service !== null);
}

/** Explicit selection when available, else the first service: recent when present, newest dated otherwise. */
export function findOrthophotoService(
    services: readonly OrthophotoServiceInfo[],
    id: string | undefined
): OrthophotoServiceInfo | null {
    if (services.length === 0) return null;
    return services.find((service) => service.id === id) ?? services[0];
}
