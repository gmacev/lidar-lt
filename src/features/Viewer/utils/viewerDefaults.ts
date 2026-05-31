import type { PotreeViewer } from '@/common/types/potree';
import {
    configureMaterialForElevation,
    EDL_DEFAULTS,
    getDefaultPointBudget,
    PERFORMANCE_DEFAULTS,
    POINT_APPEARANCE_DEFAULTS,
    POINT_SIZE_DEFAULTS,
} from '@/features/Viewer/config';
import { updateElevationRangeForZScale } from '@/features/Viewer/config/potreeMaterialConfig';
import { Z_SCALE_DEFAULTS, type ViewerState } from '@/features/Viewer/config/viewerConfig';
import { getShapeEnumValue } from '@/features/Viewer/utils/pointShapeUtils';

export function getCurrentCameraState(viewer: PotreeViewer | null): Partial<ViewerState> {
    const view = viewer?.scene?.view;
    if (!view) return {};

    return {
        x: Number(view.position.x.toFixed(3)),
        y: Number(view.position.y.toFixed(3)),
        z: Number(view.position.z.toFixed(3)),
        yaw: Number(view.yaw.toFixed(6)),
        pitch: Number(view.pitch.toFixed(6)),
        radius: Number(view.radius.toFixed(3)),
    };
}

export function resetPotreeViewerDisplayDefaults(viewer: PotreeViewer | null): void {
    if (!viewer) return;

    viewer.setFOV(PERFORMANCE_DEFAULTS.fov);
    viewer.setPointBudget(getDefaultPointBudget());
    viewer.setMinNodeSize(PERFORMANCE_DEFAULTS.minNodeSize);
    viewer.useHighQuality = PERFORMANCE_DEFAULTS.useHighQuality;
    viewer.setEDLEnabled(EDL_DEFAULTS.enabled);
    viewer.setEDLStrength(EDL_DEFAULTS.strength);
    viewer.setEDLRadius(EDL_DEFAULTS.radius);
    viewer.setBackground('gradient');

    const PotreeLib = window.Potree;
    if (PotreeLib?.CameraMode) {
        viewer.setCameraMode(PotreeLib.CameraMode.PERSPECTIVE);
    }

    if (!PotreeLib || !viewer.scene?.pointclouds) return;

    for (const pointcloud of viewer.scene.pointclouds) {
        configureMaterialForElevation(pointcloud, PotreeLib);

        // Potree is an external mutable renderer; reset its live material state.
        pointcloud.material.size = POINT_SIZE_DEFAULTS.size;
        pointcloud.material.shape = getShapeEnumValue(POINT_APPEARANCE_DEFAULTS.shape, PotreeLib);

        const currentX = pointcloud.scale.x;
        pointcloud.scale.z = currentX * Z_SCALE_DEFAULTS.scale;
        updateElevationRangeForZScale(pointcloud, Z_SCALE_DEFAULTS.scale);

        const classMap = pointcloud.material.classification;
        if (classMap) {
            Object.values(classMap).forEach((classification) => {
                classification.visible = true;
            });
            pointcloud.material.recomputeClassification();
        }
    }
}
