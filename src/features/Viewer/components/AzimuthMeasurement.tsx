import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';

interface AzimuthMeasurementProps {
    onClick: () => void;
    isActive: boolean;
}

/**
 * Azimuth measurement button.
 * Measures the compass bearing (angle from North) between two points.
 * The azimuth angle is displayed on the measurement line itself via a Potree label.
 */
export function AzimuthMeasurement({ onClick, isActive }: AzimuthMeasurementProps) {
    const { t } = useTranslation();

    return (
        <button
            onClick={onClick}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-all ${
                isActive
                    ? 'bg-neon-cyan/40 border-neon-cyan text-neon-cyan shadow-[0_0_12px_rgba(0,255,255,0.3)]'
                    : 'bg-glass-bg border-white/10 text-white/70 hover:text-neon-amber hover:border-neon-amber/50 hover:bg-black/95'
            }`}
            title={t('measurement.azimuth')}
        >
            <Icon name="azimuth" size={20} />
        </button>
    );
}
