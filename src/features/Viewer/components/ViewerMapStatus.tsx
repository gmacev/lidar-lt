import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import type { PotreeViewer } from '@/common/types/potree';

interface ViewerMapStatusProps {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface Coordinate {
    x: number;
    y: number;
}

interface ScaleState {
    label: string;
    width: number;
}

interface StatusState {
    coordinate: Coordinate | null;
    scale: ScaleState | null;
}

const TARGET_SCALE_WIDTH_PX = 96;
const MIN_SCALE_WIDTH_PX = 40;
const MAX_SCALE_WIDTH_PX = 140;
const COORDINATE_UPDATE_INTERVAL_MS = 120;
const SCALE_UPDATE_INTERVAL_MS = 500;
const COORDINATE_PRECISION = 0;
const SCALE_SAMPLE_RIGHT_OFFSET_PX = 64;
const SCALE_SAMPLE_BOTTOM_OFFSET_PX = 10;
const NICE_STEPS = [1, 2, 5];
const LKS94_PROJ =
    '+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9998 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';

function roundCoordinate(value: number) {
    return Number(value.toFixed(COORDINATE_PRECISION));
}

function getPlaneIntersection(
    camera: Camera,
    width: number,
    height: number,
    screenX: number,
    screenY: number,
    planeZ: number
) {
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

    const ndcX = (screenX / width) * 2 - 1;
    const ndcY = -(screenY / height) * 2 + 1;
    const nearPoint = new Vector3(ndcX, ndcY, -1).unproject(camera);
    const farPoint = new Vector3(ndcX, ndcY, 1).unproject(camera);
    const direction = farPoint.sub(nearPoint);

    if (Math.abs(direction.z) < 1e-9) return null;

    const t = (planeZ - nearPoint.z) / direction.z;
    if (!Number.isFinite(t)) return null;

    return nearPoint.add(direction.multiplyScalar(t));
}

function getNiceScaleDistance(maxDistance: number) {
    if (!Number.isFinite(maxDistance) || maxDistance <= 0) return null;

    const exponent = Math.floor(Math.log10(maxDistance));
    const base = 10 ** exponent;

    for (let i = NICE_STEPS.length - 1; i >= 0; i--) {
        const distance = NICE_STEPS[i] * base;
        if (distance <= maxDistance) return distance;
    }

    return NICE_STEPS[NICE_STEPS.length - 1] * 10 ** (exponent - 1);
}

function formatScaleLabel(meters: number) {
    if (meters >= 1000) {
        const kilometers = meters / 1000;
        return `${Number.isInteger(kilometers) ? kilometers.toFixed(0) : kilometers.toFixed(1)} km`;
    }

    return `${Math.round(meters)} m`;
}

function getHorizontalDistance(start: Vector3, end: Vector3) {
    return Math.hypot(end.x - start.x, end.y - start.y);
}

function getPickedPoint(viewer: PotreeViewer, screenPoint: { x: number; y: number }) {
    const camera = viewer.scene.getActiveCamera();
    const intersection = window.Potree.Utils.getMousePointCloudIntersection(
        screenPoint,
        camera,
        viewer,
        viewer.scene.pointclouds,
        { pickClipped: true }
    );

    return intersection?.location ?? null;
}

function getScaleSampleLine(viewer: PotreeViewer) {
    const element = viewer.renderer.domElement;
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width <= 0 || height <= 0) return null;

    const endX = Math.max(0, width - SCALE_SAMPLE_RIGHT_OFFSET_PX);
    const startX = Math.max(0, endX - TARGET_SCALE_WIDTH_PX);
    const y = Math.max(0, height - SCALE_SAMPLE_BOTTOM_OFFSET_PX);

    return {
        start: { x: startX, y },
        end: { x: endX, y },
    };
}

function measureScaleWithPointCloud(viewer: PotreeViewer) {
    const sampleLine = getScaleSampleLine(viewer);
    if (!sampleLine) return null;

    const start = getPickedPoint(viewer, sampleLine.start);
    const end = getPickedPoint(viewer, sampleLine.end);
    if (!start || !end) return null;

    return getHorizontalDistance(start, end) / Math.max(1, sampleLine.end.x - sampleLine.start.x);
}

function measureScaleWithPivotPlane(viewer: PotreeViewer) {
    const element = viewer.renderer.domElement;
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width <= 0 || height <= 0) return null;

    const camera = viewer.scene.getActiveCamera();
    const pivot = viewer.scene.view.getPivot();
    const centerX = width / 2;
    const centerY = height / 2;
    const start = getPlaneIntersection(camera, width, height, centerX, centerY, pivot.z);
    const end = getPlaneIntersection(
        camera,
        width,
        height,
        Math.min(width, centerX + TARGET_SCALE_WIDTH_PX),
        centerY,
        pivot.z
    );

    if (!start || !end) return null;

    return start.distanceTo(end) / TARGET_SCALE_WIDTH_PX;
}

function measureScale(viewer: PotreeViewer): ScaleState | null {
    const metersPerPixel = measureScaleWithPointCloud(viewer) ?? measureScaleWithPivotPlane(viewer);
    if (!metersPerPixel) return null;

    const niceDistance = getNiceScaleDistance(metersPerPixel * MAX_SCALE_WIDTH_PX);
    if (!niceDistance) return null;

    const scaleWidth = Math.max(
        MIN_SCALE_WIDTH_PX,
        Math.min(MAX_SCALE_WIDTH_PX, Math.round(niceDistance / metersPerPixel))
    );

    return {
        label: formatScaleLabel(niceDistance),
        width: scaleWidth,
    };
}

function getScaleLayoutSignature(viewer: PotreeViewer) {
    const element = viewer.renderer.domElement;
    const camera = viewer.scene.getActiveCamera() as Camera & {
        fov?: number;
        zoom?: number;
    };

    return [
        element.clientWidth,
        element.clientHeight,
        Math.round((camera.fov ?? 0) * 10),
        Math.round((camera.zoom ?? 1) * 100),
    ].join(':');
}

function getZoomSignature(viewer: PotreeViewer) {
    return Math.round(viewer.scene.view.radius * 10);
}

function getPointerCoordinate(
    viewer: PotreeViewer,
    pointer: { x: number; y: number } | null
): Coordinate | null {
    const element = viewer.renderer.domElement;
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width <= 0 || height <= 0) return null;

    const camera = viewer.scene.getActiveCamera();
    const pivot = viewer.scene.view.getPivot();
    const screenPoint = pointer ?? { x: width / 2, y: height / 2 };
    const intersection = getPlaneIntersection(
        camera,
        width,
        height,
        Math.max(0, Math.min(width, screenPoint.x)),
        Math.max(0, Math.min(height, screenPoint.y)),
        pivot.z
    );

    const coordinate = intersection ?? pivot;

    return {
        x: roundCoordinate(coordinate.x),
        y: roundCoordinate(coordinate.y),
    };
}

function areStatusStatesEqual(current: StatusState, next: StatusState) {
    return (
        current.coordinate?.x === next.coordinate?.x &&
        current.coordinate?.y === next.coordinate?.y &&
        current.scale?.label === next.scale?.label &&
        current.scale?.width === next.scale?.width
    );
}

function formatCoordinateText(coordinate: Coordinate) {
    return `X: ${coordinate.x} Y: ${coordinate.y}`;
}

function transformCoordinateToWgs84(coordinate: Coordinate) {
    const proj4 = window.proj4;

    if (!proj4.defs('EPSG:3346')) {
        proj4.defs('EPSG:3346', LKS94_PROJ);
    }

    const [lon, lat] = proj4('EPSG:3346', 'EPSG:4326', [coordinate.x, coordinate.y]);

    return { lat, lon };
}

function formatCoordinateForClipboard(coordinate: Coordinate) {
    const { lat, lon } = transformCoordinateToWgs84(coordinate);

    return `LKS94 / EPSG:3346: X=${coordinate.x}, Y=${coordinate.y}\nWGS84 / EPSG:4326: ${lat.toFixed(7)}, ${lon.toFixed(7)}`;
}

export function ViewerMapStatus({ viewerRef }: ViewerMapStatusProps) {
    const { t } = useTranslation();
    const [status, setStatus] = useState<StatusState>({ coordinate: null, scale: null });
    const [copied, setCopied] = useState(false);
    const pointerRef = useRef<{ x: number; y: number } | null>(null);
    const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let frameId = 0;
        let lastCoordinateUpdate = 0;
        let lastScaleUpdate = 0;
        let lastScale: ScaleState | null = null;
        let lastScaleLayoutSignature = '';
        let lastZoomSignature = 0;
        let scaleDirty = true;
        let rendererElement: HTMLCanvasElement | null = null;

        const markScaleDirty = () => {
            scaleDirty = true;
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (!rendererElement) return;
            const rect = rendererElement.getBoundingClientRect();
            pointerRef.current = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            };
        };

        const handlePointerLeave = () => {
            pointerRef.current = null;
        };

        const setRendererElement = (nextRendererElement: HTMLCanvasElement | null) => {
            if (rendererElement === nextRendererElement) return;

            rendererElement?.removeEventListener('pointermove', handlePointerMove);
            rendererElement?.removeEventListener('pointerleave', handlePointerLeave);
            rendererElement?.removeEventListener('wheel', markScaleDirty);
            rendererElement?.removeEventListener('touchend', markScaleDirty);
            rendererElement = nextRendererElement;
            rendererElement?.addEventListener('pointermove', handlePointerMove);
            rendererElement?.addEventListener('pointerleave', handlePointerLeave);
            rendererElement?.addEventListener('wheel', markScaleDirty, { passive: true });
            rendererElement?.addEventListener('touchend', markScaleDirty, { passive: true });
        };

        const updateStatus = (now: number) => {
            setRendererElement(viewerRef.current?.renderer?.domElement ?? null);

            if (now - lastCoordinateUpdate >= COORDINATE_UPDATE_INTERVAL_MS) {
                const viewer = viewerRef.current;

                if (viewer) {
                    const nextScaleLayoutSignature = getScaleLayoutSignature(viewer);
                    const nextZoomSignature = getZoomSignature(viewer);
                    const layoutChanged = nextScaleLayoutSignature !== lastScaleLayoutSignature;
                    const zoomChanged = nextZoomSignature !== lastZoomSignature;
                    const shouldUpdateScale =
                        !lastScale ||
                        layoutChanged ||
                        (scaleDirty &&
                            zoomChanged &&
                            now - lastScaleUpdate >= SCALE_UPDATE_INTERVAL_MS);

                    if (shouldUpdateScale) {
                        lastScale = measureScale(viewer);
                        lastScaleLayoutSignature = nextScaleLayoutSignature;
                        lastZoomSignature = nextZoomSignature;
                        lastScaleUpdate = now;
                        scaleDirty = false;
                    }

                    const nextStatus = {
                        coordinate: getPointerCoordinate(viewer, pointerRef.current),
                        scale: lastScale,
                    };

                    setStatus((current) =>
                        areStatusStatesEqual(current, nextStatus) ? current : nextStatus
                    );
                }

                lastCoordinateUpdate = now;
            }

            frameId = requestAnimationFrame(updateStatus);
        };

        frameId = requestAnimationFrame(updateStatus);

        return () => {
            cancelAnimationFrame(frameId);
            setRendererElement(null);
        };
    }, [viewerRef]);

    useEffect(() => {
        return () => {
            if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
        };
    }, []);

    const copyCoordinates = async () => {
        if (!status.coordinate) return;

        await navigator.clipboard.writeText(formatCoordinateForClipboard(status.coordinate));
        setCopied(true);

        if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = setTimeout(() => setCopied(false), 1200);
    };

    if (!status.scale && !status.coordinate) return null;

    return (
        <>
            {status.scale && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-white/70">
                    <span
                        className="relative inline-block h-2 border border-t-0 border-white/45"
                        style={{ width: status.scale.width }}
                        aria-hidden="true"
                    />
                    <span>{status.scale.label}</span>
                </span>
            )}
            {status.scale && status.coordinate && (
                <span aria-hidden="true" className="text-white/35">
                    {'\u00b7'}
                </span>
            )}
            {status.coordinate && (
                <button
                    type="button"
                    onClick={() => void copyCoordinates()}
                    className={`inline-flex items-center rounded font-mono text-[10px] leading-none transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none ${
                        copied ? 'text-neon-green' : 'text-white/75'
                    }`}
                    aria-label={t('viewerMapStatus.copyCoordinates')}
                    title={
                        copied
                            ? t('viewerMapStatus.coordinatesCopied')
                            : t('viewerMapStatus.copyCoordinates')
                    }
                >
                    {formatCoordinateText(status.coordinate)}
                </button>
            )}
        </>
    );
}
