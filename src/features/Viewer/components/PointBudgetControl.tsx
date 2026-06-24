import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpHint, toast } from '@/common/components';
import type { PotreeViewer } from '@/common/types/potree';
import { getDefaultPointBudget, POINT_BUDGET_LIMITS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { useCommittedRange } from '@/features/Viewer/hooks/useCommittedRange';

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
        initialState.pb ?? getDefaultPointBudget()
    );
    const commitPointBudget = useCommittedRange(pointBudget, (value) => updateUrl({ pb: value }));

    useEffect(() => {
        const handleAutoReduction = (event: WindowEventMap['potree-point-budget-reduced']) => {
            const { previousBudget, reducedBudget } = event.detail;
            const budgetReduced = event.detail.budgetReduced ?? reducedBudget < previousBudget;

            if (budgetReduced) {
                setPointBudget(reducedBudget);
                updateUrl({ pb: reducedBudget });
            }

            const titleKey = budgetReduced
                ? 'pointCloud.pointBudgetAutoReducedTitle'
                : 'pointCloud.pointLoadingPausedTitle';
            const messageKey = budgetReduced
                ? 'pointCloud.pointBudgetAutoReducedMessage'
                : 'pointCloud.pointLoadingPausedMessage';

            toast.warning(t(titleKey), {
                description: t(messageKey, {
                    previous: formatBudget(previousBudget),
                    reduced: formatBudget(reducedBudget),
                }),
                duration: 8_000,
                dedupeKey: 'potree-point-budget-auto-reduced',
            });
        };

        window.addEventListener('potree-point-budget-reduced', handleAutoReduction);
        return () => {
            window.removeEventListener('potree-point-budget-reduced', handleAutoReduction);
        };
    }, [t, updateUrl]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setPointBudget(value);

        const viewer = viewerRef.current;
        if (viewer) {
            viewer.setPointBudget(value);
        }
    };

    return (
        <div data-testid="viewer-control-point-budget" className="flex flex-col gap-1">
            <label className="text-xs text-white/70 flex justify-between">
                <span className="flex items-center gap-1.5">
                    {t('pointCloud.pointBudget')}
                    <HelpHint
                        ariaLabel={t('pointCloud.pointBudgetHelpAria')}
                        title={t('pointCloud.pointBudget')}
                    >
                        {t('pointCloud.pointBudgetHelp')}
                    </HelpHint>
                </span>
                <span className="text-laser-green">{formatBudget(pointBudget)}</span>
            </label>
            <input
                data-testid="viewer-point-budget"
                type="range"
                min={POINT_BUDGET_LIMITS.min}
                max={POINT_BUDGET_LIMITS.max}
                step={POINT_BUDGET_LIMITS.step}
                value={pointBudget}
                onChange={handleChange}
                {...commitPointBudget}
                className="w-full accent-laser-green"
            />
            {pointBudget > POINT_BUDGET_LIMITS.warning && (
                <p className="mt-1 text-[11px] leading-snug text-neon-amber" role="status">
                    {t('pointCloud.pointBudgetWarning')}
                </p>
            )}
        </div>
    );
}
