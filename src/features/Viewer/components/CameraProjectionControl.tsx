import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer, Potree } from '@/common/types/potree';
import type { Projection, ViewerState } from '@/features/Viewer/config/viewerConfig';

interface CameraProjectionControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

type ProjectionOption = { value: Projection; labelKey: string };

const PROJECTION_OPTIONS: ProjectionOption[] = [
    { value: 'PERSPECTIVE', labelKey: 'pointCloud.projections.perspective' },
    { value: 'ORTHOGRAPHIC', labelKey: 'pointCloud.projections.orthographic' },
];

export function CameraProjectionControl({
    viewerRef,
    initialState,
    updateUrl,
}: CameraProjectionControlProps) {
    const { t } = useTranslation();
    const [projection, setProjection] = useState<Projection>(
        initialState.projection ?? 'PERSPECTIVE'
    );

    const handleProjectionChange = (newProjection: Projection) => {
        const viewer = viewerRef.current;
        const PotreeLib: Potree | undefined = window.Potree;

        if (!viewer || !PotreeLib) return;

        if (newProjection === 'ORTHOGRAPHIC') {
            viewer.setCameraMode(PotreeLib.CameraMode.ORTHOGRAPHIC);
        } else {
            viewer.setCameraMode(PotreeLib.CameraMode.PERSPECTIVE);
        }

        setProjection(newProjection);
        updateUrl({ projection: newProjection });
    };

    const buttonClass = (isActive: boolean) =>
        `flex-1 py-1.5 text-[11px] font-medium transition-all text-center ${
            isActive
                ? 'bg-laser-green/20 text-laser-green border-laser-green'
                : 'text-white/60 hover:text-white/80 border-white/20 hover:border-white/40 hover:bg-white/5'
        } border rounded`;

    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-white/70">{t('pointCloud.projection')}</span>
            <div className="flex gap-1">
                {PROJECTION_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        className={buttonClass(projection === option.value)}
                        onClick={() => handleProjectionChange(option.value)}
                    >
                        {t(option.labelKey)}
                    </button>
                ))}
            </div>
        </div>
    );
}
