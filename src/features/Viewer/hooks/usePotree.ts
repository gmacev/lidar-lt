import { useEffect, useRef, useState } from 'react';
import {
    configureMaterialForElevation,
    configureMaterialForIntensity,
    configureMaterialForReturnNumber,
    EDL_DEFAULTS,
    PERFORMANCE_DEFAULTS,
    POINT_APPEARANCE_DEFAULTS,
} from '@/features/Viewer/config';
import { getShapeEnumValue } from '@/features/Viewer/utils/pointShapeUtils';
import type { Potree, PotreeViewer, LoadPointCloudResult } from '@/common/types/potree';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

interface UsePotreeOptions {
    dataUrl: string;
    initialState: ViewerState;
    updateUrl: (state: ViewerState) => void;
}

interface PotreeState {
    isLoading: boolean;
    error: string | null;
}

export function usePotree(options: UsePotreeOptions) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<PotreeViewer | null>(null);
    const [state, setState] = useState<PotreeState>({ isLoading: true, error: null });

    // Destructure options to avoid dependency on the options object itself
    const { dataUrl, initialState, updateUrl } = options;

    // Use refs for values that shouldn't trigger re-initialization
    const updateUrlRef = useRef(updateUrl);
    const initialStateRef = useRef(initialState);
    const lastStateRef = useRef<string>('');
    // Track whether user has interacted with the camera - prevents syncing
    // during initial fitToScreen animation which causes the 45-degree rotation bug
    const userHasInteractedRef = useRef(false);

    // Update refs when props change
    useEffect(() => {
        updateUrlRef.current = updateUrl;
        initialStateRef.current = initialState;
    }, [updateUrl, initialState]);

    // Sync camera state to URL via callback
    const syncCamera = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        // Don't sync until user has interacted - prevents syncing during
        // initial fitToScreen animation which causes the 45-degree rotation bug
        if (!userHasInteractedRef.current) return;

        const view = viewer.scene.view;
        if (!view) return;

        // Sync yaw/pitch/radius directly for accurate orientation restoration
        const newState: ViewerState = {
            x: Number(view.position.x.toFixed(3)),
            y: Number(view.position.y.toFixed(3)),
            z: Number(view.position.z.toFixed(3)),
            yaw: Number(view.yaw.toFixed(6)),
            pitch: Number(view.pitch.toFixed(6)),
            radius: Number(view.radius.toFixed(3)),
        };

        // Create a signature to check for changes
        const stateSignature = JSON.stringify(newState);

        // Only update if something actually changed
        if (stateSignature !== lastStateRef.current) {
            lastStateRef.current = stateSignature;
            updateUrlRef.current(newState);
        }
    };

    // Load function
    const loadPointCloud = (PotreeLib: Potree, viewer: PotreeViewer, url: string) => {
        PotreeLib.loadPointCloud(url, 'cloud', (e: LoadPointCloudResult) => {
            const pointcloud = e.pointcloud;

            // Add to viewer scene
            viewer.scene.addPointCloud(pointcloud);

            // Apply color mode from URL state (default to elevation)
            const colorMode = initialStateRef.current.colorMode ?? 'elevation';
            if (colorMode === 'intensity') {
                configureMaterialForIntensity(pointcloud, PotreeLib);
                // Apply intensity range from URL if present
                const intensityMax = initialStateRef.current.intensityMax;
                if (typeof intensityMax === 'number') {
                    pointcloud.material.intensityRange = [0, intensityMax];
                }
            } else if (colorMode === 'return-number') {
                configureMaterialForReturnNumber(pointcloud, PotreeLib);
            } else {
                configureMaterialForElevation(pointcloud, PotreeLib);
            }

            // Apply URL state overrides for rendering settings
            const { ps, mns, pb, fov, edlEnabled, edlStrength, edlRadius, psh, zScale } =
                initialStateRef.current;

            // Point size from URL overrides the default
            if (typeof ps === 'number') {
                pointcloud.material.size = ps;
            }

            // Min node size from URL
            if (typeof mns === 'number') {
                viewer.setMinNodeSize(mns);
            }

            // Point budget from URL
            if (typeof pb === 'number') {
                viewer.setPointBudget(pb);
            }

            // Field of view from URL
            if (typeof fov === 'number') {
                viewer.setFOV(fov);
            }

            // Vertical Exaggeration from URL
            const scale = Number(zScale);
            if (!isNaN(scale)) {
                // Use setTimeout to ensure scale is applied after point cloud is fully initialized
                setTimeout(() => {
                    const currentX = pointcloud.scale.x;
                    pointcloud.scale.z = currentX * scale;
                }, 0);
            }

            // EDL settings from URL
            if (typeof edlEnabled === 'boolean') {
                viewer.setEDLEnabled(edlEnabled);
            }
            if (typeof edlStrength === 'number') {
                viewer.setEDLStrength(edlStrength);
            }
            if (typeof edlRadius === 'number') {
                viewer.setEDLRadius(edlRadius);
            }

            // Point Shape - default to circle (better visuals than square)
            const shapeValue = getShapeEnumValue(psh ?? POINT_APPEARANCE_DEFAULTS.shape, PotreeLib);
            pointcloud.material.shape = shapeValue;

            // RESTORE STATE or DEFAULT VIEW from REF
            const { x, y, z, yaw, pitch, radius } = initialStateRef.current;
            if (
                typeof x === 'number' &&
                typeof y === 'number' &&
                typeof z === 'number' &&
                typeof yaw === 'number' &&
                typeof pitch === 'number' &&
                typeof radius === 'number'
            ) {
                // Restore camera position and orientation directly
                viewer.scene.view.position.set(x, y, z);
                viewer.scene.view.yaw = yaw;
                viewer.scene.view.pitch = pitch;
                viewer.scene.view.radius = radius;
            } else {
                // Default top view
                viewer.setTopView();
            }

            setState({ isLoading: false, error: null });
        });
    };

    useEffect(() => {
        if (!containerRef.current) return;

        // Access global Potree
        const PotreeLib: Potree | undefined = window.Potree;

        if (!PotreeLib) {
            console.error('Potree not loaded globally');
            setTimeout(() => {
                setState({ isLoading: false, error: 'Potree library not loaded' });
            }, 0);
            return;
        }

        // Create Potree Viewer
        const viewer: PotreeViewer = new PotreeLib.Viewer(containerRef.current);
        viewerRef.current = viewer;

        // Configure viewer
        viewer.setFOV(PERFORMANCE_DEFAULTS.fov);
        viewer.setPointBudget(PERFORMANCE_DEFAULTS.pointBudget);
        viewer.setMinNodeSize(PERFORMANCE_DEFAULTS.minNodeSize);
        viewer.useHighQuality = PERFORMANCE_DEFAULTS.useHighQuality;

        // Enable EDL
        viewer.setEDLEnabled(EDL_DEFAULTS.enabled);
        viewer.setEDLStrength(EDL_DEFAULTS.strength);
        viewer.setEDLRadius(EDL_DEFAULTS.radius);

        // Background
        viewer.setBackground('gradient');
        viewer.setDescription('');

        // Control
        viewer.setControls(viewer.earthControls);

        // Load point cloud
        loadPointCloud(PotreeLib, viewer, dataUrl);

        // Track user interaction - any mouse/wheel event enables camera syncing
        // This prevents syncing during initial fitToScreen animation
        const markUserInteracted = () => {
            userHasInteractedRef.current = true;
        };
        const container = containerRef.current;
        container.addEventListener('mousedown', markUserInteracted);
        container.addEventListener('wheel', markUserInteracted);

        // Attach loop for syncing (Potree loop runs continuously)
        // Using 'update' event if available, or just hook into standard loop?
        // Potree doesn't emit 'change' events easily. We can override the loop or use an interval.
        // A simple interval is safest for "idling" checks without hacking Potree core.
        const intervalId = setInterval(syncCamera, 200);

        return () => {
            clearInterval(intervalId);
            container.removeEventListener('mousedown', markUserInteracted);
            container.removeEventListener('wheel', markUserInteracted);
            viewerRef.current?.renderer?.domElement?.remove();
            viewerRef.current = null;
        };
    }, [dataUrl]);

    // Expose viewer for external controls
    return { containerRef, viewerRef, ...state };
}
