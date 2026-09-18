export type KvrMatchType =
    'object-territory' | 'physical-protection-zone' | 'visual-protection-zone' | 'nearby-object';

export const KVR_MATCH_ORDER: KvrMatchType[] = [
    'object-territory',
    'physical-protection-zone',
    'visual-protection-zone',
    'nearby-object',
];

export interface KvrCoordinate {
    x: number;
    y: number;
}

export interface KvrMatch {
    objectId: string;
    code: string;
    name: string;
    status: string;
    matchType: KvrMatchType;
    detailUrl: string;
    center?: KvrCoordinate;
}

export function getKvrMatchKey(match: Pick<KvrMatch, 'matchType' | 'objectId'>) {
    return `${match.objectId}:${match.matchType}`;
}

interface ArcGisFeature {
    attributes?: Record<string, unknown>;
    geometry?: ArcGisGeometry;
}

interface ArcGisFeatureResponse {
    feature?: ArcGisFeature;
    error?: ArcGisError;
}

interface ArcGisIdQueryResponse {
    objectIds?: number[] | null;
    error?: ArcGisError;
}

interface ArcGisError {
    message?: string;
}

interface ArcGisPointGeometry {
    x?: number;
    y?: number;
}

interface ArcGisPolygonGeometry {
    rings?: number[][][];
}

type ArcGisGeometry = ArcGisPointGeometry | ArcGisPolygonGeometry;

interface KvrLayerQuery {
    layerId: 0 | 1 | 2;
    matchType?: KvrMatchType;
    geometry: string;
    geometryType: 'esriGeometryPoint' | 'esriGeometryEnvelope';
}

interface RejectedKvrQuery {
    status: 'rejected';
    reason: unknown;
}

const GEOPORTAL_KVR_URL = 'https://www.geoportal.lt/mapproxy/rest/services/kpd_kvr/MapServer';
const KVR_DETAIL_URL = 'https://kvr.kpd.lt/heritage/Pages/KVRDetail.aspx?lang=lt&MC=';
const NEARBY_ENVELOPE_HALF_SIZE_METERS = 100;
const PHYSICAL_PROTECTION_ZONE = 'Apsaugos nuo fizinio poveikio pozonis';
const VISUAL_PROTECTION_ZONE = 'Vizualinės apsaugos pozonis';

function buildFallbackDetailUrl(code: string) {
    return `${KVR_DETAIL_URL}${encodeURIComponent(code)}`;
}

function normalizeDetailUrl(value: string, code: string) {
    if (!value) return buildFallbackDetailUrl(code);

    try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return buildFallbackDetailUrl(code);
        }
        url.protocol = 'https:';
        return url.toString();
    } catch {
        return buildFallbackDetailUrl(code);
    }
}

function buildArcGisIdQueryUrl({ layerId, geometry, geometryType }: KvrLayerQuery) {
    const params = new URLSearchParams({
        f: 'json',
        where: '1=1',
        returnIdsOnly: 'true',
        geometry,
        geometryType,
        inSR: '3346',
        spatialRel: 'esriSpatialRelIntersects',
    });

    return `${GEOPORTAL_KVR_URL}/${layerId}/query?${params.toString()}`;
}

function getString(attributes: Record<string, unknown>, key: string) {
    const value = attributes[key];
    return typeof value === 'string' ? value.trim() : '';
}

function getGeometryCenter(geometry?: ArcGisGeometry): KvrCoordinate | undefined {
    if (!geometry) return undefined;

    if ('x' in geometry && 'y' in geometry) {
        const { x, y } = geometry;
        if (typeof x === 'number' && typeof y === 'number') {
            return { x, y };
        }
    }

    if (!('rings' in geometry) || !Array.isArray(geometry.rings)) return undefined;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    geometry.rings.forEach((ring) => {
        ring.forEach((point) => {
            const [x, y] = point;
            if (typeof x !== 'number' || typeof y !== 'number') return;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });
    });

    if (![minX, minY, maxX, maxY].every(Number.isFinite)) return undefined;

    return {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
    };
}

function getZoneMatchType(attributes: Record<string, unknown>): KvrMatchType | null {
    const zoneType = getString(attributes, 'Pozonis');
    if (zoneType === PHYSICAL_PROTECTION_ZONE) return 'physical-protection-zone';
    if (zoneType === VISUAL_PROTECTION_ZONE) return 'visual-protection-zone';
    return null;
}

function normalizeFeature(feature: ArcGisFeature, query: KvrLayerQuery): KvrMatch | null {
    const attributes = feature.attributes;
    if (!attributes) return null;

    const code = getString(attributes, 'Unikalus_kodas');
    const matchType = query.matchType ?? getZoneMatchType(attributes);
    if (!code || !matchType) return null;

    return {
        objectId: code,
        code,
        name: getString(attributes, 'Pavadinimas'),
        status: getString(attributes, 'Statusas'),
        matchType,
        detailUrl: normalizeDetailUrl(getString(attributes, 'URL'), code),
        center: getGeometryCenter(feature.geometry),
    };
}

async function fetchFeature(
    query: KvrLayerQuery,
    objectId: number,
    signal: AbortSignal
): Promise<KvrMatch | null> {
    const response = await fetch(`${GEOPORTAL_KVR_URL}/${query.layerId}/${objectId}?f=json`, {
        signal,
    });

    if (!response.ok) {
        throw new Error(`KVR feature request failed with HTTP ${response.status}.`);
    }

    const data = (await response.json()) as ArcGisFeatureResponse;
    if (data.error) {
        throw new Error(data.error.message || 'KVR feature request failed.');
    }

    return data.feature ? normalizeFeature(data.feature, query) : null;
}

async function queryLayer(query: KvrLayerQuery, signal: AbortSignal): Promise<KvrMatch[]> {
    const response = await fetch(buildArcGisIdQueryUrl(query), { signal });

    if (!response.ok) {
        throw new Error(`KVR request failed with HTTP ${response.status}.`);
    }

    const data = (await response.json()) as ArcGisIdQueryResponse;
    if (data.error) {
        throw new Error(data.error.message || 'KVR request failed.');
    }

    const objectIds = (data.objectIds ?? []).filter(
        (objectId) => typeof objectId === 'number' && Number.isFinite(objectId)
    );
    const results = await Promise.allSettled(
        objectIds.map((objectId) => fetchFeature(query, objectId, signal))
    );
    const rejectedResults = results.filter(
        (result): result is RejectedKvrQuery => result.status === 'rejected'
    );

    if (signal.aborted) {
        const abortReason = rejectedResults.find((result) => isAbortError(result.reason))?.reason;
        throw abortReason instanceof Error
            ? abortReason
            : new DOMException('Aborted', 'AbortError');
    }

    if (results.length > 0 && rejectedResults.length === results.length) {
        const [firstFailure] = rejectedResults;
        throw firstFailure.reason instanceof Error
            ? firstFailure.reason
            : new Error('KVR feature lookup failed.');
    }

    return results.flatMap((result) =>
        result.status === 'fulfilled' && result.value ? [result.value] : []
    );
}

function createQueries(coordinate: KvrCoordinate): KvrLayerQuery[] {
    const pointGeometry = `${coordinate.x},${coordinate.y}`;
    const minX = coordinate.x - NEARBY_ENVELOPE_HALF_SIZE_METERS;
    const minY = coordinate.y - NEARBY_ENVELOPE_HALF_SIZE_METERS;
    const maxX = coordinate.x + NEARBY_ENVELOPE_HALF_SIZE_METERS;
    const maxY = coordinate.y + NEARBY_ENVELOPE_HALF_SIZE_METERS;

    return [
        {
            layerId: 1,
            matchType: 'object-territory',
            geometry: pointGeometry,
            geometryType: 'esriGeometryPoint',
        },
        {
            layerId: 2,
            geometry: pointGeometry,
            geometryType: 'esriGeometryPoint',
        },
        {
            layerId: 0,
            matchType: 'nearby-object',
            geometry: `${minX},${minY},${maxX},${maxY}`,
            geometryType: 'esriGeometryEnvelope',
        },
    ];
}

function dedupeMatches(matches: KvrMatch[]) {
    const seen = new Set<string>();
    return matches.filter((match) => {
        const key = getKvrMatchKey(match);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function isAbortError(error: unknown) {
    return error instanceof Error && error.name === 'AbortError';
}

export async function queryKvrAtCoordinate(
    coordinate: KvrCoordinate,
    signal: AbortSignal
): Promise<KvrMatch[]> {
    const results = await Promise.allSettled(
        createQueries(coordinate).map((query) => queryLayer(query, signal))
    );
    const rejectedResults = results.filter(
        (result): result is RejectedKvrQuery => result.status === 'rejected'
    );

    if (signal.aborted) {
        const abortReason = rejectedResults.find((result) => isAbortError(result.reason))?.reason;
        throw abortReason instanceof Error
            ? abortReason
            : new DOMException('Aborted', 'AbortError');
    }

    const matches = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : []
    );

    if (rejectedResults.length === results.length) {
        const [firstFailure] = rejectedResults;
        throw firstFailure.reason instanceof Error
            ? firstFailure.reason
            : new Error('KVR lookup failed.');
    }

    return dedupeMatches(matches);
}
