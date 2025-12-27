import { type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import { downloadCsv } from '@/common/utils/downloadCsv';

interface UseVolumeMeasurementDataOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseVolumeMeasurementDataReturn {
    exportToCsv: (cellId: string) => void;
}

/**
 * Hook for exporting volume measurement data to CSV.
 * Exports volume summary (dimensions, center, volume) for each box volume.
 */
export function useVolumeMeasurementData({
    viewerRef,
}: UseVolumeMeasurementDataOptions): UseVolumeMeasurementDataReturn {
    const exportToCsv = (cellId: string) => {
        const viewer = viewerRef.current;
        if (!viewer?.scene?.volumes) return;

        const volumes = viewer.scene.volumes;

        if (volumes.length === 0) {
            console.warn('No volumes to export');
            return;
        }

        const rows: string[] = [];

        // Summary section
        rows.push('# Volume Measurement Summary');
        rows.push(
            'Volume_Index,Name,Center_X,Center_Y,Center_Z,Width_m,Depth_m,Height_m,Volume_m3'
        );

        volumes.forEach((volume, index) => {
            const pos = volume.position;
            const scale = volume.scale;
            // BoxVolume extends Object3D so it has rotation
            const rotation = (
                volume as unknown as {
                    rotation: { x: number; y: number; z: number };
                }
            ).rotation;

            const vol = typeof volume.getVolume === 'function' ? volume.getVolume() : 0;

            const toDeg = (rad: number) => (rad * 180) / Math.PI;

            rows.push(
                [
                    index + 1,
                    volume.name || 'Volume',
                    pos.x.toFixed(3),
                    pos.y.toFixed(3),
                    pos.z.toFixed(3),
                    toDeg(rotation.x).toFixed(3),
                    toDeg(rotation.y).toFixed(3),
                    toDeg(rotation.z).toFixed(3),
                    Math.abs(scale.x).toFixed(3),
                    Math.abs(scale.y).toFixed(3),
                    Math.abs(scale.z).toFixed(3),
                    vol.toFixed(3),
                ].join(',')
            );
        });

        // Total volume
        const totalVolume = volumes.reduce((sum, v) => {
            return sum + (typeof v.getVolume === 'function' ? v.getVolume() : 0);
        }, 0);

        rows.push('');
        rows.push(`# Total Volume: ${totalVolume.toFixed(3)} m³`);

        downloadCsv(
            rows.join('\n'),
            `volume_meas_${cellId}_${new Date().toISOString().slice(0, 10)}.csv`
        );
    };

    return { exportToCsv };
}
