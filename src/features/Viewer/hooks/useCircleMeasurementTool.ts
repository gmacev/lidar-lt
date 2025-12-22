import { useState, useRef, type RefObject } from 'react';
import type { PotreeViewer, Measure } from '@/common/types/potree';
import { useMeasurementInteraction, hookMeasurementEvents } from './useMeasurementInteraction';

interface UseCircleMeasurementToolOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseCircleMeasurementToolReturn {
    isMeasuring: boolean;
    pointCount: number;
    toggleCircleMeasurement: () => void;
    menuPosition: { x: number; y: number } | null;
    setMenuPosition: (pos: { x: number; y: number } | null) => void;
    deleteLastPoint: () => void;
    deleteAll: () => void;
}

/**
 * Hook for circle measurement tool functionality.
 * Measures a circle defined by 3 points.
 * Uses native Potree 'showCircle' functionality.
 */
export function useCircleMeasurementTool({
    viewerRef,
}: UseCircleMeasurementToolOptions): UseCircleMeasurementToolReturn {
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [pointCount, setPointCount] = useState(0);

    const activeMeasurementRef = useRef<Measure | null>(null);

    const { menuPosition, setMenuPosition } = useMeasurementInteraction({
        viewerRef,
        isMeasuring,
    });

    const toggleCircleMeasurement = () => {
        const viewer = viewerRef.current;
        if (!viewer?.measuringTool) {
            console.warn('MeasuringTool not available');
            return;
        }

        if (isMeasuring) {
            // Cancel current measurement
            (
                viewer as unknown as { dispatchEvent: (event: { type: string }) => void }
            ).dispatchEvent({ type: 'cancel_insertions' });

            if (activeMeasurementRef.current) {
                viewer.scene.removeMeasurement(activeMeasurementRef.current);
                activeMeasurementRef.current = null;
            }

            setIsMeasuring(false);
            setPointCount(0);
            return;
        }

        // Start new measurement
        setIsMeasuring(true);

        const measurement = viewer.measuringTool.startInsertion({
            showDistances: false,
            showArea: false,
            showAngles: false,
            showAzimuth: false,
            showCircle: true,
            closed: false,
            name: 'Circle',
            maxMarkers: 3,
        });

        activeMeasurementRef.current = measurement;

        // Hook into adding/removing markers for React state (point count)
        hookMeasurementEvents(measurement, () => {
            if (activeMeasurementRef.current) {
                setPointCount(activeMeasurementRef.current.points.length);
            }
        });

        setPointCount(measurement.points.length);
    };

    const deleteAll = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        activeMeasurementRef.current = null;
        viewer.scene.removeAllMeasurements();
        setPointCount(0);

        if (isMeasuring) {
            // Restart
            const measurement = viewer.measuringTool.startInsertion({
                showDistances: false,
                showArea: false,
                showAngles: false,
                showAzimuth: false,
                showCircle: true,
                closed: false,
                name: 'Circle',
                maxMarkers: 3,
            });
            activeMeasurementRef.current = measurement;

            hookMeasurementEvents(measurement, () => {
                if (activeMeasurementRef.current) {
                    setPointCount(activeMeasurementRef.current.points.length);
                }
            });
        }
    };

    const deleteLastPoint = () => {
        deleteAll();
    };

    return {
        isMeasuring,
        pointCount,
        toggleCircleMeasurement,
        menuPosition,
        setMenuPosition,
        deleteLastPoint,
        deleteAll,
    };
}
