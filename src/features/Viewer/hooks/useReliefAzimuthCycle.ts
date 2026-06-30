import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import { RELIEF_DEFAULTS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

const CYCLE_DURATIONS = [10, 7, 3] as const;
type CycleDuration = (typeof CYCLE_DURATIONS)[number] | null;

interface ReliefAzimuthCycleSnapshot {
    azimuth: number;
    duration: CycleDuration;
}

export interface ReliefAzimuthCycleController {
    advance: () => void;
    getSnapshot: () => ReliefAzimuthCycleSnapshot;
    setAzimuthManually: (azimuth: number) => void;
    setReliefEnabled: (enabled: boolean) => void;
    subscribe: (listener: () => void) => () => void;
}

interface InternalController extends ReliefAzimuthCycleController {
    dispose: () => void;
    reset: (state: ViewerState) => void;
    setRuntime: (
        viewerRef: RefObject<PotreeViewer | null>,
        updateUrl: (state: Partial<ViewerState>) => void
    ) => void;
}

interface UseReliefAzimuthCycleOptions {
    initialState: ViewerState;
    resetKey: string;
    updateUrl: (state: Partial<ViewerState>) => void;
    viewerRef: RefObject<PotreeViewer | null>;
}

const normalizeAzimuth = (azimuth: number) => ((Math.round(azimuth) % 360) + 360) % 360;

function createController(
    initialState: ViewerState,
    initialViewerRef: RefObject<PotreeViewer | null>,
    initialUpdateUrl: (state: Partial<ViewerState>) => void
): InternalController {
    let viewerRef = initialViewerRef;
    let updateUrl = initialUpdateUrl;
    let reliefEnabled = initialState.reliefEnabled ?? RELIEF_DEFAULTS.enabled;
    let frameId: number | null = null;
    let snapshot: ReliefAzimuthCycleSnapshot = {
        azimuth: initialState.reliefAzimuth ?? RELIEF_DEFAULTS.azimuth,
        duration: null,
    };
    const listeners = new Set<() => void>();

    const publish = (nextSnapshot: ReliefAzimuthCycleSnapshot) => {
        snapshot = nextSnapshot;
        listeners.forEach((listener) => listener());
    };

    const applyAzimuth = (azimuth: number, duration = snapshot.duration) => {
        viewerRef.current?.setReliefAzimuth(azimuth);
        publish({ azimuth, duration });
    };

    const stopAnimation = () => {
        if (frameId === null) return;
        cancelAnimationFrame(frameId);
        frameId = null;
    };

    const startAnimation = () => {
        if (!reliefEnabled || snapshot.duration === null || frameId !== null) return;

        const startedAt = performance.now();
        const startingAzimuth = snapshot.azimuth;
        const duration = snapshot.duration;

        const rotateAzimuth = (now: number) => {
            const elapsed = now - startedAt;
            const azimuth = (startingAzimuth + (elapsed / (duration * 1000)) * 360) % 360;
            applyAzimuth(azimuth, duration);
            frameId = requestAnimationFrame(rotateAzimuth);
        };

        frameId = requestAnimationFrame(rotateAzimuth);
    };

    const commitCurrentAzimuth = () => {
        const azimuth = normalizeAzimuth(snapshot.azimuth);
        applyAzimuth(azimuth);
        updateUrl({ reliefAzimuth: azimuth });
    };

    const controller: InternalController = {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        advance: () => {
            const currentIndex = CYCLE_DURATIONS.findIndex(
                (duration) => duration === snapshot.duration
            );
            const nextDuration =
                snapshot.duration === null
                    ? CYCLE_DURATIONS[0]
                    : (CYCLE_DURATIONS[currentIndex + 1] ?? null);

            stopAnimation();
            if (nextDuration === null) {
                publish({ ...snapshot, duration: null });
                commitCurrentAzimuth();
                return;
            }

            publish({ ...snapshot, duration: nextDuration });
            startAnimation();
        },
        setAzimuthManually: (azimuth) => {
            stopAnimation();
            applyAzimuth(azimuth, null);
        },
        setReliefEnabled: (enabled) => {
            reliefEnabled = enabled;
            if (!enabled) {
                stopAnimation();
                if (snapshot.duration !== null) commitCurrentAzimuth();
                return;
            }
            startAnimation();
        },
        reset: (state) => {
            stopAnimation();
            reliefEnabled = state.reliefEnabled ?? RELIEF_DEFAULTS.enabled;
            applyAzimuth(state.reliefAzimuth ?? RELIEF_DEFAULTS.azimuth, null);
        },
        setRuntime: (nextViewerRef, nextUpdateUrl) => {
            viewerRef = nextViewerRef;
            updateUrl = nextUpdateUrl;
        },
        dispose: () => {
            stopAnimation();
            listeners.clear();
        },
    };

    return controller;
}

export function useReliefAzimuthCycle({
    initialState,
    resetKey,
    updateUrl,
    viewerRef,
}: UseReliefAzimuthCycleOptions): ReliefAzimuthCycleController {
    const [controller] = useState(() => createController(initialState, viewerRef, updateUrl));
    const appliedResetKeyRef = useRef(resetKey);

    useEffect(() => {
        controller.setRuntime(viewerRef, updateUrl);
    }, [controller, updateUrl, viewerRef]);

    useEffect(() => {
        if (appliedResetKeyRef.current === resetKey) return;
        appliedResetKeyRef.current = resetKey;
        controller.reset(initialState);
    }, [controller, initialState, resetKey]);

    useEffect(() => () => controller.dispose(), [controller]);

    return controller;
}
