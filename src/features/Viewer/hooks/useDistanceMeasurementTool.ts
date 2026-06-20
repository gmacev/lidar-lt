import { useEffect, useState, useRef, type RefObject } from 'react';
import type { PotreeViewer, Measure } from '@/common/types/potree';
import { Vector3 } from 'three';
import {
    cancelPotreeInsertion,
    hookMeasurementEvents,
    removeDuplicateTrailingMarker,
    useDoubleClickFinish,
    useMeasurementInteraction,
} from './useMeasurementInteraction';

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
    const lastCommittedMeasurementRef = useRef<Measure | null>(null);
    const markersAddedSinceStartRef = useRef(0);
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

    const isValidDistanceMeasurement = (measurement: Measure) => {
        return measurement.points.length >= 2 && calculateMeasurementDistance(measurement) > 0.01;
    };

    const findLastCommittedDistanceMeasurement = () => {
        const viewer = viewerRef.current;
        if (!viewer?.scene?.measurements) return null;

        return (
            viewer.scene.measurements
                .filter((measurement) => {
                    return (
                        measurement !== activeMeasurementRef.current &&
                        measurement.name === 'Atstumas' &&
                        isValidDistanceMeasurement(measurement)
                    );
                })
                .at(-1) ?? null
        );
    };

    const removeDistanceMeasurements = (viewer: PotreeViewer) => {
        const measurements = [...viewer.scene.measurements].filter((measurement) => {
            return measurement.name === 'Atstumas';
        });

        measurements.forEach((measurement) => viewer.scene.removeMeasurement(measurement));
        lastCommittedMeasurementRef.current = null;
    };

    const startDistanceMeasurement = (viewer: PotreeViewer) => {
        markersAddedSinceStartRef.current = 0;

        const measurement = viewer.measuringTool.startInsertion({
            showDistances: true,
            showArea: false,
            showAngles: false,
            closed: false,
            name: 'Atstumas',
        });

        activeMeasurementRef.current = measurement;
        hookMeasurementEvents(measurement, updateTotalDistance, () => {
            markersAddedSinceStartRef.current += 1;
        });
        return measurement;
    };

    const finishDistanceMeasurement = () => {
        const viewer = viewerRef.current;
        const measurement = activeMeasurementRef.current;
        if (!viewer || !measurement) return;

        cancelPotreeInsertion(viewer);
        removeDuplicateTrailingMarker(measurement);
        clearTimers();

        if (markersAddedSinceStartRef.current > 2 && isValidDistanceMeasurement(measurement)) {
            lastCommittedMeasurementRef.current = measurement;
        } else {
            viewer.scene.removeMeasurement(measurement);
            lastCommittedMeasurementRef.current = findLastCommittedDistanceMeasurement();
        }

        startDistanceMeasurement(viewer);
        updateTotalDistance();
    };

    useDoubleClickFinish({
        viewerRef,
        isActive: isMeasuring,
        onFinish: finishDistanceMeasurement,
    });

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
            cancelPotreeInsertion(viewer);

            if (activeMeasurementRef.current) {
                viewer.scene.removeMeasurement(activeMeasurementRef.current);
                activeMeasurementRef.current = null;
            }
            removeDistanceMeasurements(viewer);

            setIsMeasuring(false);
            clearTimers();
            updateTotalDistance(); // Re-calc in case we removed something
            return;
        }

        clearTimers();
        setIsMeasuring(true);
        startDistanceMeasurement(viewer);
    };

    const deleteLastPoint = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const activeMeasurement = activeMeasurementRef.current;
        if (activeMeasurement && activeMeasurement.points.length > 1) {
            activeMeasurement.removeMarker(activeMeasurement.points.length - 2);
            updateTotalDistance();
            return;
        }

        const measurement =
            lastCommittedMeasurementRef.current ?? findLastCommittedDistanceMeasurement();
        if (!measurement) return;

        measurement.removeMarker(measurement.points.length - 1);

        if (!isValidDistanceMeasurement(measurement)) {
            viewer.scene.removeMeasurement(measurement);
            if (lastCommittedMeasurementRef.current === measurement) {
                lastCommittedMeasurementRef.current = findLastCommittedDistanceMeasurement();
            }
        } else {
            lastCommittedMeasurementRef.current = measurement;
        }

        updateTotalDistance();
    };

    const deleteAll = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        activeMeasurementRef.current = null;
        lastCommittedMeasurementRef.current = null;
        viewer.scene.removeAllMeasurements();
        updateTotalDistance(); // Force update since we wiped everything

        if (isMeasuring) {
            startDistanceMeasurement(viewer);
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
