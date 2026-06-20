import { useEffect, useState, useRef, type RefObject } from 'react';
import type { PotreeViewer, Measure } from '@/common/types/potree';
import {
    cancelPotreeInsertion,
    hookMeasurementEvents,
    removeDuplicateTrailingMarker,
    useDoubleClickFinish,
    useMeasurementInteraction,
} from './useMeasurementInteraction';

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

    // Track current active measurement to remove it on cancel
    const activeMeasurementRef = useRef<Measure | null>(null);
    const lastCommittedMeasurementRef = useRef<Measure | null>(null);

    // Track active timers for cleanup
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { menuPosition, setMenuPosition } = useMeasurementInteraction({
        viewerRef,
        isMeasuring,
    });

    // Cleanup timers helper
    const clearTimers = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearTimers();
        };
    }, []);

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

    const isValidAreaMeasurement = (measurement: Measure) => {
        return measurement.points.length >= 3;
    };

    const findLastCommittedAreaMeasurement = () => {
        const viewer = viewerRef.current;
        if (!viewer?.scene?.measurements) return null;

        return (
            viewer.scene.measurements
                .filter((measurement) => {
                    return (
                        measurement !== activeMeasurementRef.current &&
                        measurement.name === 'Plotas' &&
                        isValidAreaMeasurement(measurement)
                    );
                })
                .at(-1) ?? null
        );
    };

    const removeAreaMeasurements = (viewer: PotreeViewer) => {
        const measurements = [...viewer.scene.measurements].filter((measurement) => {
            return measurement.name === 'Plotas';
        });

        measurements.forEach((measurement) => viewer.scene.removeMeasurement(measurement));
        lastCommittedMeasurementRef.current = null;
    };

    const startAreaMeasurement = (viewer: PotreeViewer) => {
        const measurement = viewer.measuringTool.startInsertion({
            showDistances: true,
            showArea: true,
            showAngles: false,
            closed: true,
            name: 'Plotas',
        });

        activeMeasurementRef.current = measurement;
        hookMeasurementEvents(measurement, updateTotalArea);
        return measurement;
    };

    const finishAreaMeasurement = () => {
        const viewer = viewerRef.current;
        const measurement = activeMeasurementRef.current;
        if (!viewer || !measurement) return;

        cancelPotreeInsertion(viewer);
        removeDuplicateTrailingMarker(measurement);
        clearTimers();

        if (isValidAreaMeasurement(measurement)) {
            lastCommittedMeasurementRef.current = measurement;
        } else {
            viewer.scene.removeMeasurement(measurement);
            lastCommittedMeasurementRef.current = findLastCommittedAreaMeasurement();
        }

        startAreaMeasurement(viewer);
        updateTotalArea();
    };

    useDoubleClickFinish({
        viewerRef,
        isActive: isMeasuring,
        onFinish: finishAreaMeasurement,
    });

    // Initial update
    useEffect(() => {
        const t = setTimeout(() => {
            updateTotalArea();
        }, 0);
        return () => clearTimeout(t);
    }, [updateTotalArea]);

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
            cancelPotreeInsertion(viewer);

            // Remove the incomplete measurement if it exists
            if (activeMeasurementRef.current) {
                viewer.scene.removeMeasurement(activeMeasurementRef.current);
                activeMeasurementRef.current = null;
            }
            removeAreaMeasurements(viewer);

            setIsMeasuring(false);
            clearTimers();
            updateTotalArea();
            return;
        }

        // Clear any existing timers from previous measurement
        clearTimers();

        setIsMeasuring(true);
        startAreaMeasurement(viewer);
    };

    // Delete last point
    const deleteLastPoint = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const activeMeasurement = activeMeasurementRef.current;
        if (activeMeasurement && activeMeasurement.points.length > 1) {
            activeMeasurement.removeMarker(activeMeasurement.points.length - 2);

            const realPointCount = activeMeasurement.points.length - 1;
            if (realPointCount < 3) {
                viewer.scene.removeMeasurement(activeMeasurement);
                startAreaMeasurement(viewer);
            }

            updateTotalArea();
            return;
        }

        const measurement =
            lastCommittedMeasurementRef.current ?? findLastCommittedAreaMeasurement();
        if (!measurement) return;

        measurement.removeMarker(measurement.points.length - 1);

        if (!isValidAreaMeasurement(measurement)) {
            viewer.scene.removeMeasurement(measurement);
            if (lastCommittedMeasurementRef.current === measurement) {
                lastCommittedMeasurementRef.current = findLastCommittedAreaMeasurement();
            }
        } else {
            lastCommittedMeasurementRef.current = measurement;
        }

        updateTotalArea();
    };

    // Delete all measurements
    const deleteAll = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        activeMeasurementRef.current = null;
        lastCommittedMeasurementRef.current = null;
        viewer.scene.removeAllMeasurements();
        updateTotalArea();

        if (isMeasuring) {
            startAreaMeasurement(viewer);
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
