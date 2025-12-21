import type { PotreeViewer } from '@/common/types/potree';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { PointSizeControl } from './PointSizeControl';
import { PointBudgetControl } from './PointBudgetControl';
import { FOVControl } from './FOVControl';
import { NodeSizeControl } from './NodeSizeControl';
import { PointShapeControl } from './PointShapeControl';
import { ZScaleControl } from './ZScaleControl';

interface PointCloudQualityControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function PointCloudQualityControl({
    viewerRef,
    initialState,
    updateUrl,
}: PointCloudQualityControlProps) {
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
            <FOVControl viewerRef={viewerRef} initialState={initialState} updateUrl={updateUrl} />
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
