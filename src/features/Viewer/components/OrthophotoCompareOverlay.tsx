import {
    useEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    LinearFilter,
    Mesh,
    MeshBasicMaterial,
    Scene,
    SRGBColorSpace,
    Texture,
    TextureLoader,
    Vector3,
    WebGLRenderer,
    type Camera,
} from 'three';
import type { PotreeViewer } from '@/common/types/potree';
import {
    getViewerGroundElevation,
    getViewerWorldBounds,
} from '@/features/Viewer/utils/viewerLabels';
import {
    fetchOrthophotoMetadata,
    getOrthophotoTileUrl,
    type OrthophotoMetadata,
} from '@/features/Viewer/utils/orthophotoProvider';
import {
    createOrthophotoTilePlan,
    type Lks94Bounds,
    type OrthophotoTileFragment,
    type OrthophotoTilePlan,
} from '@/features/Viewer/utils/orthophotoTiles';

interface OrthophotoCompareOverlayProps {
    coverageBounds: readonly Lks94Bounds[];
    coverageReady: boolean;
    isViewerReady: boolean;
    onError: () => void;
    viewerRef: RefObject<PotreeViewer | null>;
}

interface TextureRecord {
    status: 'loading' | 'loaded' | 'error';
    texture: Texture;
    lastUsed: number;
}

interface MeshRecord {
    geometry: BufferGeometry;
    material: MeshBasicMaterial;
    mesh: Mesh;
    tileKey: string;
}

const MAX_VISIBLE_TILES = 64;
const MAX_CACHED_TEXTURES = 128;
const MIN_SPLIT_PERCENT = 0;
const MAX_SPLIT_PERCENT = 100;
const SPLIT_KEYBOARD_STEP = 5;
const TILE_PLAN_UPDATE_INTERVAL_MS = 80;

function getPlaneIntersection(
    camera: Camera,
    width: number,
    height: number,
    screenX: number,
    screenY: number,
    planeZ: number
) {
    const nearPoint = new Vector3(
        (screenX / width) * 2 - 1,
        -(screenY / height) * 2 + 1,
        -1
    ).unproject(camera);
    const farPoint = new Vector3(
        (screenX / width) * 2 - 1,
        -(screenY / height) * 2 + 1,
        1
    ).unproject(camera);
    const direction = farPoint.sub(nearPoint);
    if (Math.abs(direction.z) < 1e-9) return null;

    const distance = (planeZ - nearPoint.z) / direction.z;
    return Number.isFinite(distance) ? nearPoint.add(direction.multiplyScalar(distance)) : null;
}

function getVisiblePlane(viewer: PotreeViewer, planeZ: number) {
    const element = viewer.renderer.domElement;
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width <= 0 || height <= 0) return null;

    const camera = viewer.scene.getActiveCamera();
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

    const corners = [
        getPlaneIntersection(camera, width, height, 0, 0, planeZ),
        getPlaneIntersection(camera, width, height, width, 0, planeZ),
        getPlaneIntersection(camera, width, height, 0, height, planeZ),
        getPlaneIntersection(camera, width, height, width, height, planeZ),
    ];
    if (corners.some((corner) => corner === null)) return null;

    const points = corners.filter((corner): corner is Vector3 => corner !== null);
    const bounds = {
        minX: Math.min(...points.map((point) => point.x)),
        minY: Math.min(...points.map((point) => point.y)),
        maxX: Math.max(...points.map((point) => point.x)),
        maxY: Math.max(...points.map((point) => point.y)),
    };
    const metersPerPixel =
        Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y) / width;

    return { bounds, metersPerPixel };
}

function getFallbackCoverage(viewer: PotreeViewer): Lks94Bounds[] {
    const bounds = getViewerWorldBounds(viewer);
    if (!bounds || bounds.isEmpty()) return [];
    return [{ minX: bounds.min.x, minY: bounds.min.y, maxX: bounds.max.x, maxY: bounds.max.y }];
}

function clampSplit(value: number) {
    return Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, value));
}

function createFragmentGeometry(fragment: OrthophotoTileFragment) {
    const geometry = new BufferGeometry();
    const clip = fragment.clipBounds;
    const tile = fragment.tileBounds;
    const centerX = (clip.minX + clip.maxX) / 2;
    const centerY = (clip.minY + clip.maxY) / 2;
    const minX = clip.minX - centerX;
    const minY = clip.minY - centerY;
    const maxX = clip.maxX - centerX;
    const maxY = clip.maxY - centerY;
    const tileWidth = tile.maxX - tile.minX;
    const tileHeight = tile.maxY - tile.minY;
    const minU = (clip.minX - tile.minX) / tileWidth;
    const maxU = (clip.maxX - tile.minX) / tileWidth;
    const minV = (clip.minY - tile.minY) / tileHeight;
    const maxV = (clip.maxY - tile.minY) / tileHeight;

    geometry.setAttribute(
        'position',
        new BufferAttribute(
            new Float32Array([minX, minY, 0, maxX, minY, 0, maxX, maxY, 0, minX, maxY, 0]),
            3
        )
    );
    geometry.setAttribute(
        'uv',
        new BufferAttribute(new Float32Array([minU, minV, maxU, minV, maxU, maxV, minU, maxV]), 2)
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeBoundingSphere();
    return { centerX, centerY, geometry };
}

function disposeMeshRecord(record: MeshRecord, scene: Scene) {
    scene.remove(record.mesh);
    record.geometry.dispose();
    record.material.dispose();
}

export function OrthophotoCompareOverlay({
    coverageBounds,
    coverageReady,
    isViewerReady,
    onError,
    viewerRef,
}: OrthophotoCompareOverlayProps) {
    const [metadata, setMetadata] = useState<OrthophotoMetadata | null>(null);
    const [splitPercent, setSplitPercent] = useState(50);
    const { t } = useTranslation();
    const rootRef = useRef<HTMLDivElement>(null);
    const rendererHostRef = useRef<HTMLDivElement>(null);
    const activePointerRef = useRef<number | null>(null);
    const onErrorRef = useRef(onError);
    const currentTileKeysRef = useRef<string[]>([]);
    const tileStatusRef = useRef(new Map<string, 'loaded' | 'error'>());
    const totalFailureReportedRef = useRef(false);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
        const controller = new AbortController();
        void fetchOrthophotoMetadata(controller.signal)
            .then((value) => {
                if (!controller.signal.aborted) setMetadata(value);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                console.warn('Orthophoto metadata could not be loaded', error);
                onErrorRef.current();
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!isViewerReady) return;
        const viewer = viewerRef.current;
        if (!viewer) return;

        viewer.earthControls.pitchLocked = true;
        viewer.orbitControls.pitchLocked = true;
        viewer.earthControls.stop?.();
        viewer.orbitControls.stop?.();

        const view = viewer.scene.view;
        const pivot = view.getPivot();
        view.pitch = -Math.PI / 2;
        view.position.set(pivot.x, pivot.y, pivot.z + view.radius);

        return () => {
            viewer.earthControls.pitchLocked = false;
            viewer.orbitControls.pitchLocked = false;
        };
    }, [isViewerReady, viewerRef]);

    useEffect(() => {
        const host = rendererHostRef.current;
        if (!host || !metadata || !coverageReady || !isViewerReady) return;

        const scene = new Scene();
        const renderer = new WebGLRenderer({ alpha: true, antialias: false });
        const textureLoader = new TextureLoader();
        const meshRecords = new Map<string, MeshRecord>();
        const textureRecords = new Map<string, TextureRecord>();
        let viewer: PotreeViewer | null = null;
        let resizeObserver: ResizeObserver | null = null;
        let syncFrame = 0;
        let lastPlanUpdate = -Infinity;
        let planSignature = '';
        let planeZ: number | null = null;
        let disposed = false;
        let activeFragmentKeys = new Set<string>();
        let fallbackFragmentKeys = new Set<string>();

        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.max(1, Math.min(window.devicePixelRatio, 2)));
        renderer.domElement.className =
            'pointer-events-none absolute left-0 top-0 block max-w-none';
        renderer.domElement.setAttribute('aria-hidden', 'true');
        host.replaceChildren(renderer.domElement);

        const effectiveCoverage = (activeViewer: PotreeViewer) =>
            coverageBounds.length > 0 ? [...coverageBounds] : getFallbackCoverage(activeViewer);

        const updateTileDataAttributes = () => {
            const currentKeys = currentTileKeysRef.current;
            const loaded = currentKeys.filter(
                (key) => tileStatusRef.current.get(key) === 'loaded'
            ).length;
            const failed = currentKeys.filter(
                (key) => tileStatusRef.current.get(key) === 'error'
            ).length;
            host.dataset.loadedTiles = String(loaded);
            host.dataset.failedTiles = String(failed);
        };

        const updateTileStatus = (tileKey: string, status: 'loaded' | 'error') => {
            if (status === 'error' && tileStatusRef.current.get(tileKey) === 'loaded') return;
            tileStatusRef.current.set(tileKey, status);
            if (status === 'loaded') totalFailureReportedRef.current = false;
            updateTileDataAttributes();

            const tileKeys = currentTileKeysRef.current;
            if (
                tileKeys.length > 0 &&
                !totalFailureReportedRef.current &&
                tileKeys.every((key) => tileStatusRef.current.get(key) === 'error')
            ) {
                totalFailureReportedRef.current = true;
                onErrorRef.current();
            }

            pruneResolvedFallback();
        };

        function pruneResolvedFallback() {
            if (fallbackFragmentKeys.size === 0) return;
            const tileKeys = currentTileKeysRef.current;
            if (
                tileKeys.length === 0 ||
                !tileKeys.every((key) => tileStatusRef.current.get(key) === 'loaded')
            ) {
                return;
            }

            for (const key of fallbackFragmentKeys) {
                const record = meshRecords.get(key);
                if (!record || activeFragmentKeys.has(key)) continue;
                disposeMeshRecord(record, scene);
                meshRecords.delete(key);
            }
            fallbackFragmentKeys.clear();
        }

        const renderScene = () => {
            const activeViewer = viewerRef.current;
            if (!activeViewer || disposed) return;
            const element = activeViewer.renderer.domElement;
            const width = element.clientWidth;
            const height = element.clientHeight;
            if (width <= 0 || height <= 0) return;

            if (renderer.domElement.width !== Math.round(width * renderer.getPixelRatio())) {
                renderer.setSize(width, height, false);
            } else if (
                renderer.domElement.height !== Math.round(height * renderer.getPixelRatio())
            ) {
                renderer.setSize(width, height, false);
            }
            renderer.domElement.style.width = `${width}px`;
            renderer.domElement.style.height = `${height}px`;
            renderer.render(scene, activeViewer.scene.getActiveCamera());
        };

        const getTextureRecord = (fragment: OrthophotoTileFragment) => {
            const existing = textureRecords.get(fragment.tileKey);
            if (existing) {
                existing.lastUsed = performance.now();
                return existing;
            }

            const placeholder = new Texture();
            const record: TextureRecord = {
                status: 'loading',
                texture: placeholder,
                lastUsed: performance.now(),
            };
            textureRecords.set(fragment.tileKey, record);
            const texture = textureLoader.load(
                getOrthophotoTileUrl(fragment.level, fragment.row, fragment.column),
                () => {
                    if (disposed) {
                        texture.dispose();
                        return;
                    }
                    record.status = 'loaded';
                    texture.colorSpace = SRGBColorSpace;
                    texture.minFilter = LinearFilter;
                    texture.magFilter = LinearFilter;
                    texture.needsUpdate = true;
                    for (const meshRecord of meshRecords.values()) {
                        if (meshRecord.tileKey === fragment.tileKey) {
                            meshRecord.material.visible = true;
                            meshRecord.material.needsUpdate = true;
                        }
                    }
                    updateTileStatus(fragment.tileKey, 'loaded');
                    renderScene();
                },
                undefined,
                () => {
                    if (disposed) return;
                    record.status = 'error';
                    for (const meshRecord of meshRecords.values()) {
                        if (meshRecord.tileKey === fragment.tileKey) {
                            meshRecord.material.visible = false;
                        }
                    }
                    updateTileStatus(fragment.tileKey, 'error');
                    renderScene();
                }
            );
            placeholder.dispose();
            texture.colorSpace = SRGBColorSpace;
            texture.minFilter = LinearFilter;
            texture.magFilter = LinearFilter;
            record.texture = texture;
            return record;
        };

        const evictUnusedTextures = () => {
            if (textureRecords.size <= MAX_CACHED_TEXTURES) return;
            const activeTileKeys = new Set(
                [...meshRecords.values()].map((record) => record.tileKey)
            );
            const candidates = [...textureRecords.entries()]
                .filter(([key]) => !activeTileKeys.has(key))
                .sort((first, second) => first[1].lastUsed - second[1].lastUsed);
            while (textureRecords.size > MAX_CACHED_TEXTURES && candidates.length > 0) {
                const candidate = candidates.shift();
                if (!candidate) break;
                candidate[1].texture.dispose();
                textureRecords.delete(candidate[0]);
            }
        };

        const applyPlan = (plan: OrthophotoTilePlan | null) => {
            const nextFragments = plan?.fragments ?? [];
            const nextKeys = new Set(nextFragments.map((fragment) => fragment.key));
            fallbackFragmentKeys = new Set(
                [...activeFragmentKeys].filter((key) => !nextKeys.has(key))
            );
            activeFragmentKeys = nextKeys;
            for (const [key, record] of meshRecords) {
                if (activeFragmentKeys.has(key) || fallbackFragmentKeys.has(key)) continue;
                disposeMeshRecord(record, scene);
                meshRecords.delete(key);
            }

            for (const fragment of nextFragments) {
                if (meshRecords.has(fragment.key) || planeZ === null) continue;
                const textureRecord = getTextureRecord(fragment);
                const { centerX, centerY, geometry } = createFragmentGeometry(fragment);
                const material = new MeshBasicMaterial({
                    map: textureRecord.texture,
                    side: DoubleSide,
                    depthTest: false,
                    depthWrite: false,
                });
                material.visible = textureRecord.status === 'loaded';
                const mesh = new Mesh(geometry, material);
                mesh.position.set(centerX, centerY, planeZ);
                mesh.frustumCulled = false;
                scene.add(mesh);
                meshRecords.set(fragment.key, {
                    geometry,
                    material,
                    mesh,
                    tileKey: fragment.tileKey,
                });
            }

            currentTileKeysRef.current = plan?.tileKeys ?? [];
            host.dataset.fragments = String(nextFragments.length);
            host.dataset.clippedFragments = String(
                nextFragments.filter(
                    (fragment) =>
                        fragment.clipBounds.minX !== fragment.tileBounds.minX ||
                        fragment.clipBounds.minY !== fragment.tileBounds.minY ||
                        fragment.clipBounds.maxX !== fragment.tileBounds.maxX ||
                        fragment.clipBounds.maxY !== fragment.tileBounds.maxY
                ).length
            );
            updateTileDataAttributes();
            pruneResolvedFallback();
            evictUnusedTextures();
        };

        const update = (forcePlanUpdate = false) => {
            const activeViewer = viewerRef.current;
            if (!activeViewer) return;
            planeZ ??= getViewerGroundElevation(activeViewer);
            if (planeZ === null) return;

            const visiblePlane = getVisiblePlane(activeViewer, planeZ);
            const now = performance.now();
            if (
                visiblePlane &&
                Number.isFinite(visiblePlane.metersPerPixel) &&
                (forcePlanUpdate || now - lastPlanUpdate >= TILE_PLAN_UPDATE_INTERVAL_MS)
            ) {
                lastPlanUpdate = now;
                const plan = createOrthophotoTilePlan({
                    coverageBounds: effectiveCoverage(activeViewer),
                    devicePixelRatio: window.devicePixelRatio,
                    maxTiles: MAX_VISIBLE_TILES,
                    metadata,
                    metersPerPixel: visiblePlane.metersPerPixel,
                    visibleBounds: visiblePlane.bounds,
                });
                const nextSignature = plan
                    ? `${plan.level}|${plan.fragments.map((fragment) => fragment.key).join('|')}`
                    : '';
                if (nextSignature !== planSignature) {
                    planSignature = nextSignature;
                    applyPlan(plan);
                }
            }

            renderScene();
        };

        const handleViewerUpdate = () => update();
        const detach = () => {
            if (!viewer) return;
            viewer.removeEventListener('render.pass.end', handleViewerUpdate);
            resizeObserver?.disconnect();
            resizeObserver = null;
            viewer = null;
        };
        const attach = (nextViewer: PotreeViewer | null) => {
            if (viewer === nextViewer) return;
            detach();
            viewer = nextViewer;
            if (!viewer) return;
            viewer.addEventListener('render.pass.end', handleViewerUpdate);
            resizeObserver = new ResizeObserver(() => update(true));
            resizeObserver.observe(viewer.renderer.domElement);
            update(true);
        };
        const syncViewer = () => {
            attach(viewerRef.current);
            syncFrame = requestAnimationFrame(syncViewer);
        };
        syncViewer();

        return () => {
            disposed = true;
            cancelAnimationFrame(syncFrame);
            detach();
            for (const record of meshRecords.values()) disposeMeshRecord(record, scene);
            meshRecords.clear();
            for (const record of textureRecords.values()) record.texture.dispose();
            textureRecords.clear();
            renderer.dispose();
            renderer.domElement.remove();
        };
    }, [coverageBounds, coverageReady, isViewerReady, metadata, viewerRef]);

    const updateSplitFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
        const rect = rootRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0) return;
        setSplitPercent(clampSplit(((event.clientX - rect.left) / rect.width) * 100));
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        activePointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateSplitFromPointer(event);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (
            activePointerRef.current !== event.pointerId ||
            !event.currentTarget.hasPointerCapture(event.pointerId)
        ) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        updateSplitFromPointer(event);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        let nextValue = splitPercent;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            nextValue -= SPLIT_KEYBOARD_STEP;
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            nextValue += SPLIT_KEYBOARD_STEP;
        } else if (event.key === 'Home') {
            nextValue = MIN_SPLIT_PERCENT;
        } else if (event.key === 'End') {
            nextValue = MAX_SPLIT_PERCENT;
        } else {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        setSplitPercent(clampSplit(nextValue));
    };

    const releasePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        if (activePointerRef.current === event.pointerId) activePointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const handleLostPointerCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (activePointerRef.current === event.pointerId) activePointerRef.current = null;
    };

    return (
        <div
            ref={rootRef}
            data-testid="viewer-orthophoto-compare"
            className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
        >
            <div
                data-testid="viewer-orthophoto-layer"
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${splitPercent}%` }}
                aria-hidden="true"
            >
                <div
                    ref={rendererHostRef}
                    data-testid="viewer-orthophoto-renderer"
                    className="absolute inset-0"
                />
            </div>

            <span
                aria-hidden="true"
                className="absolute inset-y-0 z-[6] w-px -translate-x-1/2 bg-white/70 shadow-[0_0_4px_rgba(0,0,0,0.85)]"
                style={{ left: `${splitPercent}%` }}
            />
            <div
                data-testid="viewer-orthophoto-split"
                role="slider"
                tabIndex={0}
                aria-label={t('orthophotoCompare.sliderLabel')}
                aria-valuemin={MIN_SPLIT_PERCENT}
                aria-valuemax={MAX_SPLIT_PERCENT}
                aria-valuenow={Math.round(splitPercent)}
                className="group pointer-events-auto absolute z-[7] flex h-12 w-11 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center focus-visible:outline-none md:w-8"
                style={{ left: `${splitPercent}%`, top: 'calc(50% - 24px)' }}
                onKeyDown={handleKeyDown}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={releasePointer}
                onPointerCancel={releasePointer}
                onLostPointerCapture={handleLostPointerCapture}
            >
                <span className="flex h-12 w-5 items-center justify-center rounded-full border border-white/25 bg-black/80 shadow-[0_2px_10px_rgba(0,0,0,0.65)] group-focus-visible:ring-2 group-focus-visible:ring-neon-amber/80">
                    <span className="h-5 w-px bg-white/70" />
                </span>
            </div>
        </div>
    );
}
