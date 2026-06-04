import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';

interface RecenterButtonProps {
    onRecenter: () => void;
}

export function RecenterButton({ onRecenter }: RecenterButtonProps) {
    const { t } = useTranslation();

    return (
        <button
            type="button"
            onClick={onRecenter}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-glass-bg text-white/70 transition-all hover:border-neon-amber/50 hover:bg-black/95 hover:text-neon-amber"
            title={t('viewer.recenter')}
            aria-label={t('viewer.recenter')}
        >
            <Icon name="crosshair" size={19} />
        </button>
    );
}
