import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import { ToolbarToolButton } from './ToolbarToolButton';

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
        <ToolbarToolButton
            data-testid="viewer-tool-azimuth"
            onClick={onClick}
            isActive={isActive}
            label={t('measurement.azimuth')}
            icon={<Icon name="azimuth" size={20} />}
        />
    );
}
