import { useState } from 'react';
import type { FeatureCollection, Geometry, Position } from 'geojson';
import {
    lks94ToWgs84,
    parseCoordinateInput,
    type ParsedCoordinates,
} from '@/common/utils/coordinates';
import { normalizeGeographicName } from '@/features/GridMap/services/geographicSearchIndex';

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

const GRID_ID_REGEX = /^\d{1,3}[/_]\d{1,3}$/;

/**
 * Compute matched IDs based on search query and data.
 * Pure function for deriving state.
 */
export function isCoordinateSearchQuery(searchQuery: string) {
    return parseCoordinateInput(searchQuery) !== null;
}

export function isGridIdSearchQuery(searchQuery: string) {
    return GRID_ID_REGEX.test(searchQuery.trim());
}

function computeMatchedIds(searchQuery: string, data: FeatureCollection | undefined): Set<string> {
    if (!data) return new Set();

    const query = searchQuery.trim();
    if (!query) return new Set();

    const matches = new Set<string>();

    const parsedCoordinates: ParsedCoordinates | null = parseCoordinateInput(query);
    const wgs84Coordinates =
        parsedCoordinates?.type === 'lks94' ? lks94ToWgs84(parsedCoordinates) : parsedCoordinates;
    const point: [number, number] | null = wgs84Coordinates
        ? [wgs84Coordinates.longitude, wgs84Coordinates.latitude]
        : null;

    if (point) {
        data.features.forEach((feature) => {
            if (!isPointInFeature(point, feature.geometry)) return;
            const id = (feature.properties as { id?: unknown } | null)?.id;
            if (typeof id === 'string') matches.add(id);
        });
    } else {
        const lowerQuery = query.toLowerCase().replace(/_/g, '/');
        const tokens = normalizeGeographicName(query).split(' ').filter(Boolean);
        data.features.forEach((feature) => {
            const props = feature.properties as { id: string; name: string | null };
            if (props.id.toLowerCase().includes(lowerQuery)) {
                matches.add(props.id);
                return;
            }
            if (tokens.length === 0 || !props.name) return;
            const normalizedName = normalizeGeographicName(props.name);
            if (tokens.every((token) => normalizedName.includes(token))) {
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
