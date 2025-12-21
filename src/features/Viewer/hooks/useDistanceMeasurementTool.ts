import { useEffect, useState, useRef, type RefObject } from 'react';
import type { PotreeViewer, Measure } from '@/common/types/potree';
import { Vector3 } from 'three';
import { useMeasurementInteraction, hookMeasurementEvents } from './useMeasurementInteraction';

interface UseDistanceMeasurementToolOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseDistanceMeasurementToolReturn {
    isMeasuring: boolean;
    totalDistance: number;
    toggleDistanceMeasurement: () => void;
    menuPosition: { x: number; y: number } | null;
    setMenuPosition: (pos: { x: number; y: number } | null) => void;
    deleteLastPoint: () => void;
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

export function useDistanceMeasurementTool({
    viewerRef,
}: UseDistanceMeasurementToolOptions): UseDistanceMeasurementToolReturn {
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [totalDistance, setTotalDistance] = useState(0);

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
        return () => clearTimers();
    }, []);

    const updateTotalDistance = () => {
        const viewer = viewerRef.current;
        if (!viewer?.scene?.measurements) {
            setTotalDistance(0);
            return;
        }

        const total = viewer.scene.measurements
            .filter((m) => m.name === 'Atstumas')
            .reduce((sum, measurement) => {
                return sum + calculateMeasurementDistance(measurement);
            }, 0);

        setTotalDistance(total);
    };

    // Update distance when component mounts (to show existing)
    useEffect(() => {
        const t = setTimeout(() => {
            updateTotalDistance();
        }, 0);
        return () => clearTimeout(t);
    }, [updateTotalDistance]);

    const toggleDistanceMeasurement = () => {
        const viewer = viewerRef.current;
        if (!viewer?.measuringTool) {
            console.warn('MeasuringTool not available');
            return;
        }

        if (isMeasuring) {
            // Cancel
            (
                viewer as unknown as { dispatchEvent: (event: { type: string }) => void }
            ).dispatchEvent({ type: 'cancel_insertions' });

            if (activeMeasurementRef.current) {
                viewer.scene.removeMeasurement(activeMeasurementRef.current);
                activeMeasurementRef.current = null;
            }

            setIsMeasuring(false);
            clearTimers();
            updateTotalDistance(); // Re-calc in case we removed something
            return;
        }

        clearTimers();
        setIsMeasuring(true);

        const measurement = viewer.measuringTool.startInsertion({
            showDistances: true,
            showArea: false,
            showAngles: false,
            closed: false,
            name: 'Atstumas',
        });

        activeMeasurementRef.current = measurement;
        // Hook events for immediate updates
        hookMeasurementEvents(measurement, updateTotalDistance);
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
                        showDistances: true,
                        showArea: false,
                        showAngles: false,
                        closed: false,
                        name: 'Atstumas',
                    });
                    activeMeasurementRef.current = newMeasurement;
                    hookMeasurementEvents(newMeasurement, updateTotalDistance);
                }, 0);
            }
        }
    };

    const deleteAll = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        activeMeasurementRef.current = null;
        viewer.scene.removeAllMeasurements();
        updateTotalDistance(); // Force update since we wiped everything

        if (isMeasuring) {
            const measurement = viewer.measuringTool.startInsertion({
                showDistances: true,
                showArea: false,
                showAngles: false,
                closed: false,
                name: 'Atstumas',
            });
            activeMeasurementRef.current = measurement;
            hookMeasurementEvents(measurement, updateTotalDistance);
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
