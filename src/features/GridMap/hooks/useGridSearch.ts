import { useState } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';

// Ray-casting algorithm for point in polygon
function isPointInPolygon(point: [number, number], vs: number[][]): boolean {
    const x = point[0],
        y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0],
            yi = vs[i][1];
        const xj = vs[j][0],
            yj = vs[j][1];

        const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

function isPointInFeature(point: [number, number], geometry: Geometry): boolean {
    if (geometry.type === 'Polygon') {
        // GeoJSON Polygons: first ring is exterior
        return isPointInPolygon(point, geometry.coordinates[0]);
    }
    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.some((polyCoords) => isPointInPolygon(point, polyCoords[0]));
    }
    return false;
}

// Coordinate parsing regex: "55.695, 26.435" or "55.695 26.435"
const DECIMAL_COORD_REGEX = /^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/;

function parseDMS(dmsStr: string): number | null {
    // Matches: 55°41'42.0"N or 26°26'06.0"E
    const regex = /(\d+)°\s*(\d+)'\s*(\d+(?:\.\d+)?)"\s*([NSEW])/i;
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
 * Compute matched IDs based on search query and data.
 * Pure function for deriving state.
 */
function computeMatchedIds(searchQuery: string, data: FeatureCollection | undefined): Set<string> {
    if (!data) return new Set();

    const query = searchQuery.trim();
    if (!query) return new Set();

    const matches = new Set<string>();

    // 1. Check for decimal coordinates
    const decimalMatch = query.match(DECIMAL_COORD_REGEX);

    let point: [number, number] | null = null;

    if (decimalMatch) {
        const lat = parseFloat(decimalMatch[1]);
        const lon = parseFloat(decimalMatch[3]);
        point = [lon, lat];
    } else {
        // 2. Check for DMS coordinates
        const regex = /(\d+°\s*\d+'\s*\d+(?:\.\d+)?"\s*[NSEW])/gi;
        const dmsMatches = query.match(regex);

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

                point = [lon, lat];
            }
        }
    }

    if (point) {
        // Found coordinates (Decimal or DMS)
        data.features.forEach((feature) => {
            if (isPointInFeature(point, feature.geometry)) {
                const props = feature.properties as { id: string };
                if (props.id) matches.add(props.id);
            }
        });
    } else {
        // Text Search
        const lowerQuery = query.toLowerCase();
        data.features.forEach((feature) => {
            const props = feature.properties as { id: string; name: string | null };
            if (
                props.id.toLowerCase().includes(lowerQuery) ||
                props.name?.toLowerCase().includes(lowerQuery)
            ) {
                matches.add(props.id);
            }
        });
    }

    return matches;
}

export function useGridSearch(data: FeatureCollection | undefined) {
    const [searchQuery, setSearchQuery] = useState('');

    // Derive matchedIds from searchQuery and data
    const matchedIds = computeMatchedIds(searchQuery, data);

    return {
        searchQuery,
        setSearchQuery,
        matchedIds,
    };
}
