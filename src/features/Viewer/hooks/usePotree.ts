import { useEffect, useRef, useState, type RefObject } from 'react';
import { Vector3 } from 'three';
import {
    EDL_DEFAULTS,
    PERFORMANCE_DEFAULTS,
    RELIEF_DEFAULTS,
    getDefaultPointBudget,
} from '@/features/Viewer/config';
import { getCurrentCameraState } from '@/features/Viewer/utils/viewerDefaults';
import { applyViewerDisplaySettings } from '@/features/Viewer/utils/viewerDisplaySettings';
import { configurePotreeBackgroundTexture } from '@/features/Viewer/utils/potreeBackground';
import { isTouchDevice } from '@/common/utils/screenSize';
import type { LoadPointCloudResult, Potree, PotreeViewer } from '@/common/types/potree';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

interface DisposableResource {
    dispose: () => void;
}

interface SceneObjectLike {
    geometry?: unknown;
    material?: unknown;
    children?: unknown[];
    parent?: { remove: (child: unknown) => void };
    removeFromParent?: () => void;
    sceneNode?: unknown;
    traverse?: (callback: (child: unknown) => void) => void;
}

interface TreeNodeLike {
    children?: unknown[] | Record<string, unknown>;
    dispose?: () => void;
    geometry?: unknown;
    geometryNode?: unknown;
    sceneNode?: unknown;
}

interface PotreeRuntime extends Potree {
    lru?: {
        remove?: (node: unknown) => void;
    };
}

interface UsePotreeOptions {
    dataUrl: string;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

interface PotreeState {
    isLoading: boolean;
    error: PotreeLoadError | null;
}

interface UsePotreeResult extends PotreeState {
    containerRef: RefObject<HTMLDivElement | null>;
    viewerRef: RefObject<PotreeViewer | null>;
    orientNorth: () => void;
    recenterView: () => void;
}

export type PotreeLoadErrorCode =
    | 'metadata-not-found'
    | 'metadata-unavailable'
    | 'potree-unavailable';

export interface PotreeLoadError {
    code: PotreeLoadErrorCode;
    message: string;
    status?: number;
    url?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function hasDispose(value: unknown): value is DisposableResource {
    return isRecord(value) && typeof value.dispose === 'function';
}

function asSceneObject(value: unknown): SceneObjectLike | null {
    return isRecord(value) ? value : null;
}

function asTreeNode(value: unknown): TreeNodeLike | null {
    return isRecord(value) ? value : null;
}

function disposeResource(value: unknown, disposed: Set<unknown>) {
    if (!value || disposed.has(value)) return;

    if (Array.isArray(value)) {
        value.forEach((item) => disposeResource(item, disposed));
        return;
    }

    if (hasDispose(value)) {
        disposed.add(value);
        value.dispose();
    }
}

function disposeSceneObject(
    value: unknown,
    disposedObjects: Set<unknown>,
    disposedResources: Set<unknown>
) {
    const object = asSceneObject(value);
    if (!object || disposedObjects.has(value)) return;

    disposedObjects.add(value);

    if (typeof object.traverse === 'function') {
        object.traverse((child) => {
            if (child !== value) {
                disposeSceneObject(child, disposedObjects, disposedResources);
            }
        });
    } else {
        object.children?.forEach((child) =>
            disposeSceneObject(child, disposedObjects, disposedResources)
        );
    }

    disposeResource(object.geometry, disposedResources);
    disposeResource(object.material, disposedResources);
}

function removeSceneObject(value: unknown) {
    const object = asSceneObject(value);
    if (!object) return;

    if (typeof object.removeFromParent === 'function') {
        object.removeFromParent();
    } else {
        object.parent?.remove(value);
    }
}

function disposePointCloud(pointcloud: LoadPointCloudResult['pointcloud'], PotreeLib: Potree) {
    pointcloud.profileRequests?.forEach((request) => request.cancel());
    if (pointcloud.profileRequests) {
        pointcloud.profileRequests.length = 0;
    }

    const disposedNodes = new Set<unknown>();
    const disposedObjects = new Set<unknown>();
    const disposedResources = new Set<unknown>();
    const lru = (PotreeLib as PotreeRuntime).lru;

    const disposeTreeNode = (nodeValue: unknown) => {
        const node = asTreeNode(nodeValue);
        if (!node || disposedNodes.has(nodeValue)) return;

        disposedNodes.add(nodeValue);
        lru?.remove?.(nodeValue);

        if (node.geometryNode) {
            disposeTreeNode(node.geometryNode);
        }

        if (node.sceneNode) {
            disposeSceneObject(node.sceneNode, disposedObjects, disposedResources);
            removeSceneObject(node.sceneNode);
        }

        if (typeof node.dispose === 'function') {
            node.dispose();
        }

        disposeResource(node.geometry, disposedResources);

        if (Array.isArray(node.children)) {
            node.children.forEach(disposeTreeNode);
        } else if (isRecord(node.children)) {
            Object.values(node.children).forEach(disposeTreeNode);
        }
    };

    pointcloud.visibleNodes?.forEach((node) => {
        disposeTreeNode(node.geometryNode);
    });
    disposeTreeNode(pointcloud.root);
    disposeTreeNode(pointcloud.pcoGeometry);

    removeSceneObject(pointcloud);
    disposeSceneObject(pointcloud, disposedObjects, disposedResources);
    disposeResource(pointcloud.material, disposedResources);
}

function disposeViewer(viewer: PotreeViewer, PotreeLib: Potree, container: HTMLElement) {
    viewer.renderer.setAnimationLoop(null);

    viewer.scene.removeAllMeasurements();

    const annotations = [...viewer.scene.annotations.children];
    annotations.forEach((annotation) => {
        viewer.scene.removeAnnotation(annotation);
    });

    const pointclouds = [...viewer.scene.pointclouds];
    pointclouds.forEach((pointcloud) => {
        disposePointCloud(pointcloud, PotreeLib);
    });
    viewer.scene.pointclouds.length = 0;

    const disposedObjects = new Set<unknown>();
    const disposedResources = new Set<unknown>();
    disposeSceneObject(viewer.skybox?.scene, disposedObjects, disposedResources);
    disposeSceneObject(viewer.scene.scene, disposedObjects, disposedResources);

    viewer.renderer.dispose();
    viewer.renderer.domElement.remove();
    container.replaceChildren();
}

function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === 'AbortError';
}

async function validateMetadataUrl(
    url: string,
    signal: AbortSignal
): Promise<PotreeLoadError | null> {
    try {
        let response = await fetch(url, {
            method: 'HEAD',
            signal,
            cache: 'no-store',
        });

        if (response.status === 405 || response.status === 501) {
            response = await fetch(url, {
                method: 'GET',
                signal,
                cache: 'no-store',
            });
        }

        if (response.ok) return null;

        return {
            code: response.status === 404 ? 'metadata-not-found' : 'metadata-unavailable',
            message: `Point cloud metadata request failed with HTTP ${response.status}.`,
            status: response.status,
            url,
        };
    } catch (error) {
        if (isAbortError(error)) return null;

        return {
            code: 'metadata-unavailable',
            message:
                error instanceof Error
                    ? error.message
                    : 'Point cloud metadata could not be requested.',
            url,
        };
    }
}

export function usePotree(options: UsePotreeOptions): UsePotreeResult {
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

        // Sync yaw/pitch/radius directly for accurate orientation restoration.
        const newState = getCurrentCameraState(viewer);

        // Create a signature to check for changes
        const stateSignature = JSON.stringify(newState);

        // Only update if something actually changed
        if (stateSignature !== lastStateRef.current) {
            lastStateRef.current = stateSignature;
            updateUrlRef.current(newState);
        }
    };

    // Load function
    const loadPointCloud = (
        PotreeLib: Potree,
        viewer: PotreeViewer,
        url: string,
        isDisposed: () => boolean
    ) => {
        PotreeLib.loadPointCloud(url, 'cloud', (e: LoadPointCloudResult) => {
            const pointcloud = e.pointcloud;

            if (isDisposed()) {
                disposePointCloud(pointcloud, PotreeLib);
                return;
            }

            // Add to viewer scene
            viewer.scene.addPointCloud(pointcloud);

            applyViewerDisplaySettings(viewer, initialStateRef.current);

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

            if (PotreeLib?.CameraMode) {
                viewer.setCameraMode(PotreeLib.CameraMode.PERSPECTIVE);
            }

            setState({ isLoading: false, error: null });
        });
    };

    const orientNorth = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const view = viewer.scene.view;
        const pivot = view.getPivot();

        view.yaw = 0;
        const direction = new Vector3(0, 1, 0)
            .applyAxisAngle(new Vector3(1, 0, 0), view.pitch)
            .applyAxisAngle(new Vector3(0, 0, 1), view.yaw);
        view.position.copy(pivot.sub(direction.multiplyScalar(view.radius)));
        userHasInteractedRef.current = true;
        requestAnimationFrame(syncCamera);
    };

    const recenterView = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        viewer.setTopView();
        userHasInteractedRef.current = false;
        lastStateRef.current = '';
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let disposed = false;
        let viewer: PotreeViewer | null = null;
        let intervalId: ReturnType<typeof setInterval> | null = null;
        let listenersAttached = false;
        const abortController = new AbortController();
        setState({ isLoading: true, error: null });

        // Access global Potree
        const PotreeLib: Potree | undefined = window.Potree;

        if (!PotreeLib) {
            console.error('Potree not loaded globally');
            setTimeout(() => {
                if (disposed) return;
                setState({
                    isLoading: false,
                    error: {
                        code: 'potree-unavailable',
                        message: 'Potree library not loaded',
                    },
                });
            }, 0);
            return () => {
                disposed = true;
                abortController.abort();
            };
        }

        // Track user interaction - any mouse/wheel/touch event enables camera syncing
        // This prevents syncing during initial fitToScreen animation
        const markUserInteracted = () => {
            userHasInteractedRef.current = true;
        };

        void (async () => {
            const metadataError = await validateMetadataUrl(dataUrl, abortController.signal);
            if (disposed) return;

            if (metadataError) {
                setState({ isLoading: false, error: metadataError });
                return;
            }

            configurePotreeBackgroundTexture(PotreeLib);

            // Create Potree Viewer
            viewer = new PotreeLib.Viewer(container);
            viewerRef.current = viewer;

            // Configure viewer
            viewer.setFOV(PERFORMANCE_DEFAULTS.fov);
            viewer.setPointBudget(getDefaultPointBudget());
            viewer.setMinNodeSize(PERFORMANCE_DEFAULTS.minNodeSize);
            viewer.useHQ = PERFORMANCE_DEFAULTS.highQualitySplats;

            // Enable EDL
            viewer.setEDLEnabled(EDL_DEFAULTS.enabled);
            viewer.setEDLStrength(EDL_DEFAULTS.strength);
            viewer.setEDLRadius(EDL_DEFAULTS.radius);

            // Relief defaults
            viewer.setReliefEnabled(RELIEF_DEFAULTS.enabled);
            viewer.setReliefStrength(RELIEF_DEFAULTS.strength);
            viewer.setReliefRadius(RELIEF_DEFAULTS.radius);
            viewer.setReliefAzimuth(RELIEF_DEFAULTS.azimuth);

            // Background (handled by separate effect)
            // viewer.setBackground('gradient'); // Default will be set by the other effect

            viewer.setDescription('');

            // Control - use orbit controls for touch devices (better touch gesture support)
            if (isTouchDevice()) {
                viewer.setControls(viewer.orbitControls);
            } else {
                viewer.setControls(viewer.earthControls);
            }

            // Load point cloud
            loadPointCloud(PotreeLib, viewer, dataUrl, () => disposed);

            container.addEventListener('mousedown', markUserInteracted);
            container.addEventListener('wheel', markUserInteracted);
            container.addEventListener('touchstart', markUserInteracted);
            listenersAttached = true;
            intervalId = setInterval(syncCamera, 200);
        })();

        return () => {
            disposed = true;
            abortController.abort();
            if (intervalId !== null) {
                clearInterval(intervalId);
            }
            if (listenersAttached) {
                container.removeEventListener('mousedown', markUserInteracted);
                container.removeEventListener('wheel', markUserInteracted);
                container.removeEventListener('touchstart', markUserInteracted);
            }
            if (viewer) {
                disposeViewer(viewer, PotreeLib, container);
            }
            viewerRef.current = null;
        };
    }, [dataUrl]);

    // Watch for background/skybox changes in URL state and update viewer
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const bg = initialState.bg ?? 'gradient';
        const sb = initialState.sb ?? '1';

        if (bg === 'skybox') {
            const sbUrl = sb === '2' ? 'skybox2' : 'skybox';
            const path = `${window.location.origin}/potree/resources/textures/${sbUrl}/`;

            if (typeof Potree !== 'undefined' && Potree.Utils) {
                viewer.skybox = Potree.Utils.loadSkybox(path);
                viewer.background = 'skybox';
            } else {
                console.warn('Potree.Utils not found, cannot load skybox natively.');
            }
        } else if (bg === 'black') {
            viewer.setBackground('black');
        } else {
            viewer.setBackground('gradient');
        }
    }, [initialState.bg, initialState.sb]);

    // Expose viewer for external controls
    return { containerRef, viewerRef, orientNorth, recenterView, ...state };
}
