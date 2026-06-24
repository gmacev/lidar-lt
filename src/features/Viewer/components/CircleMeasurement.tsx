import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components/Icon';
import { ToolbarToolButton } from './ToolbarToolButton';

interface CircleMeasurementProps {
    onClick: () => void;
    isActive: boolean;
}

export function CircleMeasurement({ onClick, isActive }: CircleMeasurementProps) {
    const { t } = useTranslation();

    return (
        <ToolbarToolButton
            data-testid="viewer-tool-circle"
            onClick={onClick}
            isActive={isActive}
            label={t('measurement.circle')}
            icon={<Icon name="circle" size={20} />}
        />
    );
}
