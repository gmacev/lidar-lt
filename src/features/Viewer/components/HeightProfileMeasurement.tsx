import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import { ToolbarToolButton } from './ToolbarToolButton';

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
        <ToolbarToolButton
            data-testid="viewer-tool-profile"
            onClick={onClick}
            isActive={isActive}
            label={t('measurement.heightProfile')}
            icon={<Icon name="activity" size={20} />}
        />
    );
}
