import { useState } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import type { ViewerState, Projection } from '@/features/Viewer/config/viewerConfig';
import { PointSizeControl } from './PointSizeControl';
import { PointBudgetControl } from './PointBudgetControl';
import { FOVControl } from './FOVControl';
import { NodeSizeControl } from './NodeSizeControl';
import { PointShapeControl } from './PointShapeControl';
import { ZScaleControl } from './ZScaleControl';
import { CameraProjectionControl } from './CameraProjectionControl';

interface PointCloudSettingsProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function PointCloudSettings({
    viewerRef,
    initialState,
    updateUrl,
}: PointCloudSettingsProps) {
    // Lift projection state to control FOV availability
    const [projection, setProjection] = useState<Projection>(
        initialState.projection ?? 'PERSPECTIVE'
    );

    return (
        <div className="flex flex-col gap-3">
            <PointShapeControl
                viewerRef={viewerRef}
                initialState={initialState}
                updateUrl={updateUrl}
            />
            <PointSizeControl
                viewerRef={viewerRef}
                initialState={initialState}
                updateUrl={updateUrl}
            />
            <PointBudgetControl
                viewerRef={viewerRef}
                initialState={initialState}
                updateUrl={updateUrl}
            />
            <CameraProjectionControl
                viewerRef={viewerRef}
                initialState={initialState}
                onProjectionChange={setProjection}
            />
            <FOVControl
                viewerRef={viewerRef}
                initialState={initialState}
                updateUrl={updateUrl}
                disabled={projection === 'ORTHOGRAPHIC'}
            />
            <ZScaleControl
                viewerRef={viewerRef}
                initialState={initialState}
                updateUrl={updateUrl}
            />
            <NodeSizeControl
                viewerRef={viewerRef}
                initialState={initialState}
                updateUrl={updateUrl}
            />
        </div>
    );
}
