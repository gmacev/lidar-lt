import { useEffect, useState, useRef, type RefObject } from 'react';
import type { PotreeViewer, Measure } from '@/types/potree';
import { Vector3 } from 'three';

interface UseMeasurementToolOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseMeasurementToolReturn {
    /** Whether a measurement is currently being inserted */
    isMeasuring: boolean;
    /** Total distance of all measurements in meters */
    totalDistance: number;
    /** Toggle distance measurement - starts if not active, cancels if active */
    toggleDistanceMeasurement: () => void;
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
 * Calculate total distance for a single measurement (sum of all segments)
 */
function calculateMeasurementDistance(measurement: Measure): number {
    const points = measurement.points;
    if (points.length < 2) return 0;

    let total = 0;
    for (let i = 1; i < points.length; i++) {
        const p1 = new Vector3().copy(points[i - 1].position);
        const p2 = new Vector3().copy(points[i].position);
        total += p1.distanceTo(p2);
    }
    return total;
}

/**
 * Hook for measurement tool functionality.
 * - Tracks whether user is actively measuring
 * - Calculates total distance across all measurements
 * - Enables right-click to delete measurements
 * - Provides functions to start measurements
 */
export function useMeasurementTool({
    viewerRef,
}: UseMeasurementToolOptions): UseMeasurementToolReturn {
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [totalDistance, setTotalDistance] = useState(0);
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

    // Track current active measurement to remove it on cancel
    const activeMeasurementRef = useRef<Measure | null>(null);

    // Track active timers for cleanup
    const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const distanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
            if (distanceIntervalRef.current) {
                clearInterval(distanceIntervalRef.current);
            }
        };
    }, []);

    // Poll total distance from all measurements
    useEffect(() => {
        const updateTotalDistance = () => {
            const viewer = viewerRef.current;
            if (!viewer?.scene?.measurements) {
                setTotalDistance(0);
                return;
            }

            const total = viewer.scene.measurements.reduce((sum, measurement) => {
                return sum + calculateMeasurementDistance(measurement);
            }, 0);

            setTotalDistance(total);
        };

        // Update immediately and then poll
        updateTotalDistance();
        distanceIntervalRef.current = setInterval(updateTotalDistance, 200);

        return () => {
            if (distanceIntervalRef.current) {
                clearInterval(distanceIntervalRef.current);
            }
        };
    }, [viewerRef]);

    // Toggle distance measurement (start or cancel)
    const toggleDistanceMeasurement = () => {
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

        // Start distance measurement with Potree's built-in tool
        const measurement = viewer.measuringTool.startInsertion({
            showDistances: true,
            showArea: false,
            showAngles: false,
            closed: false,
            name: 'Atstumas',
        });

        activeMeasurementRef.current = measurement;

        // Safety timeout - clear after 60 seconds
        timeoutRef.current = setTimeout(() => {
            clearTimers();
            setIsMeasuring(false);
            activeMeasurementRef.current = null;
        }, 60000);
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

        // Remove active measurement reference handling
        activeMeasurementRef.current = null;

        // Remove all measurements from scene
        viewer.scene.removeAllMeasurements();

        // Reset state but keep measuring active if currently measuring
        if (isMeasuring) {
            // Restart insertion
            const measurement = viewer.measuringTool.startInsertion({
                showDistances: true,
                showArea: false,
                showAngles: false,
                showCoordinates: true,
                closed: false,
                name: 'Atstumas',
            });
            activeMeasurementRef.current = measurement;
        }
    };

    return {
        isMeasuring,
        totalDistance,
        toggleDistanceMeasurement,
        menuPosition,
        setMenuPosition,
        deleteLastPoint,
        deleteAll,
    };
}
