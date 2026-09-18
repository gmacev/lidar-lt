import { useRef, useEffect, useState } from 'react';
import type { MapLayerMouseEvent, MapRef } from '@vis.gl/react-maplibre';
import gridData from '@/assets/grid.json';
import type { GridSectorCollection } from '@/features/GridMap/components/GridSectorLinks';
import { isCoordinateSearchQuery, isGridIdSearchQuery, useGridSearch } from './useGridSearch';
import { useGeographicSearch } from './useGeographicSearch';

const GRID_SOURCE_ID = 'lidar-grid';

interface TooltipData {
    x: number;
    y: number;
    name: string;
    id: string;
}

export function useLithuaniaGrid(mapStyleKey: string) {
    // Data is now static import
    const data = gridData as GridSectorCollection;

    // Search Logic
    const localSearch = useGridSearch(data);
    const isDirectGridSearch =
        isCoordinateSearchQuery(localSearch.searchQuery) ||
        isGridIdSearchQuery(localSearch.searchQuery);
    const geographicSearch = useGeographicSearch(localSearch.searchQuery, !isDirectGridSearch);
    const searchMatchedIds = new Set(localSearch.matchedIds);
    geographicSearch.matchedIds.forEach((id) => searchMatchedIds.add(id));
    const [highlightedAnnotationSectorId, setHighlightedAnnotationSectorId] = useState<
        string | null
    >(null);
    const renderedMatchedIds = new Set(searchMatchedIds);
    if (highlightedAnnotationSectorId) {
        renderedMatchedIds.add(highlightedAnnotationSectorId.replace(/_/g, '/'));
    }

    // Map Interaction State
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const lastHoveredId = useRef<string | null>(null);
    const mapRef = useRef<MapRef>(null);

    // Sync matched state with map
    const prevMatchedIds = useRef<Set<string>>(new Set());
    const matchedIdsRef = useRef(renderedMatchedIds);

    useEffect(() => {
        matchedIdsRef.current = renderedMatchedIds;
    }, [renderedMatchedIds]);

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map?.getSource(GRID_SOURCE_ID) || !data) return;

        // Clear old matches
        prevMatchedIds.current.forEach((id) => {
            if (!renderedMatchedIds.has(id)) {
                map.setFeatureState({ source: GRID_SOURCE_ID, id }, { matched: false });
            }
        });

        // Set new matches
        renderedMatchedIds.forEach((id) => {
            if (!prevMatchedIds.current.has(id)) {
                map.setFeatureState({ source: GRID_SOURCE_ID, id }, { matched: true });
            }
        });

        prevMatchedIds.current = renderedMatchedIds;
    }, [renderedMatchedIds, data]);

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        const restoreFeatureStates = () => {
            if (!map.getSource(GRID_SOURCE_ID)) return;

            matchedIdsRef.current.forEach((id) => {
                map.setFeatureState({ source: GRID_SOURCE_ID, id }, { matched: true });
            });

            if (lastHoveredId.current) {
                map.setFeatureState(
                    { source: GRID_SOURCE_ID, id: lastHoveredId.current },
                    { hover: true }
                );
            }

            prevMatchedIds.current = new Set(matchedIdsRef.current);
        };

        void map.once('idle', restoreFeatureStates);

        return () => {
            map.off('idle', restoreFeatureStates);
        };
    }, [mapStyleKey]);

    // Handlers
    const handleMouseMove = (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const map = event.target;

        if (feature?.properties?.id) {
            const currentId = feature.properties.id as string;

            // If we moved to a new feature
            if (currentId !== lastHoveredId.current) {
                // Clear previous hover state
                if (lastHoveredId.current) {
                    map.setFeatureState(
                        { source: GRID_SOURCE_ID, id: lastHoveredId.current },
                        { hover: false }
                    );
                }

                // Set new hover state
                map.setFeatureState({ source: GRID_SOURCE_ID, id: currentId }, { hover: true });

                lastHoveredId.current = currentId;
            }

            setTooltip({
                x: event.point.x,
                y: event.point.y,
                name: (feature.properties.name as string | null) ?? 'Nežinomas sektorius',
                id: currentId,
            });
            map.getCanvas().style.cursor = 'pointer';
        } else {
            // Mouse left all features
            if (lastHoveredId.current) {
                map.setFeatureState(
                    { source: GRID_SOURCE_ID, id: lastHoveredId.current },
                    { hover: false }
                );
                lastHoveredId.current = null;
            }
            setTooltip(null);
            map.getCanvas().style.cursor = '';
        }
    };

    const handleMouseLeave = (event: MapLayerMouseEvent) => {
        const map = event.target;
        if (lastHoveredId.current) {
            map.setFeatureState(
                { source: GRID_SOURCE_ID, id: lastHoveredId.current },
                { hover: false }
            );
            lastHoveredId.current = null;
        }
        setTooltip(null);
    };

    return {
        data,
        mapRef,
        tooltip,
        search: {
            query: localSearch.searchQuery,
            setQuery: localSearch.setSearchQuery,
            matchedIds: searchMatchedIds,
            status: geographicSearch.status,
        },
        annotationHighlight: {
            sectorId: highlightedAnnotationSectorId,
            setSectorId: setHighlightedAnnotationSectorId,
        },
        hasActiveSectorMatch: renderedMatchedIds.size > 0,
        handlers: {
            onMouseMove: handleMouseMove,
            onMouseLeave: handleMouseLeave,
        },
    };
}
