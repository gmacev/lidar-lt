import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer } from '@/common/types/potree';
import { Z_SCALE_DEFAULTS } from '@/features/Viewer/config/viewerConfig';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

interface ZScaleControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function ZScaleControl({ viewerRef, initialState, updateUrl }: ZScaleControlProps) {
    const { t } = useTranslation();
    const [zScale, setZScale] = useState(initialState.zScale ?? Z_SCALE_DEFAULTS.scale);

    const handleZScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const scale = parseFloat(e.target.value);
        setZScale(scale);

        // Update all point clouds in the viewer
        const viewer = viewerRef.current;
        if (viewer?.scene?.pointclouds) {
            for (const pointcloud of viewer.scene.pointclouds) {
                const currentX = pointcloud.scale.x;
                // eslint-disable-next-line react-hooks/immutability, react-compiler/react-compiler
                pointcloud.scale.z = currentX * scale;
            }
        }
        updateUrl({ zScale: scale });
    };

    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs text-white/70 flex justify-between">
                {t('pointCloud.zScale')}
                <span className="text-laser-green">{zScale.toFixed(1)}</span>
            </label>
            <input
                type="range"
                min="1.0"
                max="10.0"
                step="0.1"
                value={zScale}
                onChange={handleZScaleChange}
                className="w-full accent-laser-green"
            />
        </div>
    );
}
