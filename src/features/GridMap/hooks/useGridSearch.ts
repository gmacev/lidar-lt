import { useState } from 'react';
import type { FeatureCollection, Geometry, Position } from 'geojson';

const GEOMETRY_EPSILON = 1e-10;

function isPointOnSegment(point: Position, start: Position, end: Position) {
    const [x, y] = point;
    const [startX, startY] = start;
    const [endX, endY] = end;
    const crossProduct = (y - startY) * (endX - startX) - (x - startX) * (endY - startY);
    if (Math.abs(crossProduct) > GEOMETRY_EPSILON) return false;
    return (
        x >= Math.min(startX, endX) - GEOMETRY_EPSILON &&
        x <= Math.max(startX, endX) + GEOMETRY_EPSILON &&
        y >= Math.min(startY, endY) - GEOMETRY_EPSILON &&
        y <= Math.max(startY, endY) + GEOMETRY_EPSILON
    );
}

function isPointInRing(point: Position, ring: Position[]) {
    let inside = false;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
        const currentPoint = ring[index];
        const previousPoint = ring[previous];
        if (!currentPoint || !previousPoint) continue;
        if (isPointOnSegment(point, previousPoint, currentPoint)) return true;

        const [x, y] = point;
        const [currentX, currentY] = currentPoint;
        const [previousX, previousY] = previousPoint;
        const crossesRay =
            currentY > y !== previousY > y &&
            x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
        if (crossesRay) inside = !inside;
    }
    return inside;
}

function isPointInPolygon(point: Position, rings: Position[][]) {
    const exterior = rings[0];
    return Boolean(
        exterior &&
        isPointInRing(point, exterior) &&
        rings.slice(1).every((hole) => !isPointInRing(point, hole))
    );
}

function isPointInFeature(point: Position, geometry: Geometry): boolean {
    if (geometry.type === 'Polygon') return isPointInPolygon(point, geometry.coordinates);
    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.some((polygon) => isPointInPolygon(point, polygon));
    }
    if (geometry.type === 'GeometryCollection') {
        return geometry.geometries.some((item) => isPointInFeature(point, item));
    }
    return false;
}

// Coordinate parsing regex: "55.695, 26.435" or "55.695 26.435"
const DECIMAL_COORD_REGEX = /^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/;
const GRID_ID_REGEX = /^\d{1,3}[/_]\d{1,3}$/;

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
export function isCoordinateSearchQuery(searchQuery: string) {
    const query = searchQuery.trim();
    if (DECIMAL_COORD_REGEX.test(query)) return true;
    const dmsMatches = query.match(/(\d+°\s*\d+'\s*\d+(?:\.\d+)?"\s*[NSEW])/gi);
    return dmsMatches?.length === 2;
}

export function isGridIdSearchQuery(searchQuery: string) {
    return GRID_ID_REGEX.test(searchQuery.trim());
}

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
        data.features.forEach((feature) => {
            if (!isPointInFeature(point, feature.geometry)) return;
            const id = (feature.properties as { id?: unknown } | null)?.id;
            if (typeof id === 'string') matches.add(id);
        });
    } else {
        // Text Search
        const lowerQuery = query.toLowerCase().replace(/_/g, '/');
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
    const [searchState, setSearchState] = useState(() => ({
        searchQuery: '',
        matchedIds: computeMatchedIds('', data),
    }));

    const setSearchQuery = (query: string) => {
        setSearchState({
            searchQuery: query,
            matchedIds: computeMatchedIds(query, data),
        });
    };

    return {
        searchQuery: searchState.searchQuery,
        setSearchQuery,
        matchedIds: searchState.matchedIds,
    };
}
