import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpHint } from '@/common/components';
import type { PotreeViewer } from '@/common/types/potree';
import { POINT_SIZE_DEFAULTS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { useCommittedRange } from '@/features/Viewer/hooks/useCommittedRange';

interface PointSizeControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function PointSizeControl({ viewerRef, initialState, updateUrl }: PointSizeControlProps) {
    const { t } = useTranslation();
    const [pointSize, setPointSize] = useState(initialState.ps ?? POINT_SIZE_DEFAULTS.size);
    const commitPointSize = useCommittedRange(pointSize, (size) => updateUrl({ ps: size }));

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
    };

    return (
        <div data-testid="viewer-control-point-size" className="flex flex-col gap-1">
            <label className="text-xs text-white/70 flex justify-between">
                <span className="flex items-center gap-1.5">
                    {t('pointCloud.pointSize')}
                    <HelpHint
                        ariaLabel={t('pointCloud.pointSizeHelpAria')}
                        title={t('pointCloud.pointSize')}
                    >
                        {t('pointCloud.pointSizeHelp')}
                    </HelpHint>
                </span>
                <span className="text-laser-green">{pointSize.toFixed(1)}</span>
            </label>
            <input
                data-testid="viewer-point-size"
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={pointSize}
                onChange={handlePointSizeChange}
                {...commitPointSize}
                className="w-full accent-laser-green"
            />
        </div>
    );
}
