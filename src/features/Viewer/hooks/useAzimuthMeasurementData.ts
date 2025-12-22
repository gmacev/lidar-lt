import type { RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';

interface UseAzimuthMeasurementDataOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseAzimuthMeasurementDataReturn {
    exportToCsv: (cellId: string) => void;
}

/**
 * Hook for exporting azimuth measurement data to CSV.
 * Exports azimuth, reverse azimuth, distance, and point coordinates.
 */
export function useAzimuthMeasurementData({
    viewerRef,
}: UseAzimuthMeasurementDataOptions): UseAzimuthMeasurementDataReturn {
    const exportToCsv = (cellId: string) => {
        const viewer = viewerRef.current;
        if (!viewer?.scene?.measurements) return;

        const measurements = viewer.scene.measurements.filter((m) => m.name === 'Azimuth');

        if (measurements.length === 0) {
            console.warn('No azimuth measurements to export');
            return;
        }

        const rows: string[] = [];

        // Azimuth summary section
        rows.push('# Azimuth Measurements');
        rows.push(
            'Measurement,From_X,From_Y,From_Z,To_X,To_Y,To_Z,Azimuth_deg,Reverse_Azimuth_deg,Distance_m'
        );

        measurements.forEach((measurement, mIndex) => {
            const points = measurement.points;
            if (points.length >= 2) {
                const p1 = points[0].position;
                const p2 = points[1].position;

                // Calculate azimuth (from North, clockwise)
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dz = p2.z - p1.z;

                let azimuth = Math.atan2(dx, dy) * (180 / Math.PI);
                if (azimuth < 0) azimuth += 360;

                // Reverse azimuth (180° opposite)
                let reverseAzimuth = azimuth + 180;
                if (reverseAzimuth >= 360) reverseAzimuth -= 360;

                // 3D distance
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                rows.push(
                    [
                        mIndex + 1,
                        p1.x.toFixed(3),
                        p1.y.toFixed(3),
                        p1.z.toFixed(3),
                        p2.x.toFixed(3),
                        p2.y.toFixed(3),
                        p2.z.toFixed(3),
                        azimuth.toFixed(2),
                        reverseAzimuth.toFixed(2),
                        distance.toFixed(3),
                    ].join(',')
                );
            }
        });

        const csv = rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `azimuth_${cellId}_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return { exportToCsv };
}
