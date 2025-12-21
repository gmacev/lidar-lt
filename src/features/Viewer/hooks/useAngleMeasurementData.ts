import { type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import { downloadCsv } from '@/common/utils/downloadCsv';
import { Vector3 } from 'three';

interface UseAngleMeasurementDataOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseAngleMeasurementDataReturn {
    exportToCsv: (cellId: string) => void;
}

/**
 * Calculate angle at vertex B given points A, B, C
 */
function calculateAngle(a: Vector3, b: Vector3, c: Vector3): number {
    const ba = new Vector3().subVectors(a, b);
    const bc = new Vector3().subVectors(c, b);

    const dot = ba.dot(bc);
    const magBA = ba.length();
    const magBC = bc.length();

    if (magBA === 0 || magBC === 0) return 0;

    const cosAngle = dot / (magBA * magBC);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    return (angle * 180) / Math.PI;
}

export function useAngleMeasurementData({
    viewerRef,
}: UseAngleMeasurementDataOptions): UseAngleMeasurementDataReturn {
    const exportToCsv = (cellId: string) => {
        const viewer = viewerRef.current;
        if (!viewer || !viewer.scene || !viewer.scene.measurements) return;

        // Find angle measurements (name = 'Angle') with at least 3 points
        const measurements = viewer.scene.measurements.filter(
            (m) => m.name === 'Angle' && m.points.length >= 3
        );

        if (measurements.length === 0) return;

        // Take the last one added
        const measurement = measurements[measurements.length - 1];
        const points = measurement.points;
        const n = points.length;

        // Calculate interior angles at each vertex for a closed polygon
        const angles: number[] = [];
        for (let i = 0; i < n; i++) {
            const prev = points[(i - 1 + n) % n].position;
            const curr = points[i].position;
            const next = points[(i + 1) % n].position;
            angles.push(calculateAngle(prev, curr, next));
        }

        const totalAngle = angles.reduce((sum, a) => sum + a, 0);

        // CSV Structure: metadata first, then vertex list with angles
        const header = `Total_Angles_deg,${totalAngle.toFixed(2)}\nNum_Vertices,${n}\n\nVertex_Index,X,Y,Z,Angle_deg\n`;

        const rows = points
            .map((p, i) => {
                const pos = p.position;
                return `${i + 1},${pos.x.toFixed(3)},${pos.y.toFixed(3)},${pos.z.toFixed(3)},${angles[i].toFixed(2)}`;
            })
            .join('\n');

        downloadCsv(
            header + rows,
            `angle_meas_${cellId}_${new Date().toISOString().slice(0, 10)}.csv`
        );
    };

    return { exportToCsv };
}
