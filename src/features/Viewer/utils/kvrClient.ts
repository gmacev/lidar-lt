export type KvrMatchType =
    | 'object-territory'
    | 'physical-protection-zone'
    | 'visual-protection-zone'
    | 'nearby-object';

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
    objectName: string;
    status: string;
    address: string;
    area?: number;
    shapeType?: string;
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

interface ArcGisQueryResponse {
    features?: ArcGisFeature[];
    error?: {
        message?: string;
    };
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
    layerUrl: string;
    matchType: KvrMatchType;
    outFields: string;
    geometry: string;
    geometryType: 'esriGeometryPoint' | 'esriGeometryEnvelope';
}

interface RejectedKvrQuery {
    status: 'rejected';
    reason: unknown;
}

const KVR_DETAIL_URL = 'https://kvr.kpd.lt/#/static-heritage-detail/';
const KVR_OBJECTS_URL = 'https://kvr.kpd.lt/arcgis/rest/services/KVR/pub_kvr_objektai/MapServer';
const KVR_PROTECTION_URL =
    'https://kvr.kpd.lt/arcgis/rest/services/KVR/pub_kvr_apsaugos_zonos/MapServer';
const NEARBY_ENVELOPE_HALF_SIZE_METERS = 100;

const OBJECT_OUT_FIELDS = 'ObjectId,Code,Name,NameOfficial,ObjectName,Status,Address';
const ZONE_OUT_FIELDS = `${OBJECT_OUT_FIELDS},ShapeType,Area`;

function buildKvrDetailUrl(objectId: string) {
    return `${KVR_DETAIL_URL}${encodeURIComponent(objectId)}`;
}

function buildArcGisQueryUrl({
    layerUrl,
    geometry,
    geometryType,
    outFields,
}: {
    layerUrl: string;
    geometry: string;
    geometryType: 'esriGeometryPoint' | 'esriGeometryEnvelope';
    outFields: string;
}) {
    const params = new URLSearchParams({
        f: 'json',
        where: '1=1',
        outFields,
        returnGeometry: 'true',
        outSR: '3346',
        geometry,
        geometryType,
        inSR: '3346',
        spatialRel: 'esriSpatialRelIntersects',
    });

    return `${layerUrl}/query?${params.toString()}`;
}

function getString(attributes: Record<string, unknown>, key: string) {
    const value = attributes[key];
    return typeof value === 'string' ? value.trim() : '';
}

function getNumber(attributes: Record<string, unknown>, key: string) {
    const value = attributes[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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

function normalizeFeature(feature: ArcGisFeature, matchType: KvrMatchType): KvrMatch | null {
    const attributes = feature.attributes;
    if (!attributes) return null;

    const objectId = getString(attributes, 'ObjectId');
    if (!objectId) return null;

    return {
        objectId,
        code: getString(attributes, 'Code'),
        name: getString(attributes, 'NameOfficial') || getString(attributes, 'Name'),
        objectName: getString(attributes, 'ObjectName'),
        status: getString(attributes, 'Status'),
        address: getString(attributes, 'Address'),
        area: getNumber(attributes, 'Area'),
        shapeType: getString(attributes, 'ShapeType') || undefined,
        matchType,
        detailUrl: buildKvrDetailUrl(objectId),
        center: getGeometryCenter(feature.geometry),
    };
}

async function queryLayer(query: KvrLayerQuery, signal: AbortSignal): Promise<KvrMatch[]> {
    const url = buildArcGisQueryUrl(query);
    const response = await fetch(url, { signal });

    if (!response.ok) {
        throw new Error(`KVR request failed with HTTP ${response.status}.`);
    }

    const data = (await response.json()) as ArcGisQueryResponse;

    if (data.error) {
        throw new Error(data.error.message || 'KVR request failed.');
    }

    return (data.features ?? [])
        .map((feature) => normalizeFeature(feature, query.matchType))
        .filter((match): match is KvrMatch => match !== null);
}

function createQueries(coordinate: KvrCoordinate): KvrLayerQuery[] {
    const pointGeometry = `${coordinate.x},${coordinate.y}`;
    const minX = coordinate.x - NEARBY_ENVELOPE_HALF_SIZE_METERS;
    const minY = coordinate.y - NEARBY_ENVELOPE_HALF_SIZE_METERS;
    const maxX = coordinate.x + NEARBY_ENVELOPE_HALF_SIZE_METERS;
    const maxY = coordinate.y + NEARBY_ENVELOPE_HALF_SIZE_METERS;

    return [
        {
            layerUrl: `${KVR_OBJECTS_URL}/1`,
            matchType: 'object-territory',
            outFields: OBJECT_OUT_FIELDS,
            geometry: pointGeometry,
            geometryType: 'esriGeometryPoint',
        },
        {
            layerUrl: `${KVR_PROTECTION_URL}/0`,
            matchType: 'physical-protection-zone',
            outFields: ZONE_OUT_FIELDS,
            geometry: pointGeometry,
            geometryType: 'esriGeometryPoint',
        },
        {
            layerUrl: `${KVR_PROTECTION_URL}/1`,
            matchType: 'visual-protection-zone',
            outFields: ZONE_OUT_FIELDS,
            geometry: pointGeometry,
            geometryType: 'esriGeometryPoint',
        },
        {
            layerUrl: `${KVR_OBJECTS_URL}/0`,
            matchType: 'nearby-object',
            outFields: OBJECT_OUT_FIELDS,
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
