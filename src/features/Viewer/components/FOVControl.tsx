import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer } from '@/common/types/potree';
import { PERFORMANCE_DEFAULTS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { useCommittedRange } from '@/features/Viewer/hooks/useCommittedRange';

interface FOVControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
    disabled?: boolean;
}

export function FOVControl({ viewerRef, initialState, updateUrl, disabled }: FOVControlProps) {
    const { t } = useTranslation();
    const [fov, setFov] = useState<number>(initialState.fov ?? PERFORMANCE_DEFAULTS.fov);
    const commitFov = useCommittedRange(fov, (value) => updateUrl({ fov: value }));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setFov(value);

        const viewer = viewerRef.current;
        if (viewer) {
            viewer.setFOV(value);
        }
    };

    return (
        <div
            data-testid="viewer-control-fov"
            className={`flex flex-col gap-1 transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
            <label className="text-xs text-white/70 flex justify-between">
                {t('pointCloud.fov')}
                <span className="text-laser-green">{fov}°</span>
            </label>
            <input
                data-testid="viewer-fov"
                type="range"
                min="20"
                max="120"
                step="5"
                value={fov}
                onChange={handleChange}
                {...commitFov}
                disabled={disabled}
                className="w-full accent-laser-green"
            />
        </div>
    );
}
