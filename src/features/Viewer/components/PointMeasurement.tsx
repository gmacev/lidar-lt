import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import { ToolbarToolButton } from './ToolbarToolButton';

interface PointMeasurementProps {
    onClick: () => void;
    isActive: boolean;
}

export function PointMeasurement({ onClick, isActive }: PointMeasurementProps) {
    const { t } = useTranslation();

    return (
        <ToolbarToolButton
            data-testid="viewer-tool-point"
            onClick={onClick}
            isActive={isActive}
            label={t('measurement.point')}
            icon={<Icon name="crosshair" size={20} />}
        />
    );
}
