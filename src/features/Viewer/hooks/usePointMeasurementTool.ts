import { useRef, useState, type RefObject } from 'react';
import type { Measure, PotreeViewer } from '@/common/types/potree';
import { downloadCsv } from '@/common/utils/downloadCsv';
import { useMeasurementInteraction } from './useMeasurementInteraction';

interface UsePointMeasurementToolOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

function cancelPendingDrag(viewer: PotreeViewer) {
    viewer.inputHandler.drag = null;
}

/** Keep placing native Potree coordinate markers until the tool is turned off. */
export function usePointMeasurementTool({ viewerRef }: UsePointMeasurementToolOptions) {
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [pointCount, setPointCount] = useState(0);
    const isMeasuringRef = useRef(false);
    const pendingMeasurementRef = useRef<Measure | null>(null);
    const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { menuPosition, setMenuPosition } = useMeasurementInteraction({ viewerRef, isMeasuring });

    const clearRestart = () => {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
    };

    const committedPoints = (viewer: PotreeViewer) =>
        viewer.scene.measurements.filter(
            (measurement) =>
                measurement.name === 'Point' && measurement !== pendingMeasurementRef.current
        );

    const startPointMeasurement = (viewer: PotreeViewer) => {
        const measurement = viewer.measuringTool.startInsertion({
            showDistances: false,
            showAngles: false,
            showCoordinates: true,
            showArea: false,
            closed: true,
            maxMarkers: 1,
            name: 'Point',
        });
        pendingMeasurementRef.current = measurement;

        let hasPickedPoint = false;
        measurement.addEventListener('marker_moved', () => {
            hasPickedPoint = true;
        });
        measurement.addEventListener('marker_dropped', () => {
            if (pendingMeasurementRef.current !== measurement) return;

            pendingMeasurementRef.current = null;
            if (hasPickedPoint) {
                setPointCount((count) => count + 1);
            } else {
                viewer.scene.removeMeasurement(measurement);
            }

            // Potree clears its drag after dispatching the drop event. Start the next
            // insertion on the following task so that drag remains active.
            restartTimerRef.current = setTimeout(() => {
                restartTimerRef.current = null;
                if (isMeasuringRef.current && viewerRef.current === viewer) {
                    startPointMeasurement(viewer);
                }
            }, 0);
        });
    };

    const togglePointMeasurement = () => {
        const viewer = viewerRef.current;
        if (!viewer?.measuringTool) return;

        if (isMeasuring) {
            isMeasuringRef.current = false;
            clearRestart();
            if (pendingMeasurementRef.current) {
                pendingMeasurementRef.current = null;
                cancelPendingDrag(viewer);
            }
            [...viewer.scene.measurements]
                .filter((measurement) => measurement.name === 'Point')
                .forEach((measurement) => viewer.scene.removeMeasurement(measurement));
            setPointCount(0);
            setMenuPosition(null);
            setIsMeasuring(false);
            return;
        }

        isMeasuringRef.current = true;
        setPointCount(committedPoints(viewer).length);
        setIsMeasuring(true);
        startPointMeasurement(viewer);
    };

    const deleteLastPoint = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        const last = committedPoints(viewer).at(-1);
        if (!last) return;
        viewer.scene.removeMeasurement(last);
        setPointCount((count) => Math.max(0, count - 1));
    };

    const deleteAll = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        clearRestart();
        pendingMeasurementRef.current = null;
        viewer.scene.removeAllMeasurements();
        cancelPendingDrag(viewer);
        setPointCount(0);
        if (isMeasuringRef.current) startPointMeasurement(viewer);
    };

    const exportToCsv = (cellId: string) => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        const points = committedPoints(viewer);
        if (points.length === 0) return;

        const rows = ['Point,X,Y,Height_m'];
        points.forEach((measurement, index) => {
            const position = measurement.points[0].position;
            rows.push(
                `${index + 1},${position.x.toFixed(3)},${position.y.toFixed(3)},${position.z.toFixed(3)}`
            );
        });
        downloadCsv(
            rows.join('\n'),
            `point_${cellId}_${new Date().toISOString().slice(0, 10)}.csv`
        );
    };

    return {
        isMeasuring,
        pointCount,
        togglePointMeasurement,
        menuPosition,
        setMenuPosition,
        deleteLastPoint,
        deleteAll,
        exportToCsv,
    };
}
