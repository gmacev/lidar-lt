import proj4 from 'proj4';

const LKS94_PROJ =
    '+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9998 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';

const DECIMAL_COORD_REGEX = /^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/;
const DMS_COORD_REGEX = /(\d+°\s*\d+'\s*\d+(?:\.\d+)?"?\s*[NSEW])/gi;

const LITHUANIA_WGS84_BOUNDS = {
    minLatitude: 53.5,
    maxLatitude: 56.5,
    minLongitude: 20.5,
    maxLongitude: 27,
} as const;

const LITHUANIA_LKS94_BOUNDS = {
    minEasting: 250_000,
    maxEasting: 750_000,
    minNorthing: 5_850_000,
    maxNorthing: 6_400_000,
} as const;

export interface Wgs84Coordinates {
    type: 'wgs84';
    longitude: number;
    latitude: number;
}

export interface Lks94Coordinates {
    type: 'lks94';
    x: number;
    y: number;
}

export type ParsedCoordinates = Wgs84Coordinates | Lks94Coordinates;

function isWgs84(latitude: number, longitude: number) {
    return (
        latitude >= LITHUANIA_WGS84_BOUNDS.minLatitude &&
        latitude <= LITHUANIA_WGS84_BOUNDS.maxLatitude &&
        longitude >= LITHUANIA_WGS84_BOUNDS.minLongitude &&
        longitude <= LITHUANIA_WGS84_BOUNDS.maxLongitude
    );
}

function isLks94(easting: number, northing: number) {
    return (
        easting >= LITHUANIA_LKS94_BOUNDS.minEasting &&
        easting <= LITHUANIA_LKS94_BOUNDS.maxEasting &&
        northing >= LITHUANIA_LKS94_BOUNDS.minNorthing &&
        northing <= LITHUANIA_LKS94_BOUNDS.maxNorthing
    );
}

function parseDmsValue(value: string) {
    const match = value.match(/(\d+)°\s*(\d+)'\s*(\d+(?:\.\d+)?)"?\s*([NSEW])/i);
    if (!match) return null;

    const degrees = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const direction = match[4].toUpperCase();
    const sign = direction === 'S' || direction === 'W' ? -1 : 1;

    return {
        value: sign * (degrees + minutes / 60 + seconds / 3600),
        direction,
    };
}

function parseDecimalCoordinates(input: string): ParsedCoordinates | null {
    const match = input.match(DECIMAL_COORD_REGEX);
    if (!match) return null;

    const first = Number(match[1]);
    const second = Number(match[2]);

    if (isWgs84(first, second)) {
        return { type: 'wgs84', latitude: first, longitude: second };
    }
    if (isWgs84(second, first)) {
        return { type: 'wgs84', latitude: second, longitude: first };
    }
    if (isLks94(first, second)) {
        return { type: 'lks94', x: first, y: second };
    }
    if (isLks94(second, first)) {
        return { type: 'lks94', x: second, y: first };
    }

    return null;
}

function parseDmsCoordinates(input: string): Wgs84Coordinates | null {
    const matches = input.match(DMS_COORD_REGEX);
    if (matches?.length !== 2) return null;

    const first = parseDmsValue(matches[0]);
    const second = parseDmsValue(matches[1]);
    if (!first || !second) return null;

    const firstIsLatitude = first.direction === 'N' || first.direction === 'S';
    const secondIsLatitude = second.direction === 'N' || second.direction === 'S';
    if (firstIsLatitude === secondIsLatitude) return null;

    const latitude = firstIsLatitude ? first.value : second.value;
    const longitude = firstIsLatitude ? second.value : first.value;

    return isWgs84(latitude, longitude) ? { type: 'wgs84', latitude, longitude } : null;
}

export function parseCoordinateInput(input: string): ParsedCoordinates | null {
    const trimmed = input.trim();
    return parseDecimalCoordinates(trimmed) ?? parseDmsCoordinates(trimmed);
}

export function wgs84ToLks94(coordinates: Wgs84Coordinates): Lks94Coordinates {
    const [x, y] = proj4('EPSG:4326', LKS94_PROJ, [coordinates.longitude, coordinates.latitude]);
    return { type: 'lks94', x, y };
}

export function lks94ToWgs84(coordinates: Lks94Coordinates): Wgs84Coordinates {
    const [longitude, latitude] = proj4(LKS94_PROJ, 'EPSG:4326', [coordinates.x, coordinates.y]);
    return { type: 'wgs84', longitude, latitude };
}
