import { useEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import type { PotreeViewer } from '@/common/types/potree';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

export interface Marker {
    id: string;
    position: [number, number, number];
}

interface UseMarkersOptions {
    viewerRef: RefObject<PotreeViewer | null>;
    markerParam?: string;
    onSearchChange: (state: Partial<ViewerState>) => void;
}

interface ScreenMarker extends Marker {
    screenX: number;
    screenY: number;
    size: number;
    visible: boolean;
}

const MARKER_PRECISION = 3;
const MIN_MARKER_SIZE = 18;
const MAX_MARKER_SIZE = 42;
const CENTER_PICK_DELAY_FRAMES = 2;
const CENTER_PICK_MAX_FRAMES = 300;
const MARKER_SCREEN_EPSILON = 0.25;
const centerPickRequestIds = new WeakMap<PotreeViewer, number>();

function roundCoordinate(value: number): number {
    return Number(value.toFixed(MARKER_PRECISION));
}

function createMarkerId(position: [number, number, number], index: number): string {
    return `${position.join(':')}:${index}`;
}

function parseMarkers(value?: string): Marker[] {
    if (!value) return [];

    return value
        .split(';')
        .map((chunk) => chunk.split(',').map(Number))
        .filter(
            (position): position is [number, number, number] =>
                position.length === 3 && position.every(Number.isFinite)
        )
        .map((position, index) => ({
            id: createMarkerId(position, index),
            position,
        }));
}

function serializeMarkers(markers: Marker[]): string | undefined {
    if (markers.length === 0) return undefined;

    return markers
        .map((marker) => marker.position.map((coordinate) => roundCoordinate(coordinate)).join(','))
        .join(';');
}

function getPickedPosition(
    viewer: PotreeViewer,
    mouse: { x: number; y: number }
): [number, number, number] | null {
    const camera = viewer.scene.getActiveCamera();
    const intersection = window.Potree.Utils.getMousePointCloudIntersection(
        mouse,
        camera,
        viewer,
        viewer.scene.pointclouds,
        { pickClipped: true }
    );

    if (!intersection?.location) return null;

    return [
        roundCoordinate(intersection.location.x),
        roundCoordinate(intersection.location.y),
        roundCoordinate(intersection.location.z),
    ];
}

function getCameraDistance(camera: Camera, position: [number, number, number]) {
    return camera.position.distanceTo(new Vector3(...position));
}

function getMarkerSize(camera: Camera, position: [number, number, number]) {
    const distance = getCameraDistance(camera, position);
    const normalized = Math.log10(Math.max(distance, 1)) / 4;
    return Math.round(
        Math.max(MIN_MARKER_SIZE, Math.min(MAX_MARKER_SIZE, MIN_MARKER_SIZE + normalized * 20))
    );
}

function projectMarker(marker: Marker, viewer: PotreeViewer): ScreenMarker {
    const camera = viewer.scene.getActiveCamera();
    const rect = viewer.renderer.domElement.getBoundingClientRect();
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const projected = new Vector3(...marker.position).project(camera);
    const visible =
        projected.z >= -1 &&
        projected.z <= 1 &&
        projected.x >= -1.2 &&
        projected.x <= 1.2 &&
        projected.y >= -1.2 &&
        projected.y <= 1.2;

    return {
        ...marker,
        screenX: ((projected.x + 1) / 2) * rect.width,
        screenY: ((-projected.y + 1) / 2) * rect.height,
        size: getMarkerSize(camera, marker.position),
        visible,
    };
}

function areScreenMarkersEqual(current: ScreenMarker[], next: ScreenMarker[]) {
    if (current.length !== next.length) return false;

    return current.every((currentMarker, index) => {
        const nextMarker = next[index];
        if (!nextMarker) return false;

        return (
            currentMarker.id === nextMarker.id &&
            currentMarker.visible === nextMarker.visible &&
            currentMarker.size === nextMarker.size &&
            Math.abs(currentMarker.screenX - nextMarker.screenX) < MARKER_SCREEN_EPSILON &&
            Math.abs(currentMarker.screenY - nextMarker.screenY) < MARKER_SCREEN_EPSILON
        );
    });
}

export function useMarkers({ viewerRef, markerParam, onSearchChange }: UseMarkersOptions) {
    const [markers, setMarkers] = useState<Marker[]>(() => parseMarkers(markerParam));
    const [screenMarkers, setScreenMarkers] = useState<ScreenMarker[]>([]);
    const markersRef = useRef(markers);
    const screenMarkersRef = useRef(screenMarkers);
    const lastMarkerParamRef = useRef(markerParam);
    const onSearchChangeRef = useRef(onSearchChange);
    const requestScreenMarkerUpdateRef = useRef(() => {});

    useEffect(() => {
        markersRef.current = markers;
    }, [markers]);

    useEffect(() => {
        screenMarkersRef.current = screenMarkers;
    }, [screenMarkers]);

    useEffect(() => {
        onSearchChangeRef.current = onSearchChange;
    }, [onSearchChange]);

    useEffect(() => {
        if (markerParam === lastMarkerParamRef.current) return;

        const nextMarkers = parseMarkers(markerParam);
        lastMarkerParamRef.current = markerParam;
        markersRef.current = nextMarkers;
        setMarkers(nextMarkers);
        requestScreenMarkerUpdateRef.current();
    }, [markerParam]);

    const commitMarkers = (nextMarkers: Marker[]) => {
        const serialized = serializeMarkers(nextMarkers);
        lastMarkerParamRef.current = serialized;
        markersRef.current = nextMarkers;
        setMarkers(nextMarkers);
        onSearchChangeRef.current({ mk: serialized });
        requestScreenMarkerUpdateRef.current();
    };

    const deleteMarker = (id: string) => {
        commitMarkers(markersRef.current.filter((marker) => marker.id !== id));
    };

    const addMarker = (position: [number, number, number]) => {
        const roundedPosition: [number, number, number] = position.map(roundCoordinate) as [
            number,
            number,
            number,
        ];
        const nextMarkers = [
            ...markersRef.current,
            {
                id: createMarkerId(roundedPosition, markersRef.current.length),
                position: roundedPosition,
            },
        ];
        commitMarkers(nextMarkers);
    };

    const addMarkerAtViewCenter = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const requestId = (centerPickRequestIds.get(viewer) ?? 0) + 1;
        centerPickRequestIds.set(viewer, requestId);
        let frameCount = 0;

        const tryPick = () => {
            if (requestId !== centerPickRequestIds.get(viewer) || viewerRef.current !== viewer) {
                return;
            }

            frameCount += 1;
            if (frameCount <= CENTER_PICK_DELAY_FRAMES) {
                requestAnimationFrame(tryPick);
                return;
            }

            const rendererElement = viewer.renderer?.domElement;
            if (!rendererElement) return;

            const position = getPickedPosition(viewer, {
                x: rendererElement.clientWidth / 2,
                y: rendererElement.clientHeight / 2,
            });

            if (position) {
                addMarker(position);
                return;
            }

            if (frameCount < CENTER_PICK_MAX_FRAMES) {
                requestAnimationFrame(tryPick);
            }
        };

        requestAnimationFrame(tryPick);
    };

    useEffect(() => {
        let frameId = 0;
        let rendererElement: HTMLCanvasElement | null = null;

        const handleMouseDown = (event: MouseEvent) => {
            const viewer = viewerRef.current;
            if (!viewer || !rendererElement) return;
            if (event.button !== 0 || (!event.ctrlKey && !event.metaKey)) return;

            const rect = rendererElement.getBoundingClientRect();
            const position = getPickedPosition(viewer, {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            });
            if (!position) return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            addMarker(position);
        };

        const setRendererElement = (nextRendererElement: HTMLCanvasElement | null) => {
            if (rendererElement === nextRendererElement) return;

            rendererElement?.removeEventListener('mousedown', handleMouseDown, { capture: true });
            rendererElement = nextRendererElement;
            rendererElement?.addEventListener('mousedown', handleMouseDown, { capture: true });
        };

        const syncRendererElement = () => {
            setRendererElement(viewerRef.current?.renderer?.domElement ?? null);
            frameId = requestAnimationFrame(syncRendererElement);
        };

        syncRendererElement();

        return () => {
            cancelAnimationFrame(frameId);
            setRendererElement(null);
        };
    }, [viewerRef]);

    useEffect(() => {
        let frameId = 0;
        let viewer: PotreeViewer | null = null;
        let resizeObserver: ResizeObserver | null = null;

        const applyScreenMarkers = (nextMarkers: ScreenMarker[], syncWithRender: boolean) => {
            if (areScreenMarkersEqual(screenMarkersRef.current, nextMarkers)) return;

            screenMarkersRef.current = nextMarkers;
            if (syncWithRender) {
                flushSync(() => setScreenMarkers(nextMarkers));
            } else {
                setScreenMarkers(nextMarkers);
            }
        };

        const updateScreenMarkers = (syncWithRender = false) => {
            const activeViewer = viewerRef.current;
            if (!activeViewer || markersRef.current.length === 0) {
                applyScreenMarkers([], syncWithRender);
                return;
            }

            applyScreenMarkers(
                markersRef.current.map((marker) => projectMarker(marker, activeViewer)),
                syncWithRender
            );
        };

        requestScreenMarkerUpdateRef.current = () => updateScreenMarkers();

        const handleRenderPassEnd = () => updateScreenMarkers(true);
        const handleCameraChanged = () => updateScreenMarkers(true);

        const detachViewer = () => {
            if (!viewer) return;

            viewer.removeEventListener('render.pass.end', handleRenderPassEnd);
            viewer.removeEventListener('camera_changed', handleCameraChanged);
            resizeObserver?.disconnect();
            resizeObserver = null;
            viewer = null;
        };

        const attachViewer = (nextViewer: PotreeViewer | null) => {
            if (viewer === nextViewer) return;

            detachViewer();
            viewer = nextViewer;

            if (!viewer) {
                updateScreenMarkers();
                return;
            }

            viewer.addEventListener('render.pass.end', handleRenderPassEnd);
            viewer.addEventListener('camera_changed', handleCameraChanged);

            resizeObserver = new ResizeObserver(() => updateScreenMarkers());
            resizeObserver.observe(viewer.renderer.domElement);
            updateScreenMarkers();
        };

        const syncViewer = () => {
            attachViewer(viewerRef.current);
            frameId = requestAnimationFrame(syncViewer);
        };

        syncViewer();

        return () => {
            cancelAnimationFrame(frameId);
            requestScreenMarkerUpdateRef.current = () => {};
            detachViewer();
        };
    }, [viewerRef]);

    return {
        markers: screenMarkers,
        addMarkerAtViewCenter,
        deleteMarker,
    };
}
