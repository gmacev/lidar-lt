import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import { ToolbarToolButton } from './ToolbarToolButton';

interface VolumeMeasurementProps {
    onClick: () => void;
    isActive: boolean;
    totalVolume: number;
}

/**
 * Format volume for display (m³ or km³ for large values)
 */
function formatVolume(cubicMeters: number): string {
    if (cubicMeters >= 1000000000) {
        return `${(cubicMeters / 1000000000).toFixed(2)} km³`;
    }
    if (cubicMeters >= 1000000) {
        return `${(cubicMeters / 1000000).toFixed(2)} M m³`;
    }
    if (cubicMeters >= 1000) {
        return `${(cubicMeters / 1000).toFixed(2)} K m³`;
    }
    return `${cubicMeters.toFixed(2)} m³`;
}

/**
 * Volume measurement control with button and total volume display.
 * Shows active state when measurement is in progress.
 */
export function VolumeMeasurement({ onClick, isActive, totalVolume }: VolumeMeasurementProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-1">
            {/* Total volume display - only show when there are measurements */}
            {totalVolume > 0 && (
                <div className="flex h-10 items-center px-3 rounded-lg bg-glass-bg border border-white/10 text-white/90 text-sm font-medium">
                    <span className="text-white/50 mr-1.5">V</span>
                    {formatVolume(totalVolume)}
                </div>
            )}

            <ToolbarToolButton
                data-testid="viewer-tool-volume"
                onClick={onClick}
                isActive={isActive}
                label={t('measurement.volume')}
                icon={<Icon name="box" size={20} />}
            />
        </div>
    );
}
