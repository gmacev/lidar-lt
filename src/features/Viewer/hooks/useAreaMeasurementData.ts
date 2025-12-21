import { type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import { downloadCsv } from '@/common/utils/downloadCsv';

interface UseAreaMeasurementDataOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseAreaMeasurementDataReturn {
    exportToCsv: (cellId: string) => void;
}

export function useAreaMeasurementData({
    viewerRef,
}: UseAreaMeasurementDataOptions): UseAreaMeasurementDataReturn {
    const exportToCsv = (cellId: string) => {
        const viewer = viewerRef.current;
        if (!viewer || !viewer.scene || !viewer.scene.measurements) return;

        // Find the last area measurement
        const measurements = viewer.scene.measurements.filter(
            (m) => m.showArea && m.points.length > 0
        );

        if (measurements.length === 0) return;

        // Take the last one added
        const measurement = measurements[measurements.length - 1];

        // Check if getArea exists and is a function
        const totalArea =
            typeof measurement.getArea === 'function' ? measurement.getArea().toFixed(2) : 'N/A';

        const header = `Total_Area_m2,${totalArea}\n\nVertex_Index,X,Y,Z\n`;

        const rows = measurement.points
            .map((p, index) => {
                const x = p.position.x.toFixed(3);
                const y = p.position.y.toFixed(3);
                const z = p.position.z.toFixed(3);
                return `${index + 1},${x},${y},${z}`;
            })
            .join('\n');

        downloadCsv(
            header + rows,
            `area_meas_${cellId}_${new Date().toISOString().slice(0, 10)}.csv`
        );
    };

    return { exportToCsv };
}
