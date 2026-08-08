import type { PotreeViewer } from '@/common/types/potree';
import type { Projection, ViewerState } from '@/features/Viewer/config/viewerConfig';
import { applyViewerDisplaySettings } from './viewerDisplaySettings';

function toFixedFinite(value: number, digits: number): number | undefined {
    const rounded = Number(value.toFixed(digits));
    return Number.isFinite(rounded) ? rounded : undefined;
}

export function getCurrentCameraState(viewer: PotreeViewer | null): Partial<ViewerState> {
    const view = viewer?.scene?.view;
    if (!view) return {};

    return {
        x: toFixedFinite(view.position.x, 3),
        y: toFixedFinite(view.position.y, 3),
        z: toFixedFinite(view.position.z, 3),
        yaw: toFixedFinite(view.yaw, 6),
        pitch: toFixedFinite(view.pitch, 6),
        radius: toFixedFinite(view.radius, 3),
    };
}

export function setViewerProjection(
    viewer: PotreeViewer | null,
    projection: Projection
): boolean {
    const PotreeLib = window.Potree;
    if (!viewer || !PotreeLib?.CameraMode) return false;

    viewer.setCameraMode(
        projection === 'ORTHOGRAPHIC'
            ? PotreeLib.CameraMode.ORTHOGRAPHIC
            : PotreeLib.CameraMode.PERSPECTIVE
    );
    return true;
}

export function resetPotreeViewerDisplayDefaults(viewer: PotreeViewer | null): void {
    if (!viewer) return;

    applyViewerDisplaySettings(viewer, {});
    viewer.setBackground('gradient');

    setViewerProjection(viewer, 'PERSPECTIVE');
}
