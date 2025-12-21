import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer } from '@/common/types/potree';
import { PERFORMANCE_DEFAULTS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

interface FOVControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function FOVControl({ viewerRef, initialState, updateUrl }: FOVControlProps) {
    const { t } = useTranslation();
    const [fov, setFov] = useState<number>(initialState.fov ?? PERFORMANCE_DEFAULTS.fov);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setFov(value);

        const viewer = viewerRef.current;
        if (viewer) {
            viewer.setFOV(value);
        }
        updateUrl({ fov: value });
    };

    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs text-white/70 flex justify-between">
                {t('pointCloud.fov')}
                <span className="text-laser-green">{fov}°</span>
            </label>
            <input
                type="range"
                min="20"
                max="120"
                step="5"
                value={fov}
                onChange={handleChange}
                className="w-full accent-laser-green"
            />
        </div>
    );
}
