import { useEffect, useState, useRef, type RefObject } from 'react';
import type { PotreeViewer, Measure } from '@/common/types/potree';
import { useMeasurementInteraction, hookMeasurementEvents } from './useMeasurementInteraction';

interface UseAngleMeasurementToolOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseAngleMeasurementToolReturn {
    isMeasuring: boolean;
    pointCount: number;
    toggleAngleMeasurement: () => void;
    menuPosition: { x: number; y: number } | null;
    setMenuPosition: (pos: { x: number; y: number } | null) => void;
    deleteLastPoint: () => void;
    deleteAll: () => void;
}

/**
 * Hook for angle measurement tool functionality.
 * Creates a closed triangle with 3 points, showing angles at each vertex.
 */
export function useAngleMeasurementTool({
    viewerRef,
}: UseAngleMeasurementToolOptions): UseAngleMeasurementToolReturn {
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [pointCount, setPointCount] = useState(0);

    const activeMeasurementRef = useRef<Measure | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { menuPosition, setMenuPosition } = useMeasurementInteraction({
        viewerRef,
        isMeasuring,
    });

    const clearTimers = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            clearTimers();
        };
    }, []);

    const updatePointCount = () => {
        if (activeMeasurementRef.current) {
            setPointCount(activeMeasurementRef.current.points.length);
        } else {
            setPointCount(0);
        }
    };

    const toggleAngleMeasurement = () => {
        const viewer = viewerRef.current;
        if (!viewer?.measuringTool) {
            console.warn('MeasuringTool not available');
            return;
        }

        if (isMeasuring) {
            (
                viewer as unknown as { dispatchEvent: (event: { type: string }) => void }
            ).dispatchEvent({ type: 'cancel_insertions' });

            if (activeMeasurementRef.current) {
                viewer.scene.removeMeasurement(activeMeasurementRef.current);
                activeMeasurementRef.current = null;
            }

            setIsMeasuring(false);
            setPointCount(0);
            clearTimers();
            return;
        }

        clearTimers();
        setIsMeasuring(true);

        const measurement = viewer.measuringTool.startInsertion({
            showDistances: false,
            showArea: false,
            showAngles: true,
            closed: true,
            name: 'Angle',
        });

        activeMeasurementRef.current = measurement;
        // Hook events for immediate updates
        hookMeasurementEvents(measurement, updatePointCount);
        // Initialize count
        updatePointCount();
    };

    const deleteLastPoint = () => {
        const viewer = viewerRef.current;
        if (!activeMeasurementRef.current || !viewer) return;
        const measurement = activeMeasurementRef.current;
        if (measurement.points.length > 0) {
            measurement.removeMarker(measurement.points.length - 1);

            // If all points deleted, restart the measurement
            if (measurement.points.length === 0) {
                setTimeout(() => {
                    viewer.scene.removeMeasurement(measurement);
                    const newMeasurement = viewer.measuringTool.startInsertion({
                        showDistances: false,
                        showArea: false,
                        showAngles: true,
                        closed: true,
                        name: 'Angle',
                    });
                    activeMeasurementRef.current = newMeasurement;
                    hookMeasurementEvents(newMeasurement, updatePointCount);
                    updatePointCount();
                }, 0);
            }
        }
    };

    const deleteAll = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        activeMeasurementRef.current = null;
        viewer.scene.removeAllMeasurements();
        setPointCount(0);

        if (isMeasuring) {
            const measurement = viewer.measuringTool.startInsertion({
                showDistances: false,
                showArea: false,
                showAngles: true,
                closed: true,
                name: 'Angle',
            });
            activeMeasurementRef.current = measurement;
            hookMeasurementEvents(measurement, updatePointCount);
            updatePointCount();
        }
    };

    return {
        isMeasuring,
        pointCount,
        toggleAngleMeasurement,
        menuPosition,
        setMenuPosition,
        deleteLastPoint,
        deleteAll,
    };
}
