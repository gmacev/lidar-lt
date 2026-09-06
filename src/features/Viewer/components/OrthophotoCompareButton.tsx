import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import { ToolbarToolButton } from './ToolbarToolButton';

interface OrthophotoCompareButtonProps {
    enabled: boolean;
    onClick: () => void;
}

export const OrthophotoCompareButton = forwardRef<HTMLButtonElement, OrthophotoCompareButtonProps>(
    function OrthophotoCompareButton({ enabled, onClick }, ref) {
        const { t } = useTranslation();

        return (
            <ToolbarToolButton
                ref={ref}
                data-testid="viewer-orthophoto-compare-toggle"
                icon={<Icon name="imageryCompare" size={20} />}
                isActive={enabled}
                label={t('orthophotoCompare.toggle')}
                onClick={onClick}
            />
        );
    }
);
