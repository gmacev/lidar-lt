import { z } from 'zod';
import { createArrayStorage } from '@/common/utils/storage';

/**
 * Schema for a stored annotation
 */
export const storedAnnotationSchema = z.object({
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
 * Generate a unique ID for a new annotation
 */
export function generateAnnotationId(): string {
    return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
