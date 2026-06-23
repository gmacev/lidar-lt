import type { RefObject } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { PotreeViewer } from '@/common/types/potree';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import {
    getCurrentCameraState,
    resetPotreeViewerDisplayDefaults,
} from '@/features/Viewer/utils/viewerDefaults';
import {
    applyViewerDisplaySettings,
    replaceViewerDisplaySettings,
} from '@/features/Viewer/utils/viewerDisplaySettings';
import type { ViewerPreset } from '@/features/Viewer/utils/viewerPresetStorage';
import type { KvrMatch } from '@/features/Viewer/utils/kvrClient';
import { Route } from '@/routes/viewer.$cellId';

const KVR_CENTER_CAMERA_RADIUS = 55;
const KVR_CENTER_CAMERA_Z_OFFSET = 240;

interface UseViewerNavigationActionsOptions {
    cellId: string;
    initialState: ViewerState;
    viewerRef: RefObject<PotreeViewer | null>;
    recenterView: () => void;
    cancelPendingUrlUpdate: () => void;
    updateUrl: (state: Partial<ViewerState>) => void;
    setSidebarInitialState: (state: ViewerState) => void;
    bumpSidebarResetKey: () => void;
}

export interface ViewerNavigationActions {
    handleCenterKvrMatch: (match: KvrMatch) => void;
    handleLoadPreset: (preset: ViewerPreset) => void;
    handleRecenterView: () => void;
    handleResetDefaults: () => void;
    handleSectorNavigate: (sector: { id: string; name: string | null }) => void;
}

export function useViewerNavigationActions({
    cellId,
    initialState,
    viewerRef,
    recenterView,
    cancelPendingUrlUpdate,
    updateUrl,
    setSidebarInitialState,
    bumpSidebarResetKey,
}: UseViewerNavigationActionsOptions): ViewerNavigationActions {
    const navigate = useNavigate({ from: Route.fullPath });

    const handleCenterKvrMatch = (match: KvrMatch) => {
        const viewer = viewerRef.current;
        const center = match.center;
        if (!viewer || !center) return;

        const THREE = window.THREE;
        const pivot = viewer.scene.view.getPivot();
        const targetZ = Number.isFinite(pivot.z) ? pivot.z : 0;
        cancelPendingUrlUpdate();
        viewer.scene.view.position.set(center.x, center.y, targetZ + KVR_CENTER_CAMERA_Z_OFFSET);
        // eslint-disable-next-line react-compiler/react-compiler
        viewer.scene.view.pitch = -Math.PI / 2;
        viewer.scene.view.yaw = 0;
        viewer.scene.view.radius = KVR_CENTER_CAMERA_RADIUS;
        viewer.scene.view.lookAt(new THREE.Vector3(center.x, center.y, targetZ));
        updateUrl(getCurrentCameraState(viewer));
    };

    const handleSectorNavigate = (sector: { id: string; name: string | null }) => {
        cancelPendingUrlUpdate();

        const portableState = Object.fromEntries(
            Object.entries(initialState).filter(
                ([key]) =>
                    !['x', 'y', 'z', 'yaw', 'pitch', 'radius', 'mk', 'sectorName'].includes(key)
            )
        ) as ViewerState;

        void navigate({
            to: '/viewer/$cellId',
            params: { cellId: sector.id.replaceAll('/', '_') },
            search: {
                ...portableState,
                ...(sector.name ? { sectorName: sector.name } : {}),
            },
        });
    };

    const handleResetDefaults = () => {
        cancelPendingUrlUpdate();

        resetPotreeViewerDisplayDefaults(viewerRef.current);
        recenterView();
        const resetState: ViewerState = {
            ...(initialState.sectorName ? { sectorName: initialState.sectorName } : {}),
            ...(initialState.mk ? { mk: initialState.mk } : {}),
        };
        setSidebarInitialState(resetState);
        bumpSidebarResetKey();
        void navigate({
            to: '/viewer/$cellId',
            params: { cellId },
            search: resetState,
            replace: true,
        });
    };

    const handleLoadPreset = (preset: ViewerPreset) => {
        cancelPendingUrlUpdate();

        applyViewerDisplaySettings(viewerRef.current, preset.state);
        const nextSidebarState = replaceViewerDisplaySettings(initialState, preset.state);
        setSidebarInitialState(nextSidebarState);
        bumpSidebarResetKey();

        void navigate({
            search: (prev) => replaceViewerDisplaySettings(prev, preset.state),
            replace: true,
        });
    };

    const handleRecenterView = () => {
        cancelPendingUrlUpdate();
        recenterView();
        void navigate({
            search: (prev) => ({
                ...prev,
                x: undefined,
                y: undefined,
                z: undefined,
                yaw: undefined,
                pitch: undefined,
                radius: undefined,
            }),
            replace: true,
        });
    };

    return {
        handleCenterKvrMatch,
        handleLoadPreset,
        handleRecenterView,
        handleResetDefaults,
        handleSectorNavigate,
    };
}
