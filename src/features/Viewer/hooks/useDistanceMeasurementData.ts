import { type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import { downloadCsv } from '@/common/utils/downloadCsv';

interface UseDistanceMeasurementDataOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseDistanceMeasurementDataReturn {
    exportToCsv: (cellId: string) => void;
}

export function useDistanceMeasurementData({
    viewerRef,
}: UseDistanceMeasurementDataOptions): UseDistanceMeasurementDataReturn {
    const exportToCsv = (cellId: string) => {
        const viewer = viewerRef.current;
        if (!viewer || !viewer.scene || !viewer.scene.measurements) return;

        // Find the active distance measurement (assuming only one is "active" or we take the last one added)
        // For simplicity and to match user expectation of "exporting what I just drew",
        // we'll look for a measurement that has points.
        // If there are multiple, we might need a better selection logic, but typically users clear or just want the last one.
        // Let's grab the last measurement that is NOT an area (area measurements have .showArea = true)

        const measurements = viewer.scene.measurements.filter(
            (m) => !m.showArea && m.points.length > 0
        );

        if (measurements.length === 0) return;

        // Take the last one added
        const measurement = measurements[measurements.length - 1];

        const header = 'Point_Index,X,Y,Z,Cumulative_Distance_m,Segment_Distance_m\n';

        let runningDist = 0;
        const rows = measurement.points
            .map((p, index) => {
                const x = p.position.x.toFixed(3);
                const y = p.position.y.toFixed(3);
                const z = p.position.z.toFixed(3);

                let segmentDist = 0;
                if (index > 0) {
                    segmentDist = p.position.distanceTo(measurement.points[index - 1].position);
                    runningDist += segmentDist;
                }

                return `${index + 1},${x},${y},${z},${runningDist.toFixed(3)},${segmentDist.toFixed(3)}`;
            })
            .join('\n');

        downloadCsv(
            header + rows,
            `distance_meas_${cellId}_${new Date().toISOString().slice(0, 10)}.csv`
        );
    };

    return { exportToCsv };
}
