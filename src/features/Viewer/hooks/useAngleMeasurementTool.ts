import { useEffect, useState, useRef, type RefObject } from 'react';
import type { PotreeViewer, Measure } from '@/common/types/potree';
import {
    cancelPotreeInsertion,
    hookMeasurementEvents,
    removeDuplicateTrailingMarker,
    useDoubleClickFinish,
    useMeasurementInteraction,
} from './useMeasurementInteraction';

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
    const lastCommittedMeasurementRef = useRef<Measure | null>(null);
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

    const isValidAngleMeasurement = (measurement: Measure) => {
        return measurement.points.length >= 3;
    };

    const findLastCommittedAngleMeasurement = () => {
        const viewer = viewerRef.current;
        if (!viewer?.scene?.measurements) return null;

        return (
            viewer.scene.measurements
                .filter((measurement) => {
                    return (
                        measurement !== activeMeasurementRef.current &&
                        measurement.name === 'Angle' &&
                        isValidAngleMeasurement(measurement)
                    );
                })
                .at(-1) ?? null
        );
    };

    const removeAngleMeasurements = (viewer: PotreeViewer) => {
        const measurements = [...viewer.scene.measurements].filter((measurement) => {
            return measurement.name === 'Angle';
        });

        measurements.forEach((measurement) => viewer.scene.removeMeasurement(measurement));
        lastCommittedMeasurementRef.current = null;
    };

    const startAngleMeasurement = (viewer: PotreeViewer) => {
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
        return measurement;
    };

    const finishAngleMeasurement = () => {
        const viewer = viewerRef.current;
        const measurement = activeMeasurementRef.current;
        if (!viewer || !measurement) return;

        cancelPotreeInsertion(viewer);
        removeDuplicateTrailingMarker(measurement);
        clearTimers();

        if (isValidAngleMeasurement(measurement)) {
            lastCommittedMeasurementRef.current = measurement;
        } else {
            viewer.scene.removeMeasurement(measurement);
            lastCommittedMeasurementRef.current = findLastCommittedAngleMeasurement();
        }

        startAngleMeasurement(viewer);
    };

    useDoubleClickFinish({
        viewerRef,
        isActive: isMeasuring,
        onFinish: finishAngleMeasurement,
    });

    const toggleAngleMeasurement = () => {
        const viewer = viewerRef.current;
        if (!viewer?.measuringTool) {
            console.warn('MeasuringTool not available');
            return;
        }

        if (isMeasuring) {
            cancelPotreeInsertion(viewer);

            if (activeMeasurementRef.current) {
                viewer.scene.removeMeasurement(activeMeasurementRef.current);
                activeMeasurementRef.current = null;
            }
            removeAngleMeasurements(viewer);

            setIsMeasuring(false);
            setPointCount(0);
            clearTimers();
            return;
        }

        clearTimers();
        setIsMeasuring(true);
        startAngleMeasurement(viewer);
    };

    const deleteLastPoint = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const activeMeasurement = activeMeasurementRef.current;
        if (activeMeasurement && activeMeasurement.points.length > 1) {
            activeMeasurement.removeMarker(activeMeasurement.points.length - 2);

            const realPointCount = activeMeasurement.points.length - 1;
            if (realPointCount < 3) {
                viewer.scene.removeMeasurement(activeMeasurement);
                startAngleMeasurement(viewer);
            }

            updatePointCount();
            return;
        }

        const measurement =
            lastCommittedMeasurementRef.current ?? findLastCommittedAngleMeasurement();
        if (!measurement) return;

        measurement.removeMarker(measurement.points.length - 1);

        if (!isValidAngleMeasurement(measurement)) {
            viewer.scene.removeMeasurement(measurement);
            if (lastCommittedMeasurementRef.current === measurement) {
                lastCommittedMeasurementRef.current = findLastCommittedAngleMeasurement();
            }
        } else {
            lastCommittedMeasurementRef.current = measurement;
        }

        updatePointCount();
    };

    const deleteAll = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        activeMeasurementRef.current = null;
        lastCommittedMeasurementRef.current = null;
        viewer.scene.removeAllMeasurements();
        setPointCount(0);

        if (isMeasuring) {
            startAngleMeasurement(viewer);
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
