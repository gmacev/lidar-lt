import { useEffect, useState, type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import {
    clearOrthophotoProbeCache,
    fetchAvailableDatedOrthophotoServices,
    fetchRecentOrthophotoService,
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
    datedReady: boolean;
    key: string | null;
    recentReady: boolean;
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
        datedReady: false,
        key: null,
        recentReady: false,
        services: [],
        status: 'idle',
    });

    // A new request key means a new load: reset to loading during render so the
    // effect below only ever sets state from async callbacks.
    const boundsKey = JSON.stringify(coverageBounds);
    const requestKey = enabled && coverageReady ? `${cellId}|${boundsKey}|${retryKey}` : null;
    if (state.key !== requestKey) {
        setState({
            datedReady: false,
            key: requestKey,
            recentReady: false,
            services: [],
            status: requestKey ? 'loading' : 'idle',
        });
    }

    useEffect(() => {
        if (!requestKey) return;

        const controller = new AbortController();
        let frameId = 0;

        const loadWithBounds = (effectiveBounds: readonly Lks94Bounds[]) => {
            // Recent metadata and dated discovery start together: a stalled
            // ORT_recent request must not block dated options from appearing.
            // Each side publishes independently as it settles.
            let recentService: OrthophotoServiceInfo | null = null;
            let recentSettled = false;
            let datedServices: OrthophotoServiceInfo[] = [];
            let datedSettled = false;
            let datedFailed = false;

            const publish = () => {
                if (controller.signal.aborted) return;
                if (recentSettled && datedSettled) {
                    if (datedFailed && !recentService) {
                        setState({
                            datedReady: true,
                            key: requestKey,
                            recentReady: true,
                            services: [],
                            status: 'error',
                        });
                    } else {
                        setState({
                            datedReady: true,
                            key: requestKey,
                            recentReady: true,
                            services: recentService
                                ? [recentService, ...datedServices]
                                : datedServices,
                            status: 'ready',
                        });
                    }
                    return;
                }
                if (recentSettled && recentService && !datedSettled) {
                    // Recent needs no dated discovery or probes, so it renders
                    // without waiting for the dated options below.
                    setState({
                        datedReady: false,
                        key: requestKey,
                        recentReady: true,
                        services: [recentService],
                        status: 'ready',
                    });
                    return;
                }
                if (!recentSettled && datedSettled && !datedFailed && datedServices.length > 0) {
                    // Dated discovery won the race: offer it now instead of
                    // leaving the picker loading behind a stalled recent
                    // request. Recent prepends itself when its metadata lands.
                    // An empty dated result still waits for recent before the
                    // picker can honestly report no coverage.
                    setState({
                        datedReady: true,
                        key: requestKey,
                        recentReady: false,
                        services: datedServices,
                        status: 'ready',
                    });
                }
                // Otherwise keep waiting: still loading, recent is down while
                // dated is pending, or dated failed while recent is pending.
            };

            void fetchRecentOrthophotoService().then((service) => {
                if (controller.signal.aborted) return;
                recentService = service;
                recentSettled = true;
                publish();
            });
            void fetchAvailableDatedOrthophotoServices(effectiveBounds, controller.signal)
                .then((services) => {
                    if (controller.signal.aborted) return;
                    datedServices = services;
                    datedSettled = true;
                    publish();
                })
                .catch((error: unknown) => {
                    if (controller.signal.aborted) return;
                    console.warn('Orthophoto catalog could not be loaded', error);
                    datedSettled = true;
                    datedFailed = true;
                    publish();
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
        datedReady: state.datedReady,
        recentReady: state.recentReady,
        retry: () => {
            clearOrthophotoProbeCache();
            setRetryKey((value) => value + 1);
        },
        services: state.services,
        status: state.status,
    };
}
