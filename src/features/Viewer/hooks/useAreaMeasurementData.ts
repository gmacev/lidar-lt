import { type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import { downloadCsv } from '@/common/utils/downloadCsv';

interface UseAreaMeasurementDataOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseAreaMeasurementDataReturn {
    exportToCsv: (cellId: string) => void;
}

/**
 * Hook for exporting area measurement data to CSV.
 * Exports area, perimeter, centroid, and vertex coordinates.
 */
export function useAreaMeasurementData({
    viewerRef,
}: UseAreaMeasurementDataOptions): UseAreaMeasurementDataReturn {
    const exportToCsv = (cellId: string) => {
        const viewer = viewerRef.current;
        if (!viewer?.scene?.measurements) return;

        // Find area measurements
        const measurements = viewer.scene.measurements.filter(
            (m) => m.showArea && m.points.length > 0
        );

        if (measurements.length === 0) return;

        // Take the last one added
        const measurement = measurements[measurements.length - 1];
        const points = measurement.points;

        // Calculate area
        const totalArea = typeof measurement.getArea === 'function' ? measurement.getArea() : 0;

        // Calculate perimeter (sum of all edge lengths, including closing edge)
        let perimeter = 0;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i].position;
            const p2 = points[(i + 1) % points.length].position;
            perimeter += p1.distanceTo(p2);
        }

        // Calculate centroid (average of all vertices)
        let centroidX = 0;
        let centroidY = 0;
        let centroidZ = 0;
        for (const point of points) {
            centroidX += point.position.x;
            centroidY += point.position.y;
            centroidZ += point.position.z;
        }
        centroidX /= points.length;
        centroidY /= points.length;
        centroidZ /= points.length;

        const rows: string[] = [];

        // Summary section
        rows.push('# Area Measurement Summary');
        rows.push('Property,Value');
        rows.push(`Area_m2,${totalArea.toFixed(2)}`);
        rows.push(`Perimeter_m,${perimeter.toFixed(3)}`);
        rows.push(`Vertex_Count,${points.length}`);
        rows.push(`Centroid_X,${centroidX.toFixed(3)}`);
        rows.push(`Centroid_Y,${centroidY.toFixed(3)}`);
        rows.push(`Centroid_Z,${centroidZ.toFixed(3)}`);

        // Vertex coordinates section
        rows.push('');
        rows.push('# Polygon Vertices');
        rows.push('Vertex_Index,X,Y,Z');

        points.forEach((point, index) => {
            const p = point.position;
            rows.push(`${index + 1},${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`);
        });

        downloadCsv(
            rows.join('\n'),
            `area_meas_${cellId}_${new Date().toISOString().slice(0, 10)}.csv`
        );
    };

    return { exportToCsv };
}
