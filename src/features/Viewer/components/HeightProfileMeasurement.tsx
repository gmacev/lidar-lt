import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';

interface HeightProfileMeasurementProps {
    onClick: () => void;
    isActive: boolean;
}

/**
 * Height Profile measurement control.
 * Allows drawing a line to measure elevation profile.
 */
export function HeightProfileMeasurement({ onClick, isActive }: HeightProfileMeasurementProps) {
    const { t } = useTranslation();

    return (
        <button
            onClick={onClick}
            className={`flex h-10 w-10 items-center justify-center rounded-lg backdrop-blur-md border transition-all ${
                isActive
                    ? 'bg-neon-cyan/30 border-neon-cyan text-neon-cyan shadow-[0_0_12px_rgba(0,255,255,0.3)]'
                    : 'bg-void-black/60 border-white/10 text-white/70 hover:text-neon-cyan hover:border-neon-cyan/50 hover:bg-white/10'
            }`}
            title={t('measurement.heightProfile')}
        >
            <Icon name="activity" size={20} />
        </button>
    );
}
