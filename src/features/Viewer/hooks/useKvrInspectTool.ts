import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import {
    getKvrMatchKey,
    queryKvrAtCoordinate,
    type KvrCoordinate,
    type KvrMatch,
} from '@/features/Viewer/utils/kvrClient';

type KvrInspectStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export interface KvrMatchFocusRequest {
    key: string;
    revision: number;
}

export interface KvrInspectState {
    coordinate: KvrCoordinate | null;
    error: string | null;
    matches: KvrMatch[];
    status: KvrInspectStatus;
}

interface UseKvrInspectToolOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseKvrInspectToolReturn {
    closePopover: () => void;
    focusRequest: KvrMatchFocusRequest | null;
    inspectState: KvrInspectState;
    isInspecting: boolean;
    isPopoverOpen: boolean;
    retryLastInspection: () => void;
    requestMatchFocus: (match: KvrMatch) => void;
    toggleInspectMode: () => void;
}

const initialInspectState: KvrInspectState = {
    coordinate: null,
    error: null,
    matches: [],
    status: 'idle',
};

function roundCoordinate(value: number) {
    return Number(value.toFixed(3));
}

function isPlainLeftClick(event: MouseEvent) {
    return (
        event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey
    );
}

function getPickedCoordinate(
    viewer: PotreeViewer,
    mouse: { x: number; y: number }
): KvrCoordinate | null {
    const camera = viewer.scene.getActiveCamera();
    const intersection = window.Potree.Utils.getMousePointCloudIntersection(
        mouse,
        camera,
        viewer,
        viewer.scene.pointclouds,
        { pickClipped: true }
    );

    if (!intersection?.location) return null;

    return {
        x: roundCoordinate(intersection.location.x),
        y: roundCoordinate(intersection.location.y),
    };
}

export function useKvrInspectTool({
    viewerRef,
}: UseKvrInspectToolOptions): UseKvrInspectToolReturn {
    const [isInspecting, setIsInspecting] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [inspectState, setInspectState] = useState<KvrInspectState>(initialInspectState);
    const [focusRequest, setFocusRequest] = useState<KvrMatchFocusRequest | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastCoordinateRef = useRef<KvrCoordinate | null>(null);

    const abortCurrentRequest = () => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
    };

    const runInspection = async (coordinate: KvrCoordinate) => {
        abortCurrentRequest();
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        lastCoordinateRef.current = coordinate;
        setFocusRequest(null);

        setIsPopoverOpen(true);
        setInspectState({
            coordinate,
            error: null,
            matches: [],
            status: 'loading',
        });

        try {
            const matches = await queryKvrAtCoordinate(coordinate, abortController.signal);
            if (abortController.signal.aborted) return;

            setInspectState({
                coordinate,
                error: null,
                matches,
                status: matches.length > 0 ? 'success' : 'empty',
            });
        } catch (error) {
            if (abortController.signal.aborted) return;

            setInspectState({
                coordinate,
                error: error instanceof Error ? error.message : 'KVR lookup failed unexpectedly.',
                matches: [],
                status: 'error',
            });
        } finally {
            if (abortControllerRef.current === abortController) {
                abortControllerRef.current = null;
            }
        }
    };

    const retryLastInspection = () => {
        if (!lastCoordinateRef.current) return;
        void runInspection(lastCoordinateRef.current);
    };

    const closePopover = () => {
        abortCurrentRequest();
        setIsInspecting(false);
        setIsPopoverOpen(false);
        setFocusRequest(null);
    };

    const requestMatchFocus = (match: KvrMatch) => {
        const key = getKvrMatchKey(match);
        setFocusRequest((current) => ({
            key,
            revision: (current?.revision ?? 0) + 1,
        }));
    };

    const toggleInspectMode = () => {
        setIsInspecting((current) => !current);
    };

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        if (!isInspecting) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setIsInspecting(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isInspecting]);

    useEffect(() => {
        if (!isPopoverOpen && !isInspecting) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            closePopover();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closePopover, isInspecting, isPopoverOpen]);

    useEffect(() => {
        if (!isInspecting) return;

        let frameId = 0;
        let rendererElement: HTMLCanvasElement | null = null;
        let previousCursor = '';

        const handleMouseDown = (event: MouseEvent) => {
            const viewer = viewerRef.current;
            if (!viewer || !rendererElement || !isPlainLeftClick(event)) return;

            const rect = rendererElement.getBoundingClientRect();
            const coordinate = getPickedCoordinate(viewer, {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            });

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            setIsInspecting(false);
            setIsPopoverOpen(true);

            if (!coordinate) {
                setInspectState({
                    coordinate: null,
                    error: 'No LiDAR point was found at the clicked position.',
                    matches: [],
                    status: 'error',
                });
                return;
            }

            void runInspection(coordinate);
        };

        const setRendererElement = (nextRendererElement: HTMLCanvasElement | null) => {
            if (rendererElement === nextRendererElement) return;

            if (rendererElement) {
                rendererElement.removeEventListener('mousedown', handleMouseDown, {
                    capture: true,
                });
                rendererElement.style.cursor = previousCursor;
            }

            rendererElement = nextRendererElement;
            previousCursor = nextRendererElement?.style.cursor ?? '';

            if (rendererElement) {
                rendererElement.addEventListener('mousedown', handleMouseDown, { capture: true });
                rendererElement.style.cursor = 'help';
            }
        };

        const syncRendererElement = () => {
            setRendererElement(viewerRef.current?.renderer?.domElement ?? null);
            frameId = requestAnimationFrame(syncRendererElement);
        };

        syncRendererElement();

        return () => {
            cancelAnimationFrame(frameId);
            setRendererElement(null);
        };
    }, [isInspecting, runInspection, viewerRef]);

    return {
        closePopover,
        focusRequest,
        inspectState,
        isInspecting,
        isPopoverOpen,
        retryLastInspection,
        requestMatchFocus,
        toggleInspectMode,
    };
}
