import type { RefObject } from 'react';
import { Vector3 } from 'three';
import type { PotreeViewer } from '@/common/types/potree';

interface UseCircleMeasurementDataOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseCircleMeasurementDataReturn {
    exportToCsv: (cellId: string) => void;
}

/**
 * Computes the center of a circle defined by 3 points.
 * Uses the same algorithm as Potree.Utils.computeCircleCenter.
 */
function computeCircleCenter(A: Vector3, B: Vector3, C: Vector3): Vector3 {
    const AB = B.clone().sub(A);
    const AC = C.clone().sub(A);
    const N = AC.clone().cross(AB).normalize();

    const ab_dir = AB.clone().cross(N).normalize();
    const ac_dir = AC.clone().cross(N).normalize();

    const ab_origin = A.clone().add(B).multiplyScalar(0.5);
    const ac_origin = A.clone().add(C).multiplyScalar(0.5);

    const P0 = ab_origin;
    const P1 = ab_origin.clone().add(ab_dir);
    const P2 = ac_origin;
    const P3 = ac_origin.clone().add(ac_dir);

    // Line-to-line intersection
    const P = [P0, P1, P2, P3];
    const d = (m: number, n: number, o: number, p: number): number => {
        return (
            (P[m].x - P[n].x) * (P[o].x - P[p].x) +
            (P[m].y - P[n].y) * (P[o].y - P[p].y) +
            (P[m].z - P[n].z) * (P[o].z - P[p].z)
        );
    };

    const mua =
        (d(0, 2, 3, 2) * d(3, 2, 1, 0) - d(0, 2, 1, 0) * d(3, 2, 3, 2)) /
        (d(1, 0, 1, 0) * d(3, 2, 3, 2) - d(3, 2, 1, 0) * d(3, 2, 1, 0));

    const mub = (d(0, 2, 3, 2) + mua * d(3, 2, 1, 0)) / d(3, 2, 3, 2);

    const P01 = P1.clone().sub(P0);
    const P23 = P3.clone().sub(P2);

    const Pa = P0.clone().add(P01.multiplyScalar(mua));
    const Pb = P2.clone().add(P23.multiplyScalar(mub));

    return Pa.clone().add(Pb).multiplyScalar(0.5);
}

/**
 * Hook for exporting circle measurement data to CSV.
 * Exports computed circle properties (center, radius, etc.) plus the 3 defining points.
 */
export function useCircleMeasurementData({
    viewerRef,
}: UseCircleMeasurementDataOptions): UseCircleMeasurementDataReturn {
    const exportToCsv = (cellId: string) => {
        const viewer = viewerRef.current;
        if (!viewer?.scene?.measurements) return;

        const measurements = viewer.scene.measurements.filter((m) => m.name === 'Circle');

        if (measurements.length === 0) {
            console.warn('No circle measurements to export');
            return;
        }

        const rows: string[] = [];

        // Header for circle properties
        rows.push('# Circle Properties');
        rows.push(
            'Measurement,Center_X,Center_Y,Center_Z,Radius_m,Diameter_m,Circumference_m,Area_m2'
        );

        measurements.forEach((measurement, mIndex) => {
            if (measurement.points.length === 3) {
                const A = measurement.points[0].position;
                const B = measurement.points[1].position;
                const C = measurement.points[2].position;

                const center = computeCircleCenter(A, B, C);
                const radius = center.distanceTo(A);
                const diameter = radius * 2;
                const circumference = 2 * Math.PI * radius;
                const area = Math.PI * radius * radius;

                rows.push(
                    `${mIndex + 1},${center.x.toFixed(3)},${center.y.toFixed(3)},${center.z.toFixed(3)},${radius.toFixed(3)},${diameter.toFixed(3)},${circumference.toFixed(3)},${area.toFixed(3)}`
                );
            }
        });

        // Add defining points section
        rows.push('');
        rows.push('# Defining Points (3 points on circle perimeter)');
        rows.push('Measurement,Point,X,Y,Z');

        measurements.forEach((measurement, mIndex) => {
            measurement.points.forEach((point, pIndex) => {
                const p = point.position;
                rows.push(
                    `${mIndex + 1},${pIndex + 1},${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`
                );
            });
        });

        const csv = rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `circle_${cellId}_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return { exportToCsv };
}
