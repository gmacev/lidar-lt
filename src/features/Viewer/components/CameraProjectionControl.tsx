import { useTranslation } from 'react-i18next';
import type { PotreeViewer } from '@/common/types/potree';
import type { Projection } from '@/features/Viewer/config/viewerConfig';
import { setViewerProjection } from '@/features/Viewer/utils/viewerDefaults';

interface CameraProjectionControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    projection: Projection;
    onChange: (mode: Projection) => void;
    disabled?: boolean;
}

type ProjectionOption = { value: Projection; labelKey: string };

const PROJECTION_OPTIONS: ProjectionOption[] = [
    { value: 'PERSPECTIVE', labelKey: 'pointCloud.projections.perspective' },
    { value: 'ORTHOGRAPHIC', labelKey: 'pointCloud.projections.orthographic' },
];

export function CameraProjectionControl({
    viewerRef,
    projection,
    onChange,
    disabled = false,
}: CameraProjectionControlProps) {
    const { t } = useTranslation();

    const handleProjectionChange = (newProjection: Projection) => {
        if (disabled || !setViewerProjection(viewerRef.current, newProjection)) return;

        onChange(newProjection);
    };

    const buttonClass = (isActive: boolean) =>
        `flex-1 py-1.5 text-[11px] font-medium transition-all text-center disabled:cursor-not-allowed ${
            isActive
                ? 'bg-laser-green/20 text-laser-green border-laser-green'
                : 'text-white/60 hover:text-white/80 border-white/20 hover:border-white/40 hover:bg-white/5'
        } border rounded`;

    return (
        <div data-testid="viewer-control-projection" className="flex flex-col gap-1">
            <span className="text-xs text-white/70">{t('pointCloud.projection')}</span>
            <div className="flex gap-1">
                {PROJECTION_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        data-testid={`viewer-projection-${option.value.toLowerCase()}`}
                        className={buttonClass(projection === option.value)}
                        disabled={disabled}
                        onClick={() => handleProjectionChange(option.value)}
                    >
                        {t(option.labelKey)}
                    </button>
                ))}
            </div>
        </div>
    );
}
