import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer } from '@/common/types/potree';
import { POINT_APPEARANCE_DEFAULTS, type PointQuality } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

interface PointQualityControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

type QualityOption = { value: PointQuality; labelKey: string };

const QUALITY_OPTIONS: QualityOption[] = [
    { value: 'standard', labelKey: 'pointCloud.qualities.standard' },
    { value: 'high', labelKey: 'pointCloud.qualities.high' },
];

export function PointQualityControl({
    viewerRef,
    initialState,
    updateUrl,
}: PointQualityControlProps) {
    const { t } = useTranslation();
    const [quality, setQuality] = useState<PointQuality>(
        initialState.pq ?? POINT_APPEARANCE_DEFAULTS.quality
    );

    const handleQualityChange = (newQuality: PointQuality) => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        // eslint-disable-next-line react-compiler/react-compiler -- Intentionally mutating external Potree viewer state
        viewer.useHQ = newQuality === 'high';
        setQuality(newQuality);
        updateUrl({
            pq: newQuality === POINT_APPEARANCE_DEFAULTS.quality ? undefined : newQuality,
        });
    };

    const buttonClass = (isActive: boolean) =>
        `flex-1 py-1.5 text-[11px] font-medium transition-all text-center ${
            isActive
                ? 'bg-laser-green/20 text-laser-green border-laser-green'
                : 'text-white/60 hover:text-white/80 border-white/20 hover:border-white/40 hover:bg-white/5'
        } border rounded`;

    return (
        <div data-testid="viewer-control-point-quality" className="flex flex-col gap-1">
            <span className="text-xs text-white/70">{t('pointCloud.pointQuality')}</span>
            <div className="flex gap-1">
                {QUALITY_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        data-testid={`viewer-point-quality-${option.value}`}
                        className={buttonClass(quality === option.value)}
                        onClick={() => handleQualityChange(option.value)}
                    >
                        {t(option.labelKey)}
                    </button>
                ))}
            </div>
        </div>
    );
}
