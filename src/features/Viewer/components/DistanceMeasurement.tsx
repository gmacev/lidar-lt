import { Icon } from '@/common/components';

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
    return (
        <div className="flex items-center gap-1">
            {/* Total distance display - only show when there are measurements */}
            {totalDistance > 0 && (
                <div className="flex h-10 items-center px-3 rounded-lg bg-void-black/60 backdrop-blur-md border border-white/10 text-white/90 text-sm font-medium">
                    <span className="text-white/50 mr-1.5">Σ</span>
                    {formatDistance(totalDistance)}
                </div>
            )}

            <button
                onClick={onClick}
                className={`flex h-10 w-10 items-center justify-center rounded-lg backdrop-blur-md border transition-all ${
                    isActive
                        ? 'bg-neon-cyan/30 border-neon-cyan text-neon-cyan shadow-[0_0_12px_rgba(0,255,255,0.3)]'
                        : 'bg-void-black/60 border-white/10 text-white/70 hover:text-neon-cyan hover:border-neon-cyan/50 hover:bg-white/10'
                }`}
                title="Matuoti atstumą"
            >
                <Icon name="ruler" size={20} />
            </button>
        </div>
    );
}
