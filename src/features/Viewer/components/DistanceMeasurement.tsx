import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import { ToolbarToolButton } from './ToolbarToolButton';

interface DistanceMeasurementProps {
    onClick: () => void;
    isActive: boolean;
    totalDistance: number;
}

/**
 * Format distance for display (m or km)
 */
function formatDistance(meters: number): string {
    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(2)} m`;
}

/**
 * Distance measurement control with button and total distance display.
 * Shows active state when measurement is in progress.
 */
export function DistanceMeasurement({
    onClick,
    isActive,
    totalDistance,
}: DistanceMeasurementProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-1">
            {/* Total distance display - only show when there are measurements */}
            {totalDistance > 0 && (
                <div className="flex h-10 items-center px-3 rounded-lg bg-glass-bg border border-white/10 text-white/90 text-sm font-medium">
                    <span className="text-white/50 mr-1.5">Σ</span>
                    {formatDistance(totalDistance)}
                </div>
            )}

            <ToolbarToolButton
                data-testid="viewer-tool-distance"
                onClick={onClick}
                isActive={isActive}
                label={t('measurement.distance')}
                icon={<Icon name="ruler" size={20} />}
            />
        </div>
    );
}
