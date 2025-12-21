import { useState, useEffect, type RefObject } from 'react';
import type { Measure, PotreeViewer } from '@/common/types/potree';

interface UseMeasurementInteractionOptions {
    viewerRef: RefObject<PotreeViewer | null>;
    isMeasuring: boolean;
}

interface UseMeasurementInteractionReturn {
    menuPosition: { x: number; y: number } | null;
    setMenuPosition: (pos: { x: number; y: number } | null) => void;
}

export function hookMeasurementEvents(measurement: Measure, onChange: () => void) {
    const originalAdd = measurement.addMarker.bind(measurement);
    const originalRemove = measurement.removeMarker.bind(measurement);

    measurement.addMarker = (pos) => {
        originalAdd(pos);
        onChange();
    };

    measurement.removeMarker = (index) => {
        originalRemove(index);
        onChange();
    };
}

/**
 * Hook to handle common measurement tool interactions:
 * - Preventing Potree's default right-click cancel behavior
 * - Managing custom context menu position
 */
export function useMeasurementInteraction({
    viewerRef,
    isMeasuring,
}: UseMeasurementInteractionOptions): UseMeasurementInteractionReturn {
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

    // Prevent Potree's default right-click behavior (cancel measurement)
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !isMeasuring) return;

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
    }, [viewerRef, isMeasuring]);

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
