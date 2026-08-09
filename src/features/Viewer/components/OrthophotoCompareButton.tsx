import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import { ToolbarToolButton } from './ToolbarToolButton';

interface OrthophotoCompareButtonProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}

export function OrthophotoCompareButton({ enabled, onChange }: OrthophotoCompareButtonProps) {
    const { t } = useTranslation();

    return (
        <ToolbarToolButton
            data-testid="viewer-orthophoto-compare-toggle"
            icon={<Icon name="imageryCompare" size={20} />}
            isActive={enabled}
            label={t('orthophotoCompare.toggle')}
            onClick={() => onChange(!enabled)}
        />
    );
}
