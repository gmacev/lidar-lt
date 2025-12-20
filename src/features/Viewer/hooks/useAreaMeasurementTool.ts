import { useEffect, useState, useRef, type RefObject } from 'react';
import type { PotreeViewer, Measure } from '@/types/potree';

interface UseAreaMeasurementToolOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseAreaMeasurementToolReturn {
    /** Whether a measurement is currently being inserted */
    isMeasuring: boolean;
    /** Total area of all measurements in square meters */
    totalArea: number;
    /** Toggle area measurement - starts if not active, cancels if active */
    toggleAreaMeasurement: () => void;
    /** Context menu position */
    menuPosition: { x: number; y: number } | null;
    /** Set context menu position */
    setMenuPosition: (pos: { x: number; y: number } | null) => void;
    /** Delete the last added point */
    deleteLastPoint: () => void;
    /** Delete all active measurements */
    deleteAll: () => void;
}

/**
 * Hook for area measurement tool functionality.
 * - Tracks whether user is actively measuring area
 * - Calculates total area across all measurements
 * - Enables right-click to delete measurements
 * - Provides functions to start measurements
 */
export function useAreaMeasurementTool({
    viewerRef,
}: UseAreaMeasurementToolOptions): UseAreaMeasurementToolReturn {
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [totalArea, setTotalArea] = useState(0);
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

    // Track current active measurement to remove it on cancel
    const activeMeasurementRef = useRef<Measure | null>(null);

    // Track active timers for cleanup
    const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const areaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Cleanup timers helper
    const clearTimers = () => {
        if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearTimers();
            if (areaIntervalRef.current) {
                clearInterval(areaIntervalRef.current);
            }
        };
    }, []);

    // Poll total area from all measurements
    useEffect(() => {
        const updateTotalArea = () => {
            const viewer = viewerRef.current;
            if (!viewer?.scene?.measurements) {
                setTotalArea(0);
                return;
            }

            // Sum up areas of all measurements that are "Area" (closed polygons)
            const total = viewer.scene.measurements.reduce((sum, measurement) => {
                // Only count measurements that have area enabled or are closed
                // Check if getArea exists (it should per type definition, but good to be safe at runtime)
                if (measurement.showArea && typeof measurement.getArea === 'function') {
                    return sum + measurement.getArea();
                }
                return sum;
            }, 0);

            setTotalArea(total);
        };

        // Update immediately and then poll
        updateTotalArea();
        areaIntervalRef.current = setInterval(updateTotalArea, 200);

        return () => {
            if (areaIntervalRef.current) {
                clearInterval(areaIntervalRef.current);
            }
        };
    }, [viewerRef]);

    // Toggle area measurement (start or cancel)
    const toggleAreaMeasurement = () => {
        const viewer = viewerRef.current;
        if (!viewer?.measuringTool) {
            console.warn('MeasuringTool not available');
            return;
        }

        // If already measuring, cancel it
        if (isMeasuring) {
            // Dispatch cancel_insertions to stop the tool
            (
                viewer as unknown as { dispatchEvent: (event: { type: string }) => void }
            ).dispatchEvent({ type: 'cancel_insertions' });

            // Remove the incomplete measurement if it exists
            if (activeMeasurementRef.current) {
                viewer.scene.removeMeasurement(activeMeasurementRef.current);
                activeMeasurementRef.current = null;
            }

            setIsMeasuring(false);
            clearTimers();
            return;
        }

        // Clear any existing timers from previous measurement
        clearTimers();

        setIsMeasuring(true);

        // Start area measurement with Potree's built-in tool
        const measurement = viewer.measuringTool.startInsertion({
            showDistances: true,
            showArea: true,
            showAngles: false,
            closed: true, // Auto-close polygon
            name: 'Plotas',
        });

        activeMeasurementRef.current = measurement;

        // Safety timeout - clear after 120 seconds (longer for area)
        timeoutRef.current = setTimeout(() => {
            clearTimers();
            setIsMeasuring(false);
            activeMeasurementRef.current = null;
        }, 120000);
    };

    // Prevent Potree's default right-click behavior (cancel measurement) by capturing and stopping propagation
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !isMeasuring) return;

        const preventPotreeRightClick = (e: MouseEvent) => {
            if (e.button === 2) {
                e.stopImmediatePropagation();
            }
        };

        const element = viewer.renderer.domElement;

        // Listen on capture phase to intercept before Potree gets it
        element.addEventListener('mousedown', preventPotreeRightClick, true);
        element.addEventListener('mouseup', preventPotreeRightClick, true);

        return () => {
            element.removeEventListener('mousedown', preventPotreeRightClick, true);
            element.removeEventListener('mouseup', preventPotreeRightClick, true);
        };
    }, [viewerRef, isMeasuring]);

    // Right-click deletion is handled generally by useMeasurementTool usage in the toolbar main component,
    // OR we can rely on the fact that if this hook is used, it cleans up measurements it knows about?
    // Potree measurements are global in the scene.
    // We'll trust the main useMeasurementTool hook or just duplicate the listener here if needed.
    // Since useMeasurementTool is used in the Toolbar alongside this one (potentially),
    // having two listeners for the same right-click might be redundant but harmless if they do the same thing.
    // However, if we don't import useMeasurementTool in the toolbar when only Area is active, we might miss deletion.
    // So safe to include deletion logic here too.

    // Right-click handling for context menu
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

    // Delete last point
    const deleteLastPoint = () => {
        if (!activeMeasurementRef.current) return;
        const measurement = activeMeasurementRef.current;
        if (measurement.points.length > 0) {
            measurement.removeMarker(measurement.points.length - 1);
        }
    };

    // Delete all measurements
    const deleteAll = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        activeMeasurementRef.current = null;
        viewer.scene.removeAllMeasurements();

        if (isMeasuring) {
            const measurement = viewer.measuringTool.startInsertion({
                showDistances: true,
                showArea: true,
                showAngles: false,
                closed: true,
                name: 'Plotas',
            });
            activeMeasurementRef.current = measurement;
        }
    };

    return {
        isMeasuring,
        totalArea,
        toggleAreaMeasurement,
        menuPosition,
        setMenuPosition,
        deleteLastPoint,
        deleteAll,
    };
}
