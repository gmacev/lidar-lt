import { useState, useEffect, useRef, type RefObject } from 'react';
import type { PotreeViewer, Annotation } from '@/common/types/potree';
import {
    getAnnotationStorage,
    generateAnnotationId,
    type StoredAnnotation,
} from '../utils/annotationStorage';
import { useModal } from '@/common/hooks';
import { AnnotationModal, type AnnotationFormData } from '../components/AnnotationModal';

interface UseAnnotationsOptions {
    viewerRef: RefObject<PotreeViewer | null>;
    sectorId: string;
}

interface UseAnnotationsReturn {
    annotations: StoredAnnotation[];
    isPanelOpen: boolean;
    togglePanel: () => void;
    closePanel: () => void;
    isPlacing: boolean;
    startPlacement: () => void;
    cancelPlacement: () => void;
    toggleVisibility: (id: string) => void;
    toggleAllVisibility: () => void;
    navigateToAnnotation: (id: string) => void;
    deleteAnnotation: (id: string) => void;
    deleteAllAnnotations: () => void;
    allVisible: boolean;
    someVisible: boolean;
}

export function useAnnotations({
    viewerRef,
    sectorId,
}: UseAnnotationsOptions): UseAnnotationsReturn {
    const [annotations, setAnnotations] = useState<StoredAnnotation[]>(() => {
        return getAnnotationStorage(sectorId).get();
    });
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isPlacing, setIsPlacing] = useState(false);
    const potreeAnnotationsRef = useRef<Map<string, Annotation>>(new Map());
    const { openModal } = useModal();

    const storage = getAnnotationStorage(sectorId);

    // Reload annotations when sector changes
    useEffect(() => {
        setAnnotations(getAnnotationStorage(sectorId).get());
    }, [sectorId]);

    // Sync stored annotations to Potree scene
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer?.scene) return;

        const potreeAnnotations = potreeAnnotationsRef.current;

        // Clear existing Potree annotations
        potreeAnnotations.forEach((ann) => {
            try {
                viewer.scene.removeAnnotation(ann);
            } catch {
                // Ignore if annotation was already removed
            }
        });
        potreeAnnotations.clear();

        // Add stored annotations to scene
        annotations.forEach((stored) => {
            try {
                const ann = viewer.scene.addAnnotation(stored.position, {
                    title: stored.title,
                    description: stored.description,
                    cameraPosition: stored.cameraPosition,
                    cameraTarget: stored.cameraTarget,
                });

                ann.visible = stored.visible;
                potreeAnnotations.set(stored.id, ann);
            } catch {
                // Ignore if annotation couldn't be added
            }
        });

        // Cleanup on unmount
        return () => {
            potreeAnnotations.forEach((ann) => {
                try {
                    viewer.scene.removeAnnotation(ann);
                } catch {
                    // Ignore
                }
            });
            potreeAnnotations.clear();
        };
    }, [annotations, viewerRef]);

    const togglePanel = () => {
        setIsPanelOpen((prev) => !prev);
    };

    const closePanel = () => {
        setIsPanelOpen(false);
        setIsPlacing(false);
    };

    const startPlacement = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        setIsPlacing(true);

        // Handler for click - does the picking and opens modal
        const handleClick = (e: MouseEvent) => {
            const rect = viewer.renderer.domElement.getBoundingClientRect();
            const mouse = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };

            // Use Potree's Utils to get point cloud intersection
            const camera = viewer.scene.getActiveCamera();
            const intersection = window.Potree.Utils.getMousePointCloudIntersection(
                mouse,
                camera,
                viewer,
                viewer.scene.pointclouds,
                { pickClipped: true }
            );

            // Get position - either from pick or fallback to view pivot
            let position: [number, number, number];
            if (intersection?.location) {
                position = [
                    intersection.location.x,
                    intersection.location.y,
                    intersection.location.z,
                ];
            } else {
                // Fallback to view pivot if picking fails
                const pivot = viewer.scene.view.getPivot();
                position = [pivot.x, pivot.y, pivot.z];
            }

            // Save camera state for annotation navigation
            const cameraPosition = camera.position.clone();
            const cameraTarget = viewer.scene.view.getPivot();

            // Open modal for title/description
            void openModal<AnnotationFormData>({
                titleKey: 'annotation.newAnnotation',
                component: AnnotationModal,
            }).then((result) => {
                if (result) {
                    const newAnnotation: StoredAnnotation = {
                        id: generateAnnotationId(),
                        position,
                        title: result.title,
                        description: result.description,
                        cameraPosition: [cameraPosition.x, cameraPosition.y, cameraPosition.z],
                        cameraTarget: [cameraTarget.x, cameraTarget.y, cameraTarget.z],
                        visible: true,
                        createdAt: new Date().toISOString(),
                    };

                    storage.add(newAnnotation);
                    setAnnotations(storage.get());
                }

                setIsPlacing(false);
            });

            viewer.renderer.domElement.removeEventListener('click', handleClick);
        };

        viewer.renderer.domElement.addEventListener('click', handleClick, { once: true });
    };

    const cancelPlacement = () => {
        setIsPlacing(false);
    };

    const toggleVisibility = (id: string) => {
        storage.updateWhere(
            (ann) => ann.id === id,
            (ann) => ({ ...ann, visible: !ann.visible })
        );
        setAnnotations(storage.get());
    };

    const allVisible = annotations.length > 0 && annotations.every((a) => a.visible);
    const someVisible = annotations.some((a) => a.visible);

    const toggleAllVisibility = () => {
        const newVisible = !allVisible;
        annotations.forEach((ann) => {
            storage.updateWhere(
                (a) => a.id === ann.id,
                (a) => ({ ...a, visible: newVisible })
            );
        });
        setAnnotations(storage.get());
    };

    const navigateToAnnotation = (id: string) => {
        const viewer = viewerRef.current;
        const potreeAnn = potreeAnnotationsRef.current.get(id);

        if (viewer && potreeAnn) {
            potreeAnn.moveHere(viewer.scene.getActiveCamera());
        }
    };

    const deleteAnnotation = (id: string) => {
        const viewer = viewerRef.current;
        const potreeAnn = potreeAnnotationsRef.current.get(id);

        if (potreeAnn && viewer) {
            try {
                viewer.scene.removeAnnotation(potreeAnn);
            } catch {
                // Ignore
            }
            potreeAnnotationsRef.current.delete(id);
        }

        storage.removeWhere((ann) => ann.id === id);
        setAnnotations(storage.get());
    };

    const deleteAllAnnotations = () => {
        const viewer = viewerRef.current;

        potreeAnnotationsRef.current.forEach((ann) => {
            if (viewer) {
                try {
                    viewer.scene.removeAnnotation(ann);
                } catch {
                    // Ignore
                }
            }
        });
        potreeAnnotationsRef.current.clear();

        storage.set([]);
        setAnnotations([]);
    };

    return {
        annotations,
        isPanelOpen,
        togglePanel,
        closePanel,
        isPlacing,
        startPlacement,
        cancelPlacement,
        toggleVisibility,
        toggleAllVisibility,
        navigateToAnnotation,
        deleteAnnotation,
        deleteAllAnnotations,
        allVisible,
        someVisible,
    };
}
