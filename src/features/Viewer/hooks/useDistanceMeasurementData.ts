import { type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import { downloadCsv } from '@/common/utils/downloadCsv';

interface UseDistanceMeasurementDataOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseDistanceMeasurementDataReturn {
    exportToCsv: (cellId: string) => void;
}

/**
 * Hook for exporting distance measurement data to CSV.
 * Exports total distance, point count, and all point coordinates with segment distances.
 */
export function useDistanceMeasurementData({
    viewerRef,
}: UseDistanceMeasurementDataOptions): UseDistanceMeasurementDataReturn {
    const exportToCsv = (cellId: string) => {
        const viewer = viewerRef.current;
        if (!viewer?.scene?.measurements) return;

        const measurements = viewer.scene.measurements.filter(
            (m) => !m.showArea && m.points.length > 0
        );

        if (measurements.length === 0) return;

        // Take the last one added
        const measurement = measurements[measurements.length - 1];
        const points = measurement.points;

        // Calculate total distance
        let totalDistance = 0;
        for (let i = 1; i < points.length; i++) {
            totalDistance += points[i].position.distanceTo(points[i - 1].position);
        }

        const rows: string[] = [];

        // Summary section
        rows.push('# Distance Measurement Summary');
        rows.push('Property,Value');
        rows.push(`Total_Distance_m,${totalDistance.toFixed(3)}`);
        rows.push(`Point_Count,${points.length}`);
        rows.push(`Segment_Count,${points.length - 1}`);

        // Point coordinates section
        rows.push('');
        rows.push('# Point Coordinates');
        rows.push('Point_Index,X,Y,Z,Cumulative_Distance_m,Segment_Distance_m');

        let runningDist = 0;
        points.forEach((p, index) => {
            const x = p.position.x.toFixed(3);
            const y = p.position.y.toFixed(3);
            const z = p.position.z.toFixed(3);

            let segmentDist = 0;
            if (index > 0) {
                segmentDist = p.position.distanceTo(points[index - 1].position);
                runningDist += segmentDist;
            }

            rows.push(
                `${index + 1},${x},${y},${z},${runningDist.toFixed(3)},${segmentDist.toFixed(3)}`
            );
        });

        downloadCsv(
            rows.join('\n'),
            `distance_meas_${cellId}_${new Date().toISOString().slice(0, 10)}.csv`
        );
    };

    return { exportToCsv };
}
