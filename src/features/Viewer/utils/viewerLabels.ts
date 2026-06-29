import { Box3 } from 'three';
import type { PotreeViewer } from '@/common/types/potree';

export type ViewerLabelTone = 'neutral' | 'water' | 'accent';
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
    ariaLabel?: string;
    onActivate?: () => void;
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
