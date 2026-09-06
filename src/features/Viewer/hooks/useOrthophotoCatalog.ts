import { useEffect, useState, type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import {
    clearOrthophotoProbeCache,
    fetchAvailableOrthophotoServices,
    type OrthophotoServiceInfo,
} from '@/features/Viewer/utils/orthophotoCatalog';
import type { Lks94Bounds } from '@/features/Viewer/utils/orthophotoTiles';
import { getViewerWorldBounds } from '@/features/Viewer/utils/viewerLabels';

export type OrthophotoCatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

interface UseOrthophotoCatalogOptions {
    cellId: string;
    coverageBounds: readonly Lks94Bounds[];
    coverageReady: boolean;
    enabled: boolean;
    viewerRef: RefObject<PotreeViewer | null>;
}

interface OrthophotoCatalogState {
    key: string | null;
    services: OrthophotoServiceInfo[];
    status: OrthophotoCatalogStatus;
}

export function useOrthophotoCatalog({
    cellId,
    coverageBounds,
    coverageReady,
    enabled,
    viewerRef,
}: UseOrthophotoCatalogOptions) {
    const [retryKey, setRetryKey] = useState(0);
    const [state, setState] = useState<OrthophotoCatalogState>({
        key: null,
        services: [],
        status: 'idle',
    });

    // A new request key means a new load: reset to loading during render so the
    // effect below only ever sets state from async callbacks.
    const boundsKey = JSON.stringify(coverageBounds);
    const requestKey = enabled && coverageReady ? `${cellId}|${boundsKey}|${retryKey}` : null;
    if (state.key !== requestKey) {
        setState({
            key: requestKey,
            services: [],
            status: requestKey ? 'loading' : 'idle',
        });
    }

    useEffect(() => {
        if (!requestKey) return;

        const controller = new AbortController();
        let frameId = 0;

        const loadWithBounds = (effectiveBounds: readonly Lks94Bounds[]) => {
            void fetchAvailableOrthophotoServices(effectiveBounds, controller.signal)
                .then((available) => {
                    if (controller.signal.aborted) return;
                    setState({ key: requestKey, services: available, status: 'ready' });
                })
                .catch((error: unknown) => {
                    if (controller.signal.aborted) return;
                    console.warn('Orthophoto catalog could not be loaded', error);
                    setState({ key: requestKey, services: [], status: 'error' });
                });
        };

        const loadWhenViewerReady = () => {
            if (controller.signal.aborted) return;
            // Manifest footprints need no viewer: start immediately.
            if (coverageBounds.length > 0) {
                loadWithBounds(coverageBounds);
                return;
            }
            const viewer = viewerRef.current;
            const worldBounds = viewer ? getViewerWorldBounds(viewer) : null;
            if (!viewer || !worldBounds || worldBounds.isEmpty()) {
                frameId = requestAnimationFrame(loadWhenViewerReady);
                return;
            }

            // Live point-cloud bounds keep sector locality when the manifest
            // is missing them (same fallback as map labels and the overlay).
            loadWithBounds([
                {
                    minX: worldBounds.min.x,
                    minY: worldBounds.min.y,
                    maxX: worldBounds.max.x,
                    maxY: worldBounds.max.y,
                },
            ]);
        };

        loadWhenViewerReady();
        return () => {
            controller.abort();
            cancelAnimationFrame(frameId);
        };
    }, [coverageBounds, requestKey, viewerRef]);

    return {
        retry: () => {
            clearOrthophotoProbeCache();
            setRetryKey((value) => value + 1);
        },
        services: state.services,
        status: state.status,
    };
}
