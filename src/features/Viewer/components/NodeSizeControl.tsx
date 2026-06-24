import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpHint } from '@/common/components';
import type { PotreeViewer } from '@/common/types/potree';
import { PERFORMANCE_DEFAULTS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { useCommittedRange } from '@/features/Viewer/hooks/useCommittedRange';

interface NodeSizeControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function NodeSizeControl({ viewerRef, initialState, updateUrl }: NodeSizeControlProps) {
    const { t } = useTranslation();
    const [minNodeSize, setMinNodeSize] = useState<number>(
        initialState.mns ?? PERFORMANCE_DEFAULTS.minNodeSize
    );
    const commitMinNodeSize = useCommittedRange(minNodeSize, (size) => updateUrl({ mns: size }));

    const handleNodeSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const size = parseInt(e.target.value, 10);
        setMinNodeSize(size);

        // Update viewer setting
        const viewer = viewerRef.current;
        if (viewer) {
            viewer.setMinNodeSize(size);
        }
    };

    return (
        <div data-testid="viewer-control-min-node-size" className="flex flex-col gap-1">
            <label className="text-xs text-white/70 flex justify-between">
                <span className="flex items-center gap-1.5">
                    {t('pointCloud.detailLevel')}
                    <HelpHint
                        ariaLabel={t('pointCloud.detailLevelHelpAria')}
                        title={t('pointCloud.detailLevel')}
                    >
                        {t('pointCloud.detailLevelHelp')}
                    </HelpHint>
                </span>
                <span className="text-laser-green">{minNodeSize}</span>
            </label>
            <input
                data-testid="viewer-min-node-size"
                type="range"
                min="5"
                max="100" // 100 is very coarse, 5 is very fine
                step="5"
                value={minNodeSize}
                onChange={handleNodeSizeChange}
                {...commitMinNodeSize}
                className="w-full accent-laser-green dir-rtl"
            />
        </div>
    );
}
