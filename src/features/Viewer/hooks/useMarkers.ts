import { useEffect, useRef, useState, type RefObject } from 'react';
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
const centerPickRequestIds = new WeakMap<PotreeViewer, number>();

function roundCoordinate(value: number): number {
    return Number(value.toFixed(MARKER_PRECISION));
}

function createMarkerId(position: [number, number, number], index: number): string {
    return `${position.join(':')}:${index}`;
}

export function parseMarkers(value?: string): Marker[] {
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

export function useMarkers({ viewerRef, markerParam, onSearchChange }: UseMarkersOptions) {
    const [markers, setMarkers] = useState<Marker[]>(() => parseMarkers(markerParam));
    const [screenMarkers, setScreenMarkers] = useState<ScreenMarker[]>([]);
    const markersRef = useRef(markers);
    const screenMarkersRef = useRef(screenMarkers);
    const lastMarkerParamRef = useRef(markerParam);

    useEffect(() => {
        markersRef.current = markers;
    }, [markers]);

    useEffect(() => {
        screenMarkersRef.current = screenMarkers;
    }, [screenMarkers]);

    useEffect(() => {
        if (markerParam === lastMarkerParamRef.current) return;

        lastMarkerParamRef.current = markerParam;
        setMarkers(parseMarkers(markerParam));
    }, [markerParam]);

    const commitMarkers = (nextMarkers: Marker[]) => {
        const serialized = serializeMarkers(nextMarkers);
        lastMarkerParamRef.current = serialized;
        setMarkers(nextMarkers);
        onSearchChange({ mk: serialized });
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
        const viewer = viewerRef.current;
        const rendererElement = viewer?.renderer?.domElement;
        if (!viewer || !rendererElement) return;

        const handleMouseDown = (event: MouseEvent) => {
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

        rendererElement.addEventListener('mousedown', handleMouseDown, { capture: true });

        return () => {
            rendererElement.removeEventListener('mousedown', handleMouseDown, { capture: true });
        };
    }, [commitMarkers, viewerRef]);

    useEffect(() => {
        let frameId = 0;

        const updateScreenMarkers = () => {
            const viewer = viewerRef.current;
            if (!viewer || markersRef.current.length === 0) {
                if (screenMarkersRef.current.length > 0) {
                    setScreenMarkers([]);
                }
            } else {
                setScreenMarkers(markersRef.current.map((marker) => projectMarker(marker, viewer)));
            }

            frameId = requestAnimationFrame(updateScreenMarkers);
        };

        frameId = requestAnimationFrame(updateScreenMarkers);

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [viewerRef]);

    return {
        markers: screenMarkers,
        addMarkerAtViewCenter,
        deleteMarker,
    };
}
