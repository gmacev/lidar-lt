import { useEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { Vector3 } from 'three';
import type { PotreeViewer } from '@/common/types/potree';
import {
    getViewerGroundElevation,
    getViewerLabelEmphasis,
    getViewerLabelKey,
    VIEWER_LABEL_METRICS,
    type ViewerLabel,
} from '@/features/Viewer/utils/viewerLabels';

export interface ProjectedViewerLabel {
    key: string;
    screenX: number;
    screenY: number;
}

interface UseProjectedViewerLabelsOptions {
    labels: ViewerLabel[];
    viewerRef: RefObject<PotreeViewer | null>;
}

const MAX_VISIBLE_LABELS = 50;
const COLLISION_PADDING = 6;

function rectanglesOverlap(
    first: { left: number; top: number; right: number; bottom: number },
    second: { left: number; top: number; right: number; bottom: number }
) {
    return !(
        first.right + COLLISION_PADDING < second.left ||
        first.left > second.right + COLLISION_PADDING ||
        first.bottom + COLLISION_PADDING < second.top ||
        first.top > second.bottom + COLLISION_PADDING
    );
}

function projectLabels(labels: ViewerLabel[], viewer: PotreeViewer, groundElevation: number) {
    const camera = viewer.scene.getActiveCamera();
    const rect = viewer.renderer.domElement.getBoundingClientRect();
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

    const projected = labels
        .map((label) => {
            const elevation = label.position.length === 3 ? label.position[2] : groundElevation;
            const point = new Vector3(label.position[0], label.position[1], elevation).project(
                camera
            );
            if (
                point.z < -1 ||
                point.z > 1 ||
                point.x < -1.05 ||
                point.x > 1.05 ||
                point.y < -1.05 ||
                point.y > 1.05
            ) {
                return null;
            }

            const screenX = ((point.x + 1) / 2) * rect.width;
            const screenY = ((-point.y + 1) / 2) * rect.height;
            const metrics = VIEWER_LABEL_METRICS[getViewerLabelEmphasis(label)];
            const displayLength = label.text.length;
            const width = Math.min(
                metrics.maxWidth,
                Math.max(
                    metrics.minWidth,
                    displayLength * metrics.characterWidth + metrics.paddingWidth
                )
            );
            const height = metrics.height;

            return {
                label,
                projected: { key: getViewerLabelKey(label), screenX, screenY },
                bounds: {
                    left: screenX - width / 2,
                    right: screenX + width / 2,
                    top: screenY - height / 2,
                    bottom: screenY + height / 2,
                },
            };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .sort(
            (first, second) =>
                second.label.priority - first.label.priority ||
                first.projected.key.localeCompare(second.projected.key)
        );

    const accepted: typeof projected = [];
    for (const item of projected) {
        if (accepted.length >= MAX_VISIBLE_LABELS) break;
        if (accepted.some((existing) => rectanglesOverlap(item.bounds, existing.bounds))) continue;
        accepted.push(item);
    }

    return accepted.map((item) => item.projected);
}

function areLabelsEqual(current: ProjectedViewerLabel[], next: ProjectedViewerLabel[]) {
    if (current.length !== next.length) return false;
    return current.every((label, index) => {
        const nextLabel = next[index];
        return (
            nextLabel?.key === label.key &&
            Math.abs(nextLabel.screenX - label.screenX) < 0.25 &&
            Math.abs(nextLabel.screenY - label.screenY) < 0.25
        );
    });
}

export function useProjectedViewerLabels({ labels, viewerRef }: UseProjectedViewerLabelsOptions) {
    const [projectedLabels, setProjectedLabels] = useState<ProjectedViewerLabel[]>([]);
    const labelsRef = useRef(labels);
    const requestUpdateRef = useRef(() => {});
    useEffect(() => {
        labelsRef.current = labels;
        requestUpdateRef.current();
    }, [labels]);

    useEffect(() => {
        let frameId = 0;
        let viewer: PotreeViewer | null = null;
        let resizeObserver: ResizeObserver | null = null;
        let groundElevation: number | null = null;

        const applyLabels = (nextLabels: ProjectedViewerLabel[], syncWithRender: boolean) => {
            const commit = () =>
                setProjectedLabels((current) =>
                    areLabelsEqual(current, nextLabels) ? current : nextLabels
                );
            if (syncWithRender) flushSync(commit);
            else commit();
        };

        const updateLabels = (syncWithRender = false) => {
            const activeViewer = viewerRef.current;
            if (!activeViewer || labelsRef.current.length === 0) {
                applyLabels([], syncWithRender);
                return;
            }

            groundElevation ??= getViewerGroundElevation(activeViewer);
            if (groundElevation === null) return;
            applyLabels(
                projectLabels(labelsRef.current, activeViewer, groundElevation),
                syncWithRender
            );
        };

        requestUpdateRef.current = () => updateLabels();
        const handleRenderPassEnd = () => updateLabels(true);
        const handleCameraChanged = () => updateLabels(true);

        const detach = () => {
            if (!viewer) return;
            viewer.removeEventListener('render.pass.end', handleRenderPassEnd);
            viewer.removeEventListener('camera_changed', handleCameraChanged);
            resizeObserver?.disconnect();
            resizeObserver = null;
            viewer = null;
            groundElevation = null;
        };

        const attach = (nextViewer: PotreeViewer | null) => {
            if (viewer === nextViewer) return;
            detach();
            viewer = nextViewer;
            if (!viewer) return;

            viewer.addEventListener('render.pass.end', handleRenderPassEnd);
            viewer.addEventListener('camera_changed', handleCameraChanged);
            resizeObserver = new ResizeObserver(() => updateLabels());
            resizeObserver.observe(viewer.renderer.domElement);
            updateLabels();
        };

        const syncViewer = () => {
            attach(viewerRef.current);
            if (groundElevation === null && labelsRef.current.length > 0) updateLabels();
            frameId = requestAnimationFrame(syncViewer);
        };
        syncViewer();

        return () => {
            cancelAnimationFrame(frameId);
            requestUpdateRef.current = () => {};
            detach();
        };
    }, [viewerRef]);

    return projectedLabels;
}
