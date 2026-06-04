import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components/Icon';

interface CircleMeasurementProps {
    onClick: () => void;
    isActive: boolean;
}

export function CircleMeasurement({ onClick, isActive }: CircleMeasurementProps) {
    const { t } = useTranslation();

    return (
        <button
            onClick={onClick}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-all ${
                isActive
                    ? 'bg-neon-amber/30 border-neon-amber text-neon-amber shadow-[0_0_6px_rgba(255,191,0,0.22)]'
                    : 'bg-glass-bg border-white/10 text-white/70 hover:text-neon-amber hover:border-neon-amber/50 hover:bg-black/95'
            }`}
            title={t('measurement.circle')}
        >
            <Icon name="circle" size={20} />
        </button>
    );
}
