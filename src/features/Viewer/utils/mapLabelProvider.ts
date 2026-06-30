import { VectorTile } from '@mapbox/vector-tile';
import type { Geometry, Position } from 'geojson';
import Pbf from 'pbf';

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

interface TileJson {
    tiles?: string[];
    minzoom?: number;
    maxzoom?: number;
}

interface TileCoordinate {
    x: number;
    y: number;
    z: number;
}

const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';
const LKS94_PROJ =
    '+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9998 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
// A 5 x 5 km sector can straddle a 5 x 5 tile grid at zoom 14. Dropping to
// zoom 13 loses lower-rank POIs such as named archaeological sites.
const MAX_TILE_REQUESTS = 25;
const MAX_SOURCE_ZOOM = 14;
const MIN_SOURCE_ZOOM = 3;
const WEB_MERCATOR_MAX_LATITUDE = 85.05112878;
const RELIEF_CLASSES = new Set(['peak', 'saddle', 'ridge', 'cliff', 'arete']);
const HUMAN_MADE_POI_CLASSES = new Set([
    'quarry',
    'mine',
    'mineshaft',
    'dam',
    'weir',
    'dyke',
    'embankment',
    'cemetery',
]);
const HERITAGE_POI_CLASSES = new Set(['castle', 'fort', 'fortress', 'ruins']);
const HILL_FORT_NAME_PATTERN = /(?:piliakaln|hill[\s-]?fort)/i;

let tileJsonCache: TileJson | null = null;
const tileCache = new Map<string, MapLabelCandidate[]>();

function ensureLks94Projection() {
    if (!window.proj4.defs('EPSG:3346')) {
        window.proj4.defs('EPSG:3346', LKS94_PROJ);
    }
}

function readString(properties: Record<string, string | number | boolean>, key: string) {
    const value = properties[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getNames(properties: Record<string, string | number | boolean>) {
    const defaultName = readString(properties, 'name');
    if (!defaultName) return null;

    return {
        default: defaultName,
        lt: readString(properties, 'name:lt'),
        en: readString(properties, 'name_en') ?? readString(properties, 'name:en'),
        latin: readString(properties, 'name:latin'),
    };
}

function isHillFortAttraction(featureClasses: string[], names: MapLabelNames): boolean {
    if (!featureClasses.includes('attraction')) return false;

    // OpenMapTiles can prioritize tourism=attraction and omit the original
    // historic/fortification tags, as it does for Apuolės piliakalnis.
    return [names.default, names.lt, names.en, names.latin].some(
        (name) => name !== undefined && HILL_FORT_NAME_PATTERN.test(name)
    );
}

function getCategory(
    layerName: string,
    properties: Record<string, string | number | boolean>,
    names: MapLabelNames
): MapLabelCategory | null {
    if (layerName === 'place') {
        const placeClass = properties.class;
        if (placeClass === 'city' || placeClass === 'town' || placeClass === 'village') {
            return placeClass;
        }
        if (placeClass === 'hamlet') return 'hamlet';
        if (placeClass === 'isolated_dwelling') return 'dwelling';
        if (placeClass === 'island') return 'island';
        return null;
    }

    if (layerName === 'water_name') return 'water';
    if (layerName === 'waterway') {
        if (properties.class === 'river') return 'river';
        if (properties.class === 'stream') return 'stream';
        if (properties.class === 'canal') return 'canal';
        return null;
    }
    if (layerName === 'mountain_peak' && RELIEF_CLASSES.has(String(properties.class))) {
        return 'relief';
    }
    if (layerName === 'park') return 'protected';
    if (layerName === 'poi') {
        const featureClasses = [properties.class, properties.subclass].map(String);
        if (featureClasses.some((featureClass) => HUMAN_MADE_POI_CLASSES.has(featureClass))) {
            return 'human-made';
        }
        if (featureClasses.includes('archaeological_site')) return 'archaeological';
        if (featureClasses.some((featureClass) => HERITAGE_POI_CLASSES.has(featureClass))) {
            return 'heritage';
        }
        if (isHillFortAttraction(featureClasses, names)) return 'archaeological';
    }
    return null;
}

function isPosition(value: unknown): value is Position {
    return (
        Array.isArray(value) &&
        value.length >= 2 &&
        typeof value[0] === 'number' &&
        typeof value[1] === 'number'
    );
}

function lineLength(line: Position[]) {
    let length = 0;
    for (let index = 1; index < line.length; index += 1) {
        const previous = line[index - 1];
        const current = line[index];
        if (!previous || !current) continue;
        length += Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    }
    return length;
}

function lineMidpoint(line: Position[]): { position: Position; weight: number } | null {
    if (line.length === 0) return null;
    if (line.length === 1 && line[0]) return { position: line[0], weight: 0 };

    const length = lineLength(line);
    const target = length / 2;
    let traversed = 0;

    for (let index = 1; index < line.length; index += 1) {
        const start = line[index - 1];
        const end = line[index];
        if (!start || !end) continue;
        const segmentLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
        if (traversed + segmentLength >= target) {
            const ratio = segmentLength === 0 ? 0 : (target - traversed) / segmentLength;
            return {
                position: [
                    start[0] + (end[0] - start[0]) * ratio,
                    start[1] + (end[1] - start[1]) * ratio,
                ],
                weight: length,
            };
        }
        traversed += segmentLength;
    }

    const last = line.at(-1);
    return last ? { position: last, weight: length } : null;
}

function getGeometryAnchor(geometry: Geometry): { position: Position; weight: number } | null {
    if (geometry.type === 'Point') return { position: geometry.coordinates, weight: 0 };
    if (geometry.type === 'MultiPoint') {
        const point = geometry.coordinates[0];
        return point ? { position: point, weight: 0 } : null;
    }
    if (geometry.type === 'LineString') return lineMidpoint(geometry.coordinates);
    if (geometry.type === 'MultiLineString') {
        return (
            geometry.coordinates
                .map(lineMidpoint)
                .filter((item): item is NonNullable<typeof item> => Boolean(item))
                .sort((first, second) => second.weight - first.weight)[0] ?? null
        );
    }
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        const positions =
            geometry.type === 'Polygon'
                ? geometry.coordinates.flat()
                : geometry.coordinates.flat(2);
        const validPositions = positions.filter(isPosition);
        if (validPositions.length === 0) return null;
        const total = validPositions.reduce(
            (sum, position) => [sum[0] + position[0], sum[1] + position[1]],
            [0, 0]
        );
        return {
            position: [total[0] / validPositions.length, total[1] / validPositions.length],
            weight: validPositions.length,
        };
    }
    return null;
}

function getPriority(
    category: MapLabelCategory,
    properties: Record<string, string | number | boolean>
) {
    const rankValue = typeof properties.rank === 'number' ? properties.rank : 20;
    const rankAdjustment = Math.max(0, 30 - rankValue);
    const basePriority: Record<MapLabelCategory, number> = {
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
    return basePriority[category] + rankAdjustment;
}

function decodeTile(buffer: ArrayBuffer, tile: TileCoordinate): MapLabelCandidate[] {
    const vectorTile = new VectorTile(new Pbf(buffer));
    const candidates: MapLabelCandidate[] = [];

    for (const layerName of ['place', 'mountain_peak', 'water_name', 'waterway', 'park', 'poi']) {
        const layer = vectorTile.layers[layerName];
        if (!layer) continue;

        for (let index = 0; index < layer.length; index += 1) {
            const feature = layer.feature(index);
            const names = getNames(feature.properties);
            if (!names) continue;
            const category = getCategory(layerName, feature.properties, names);
            if (!category) continue;

            const geoJson = feature.toGeoJSON(tile.x, tile.y, tile.z);
            if (!geoJson.geometry) continue;
            const anchor = getGeometryAnchor(geoJson.geometry);
            if (!anchor) continue;

            ensureLks94Projection();
            const [x, y] = window.proj4('EPSG:4326', 'EPSG:3346', [
                anchor.position[0],
                anchor.position[1],
            ]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

            candidates.push({
                id: `${tile.z}/${tile.x}/${tile.y}:${layerName}:${feature.id ?? index}`,
                category,
                names,
                position: [x, y],
                priority: getPriority(category, feature.properties),
                geometryWeight: anchor.weight,
            });
        }
    }

    return candidates;
}

function longitudeToTileX(longitude: number, zoom: number) {
    const tileCount = 2 ** zoom;
    return Math.max(0, Math.min(tileCount - 1, Math.floor(((longitude + 180) / 360) * tileCount)));
}

function latitudeToTileY(latitude: number, zoom: number) {
    const tileCount = 2 ** zoom;
    const clampedLatitude = Math.max(
        -WEB_MERCATOR_MAX_LATITUDE,
        Math.min(WEB_MERCATOR_MAX_LATITUDE, latitude)
    );
    const radians = (clampedLatitude * Math.PI) / 180;
    const value = (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
    return Math.max(0, Math.min(tileCount - 1, Math.floor(value * tileCount)));
}

function getTileCoordinates(bounds: Lks94Bounds, zoom: number): TileCoordinate[] {
    ensureLks94Projection();
    const lks94Corners: Array<[number, number]> = [
        [bounds.minX, bounds.minY],
        [bounds.minX, bounds.maxY],
        [bounds.maxX, bounds.minY],
        [bounds.maxX, bounds.maxY],
    ];
    const corners = lks94Corners.map((coordinate) =>
        window.proj4('EPSG:3346', 'EPSG:4326', coordinate)
    );
    const longitudes = corners.map((coordinate) => coordinate[0]);
    const latitudes = corners.map((coordinate) => coordinate[1]);
    const minX = longitudeToTileX(Math.min(...longitudes), zoom);
    const maxX = longitudeToTileX(Math.max(...longitudes), zoom);
    const minY = latitudeToTileY(Math.max(...latitudes), zoom);
    const maxY = latitudeToTileY(Math.min(...latitudes), zoom);
    const tiles: TileCoordinate[] = [];

    for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
            tiles.push({ x, y, z: zoom });
        }
    }
    return tiles;
}

async function getTileJson(signal: AbortSignal) {
    if (tileJsonCache) return tileJsonCache;
    const response = await fetch(TILEJSON_URL, { signal });
    if (!response.ok) throw new Error(`OpenFreeMap TileJSON returned HTTP ${response.status}`);
    const tileJson = (await response.json()) as TileJson;
    if (!tileJson.tiles?.[0]) throw new Error('OpenFreeMap TileJSON has no vector tile URL');
    tileJsonCache = tileJson;
    return tileJson;
}

async function fetchTile(url: string, tile: TileCoordinate, signal: AbortSignal) {
    const cached = tileCache.get(url);
    if (cached) return cached;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`OpenFreeMap tile returned HTTP ${response.status}`);
    const candidates = decodeTile(await response.arrayBuffer(), tile);
    tileCache.set(url, candidates);
    return candidates;
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

export async function fetchMapLabels(bounds: Lks94Bounds, signal: AbortSignal) {
    const tileJson = await getTileJson(signal);
    const maximumZoom = Math.min(tileJson.maxzoom ?? MAX_SOURCE_ZOOM, MAX_SOURCE_ZOOM);
    const minimumZoom = Math.max(tileJson.minzoom ?? MIN_SOURCE_ZOOM, MIN_SOURCE_ZOOM);
    let zoom = maximumZoom;
    let tiles = getTileCoordinates(bounds, zoom);

    while (tiles.length > MAX_TILE_REQUESTS && zoom > minimumZoom) {
        zoom -= 1;
        tiles = getTileCoordinates(bounds, zoom);
    }
    if (tiles.length > MAX_TILE_REQUESTS) {
        throw new Error('Point-cloud bounds require too many map tiles');
    }

    const template = tileJson.tiles?.[0];
    if (!template) throw new Error('OpenFreeMap TileJSON has no vector tile URL');
    const results = await Promise.allSettled(
        tiles.map((tile) => {
            const url = template
                .replace('{z}', String(tile.z))
                .replace('{x}', String(tile.x))
                .replace('{y}', String(tile.y));
            return fetchTile(url, tile, signal);
        })
    );
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const successful = results.filter(
        (result): result is PromiseFulfilledResult<MapLabelCandidate[]> =>
            result.status === 'fulfilled'
    );
    if (successful.length === 0) throw new Error('All OpenFreeMap tile requests failed');
    return deduplicateCandidates(successful.flatMap((result) => result.value)).filter((candidate) =>
        isCandidateInsideBounds(candidate, bounds)
    );
}
