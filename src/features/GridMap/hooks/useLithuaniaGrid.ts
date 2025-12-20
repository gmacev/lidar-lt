import { useRef, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { MapLayerMouseEvent, MapRef } from '@vis.gl/react-maplibre';
import type { FeatureCollection } from 'geojson';
import gridData from '@/assets/grid.json';
import { useGridSearch } from './useGridSearch';

const GRID_SOURCE_ID = 'lidar-grid';

interface TooltipData {
    x: number;
    y: number;
    name: string;
    id: string;
}

export function useLithuaniaGrid() {
    const navigate = useNavigate();

    // Data is now static import
    const data = gridData as FeatureCollection;

    // Search Logic
    const { searchQuery, setSearchQuery, matchedIds } = useGridSearch(data);

    // Map Interaction State
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const lastHoveredId = useRef<string | null>(null);
    const mapRef = useRef<MapRef>(null);

    // Sync matched state with map
    const prevMatchedIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map || !data) return;

        // Clear old matches
        prevMatchedIds.current.forEach((id) => {
            if (!matchedIds.has(id)) {
                map.setFeatureState({ source: GRID_SOURCE_ID, id }, { matched: false });
            }
        });

        // Set new matches
        matchedIds.forEach((id) => {
            if (!prevMatchedIds.current.has(id)) {
                map.setFeatureState({ source: GRID_SOURCE_ID, id }, { matched: true });
            }
        });

        prevMatchedIds.current = matchedIds;
    }, [matchedIds, data]);

    // Handlers
    const handleClick = (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];

        if (feature?.properties) {
            const { id, name } = feature.properties as { id: string; name: string | null };
            if (id) {
                const normalizedId = id.replace(/\//g, '_');
                void navigate({
                    to: '/viewer/$cellId',
                    params: { cellId: normalizedId },
                    search: { sectorName: name ?? undefined },
                });
                return;
            }
        }

        // If clicked on empty space, navigate to root
        void navigate({ to: '/' });
    };

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
            query: searchQuery,
            setQuery: setSearchQuery,
            matchedIds,
        },
        handlers: {
            onClick: handleClick,
            onMouseMove: handleMouseMove,
            onMouseLeave: handleMouseLeave,
        },
    };
}
