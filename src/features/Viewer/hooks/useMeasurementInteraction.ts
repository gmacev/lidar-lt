import { useState, useEffect, type RefObject } from 'react';
import type { Measure, PotreeViewer } from '@/common/types/potree';

interface UseMeasurementInteractionOptions {
    viewerRef: RefObject<PotreeViewer | null>;
    isMeasuring: boolean;
    /**
     * Whether to block right-click events to prevent Potree's default behavior
     * (removing points/canceling measurement).
     *
     * - true (default): Block right-click, no rotation during measurement
     * - false: Allow right-click through, enables rotation but may affect
     *          some tools (use for volume tool which needs drag interaction)
     */
    blockRightClick?: boolean;
}

interface UseDoubleClickFinishOptions {
    viewerRef: RefObject<PotreeViewer | null>;
    isActive: boolean;
    onFinish: () => void;
}

interface UseMeasurementInteractionReturn {
    menuPosition: { x: number; y: number } | null;
    setMenuPosition: (pos: { x: number; y: number } | null) => void;
}

interface DispatchableViewer extends PotreeViewer {
    dispatchEvent: (event: { type: string }) => void;
}

export function cancelPotreeInsertion(viewer: PotreeViewer) {
    (viewer as DispatchableViewer).dispatchEvent({ type: 'cancel_insertions' });
}

export function removeDuplicateTrailingMarker(measurement: Measure, tolerance = 0.01) {
    const { points } = measurement;
    if (points.length < 2) return false;

    const previous = points[points.length - 2].position;
    const current = points[points.length - 1].position;
    if (previous.distanceTo(current) > tolerance) return false;

    measurement.removeMarker(points.length - 1);
    return true;
}

export function hookMeasurementEvents(
    measurement: Measure,
    onChange: () => void,
    onAdd?: () => void
) {
    const originalAdd = measurement.addMarker.bind(measurement);
    const originalRemove = measurement.removeMarker.bind(measurement);

    measurement.addMarker = (pos) => {
        originalAdd(pos);
        onAdd?.();
        onChange();
    };

    measurement.removeMarker = (index) => {
        originalRemove(index);
        onChange();
    };
}

export function useDoubleClickFinish({
    viewerRef,
    isActive,
    onFinish,
}: UseDoubleClickFinishOptions) {
    useEffect(() => {
        const element = viewerRef.current?.renderer.domElement;
        if (!element || !isActive) return;

        const handleDoubleClick = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            onFinish();
        };

        element.addEventListener('dblclick', handleDoubleClick, true);
        return () => element.removeEventListener('dblclick', handleDoubleClick, true);
    }, [viewerRef, isActive, onFinish]);
}

/**
 * Hook to handle common measurement tool interactions:
 * - Optionally preventing Potree's default right-click behavior
 * - Managing custom context menu position
 */
export function useMeasurementInteraction({
    viewerRef,
    isMeasuring,
    blockRightClick = true,
}: UseMeasurementInteractionOptions): UseMeasurementInteractionReturn {
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

    // Optionally block right-click to prevent Potree's default behavior
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !isMeasuring || !blockRightClick) return;

        const preventPotreeRightClick = (e: MouseEvent) => {
            if (e.button === 2) {
                e.stopImmediatePropagation();
            }
        };

        const element = viewer.renderer.domElement;
        element.addEventListener('mousedown', preventPotreeRightClick, true);
        element.addEventListener('mouseup', preventPotreeRightClick, true);

        return () => {
            element.removeEventListener('mousedown', preventPotreeRightClick, true);
            element.removeEventListener('mouseup', preventPotreeRightClick, true);
        };
    }, [viewerRef, isMeasuring, blockRightClick]);

    // Handle context menu
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            if (isMeasuring) {
                e.preventDefault();
                setMenuPosition({ x: e.clientX, y: e.clientY });
            }
        };

        window.addEventListener('contextmenu', handleContextMenu);
        return () => window.removeEventListener('contextmenu', handleContextMenu);
    }, [isMeasuring]);

    return {
        menuPosition,
        setMenuPosition,
    };
}
