type MapLabelCategory =
    | 'city'
    | 'town'
    | 'village'
    | 'hamlet'
    | 'dwelling'
    | 'island'
    | 'relief'
    | 'water'
    | 'river'
    | 'stream'
    | 'canal'
    | 'protected'
    | 'human-made'
    | 'archaeological'
    | 'heritage';

export interface MapLabelCandidate {
    id: string;
    category: MapLabelCategory;
    names: MapLabelNames;
    position: [number, number];
    priority: number;
    geometryWeight: number;
}

interface MapLabelNames {
    default: string;
    lt?: string;
    en?: string;
    latin?: string;
}

export interface Lks94Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

interface GeoportalLabelRecord {
    objectId: string;
    name: string;
    nameStatus: string;
    localType: string;
    subtype: string;
    longitude: number;
    latitude: number;
}

const GEOPORTAL_SEARCH_URL = 'https://www.geoportal.lt/mapproxy/elasticsearch_gvdr';
const GEOPORTAL_MAX_RESULTS = 1000;
const LKS94_PROJ =
    '+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9998 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
const MAP_LABEL_BASE_PRIORITY: Record<MapLabelCategory, number> = {
    city: 500,
    town: 400,
    village: 300,
    relief: 280,
    hamlet: 260,
    island: 250,
    dwelling: 220,
    water: 200,
    river: 180,
    protected: 160,
    stream: 140,
    canal: 130,
    'human-made': 120,
    archaeological: 270,
    heritage: 110,
};
const GEOPORTAL_ARCHAEOLOGICAL_NAME_PATTERN =
    /(?:piliakaln|pilkap|kapinyn|senovės gyvenviet|alkakaln|dvarviet|senkap|mūšio viet)/iu;
const GEOPORTAL_ARCHAEOLOGICAL_QUERY =
    'piliakaln* OR pilkap* OR kapinyn* OR "senovės gyvenvietė" OR alkakaln* OR dvarviet* OR senkap* OR "mūšio vieta"';

const GEOPORTAL_SUBTYPES = {
    settlements: ['miestas', 'miestelis', 'kaimas', 'viensėdis', 'dvaras'],
    hydrography: [
        'upė',
        'upelis',
        'ežeras',
        'tvenkinys',
        'šaltinis',
        'versmė',
        'sala',
        'kanalas',
        'kūdra',
        'įlanka',
        'krioklys',
    ],
    relief: [
        'kalnas',
        'kalva',
        'aukštuma',
        'pakiluma',
        'kauburys',
        'skardis',
        'slėnis',
        'šlaitas',
        'griovys',
        'dauba',
        'duburys',
        'įduba',
        'loma',
        'žemuma',
        'klonis',
    ],
    context: ['kapinės', 'parkas'],
    burialLandscape: ['kapinės', 'kapai', 'kapinynas', 'senkapis', 'senkapiai', 'piliakalnis'],
    structures: ['malūnas', 'užtvanka', 'bažnyčia', 'sodyba'],
} as const;

function ensureLks94Projection() {
    if (!window.proj4.defs('EPSG:3346')) {
        window.proj4.defs('EPSG:3346', LKS94_PROJ);
    }
}

function deduplicateCandidates(candidates: MapLabelCandidate[]) {
    const unique = new Map<string, MapLabelCandidate>();
    for (const candidate of candidates) {
        const identityName = candidate.names.lt ?? candidate.names.default;
        const key = `${candidate.category}:${identityName.trim().toLocaleLowerCase('lt')}`;
        const existing = unique.get(key);
        if (!existing || candidate.geometryWeight > existing.geometryWeight) {
            unique.set(key, candidate);
        }
    }
    return [...unique.values()];
}

function isCandidateInsideBounds(candidate: MapLabelCandidate, bounds: Lks94Bounds) {
    const [x, y] = candidate.position;
    return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

function createGeoportalCategoryClause(localType: string, subtypes: readonly string[]) {
    return {
        bool: {
            filter: [{ term: { localtype: localType } }, { terms: { subtype: subtypes } }],
        },
    };
}

function getGeoportalSearchBounds(coverageBounds: readonly Lks94Bounds[]) {
    ensureLks94Projection();
    const corners = coverageBounds.flatMap((bounds) => [
        [bounds.minX, bounds.minY],
        [bounds.minX, bounds.maxY],
        [bounds.maxX, bounds.minY],
        [bounds.maxX, bounds.maxY],
    ]);
    const projected = corners.map((coordinate) =>
        window.proj4('EPSG:3346', 'EPSG:4326', coordinate)
    );
    const longitudes = projected.map((coordinate) => coordinate[0]);
    const latitudes = projected.map((coordinate) => coordinate[1]);

    return {
        minLongitude: Math.min(...longitudes),
        maxLongitude: Math.max(...longitudes),
        minLatitude: Math.min(...latitudes),
        maxLatitude: Math.max(...latitudes),
    };
}

function createGeoportalQuery(coverageBounds: readonly Lks94Bounds[]) {
    const bounds = getGeoportalSearchBounds(coverageBounds);
    return {
        size: GEOPORTAL_MAX_RESULTS,
        _source: [
            'objectid',
            'name',
            'namestatus',
            'localtype',
            'subtype',
            'LOCATIONX',
            'LOCATIONY',
        ],
        query: {
            bool: {
                filter: [
                    {
                        range: {
                            LOCATIONX: {
                                gte: bounds.minLongitude,
                                lte: bounds.maxLongitude,
                            },
                        },
                    },
                    {
                        range: {
                            LOCATIONY: {
                                gte: bounds.minLatitude,
                                lte: bounds.maxLatitude,
                            },
                        },
                    },
                ],
                should: [
                    createGeoportalCategoryClause('Gyvenvietės', GEOPORTAL_SUBTYPES.settlements),
                    createGeoportalCategoryClause('Hidrografija', GEOPORTAL_SUBTYPES.hydrography),
                    createGeoportalCategoryClause('Reljefas', GEOPORTAL_SUBTYPES.relief),
                    createGeoportalCategoryClause('Kita', GEOPORTAL_SUBTYPES.context),
                    createGeoportalCategoryClause(
                        'Žemės danga',
                        GEOPORTAL_SUBTYPES.burialLandscape
                    ),
                    createGeoportalCategoryClause('Statinys', GEOPORTAL_SUBTYPES.structures),
                    {
                        bool: {
                            filter: [{ term: { localtype: 'Saugomos vietovės' } }],
                            must_not: [{ term: { subtype: 'kultūros vertybė' } }],
                        },
                    },
                    {
                        bool: {
                            filter: [
                                { term: { localtype: 'Saugomos vietovės' } },
                                { term: { subtype: 'kultūros vertybė' } },
                            ],
                            must: [
                                {
                                    query_string: {
                                        default_field: 'name',
                                        query: GEOPORTAL_ARCHAEOLOGICAL_QUERY,
                                    },
                                },
                            ],
                        },
                    },
                ],
                minimum_should_match: 1,
            },
        },
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readGeoportalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readGeoportalCoordinate(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseGeoportalRecord(value: unknown): GeoportalLabelRecord | null {
    if (!isRecord(value) || !isRecord(value._source)) return null;
    const source = value._source;
    const objectIdValue = source.objectid;
    const objectId =
        typeof objectIdValue === 'string' || typeof objectIdValue === 'number'
            ? String(objectIdValue)
            : null;
    const name = readGeoportalString(source.name);
    const nameStatus = readGeoportalString(source.namestatus);
    const localType = readGeoportalString(source.localtype);
    const subtype = readGeoportalString(source.subtype);
    const longitude = readGeoportalCoordinate(source.LOCATIONX);
    const latitude = readGeoportalCoordinate(source.LOCATIONY);
    if (
        !objectId ||
        !name ||
        !nameStatus ||
        !localType ||
        !subtype ||
        longitude === null ||
        latitude === null
    ) {
        return null;
    }

    return { objectId, name, nameStatus, localType, subtype, longitude, latitude };
}

function parseGeoportalResponse(value: unknown) {
    if (!isRecord(value)) throw new Error('Geoportal returned an invalid response');
    if (isRecord(value.error)) {
        const message = readGeoportalString(value.error.reason) ?? 'Geoportal search failed';
        throw new Error(message);
    }
    if (!isRecord(value.hits) || !Array.isArray(value.hits.hits)) {
        throw new Error('Geoportal response has no search results');
    }
    return value.hits.hits
        .map(parseGeoportalRecord)
        .filter((record): record is GeoportalLabelRecord => record !== null);
}

function includesSubtype(subtypes: readonly string[], value: string) {
    return subtypes.includes(value);
}

function getGeoportalCategory(record: GeoportalLabelRecord): MapLabelCategory | null {
    const localType = record.localType.toLocaleLowerCase('lt');
    const subtype = record.subtype.toLocaleLowerCase('lt');

    if (localType === 'gyvenvietės') {
        if (subtype === 'miestas') return 'city';
        if (subtype === 'miestelis') return 'town';
        if (subtype === 'kaimas') return 'village';
        if (subtype === 'viensėdis') return 'dwelling';
        if (subtype === 'dvaras') return 'heritage';
        return null;
    }
    if (localType === 'hidrografija') {
        if (!includesSubtype(GEOPORTAL_SUBTYPES.hydrography, subtype)) return null;
        if (subtype === 'upė') return 'river';
        if (['upelis', 'šaltinis', 'versmė', 'krioklys'].includes(subtype)) return 'stream';
        if (subtype === 'kanalas') return 'canal';
        if (subtype === 'sala') return 'island';
        return 'water';
    }
    if (localType === 'reljefas') {
        return includesSubtype(GEOPORTAL_SUBTYPES.relief, subtype) ? 'relief' : null;
    }
    if (localType === 'kita') {
        if (!includesSubtype(GEOPORTAL_SUBTYPES.context, subtype)) return null;
        return subtype === 'parkas' ? 'protected' : 'human-made';
    }
    if (localType === 'žemės danga') {
        if (!includesSubtype(GEOPORTAL_SUBTYPES.burialLandscape, subtype)) return null;
        return subtype === 'kapinės' ? 'human-made' : 'archaeological';
    }
    if (localType === 'statinys') {
        if (!includesSubtype(GEOPORTAL_SUBTYPES.structures, subtype)) return null;
        return subtype === 'užtvanka' ? 'human-made' : 'heritage';
    }
    if (localType === 'saugomos vietovės') {
        if (subtype !== 'kultūros vertybė') return 'protected';
        return GEOPORTAL_ARCHAEOLOGICAL_NAME_PATTERN.test(record.name) ? 'archaeological' : null;
    }
    return null;
}

function getGeoportalPriority(category: MapLabelCategory, nameStatus: string) {
    const normalizedStatus = nameStatus.toLocaleLowerCase('lt');
    const statusAdjustment =
        normalizedStatus === 'oficialus' ? 20 : normalizedStatus === 'istorinis' ? -10 : 0;
    return MAP_LABEL_BASE_PRIORITY[category] + statusAdjustment;
}

async function fetchGeoportalMapLabels(
    coverageBounds: readonly Lks94Bounds[],
    signal: AbortSignal
) {
    const response = await fetch(GEOPORTAL_SEARCH_URL, {
        method: 'POST',
        // Geoportal accepts JSON bodies as text/plain. Keeping this a CORS-simple
        // request avoids its incomplete OPTIONS response for custom headers.
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(createGeoportalQuery(coverageBounds)),
        signal,
    });
    if (!response.ok) throw new Error(`Geoportal search returned HTTP ${response.status}`);
    const payload: unknown = await response.json();
    const records = parseGeoportalResponse(payload);
    ensureLks94Projection();

    return deduplicateCandidates(
        records.flatMap((record): MapLabelCandidate[] => {
            const category = getGeoportalCategory(record);
            if (!category) return [];
            const [x, y] = window.proj4('EPSG:4326', 'EPSG:3346', [
                record.longitude,
                record.latitude,
            ]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
            return [
                {
                    id: `gvdr:${record.objectId}`,
                    category,
                    names: { default: record.name, lt: record.name },
                    position: [x, y],
                    priority: getGeoportalPriority(category, record.nameStatus),
                    geometryWeight: 0,
                },
            ];
        })
    ).filter((candidate) =>
        coverageBounds.some((bounds) => isCandidateInsideBounds(candidate, bounds))
    );
}

export function fetchMapLabels(coverageBounds: readonly Lks94Bounds[], signal: AbortSignal) {
    if (coverageBounds.length === 0) return Promise.resolve([]);
    return fetchGeoportalMapLabels(coverageBounds, signal);
}
