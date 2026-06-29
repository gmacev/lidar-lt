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
            icon={<Icon name="mapLabels" size={20} />}
            isActive={enabled}
            label={t('mapLabels.toggle')}
            onClick={() => onChange(!enabled)}
        />
    );
}
