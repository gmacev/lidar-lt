import { Box3 } from 'three';
import type { PotreeViewer } from '@/common/types/potree';

export type ViewerLabelTone = 'neutral' | 'water' | 'accent';
export type ViewerLabelEmphasis = 'primary' | 'secondary' | 'tertiary';
type ViewerLabelPosition =
    | readonly [x: number, y: number]
    | readonly [x: number, y: number, z: number];

export interface ViewerLabel {
    id: string;
    source: string;
    text: string;
    position: ViewerLabelPosition;
    priority: number;
    tone?: ViewerLabelTone;
    emphasis?: ViewerLabelEmphasis;
    ariaLabel?: string;
    onActivate?: () => void;
}

export const VIEWER_LABEL_METRICS: Record<
    ViewerLabelEmphasis,
    {
        anchorOffset: number;
        characterWidth: number;
        height: number;
        maxWidth: number;
        minWidth: number;
        paddingWidth: number;
    }
> = {
    primary: {
        anchorOffset: 11,
        characterWidth: 7.8,
        height: 22,
        maxWidth: 224,
        minWidth: 44,
        paddingWidth: 16,
    },
    secondary: {
        anchorOffset: 9,
        characterWidth: 7.2,
        height: 20,
        maxWidth: 192,
        minWidth: 38,
        paddingWidth: 14,
    },
    tertiary: {
        anchorOffset: 8,
        characterWidth: 6.4,
        height: 17,
        maxWidth: 176,
        minWidth: 34,
        paddingWidth: 12,
    },
};

export function getViewerLabelEmphasis(label: Pick<ViewerLabel, 'emphasis'>) {
    return label.emphasis ?? 'secondary';
}

export function getViewerWorldBounds(viewer: PotreeViewer) {
    const pointcloud = viewer.scene.pointclouds[0];
    if (!pointcloud) return null;

    pointcloud.updateMatrixWorld(true);
    return new Box3().copy(pointcloud.boundingBox).applyMatrix4(pointcloud.matrixWorld);
}

export function getViewerGroundElevation(viewer: PotreeViewer) {
    const bounds = getViewerWorldBounds(viewer);
    if (!bounds || bounds.isEmpty()) return null;

    const elevationRange = Math.max(0, bounds.max.z - bounds.min.z);
    return bounds.min.z + Math.min(5, elevationRange * 0.1);
}

export function getViewerLabelKey(label: Pick<ViewerLabel, 'id' | 'source'>) {
    return `${label.source}:${label.id}`;
}
