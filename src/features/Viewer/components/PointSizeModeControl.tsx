import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpHint } from '@/common/components';
import type { PotreeViewer, Potree } from '@/common/types/potree';
import { POINT_APPEARANCE_DEFAULTS, type PointSizeMode } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { getPointSizeModeEnumValue } from '@/features/Viewer/utils/pointSizeModeUtils';

interface PointSizeModeControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

type SizeModeOption = { value: PointSizeMode; labelKey: string; fallbackLabel: string };

const SIZE_MODE_OPTIONS: SizeModeOption[] = [
    { value: 'adaptive', labelKey: 'pointCloud.sizeModes.adaptive', fallbackLabel: 'Adaptive' },
    { value: 'fixed', labelKey: 'pointCloud.sizeModes.fixed', fallbackLabel: 'Fixed' },
];

/* eslint-disable react-compiler/react-compiler */
export function PointSizeModeControl({
    viewerRef,
    initialState,
    updateUrl,
}: PointSizeModeControlProps) {
    const { t } = useTranslation();
    const [mode, setMode] = useState<PointSizeMode>(
        initialState.psm ?? POINT_APPEARANCE_DEFAULTS.sizeMode
    );

    const handleModeChange = (newMode: PointSizeMode) => {
        const viewer = viewerRef.current;
        const PotreeLib: Potree | undefined = window.Potree;

        if (!viewer?.scene?.pointclouds?.length || !PotreeLib) return;

        const modeValue = getPointSizeModeEnumValue(newMode, PotreeLib);

        for (const pointcloud of viewer.scene.pointclouds) {
            // eslint-disable-next-line react-hooks/immutability
            pointcloud.material.pointSizeType = modeValue;
        }

        setMode(newMode);
        updateUrl({ psm: newMode });
    };

    const buttonClass = (isActive: boolean) =>
        `flex-1 py-1.5 text-[11px] font-medium transition-all text-center ${
            isActive
                ? 'bg-laser-green/20 text-laser-green border-laser-green'
                : 'text-white/60 hover:text-white/80 border-white/20 hover:border-white/40 hover:bg-white/5'
        } border rounded`;

    const translateWithFallback = (key: string, fallback: string) => {
        const label = t(key);
        return label === key ? fallback : label;
    };

    return (
        <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs text-white/70">
                {translateWithFallback('pointCloud.pointSizeMode', 'Point Size Mode')}
                <HelpHint
                    ariaLabel={t('pointCloud.pointSizeModeHelpAria')}
                    title={t('pointCloud.pointSizeMode')}
                >
                    <div className="flex flex-col gap-2">
                        <p>{t('pointCloud.pointSizeModeHelpAdaptive')}</p>
                        <p>{t('pointCloud.pointSizeModeHelpFixed')}</p>
                    </div>
                </HelpHint>
            </span>
            <div className="flex gap-1">
                {SIZE_MODE_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        className={buttonClass(mode === option.value)}
                        onClick={() => handleModeChange(option.value)}
                    >
                        {translateWithFallback(option.labelKey, option.fallbackLabel)}
                    </button>
                ))}
            </div>
        </div>
    );
}
