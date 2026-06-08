import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import { ToolbarToolButton } from './ToolbarToolButton';

interface AngleMeasurementProps {
    onClick: () => void;
    isActive: boolean;
}

/**
 * Angle measurement button.
 * Place 3 points to form a closed triangle with angles shown at each vertex.
 */
export function AngleMeasurement({ onClick, isActive }: AngleMeasurementProps) {
    const { t } = useTranslation();

    return (
        <ToolbarToolButton
            onClick={onClick}
            isActive={isActive}
            label={t('measurement.angle')}
            icon={<Icon name="angle" size={20} />}
        />
    );
}
