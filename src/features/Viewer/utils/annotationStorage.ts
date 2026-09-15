import { z } from 'zod';
import { createArrayStorage } from '@/common/utils/storage';

/**
 * Schema for a stored annotation
 */
const storedAnnotationSchema = z.object({
    id: z.string(),
    position: z.tuple([z.number(), z.number(), z.number()]),
    title: z.string(),
    description: z.string(),
    cameraPosition: z.tuple([z.number(), z.number(), z.number()]).optional(),
    cameraTarget: z.tuple([z.number(), z.number(), z.number()]).optional(),
    visible: z.boolean().default(true),
    createdAt: z.string(),
});

export type StoredAnnotation = z.infer<typeof storedAnnotationSchema>;

export interface StoredSectorAnnotation {
    sectorId: string;
    annotation: StoredAnnotation;
}

export interface AnnotationMergeResult {
    importedCount: number;
    skippedCount: number;
}

export interface AnnotationCameraState {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    radius: number;
}

export interface AnnotationView {
    cameraPosition: [number, number, number];
    cameraTarget: [number, number, number];
}

const ANNOTATION_STORAGE_KEY_PREFIX = 'lidar:annotations:';
/**
 * Get the annotation storage for a specific sector.
 * Each sector has its own isolated annotation storage.
 */
export function getAnnotationStorage(sectorId: string) {
    return createArrayStorage({
        key: `annotations:${sectorId}`,
        schema: z.array(storedAnnotationSchema),
        itemSchema: storedAnnotationSchema,
        defaultValue: [],
    });
}

/**
 * Read every valid annotation collection stored by this application.
 * Results are newest-first so the grid shortcut prioritizes recent work.
 */
export function getAllStoredAnnotations(): StoredSectorAnnotation[] {
    if (typeof localStorage === 'undefined') return [];

    try {
        const annotations: StoredSectorAnnotation[] = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key?.startsWith(ANNOTATION_STORAGE_KEY_PREFIX)) continue;

            const sectorId = key.slice(ANNOTATION_STORAGE_KEY_PREFIX.length);
            if (!sectorId) continue;

            getAnnotationStorage(sectorId)
                .get()
                .forEach((annotation) => annotations.push({ sectorId, annotation }));
        }

        return annotations.sort((left, right) => {
            const leftTime = Date.parse(left.annotation.createdAt);
            const rightTime = Date.parse(right.annotation.createdAt);
            return (
                (Number.isFinite(rightTime) ? rightTime : 0) -
                (Number.isFinite(leftTime) ? leftTime : 0)
            );
        });
    } catch {
        return [];
    }
}

/**
 * Merge validated annotations into their sector stores without overwriting
 * existing records. Annotation IDs are unique within each sector.
 */
export function mergeStoredAnnotations(
    imported: readonly StoredSectorAnnotation[]
): AnnotationMergeResult {
    const annotationsBySector = new Map<string, StoredAnnotation[]>();
    imported.forEach(({ sectorId, annotation }) => {
        const sectorAnnotations = annotationsBySector.get(sectorId) ?? [];
        sectorAnnotations.push(annotation);
        annotationsBySector.set(sectorId, sectorAnnotations);
    });

    let importedCount = 0;
    let skippedCount = 0;

    annotationsBySector.forEach((sectorAnnotations, sectorId) => {
        const storage = getAnnotationStorage(sectorId);
        const existing = storage.get();
        const knownIds = new Set(existing.map(({ id }) => id));
        const additions = sectorAnnotations.filter(({ id }) => {
            if (knownIds.has(id)) {
                skippedCount += 1;
                return false;
            }
            knownIds.add(id);
            return true;
        });

        if (additions.length > 0) {
            storage.set([...existing, ...additions]);
            importedCount += additions.length;
        }
    });

    return { importedCount, skippedCount };
}

/**
 * Return the exact saved camera pose without inferring or repairing missing data.
 */
export function getAnnotationView(annotation: StoredAnnotation): AnnotationView | null {
    if (!annotation.cameraPosition || !annotation.cameraTarget) {
        return null;
    }

    return {
        cameraPosition: annotation.cameraPosition,
        cameraTarget: annotation.cameraTarget,
    };
}

export function getAnnotationCameraState(
    annotation: StoredAnnotation
): AnnotationCameraState | null {
    const annotationView = getAnnotationView(annotation);
    if (!annotationView) return null;

    const { cameraPosition, cameraTarget } = annotationView;
    const target = cameraTarget;
    const directionX = target[0] - cameraPosition[0];
    const directionY = target[1] - cameraPosition[1];
    const directionZ = target[2] - cameraPosition[2];
    const horizontalDistance = Math.hypot(directionX, directionY);
    const calculatedRadius = Math.hypot(horizontalDistance, directionZ);

    return {
        x: cameraPosition[0],
        y: cameraPosition[1],
        z: cameraPosition[2],
        yaw: horizontalDistance === 0 ? 0 : Math.atan2(directionY, directionX) - Math.PI / 2,
        pitch: Math.atan2(directionZ, horizontalDistance),
        radius: calculatedRadius,
    };
}

/**
 * Generate a unique ID for a new annotation
 */
export function generateAnnotationId(): string {
    return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
