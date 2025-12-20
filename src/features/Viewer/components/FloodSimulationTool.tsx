import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';

interface FloodSimulationToolProps {
    isActive: boolean;
    waterLevel: number;
    minLevel: number;
    maxLevel: number;
    precision: number;
    onStart: () => void;
    onWaterLevelChange: (level: number) => void;
    onPrecisionChange: (precision: number) => void;
    onReset: () => void;
}

/**
 * Format elevation for display
 */
function formatElevation(meters: number): string {
    return `${meters.toFixed(1)} m`;
}

/**
 * Simplified flood simulation control.
 * - Click button to activate (covers entire point cloud)
 * - Slider to adjust water level
 * - Precision input for step control
 * - Reset button
 */
export function FloodSimulationTool({
    isActive,
    waterLevel,
    minLevel,
    maxLevel,
    precision,
    onStart,
    onWaterLevelChange,
    onPrecisionChange,
    onReset,
}: FloodSimulationToolProps) {
    const { t } = useTranslation();

    // Calculate percentage for slider gradient
    const range = maxLevel - minLevel;
    const percentage = range > 0 ? ((waterLevel - minLevel) / range) * 100 : 0;

    // Handle keyboard for arrow keys
    const handleKeyDown = (e: KeyboardEvent) => {
        // Only handle when simulation is active
        if (!isActive) return;

        // Don't interfere if user is typing in an input field
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault();
            const newValue = Math.min(maxLevel, waterLevel + precision);
            onWaterLevelChange(newValue);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const newValue = Math.max(minLevel, waterLevel - precision);
            onWaterLevelChange(newValue);
        }
    };

    // Global keyboard listener for arrow key control
    useEffect(() => {
        if (isActive) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isActive, handleKeyDown]);

    return (
        <div className="flex items-start gap-2">
            {/* Controls - show when active */}
            {isActive && (
                <div className="flex flex-col gap-3 p-3 rounded-lg bg-void-black/80 backdrop-blur-md border border-white/10 min-w-[200px]">
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
                            {t('flood.waterLevel')}
                        </span>
                        <button
                            onClick={onReset}
                            className="flex h-5 w-5 items-center justify-center rounded text-white/40 hover:text-plasma-red hover:bg-plasma-red/10 transition-all"
                            title={t('flood.close')}
                        >
                            <Icon name="close" size={12} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Current level - prominent display */}
                    <div className="text-center">
                        <span className="text-2xl font-bold text-blue-400 tabular-nums">
                            {waterLevel.toFixed(2)}
                        </span>
                        <span className="text-sm text-blue-400/70 ml-1">m</span>
                    </div>

                    {/* Slider with labels */}
                    <div className="flex flex-col gap-1">
                        <input
                            type="range"
                            min={minLevel}
                            max={maxLevel}
                            step={precision}
                            value={waterLevel}
                            onChange={(e) => onWaterLevelChange(Number(e.target.value))}
                            className="w-full h-2 appearance-none cursor-pointer rounded-full"
                            style={{
                                background: `linear-gradient(to right, #3b82f6 ${percentage}%, rgba(255,255,255,0.15) ${percentage}%)`,
                            }}
                            title={t('flood.waterLevelValue', {
                                value: formatElevation(waterLevel),
                            })}
                        />
                        <div className="flex justify-between">
                            <span className="text-[10px] text-white/30">
                                {formatElevation(minLevel)}
                            </span>
                            <span className="text-[10px] text-white/30">
                                {formatElevation(maxLevel)}
                            </span>
                        </div>
                    </div>

                    {/* Step control with custom +/- buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-[10px] text-white/40 uppercase tracking-wide">
                            {t('flood.step')}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onPrecisionChange(Math.max(0.01, precision / 2))}
                                className="flex h-5 w-5 items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                title={t('flood.decreaseStep')}
                            >
                                <Icon name="minus" size={10} strokeWidth={3} />
                            </button>
                            <span className="text-xs text-white/60 tabular-nums min-w-[36px] text-center">
                                {precision < 0.1
                                    ? precision.toFixed(2)
                                    : precision < 1
                                      ? precision.toFixed(1)
                                      : precision.toFixed(0)}
                                m
                            </span>
                            <button
                                onClick={() => onPrecisionChange(Math.min(100, precision * 2))}
                                className="flex h-5 w-5 items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                title={t('flood.increaseStep')}
                            >
                                <Icon name="plus" size={10} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main flood button */}
            <button
                onClick={isActive ? onReset : onStart}
                className={`flex h-10 w-10 items-center justify-center rounded-lg backdrop-blur-md border transition-all ${
                    isActive
                        ? 'bg-blue-500/30 border-blue-400 text-blue-300 shadow-[0_0_12px_rgba(0,136,255,0.3)]'
                        : 'bg-void-black/60 border-white/10 text-white/70 hover:text-blue-300 hover:border-blue-400/50 hover:bg-white/10'
                }`}
                title={isActive ? t('flood.simulationActive') : t('flood.simulation')}
            >
                <Icon name="waves" size={20} />
            </button>
        </div>
    );
}
