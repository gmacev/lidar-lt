import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer } from '@/common/types/potree';
import { PERFORMANCE_DEFAULTS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

interface PointBudgetControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

/** Format large numbers with M suffix (e.g., 8000000 -> 8.0M) */
function formatBudget(value: number): string {
    return (value / 1_000_000).toFixed(1) + 'M';
}

export function PointBudgetControl({
    viewerRef,
    initialState,
    updateUrl,
}: PointBudgetControlProps) {
    const { t } = useTranslation();
    const [pointBudget, setPointBudget] = useState<number>(
        initialState.pb ?? PERFORMANCE_DEFAULTS.pointBudget
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setPointBudget(value);

        const viewer = viewerRef.current;
        if (viewer) {
            viewer.setPointBudget(value);
        }
        updateUrl({ pb: value });
    };

    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-white/70 flex justify-between">
                {t('pointCloud.pointBudget')}
                <span className="text-laser-green">{formatBudget(pointBudget)}</span>
            </label>
            <input
                type="range"
                min="500000"
                max="20000000"
                step="500000"
                value={pointBudget}
                onChange={handleChange}
                className="w-full accent-laser-green"
            />
        </div>
    );
}
