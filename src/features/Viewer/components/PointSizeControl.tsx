import { useState } from 'react';
import type { PotreeViewer } from '@/types/potree';
import { POINT_SIZE_DEFAULTS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

interface PointSizeControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function PointSizeControl({ viewerRef, initialState, updateUrl }: PointSizeControlProps) {
    const [pointSize, setPointSize] = useState(initialState.ps ?? POINT_SIZE_DEFAULTS.size);

    const handlePointSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const size = parseFloat(e.target.value);
        setPointSize(size);

        // Update all point clouds in the viewer (intentionally mutating Potree state)
        const viewer = viewerRef.current;
        if (viewer?.scene?.pointclouds) {
            for (const pointcloud of viewer.scene.pointclouds) {
                const material = pointcloud.material;
                // eslint-disable-next-line react-compiler/react-compiler, react-hooks/immutability -- Intentionally mutating external Potree state
                material.size = size;
            }
        }
        updateUrl({ ps: size });
    };

    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs text-white/70 flex justify-between">
                Taškų dydis
                <span className="text-laser-green">{pointSize.toFixed(1)}</span>
            </label>
            <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={pointSize}
                onChange={handlePointSizeChange}
                className="w-full accent-laser-green"
            />
        </div>
    );
}
