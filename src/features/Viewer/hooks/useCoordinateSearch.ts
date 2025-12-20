import { useState, useEffect } from 'react';
import debounce from 'lodash/debounce';

// LKS94 projection definition (EPSG:3346)
const LKS94_PROJ =
    '+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9998 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';

// Default bird's eye view height in meters
const DEFAULT_VIEW_HEIGHT = 500;

interface Coordinates {
    x: number;
    y: number;
}

interface ParseResult {
    isValid: boolean;
    coordinates: Coordinates | null;
    error: string | null;
}

// Coordinate parsing patterns
const DECIMAL_COORD_REGEX = /^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/;

/**
 * Parse DMS format like "55°41'42.0"N" to decimal degrees
 */
function parseDMS(dmsStr: string): number | null {
    const regex = /(\d+)°\s*(\d+)'\s*(\d+(?:\.\d+)?)"?\s*([NSEW])/i;
    const match = dmsStr.match(regex);
    if (!match) return null;

    const degrees = parseFloat(match[1]);
    const minutes = parseFloat(match[2]);
    const seconds = parseFloat(match[3]);
    const direction = match[4].toUpperCase();

    let decimal = degrees + minutes / 60 + seconds / 3600;

    if (direction === 'S' || direction === 'W') {
        decimal = -decimal;
    }

    return decimal;
}

/**
 * Parse WGS84 coordinates from various input formats
 * Returns [longitude, latitude] for proj4
 */
function parseWGS84(input: string): [number, number] | null {
    const trimmed = input.trim();

    // 1. Try decimal format: "54.687157, 25.279652" (lat, lon)
    const decimalMatch = trimmed.match(DECIMAL_COORD_REGEX);
    if (decimalMatch) {
        const lat = parseFloat(decimalMatch[1]);
        const lon = parseFloat(decimalMatch[2]);

        // Validate Lithuania bbox roughly
        if (lat >= 53.5 && lat <= 56.5 && lon >= 20.5 && lon <= 27) {
            return [lon, lat]; // proj4 expects [lon, lat]
        }
        // Maybe they swapped lat/lon
        if (lon >= 53.5 && lon <= 56.5 && lat >= 20.5 && lat <= 27) {
            return [lat, lon];
        }
        return null; // Outside Lithuania
    }

    // 2. Try DMS format: "55°41'42.0"N 26°26'06.0"E"
    const dmsRegex = /(\d+°\s*\d+'\s*\d+(?:\.\d+)?"?\s*[NSEW])/gi;
    const dmsMatches = trimmed.match(dmsRegex);

    if (dmsMatches && dmsMatches.length === 2) {
        const c1 = parseDMS(dmsMatches[0]);
        const c2 = parseDMS(dmsMatches[1]);

        if (c1 !== null && c2 !== null) {
            const isLat = (str: string) => /[NS]/i.test(str);

            let lat = c1;
            let lon = c2;

            if (isLat(dmsMatches[1]) && !isLat(dmsMatches[0])) {
                lat = c2;
                lon = c1;
            }

            // Validate Lithuania bbox
            if (lat >= 53.5 && lat <= 56.5 && lon >= 20.5 && lon <= 27) {
                return [lon, lat];
            }
        }
    }

    return null;
}

/**
 * Transform WGS84 [lon, lat] to LKS94 [x, y]
 */
function transformToLKS94(lonLat: [number, number]): Coordinates {
    const proj4 = window.proj4;

    // Register LKS94 if not already defined
    if (!proj4.defs('EPSG:3346')) {
        proj4.defs('EPSG:3346', LKS94_PROJ);
    }

    const [x, y] = proj4('EPSG:4326', 'EPSG:3346', lonLat);
    return { x, y };
}

/**
 * Parse and transform coordinates, updating result state
 */
function processQuery(query: string, setResult: (result: ParseResult) => void) {
    const trimmed = query.trim();
    if (!trimmed) {
        setResult({ isValid: false, coordinates: null, error: null });
        return;
    }

    const wgs84 = parseWGS84(trimmed);

    if (wgs84) {
        try {
            const lks94 = transformToLKS94(wgs84);
            setResult({
                isValid: true,
                coordinates: lks94,
                error: null,
            });
        } catch {
            setResult({
                isValid: false,
                coordinates: null,
                error: 'Transformation failed',
            });
        }
    } else {
        setResult({
            isValid: false,
            coordinates: null,
            error: 'Invalid coordinates',
        });
    }
}

export function useCoordinateSearch() {
    const [query, setQuery] = useState('');
    const [parseResult, setParseResult] = useState<ParseResult>({
        isValid: false,
        coordinates: null,
        error: null,
    });

    const debouncedProcess = debounce((q: string) => processQuery(q, setParseResult), 300);

    // Cancel on unmount
    useEffect(() => {
        return () => {
            debouncedProcess.cancel();
        };
    }, [debouncedProcess]);

    // Trigger debounced processing on query change
    useEffect(() => {
        debouncedProcess(query);
    }, [query, debouncedProcess]);

    return {
        query,
        setQuery,
        isValid: parseResult.isValid,
        coordinates: parseResult.coordinates,
        error: parseResult.error,
        defaultHeight: DEFAULT_VIEW_HEIGHT,
    };
}
