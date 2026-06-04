import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';

interface AreaMeasurementProps {
    onClick: () => void;
    isActive: boolean;
    totalArea: number;
}

/**
 * Format area for display (m², km², or ha)
 */
function formatArea(sqMeters: number): string {
    if (sqMeters >= 1000000) {
        return `${(sqMeters / 1000000).toFixed(2)} km²`;
    }
    if (sqMeters >= 10000) {
        return `${(sqMeters / 10000).toFixed(2)} ha`;
    }
    return `${sqMeters.toFixed(2)} m²`;
}

/**
 * Area measurement control with button and total area display.
 * Shows active state when measurement is in progress.
 */
export function AreaMeasurement({ onClick, isActive, totalArea }: AreaMeasurementProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-1">
            {/* Total area display - only show when there are measurements */}
            {totalArea > 0 && (
                <div className="flex h-10 items-center px-3 rounded-lg bg-glass-bg border border-white/10 text-white/90 text-sm font-medium">
                    <span className="text-white/50 mr-1.5">A</span>
                    {formatArea(totalArea)}
                </div>
            )}

            <button
                onClick={onClick}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-all ${
                    isActive
                        ? 'bg-neon-amber/30 border-neon-amber text-neon-amber shadow-[0_0_6px_rgba(255,191,0,0.22)]'
                        : 'bg-glass-bg border-white/10 text-white/70 hover:text-neon-amber hover:border-neon-amber/50 hover:bg-black/95'
                }`}
                title={t('measurement.area')}
            >
                <Icon name="map" size={20} />
            </button>
        </div>
    );
}
