import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import { ToolbarToolButton } from './ToolbarToolButton';

interface MapLabelsButtonProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}

export function MapLabelsButton({ enabled, onChange }: MapLabelsButtonProps) {
    const { t } = useTranslation();
    return (
        <ToolbarToolButton
            data-testid="viewer-map-labels-toggle"
            activeClassName="border-[#8fc8ef] bg-[#16384d]/90 text-[#a9dcff] shadow-[0_0_6px_rgba(143,200,239,0.2)]"
            icon={<Icon name="map" size={20} />}
            isActive={enabled}
            label={t('mapLabels.toggle')}
            onClick={() => onChange(!enabled)}
        />
    );
}
