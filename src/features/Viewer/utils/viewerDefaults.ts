import type { PotreeViewer } from '@/common/types/potree';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
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

export function resetPotreeViewerDisplayDefaults(viewer: PotreeViewer | null): void {
    if (!viewer) return;

    applyViewerDisplaySettings(viewer, {});
    viewer.setBackground('gradient');

    const PotreeLib = window.Potree;
    if (PotreeLib?.CameraMode) {
        viewer.setCameraMode(PotreeLib.CameraMode.PERSPECTIVE);
    }
}
